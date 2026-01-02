"""Local cache management for downloaded photos."""

import hashlib
import os
import shutil
from pathlib import Path
from typing import Optional, List
import json


class PhotoCache:
    """Manages local photo cache."""

    def __init__(self, cache_dir: Path, max_size_mb: int = 500):
        self.cache_dir = cache_dir
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.metadata_file = cache_dir / "metadata.json"
        self._ensure_cache_dir()
        self.metadata = self._load_metadata()

    def _ensure_cache_dir(self) -> None:
        """Create cache directory if it doesn't exist."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _load_metadata(self) -> dict:
        """Load cache metadata."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {"photos": {}, "total_size": 0}

    def _save_metadata(self) -> None:
        """Save cache metadata."""
        with open(self.metadata_file, "w") as f:
            json.dump(self.metadata, f)

    def _get_cache_key(self, photo_id: str, storage_path: str) -> str:
        """Generate a unique cache key for a photo."""
        return hashlib.sha256(f"{photo_id}:{storage_path}".encode()).hexdigest()[:16]

    def get_cached_path(self, photo_id: str, storage_path: str) -> Optional[Path]:
        """Get the local path for a cached photo, if it exists."""
        cache_key = self._get_cache_key(photo_id, storage_path)
        if cache_key in self.metadata["photos"]:
            cached_path = self.cache_dir / self.metadata["photos"][cache_key]["filename"]
            if cached_path.exists():
                return cached_path
        return None

    def is_cached(self, photo_id: str, storage_path: str) -> bool:
        """Check if a photo is cached."""
        return self.get_cached_path(photo_id, storage_path) is not None

    def cache_photo(self, photo_id: str, storage_path: str, data: bytes, extension: str = ".jpg") -> Path:
        """Cache a photo and return the local path."""
        cache_key = self._get_cache_key(photo_id, storage_path)
        filename = f"{cache_key}{extension}"
        local_path = self.cache_dir / filename

        # Write the file
        with open(local_path, "wb") as f:
            f.write(data)

        file_size = len(data)

        # Update metadata
        self.metadata["photos"][cache_key] = {
            "photo_id": photo_id,
            "storage_path": storage_path,
            "filename": filename,
            "size": file_size,
        }
        self.metadata["total_size"] = self.metadata.get("total_size", 0) + file_size
        self._save_metadata()

        # Clean up if over size limit
        self._cleanup_if_needed()

        return local_path

    def _cleanup_if_needed(self) -> None:
        """Remove old cached photos if cache exceeds size limit."""
        if self.metadata["total_size"] <= self.max_size_bytes:
            return

        # Sort by file modification time (oldest first)
        # Use list() to create a copy, avoiding issues if dict is modified during iteration
        photos_by_age = []
        for cache_key, info in list(self.metadata["photos"].items()):
            file_path = self.cache_dir / info["filename"]
            if file_path.exists():
                mtime = file_path.stat().st_mtime
                photos_by_age.append((cache_key, mtime, info["size"]))

        photos_by_age.sort(key=lambda x: x[1])

        # Remove oldest photos until under limit
        for cache_key, _, size in photos_by_age:
            if self.metadata["total_size"] <= self.max_size_bytes * 0.8:
                break

            info = self.metadata["photos"].get(cache_key)
            if info:
                file_path = self.cache_dir / info["filename"]
                if file_path.exists():
                    file_path.unlink()
                del self.metadata["photos"][cache_key]
                self.metadata["total_size"] -= size

        self._save_metadata()

    def get_cached_photos(self) -> List[Path]:
        """Get list of all cached photo paths."""
        paths = []
        for cache_key, info in self.metadata["photos"].items():
            file_path = self.cache_dir / info["filename"]
            if file_path.exists():
                paths.append(file_path)
        return paths

    def clear(self) -> None:
        """Clear all cached photos."""
        for cache_key, info in list(self.metadata["photos"].items()):
            file_path = self.cache_dir / info["filename"]
            if file_path.exists():
                file_path.unlink()

        self.metadata = {"photos": {}, "total_size": 0}
        self._save_metadata()

    def get_cache_size_mb(self) -> float:
        """Get current cache size in MB."""
        return self.metadata.get("total_size", 0) / (1024 * 1024)

    def remove_photos_by_id(self, photo_ids: set) -> int:
        """Remove cached photos by their photo IDs. Returns count of removed photos."""
        removed = 0
        for cache_key, info in list(self.metadata["photos"].items()):
            if info.get("photo_id") in photo_ids:
                file_path = self.cache_dir / info["filename"]
                if file_path.exists():
                    file_path.unlink()
                self.metadata["total_size"] -= info.get("size", 0)
                del self.metadata["photos"][cache_key]
                removed += 1

        if removed > 0:
            self._save_metadata()

        return removed

    def get_photo_ids(self) -> set:
        """Get set of all cached photo IDs."""
        return {info.get("photo_id") for info in self.metadata["photos"].values() if info.get("photo_id")}
