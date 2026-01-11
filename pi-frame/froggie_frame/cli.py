"""Command-line interface for Froggie Frame."""

import platform
import sys
import time

import click

from .config import Config
from .cache import PhotoCache
from .sync import SyncService

def _should_use_framebuffer() -> bool:
    """Determine if we should use framebuffer (Pi in kiosk mode) or pygame."""
    if platform.system() != "Linux":
        return False

    # Check if we're on a Raspberry Pi
    try:
        with open("/proc/device-tree/model", "r") as f:
            if "Raspberry Pi" not in f.read():
                return False
    except (FileNotFoundError, IOError):
        return False

    # Check if we have a display server (X11/Wayland) - if so, use pygame
    import os
    if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
        return False

    # Check if framebuffer is accessible
    try:
        with open("/dev/fb0", "rb"):
            pass
        return True
    except (FileNotFoundError, IOError, PermissionError):
        return False

# Use framebuffer on Raspberry Pi in kiosk mode, pygame otherwise
if _should_use_framebuffer():
    from .display_fb import DisplayEngine
else:
    from .display import DisplayEngine


@click.command()
@click.option("--api-url", default=None, help="URL of the Froggie Frame web app")
@click.option("--device-token", default=None, help="Device token for frame authentication")
@click.option("--interval", default=None, type=int, help="Slideshow interval in seconds (default: 30)")
@click.option("--transition", default=None, type=click.Choice(["fade", "cut"]), help="Transition effect")
@click.option("--shuffle/--no-shuffle", default=None, help="Shuffle photos (default: true)")
@click.option("--max-cache-mb", default=None, type=int, help="Maximum cache size in MB (default: 500)")
@click.option("--windowed", is_flag=True, default=False, help="Run in windowed mode for development")
def cli(api_url, device_token, interval, transition, shuffle, max_cache_mb, windowed):
    """Froggie Frame - Raspberry Pi Photo Frame Application

    Starts the photo frame slideshow with automatic sync and live updates.

    Configuration is loaded from ~/.froggie-frame/config.json by default.
    Command-line options override the config file values.
    """
    # Load existing config (from ~/.froggie-frame/config.json)
    config = Config()

    # Override with command-line options if provided
    if api_url:
        config.set("api_url", api_url.rstrip("/"))
    if device_token:
        config.set("device_token", device_token)
    if interval is not None:
        config.set("slideshow_interval", interval)
    if transition:
        config.set("transition_effect", transition)
    if shuffle is not None:
        config.set("shuffle", shuffle)
    if max_cache_mb is not None:
        config.set("max_cache_size_mb", max_cache_mb)

    # Validate required configuration
    if not config.is_configured():
        click.echo("Error: Missing required configuration.", err=True)
        click.echo("", err=True)
        click.echo("Provide --api-url and --device-token options,", err=True)
        click.echo("or create a config file at ~/.froggie-frame/config.json with:", err=True)
        click.echo('  {', err=True)
        click.echo('    "api_url": "https://your-app.vercel.app",', err=True)
        click.echo('    "device_token": "YOUR_DEVICE_TOKEN"', err=True)
        click.echo('  }', err=True)
        sys.exit(1)

    # Save merged config
    config.save()

    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)
    sync_service = SyncService(config, cache)

    # Fetch settings from server
    click.echo("Fetching frame settings from server...")
    frame_config = sync_service.fetch_frame_config()
    if frame_config and "frame" in frame_config:
        fc = frame_config["frame"]
        if interval is None and "slideshow_interval" in fc:
            config.set("slideshow_interval", fc["slideshow_interval"])
        if transition is None and "transition_effect" in fc:
            config.set("transition_effect", fc["transition_effect"])
        if shuffle is None and "shuffle" in fc:
            config.set("shuffle", fc["shuffle"])
        click.echo(f"Frame: {fc.get('name', 'Unknown')}")

    display = DisplayEngine(
        slideshow_interval=config.slideshow_interval,
        transition_effect=config.transition_effect,
        shuffle=config.shuffle,
        windowed=windowed,
    )

    # Initialize display first so we can show content immediately
    click.echo("Starting slideshow...")
    if not display.initialize():
        click.echo("Failed to initialize display.")
        sys.exit(1)

    # Fetch photo list to know which photos belong to this stream
    click.echo("Fetching photo list...")
    photo_list = sync_service.fetch_photo_list()
    stream_photo_ids = {p.get("id") for p in photo_list if p.get("id")}

    # Get cached photos that belong to this stream
    cached_photos = cache.get_cached_photos_for_ids(stream_photo_ids)
    if cached_photos:
        click.echo(f"Starting with {len(cached_photos)} cached photos")
        display.set_photos(cached_photos)
    else:
        click.echo("No cached photos for this stream, syncing in background...")

    # Callback for incremental updates as photos download
    def on_photos_updated(new_photos):
        click.echo(f"Photos: {len(new_photos)} available")
        display.update_photos(new_photos)

    # Start background sync (updates display as each photo downloads)
    sync_service.start_background_sync(on_photos_updated)

    try:
        display.run_slideshow()
    except KeyboardInterrupt:
        pass
    finally:
        sync_service.unsubscribe()
        display.shutdown()
        click.echo("Slideshow stopped.")


def main():
    """Main entry point."""
    cli()


if __name__ == "__main__":
    main()
