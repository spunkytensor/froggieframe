"""Photo synchronization service for Froggie Frame."""

import os
import requests
from pathlib import Path
from typing import List, Dict, Optional
from urllib.parse import urljoin

from .config import Config
from .cache import PhotoCache


class SyncService:
    """Handles photo synchronization with the cloud API."""

    def __init__(self, config: Config, cache: PhotoCache):
        self.config = config
        self.cache = cache
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": config.api_key,
            "User-Agent": "FroggieFrame/1.0",
        })

    def _api_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make an authenticated API request."""
        url = urljoin(self.config.api_url, endpoint)
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def fetch_photo_list(self) -> List[Dict]:
        """Fetch the list of photos for the configured stream."""
        try:
            response = self._api_request(
                "GET",
                f"/api/device/photos?stream_id={self.config.stream_id}"
            )
            data = response.json()
            return data.get("photos", [])
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

        # Check if already cached
        cached_path = self.cache.get_cached_path(photo_id, storage_path)
        if cached_path:
            return cached_path

        # Download the photo
        try:
            response = self.session.get(download_url, stream=True)
            response.raise_for_status()

            # Determine file extension
            content_type = response.headers.get("content-type", "image/jpeg")
            ext_map = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/webp": ".webp",
                "image/gif": ".gif",
            }
            extension = ext_map.get(content_type, ".jpg")

            # Cache the photo
            data = response.content
            local_path = self.cache.cache_photo(photo_id, storage_path, data, extension)
            return local_path

        except requests.RequestException as e:
            print(f"Error downloading photo {photo_id}: {e}")
            return None

    def sync_photos(self, progress_callback=None) -> List[Path]:
        """Sync all photos from the stream."""
        photos = self.fetch_photo_list()
        local_paths = []

        total = len(photos)
        for i, photo in enumerate(photos):
            if progress_callback:
                progress_callback(i + 1, total, photo.get("filename", ""))

            local_path = self.download_photo(photo)
            if local_path:
                local_paths.append(local_path)

        # Report sync status
        self._report_sync_status(len(local_paths), total)

        return local_paths

    def _report_sync_status(self, synced: int, total: int) -> None:
        """Report sync status to the server."""
        try:
            self._api_request(
                "POST",
                "/api/device/sync",
                json={
                    "stream_id": self.config.stream_id,
                    "synced_count": synced,
                    "total_count": total,
                    "cache_size_mb": self.cache.get_cache_size_mb(),
                }
            )
        except requests.RequestException:
            # Non-critical, just log
            pass

    def check_for_updates(self) -> bool:
        """Check if there are new photos to sync."""
        try:
            response = self._api_request(
                "GET",
                f"/api/device/photos?stream_id={self.config.stream_id}&count_only=true"
            )
            data = response.json()
            server_count = data.get("count", 0)
            local_count = len(self.cache.get_cached_photos())
            return server_count != local_count
        except requests.RequestException:
            return False
