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
@click.option("--stream-id", default=None, help="UUID of the photo stream to display")
@click.option("--api-key", default=None, help="API key for authentication")
@click.option("--interval", default=None, type=int, help="Slideshow interval in seconds (default: 30)")
@click.option("--transition", default=None, type=click.Choice(["fade", "cut"]), help="Transition effect")
@click.option("--shuffle/--no-shuffle", default=None, help="Shuffle photos (default: true)")
@click.option("--supabase-url", default=None, help="Supabase project URL for realtime updates")
@click.option("--supabase-anon-key", default=None, help="Supabase anon key for realtime updates")
@click.option("--max-cache-mb", default=None, type=int, help="Maximum cache size in MB (default: 500)")
@click.option("--windowed", is_flag=True, default=False, help="Run in windowed mode for development")
def cli(api_url, stream_id, api_key, interval, transition, shuffle, supabase_url, supabase_anon_key, max_cache_mb, windowed):
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
    if stream_id:
        config.set("stream_id", stream_id)
    if api_key:
        config.set("api_key", api_key)
    if interval is not None:
        config.set("slideshow_interval", interval)
    if transition:
        config.set("transition_effect", transition)
    if shuffle is not None:
        config.set("shuffle", shuffle)
    if max_cache_mb is not None:
        config.set("max_cache_size_mb", max_cache_mb)
    if supabase_url:
        config.set("supabase_url", supabase_url)
    if supabase_anon_key:
        config.set("supabase_anon_key", supabase_anon_key)

    # Validate required configuration
    if not config.is_configured():
        click.echo("Error: Missing required configuration.", err=True)
        click.echo("", err=True)
        click.echo("Either provide --api-url, --stream-id, and --api-key options,", err=True)
        click.echo("or create a config file at ~/.froggie-frame/config.json with:", err=True)
        click.echo('  {', err=True)
        click.echo('    "api_url": "https://your-app.vercel.app",', err=True)
        click.echo('    "stream_id": "YOUR_STREAM_UUID",', err=True)
        click.echo('    "api_key": "YOUR_API_KEY"', err=True)
        click.echo('  }', err=True)
        sys.exit(1)

    # Save merged config
    config.save()

    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)
    sync_service = SyncService(config, cache)
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
