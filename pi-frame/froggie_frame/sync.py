"""Photo synchronization service for Froggie Frame."""

import threading
import time
import requests
from pathlib import Path
from typing import List, Dict, Optional, Callable, Set
from urllib.parse import urljoin

from .config import Config
from .cache import PhotoCache


class SyncService:
    """Handles photo synchronization with the Froggie Frame server."""

    def __init__(self, config: Config, cache: PhotoCache):
        self.config = config
        self.cache = cache
        self.session = requests.Session()
        self.session.headers.update({
            "X-Device-Token": config.device_token,
            "User-Agent": "FroggieFrame/1.0",
        })
        self._on_update_callback: Optional[Callable[[List[Path]], None]] = None
        self._running = False
        self._poll_thread: Optional[threading.Thread] = None
        self._current_photo_ids: Set[str] = set()
        self._photo_ids_lock = threading.Lock()

    def _api_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make an authenticated API request."""
        url = urljoin(self.config.api_url, endpoint)
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def fetch_photo_list(self) -> List[Dict]:
        """Fetch the list of photos for the configured frame."""
        try:
            response = self._api_request("GET", "/api/device/frame/photos")
            data = response.json()
            photos = data.get("photos", [])
            
            mood_filter = self.config.mood_filter
            if mood_filter:
                photos = [
                    p for p in photos 
                    if p.get("mood") in mood_filter or p.get("ai_status") != "complete"
                ]
            
            return photos
        except requests.RequestException as e:
            print(f"Error fetching photo list: {e}")
            return []

    def download_photo(self, photo: Dict) -> Optional[Path]:
        """Download a single photo and cache it."""
        photo_id = photo.get("id")
        storage_path = photo.get("storage_path")
        download_url = photo.get("download_url")

        if not all([photo_id, storage_path, download_url]):
            print(f"Invalid photo data: {photo}")
            return None

        cached_path = self.cache.get_cached_path(photo_id, storage_path)
        if cached_path:
            return cached_path

        try:
            response = self.session.get(download_url, stream=True)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "image/jpeg")
            ext_map = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }
            extension = ext_map.get(content_type, ".jpg")

            data = response.content
            local_path = self.cache.cache_photo(photo_id, storage_path, data, extension)
            return local_path

        except requests.RequestException as e:
            print(f"Error downloading photo {photo_id}: {e}")
            return None

    def sync_photos(self, progress_callback=None) -> List[Path]:
        """Sync all photos from the stream, pruning removed ones."""
        photos = self.fetch_photo_list()
        local_paths = []

        new_photo_ids: Set[str] = set()

        total = len(photos)
        for i, photo in enumerate(photos):
            if progress_callback:
                progress_callback(i + 1, total, photo.get("filename", ""))

            photo_id = photo.get("id")
            if photo_id:
                new_photo_ids.add(photo_id)

            local_path = self.download_photo(photo)
            if local_path:
                local_paths.append(local_path)

        with self._photo_ids_lock:
            removed_ids = self._current_photo_ids - new_photo_ids
            if removed_ids:
                self.cache.remove_photos_by_id(removed_ids)
            self._current_photo_ids = new_photo_ids

        self._report_sync_status(len(local_paths), total)

        return local_paths

    def _report_sync_status(self, synced: int, total: int) -> None:
        """Report sync status to the server."""
        try:
            self._api_request(
                "POST",
                "/api/device/sync",
                json={
                    "synced_count": synced,
                    "total_count": total,
                    "cache_size_mb": self.cache.get_cache_size_mb(),
                }
            )
        except requests.RequestException:
            pass

    def subscribe(self, on_update: Callable[[List[Path]], None]) -> bool:
        """Subscribe to photo changes via polling."""
        self._on_update_callback = on_update
        self._running = True
        print("Using polling for updates")
        self._start_polling()
        return True

    def _start_polling(self) -> None:
        """Start a background thread that polls for updates."""
        def poll_loop():
            poll_interval = 60
            last_count = len(self.cache.get_cached_photos())

            while self._running:
                time.sleep(poll_interval)
                if not self._running:
                    break

                try:
                    if self._check_for_updates(last_count):
                        photos = self.sync_photos()
                        last_count = len(photos)
                        if self._on_update_callback:
                            self._on_update_callback(photos)
                except Exception as e:
                    print(f"Polling error: {e}")

        self._poll_thread = threading.Thread(target=poll_loop, daemon=True)
        self._poll_thread.start()

    def _check_for_updates(self, local_count: int) -> bool:
        """Check if there are changes to sync."""
        try:
            response = self._api_request(
                "GET",
                "/api/device/frame/photos?count_only=true"
            )
            data = response.json()
            server_count = data.get("count", 0)
            return server_count != local_count
        except requests.RequestException:
            return False

    def fetch_frame_config(self) -> Optional[Dict]:
        """Fetch frame configuration from server."""
        try:
            response = self._api_request("GET", "/api/device/frame")
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching frame config: {e}")
            return None

    def unsubscribe(self) -> None:
        """Stop listening for updates."""
        self._running = False

    def check_for_updates(self) -> bool:
        """Check if there are new photos to sync."""
        local_count = len(self.cache.get_cached_photos())
        return self._check_for_updates(local_count)

    def start_background_sync(
        self,
        on_progress: Callable[[List[Path]], None],
        on_complete: Optional[Callable[[List[Path]], None]] = None
    ) -> None:
        """Start syncing photos in background, updating display incrementally.

        Args:
            on_progress: Called after each photo downloads with current list
            on_complete: Called when initial sync finishes
        """
        def sync_worker():
            photos = self.fetch_photo_list()
            local_paths = []
            new_photo_ids: Set[str] = set()

            for photo in photos:
                photo_id = photo.get("id")
                if photo_id:
                    new_photo_ids.add(photo_id)

                path = self.download_photo(photo)
                if path:
                    local_paths.append(path)
                    # Update display after each new download
                    on_progress(local_paths.copy())

            # Prune removed photos
            with self._photo_ids_lock:
                removed_ids = self._current_photo_ids - new_photo_ids
                if removed_ids:
                    self.cache.remove_photos_by_id(removed_ids)
                self._current_photo_ids = new_photo_ids

            self._report_sync_status(len(local_paths), len(photos))

            if on_complete:
                on_complete(local_paths)

            # Subscribe to realtime updates for future changes
            self.subscribe(on_progress)

        thread = threading.Thread(target=sync_worker, daemon=True)
        thread.start()
