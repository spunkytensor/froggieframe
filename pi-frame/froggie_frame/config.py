"""Configuration management for Froggie Frame."""

import json
import os
from pathlib import Path
from typing import Optional

DEFAULT_CONFIG = {
    "api_url": "",
    "device_token": "",
    "slideshow_interval": 30,
    "transition_effect": "fade",
    "shuffle": True,
    "cache_dir": "~/.froggie-frame/cache",
    "max_cache_size_mb": 500,
    "mood_filter": [],  # e.g., ["vibrant", "relaxing"] - empty means no filter
}


class Config:
    """Manages Froggie Frame configuration."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(
            config_path or os.path.expanduser("~/.froggie-frame/config.json")
        )
        self.config = DEFAULT_CONFIG.copy()
        self._load()

    def _load(self) -> None:
        """Load configuration from file."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    saved_config = json.load(f)
                    self.config.update(saved_config)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load config: {e}")

    def save(self) -> None:
        """Save configuration to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            json.dump(self.config, f, indent=2)

    def get(self, key: str, default=None):
        """Get a configuration value."""
        return self.config.get(key, default)

    def set(self, key: str, value) -> None:
        """Set a configuration value."""
        self.config[key] = value

    def is_configured(self) -> bool:
        """Check if the frame is properly configured."""
        return bool(self.config.get("api_url") and self.config.get("device_token"))

    @property
    def api_url(self) -> str:
        return self.config.get("api_url", "")

    @property
    def device_token(self) -> str:
        return self.config.get("device_token", "")

    @property
    def slideshow_interval(self) -> int:
        return self.config.get("slideshow_interval", 30)

    @property
    def transition_effect(self) -> str:
        return self.config.get("transition_effect", "fade")

    @property
    def shuffle(self) -> bool:
        return self.config.get("shuffle", True)

    @property
    def cache_dir(self) -> Path:
        return Path(os.path.expanduser(self.config.get("cache_dir", "~/.froggie-frame/cache")))

    @property
    def max_cache_size_mb(self) -> int:
        return self.config.get("max_cache_size_mb", 500)

    @property
    def mood_filter(self) -> list:
        return self.config.get("mood_filter", [])
