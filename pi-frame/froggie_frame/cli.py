"""Command-line interface for Froggie Frame."""

import platform
import sys
import click

from .config import Config
from .cache import PhotoCache
from .sync import SyncService

# Use framebuffer display on Linux (Raspberry Pi), pygame on other platforms
if platform.system() == "Linux":
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
def cli(api_url, stream_id, api_key, interval, transition, shuffle, supabase_url, supabase_anon_key, max_cache_mb):
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
    )

    # Initialize display and show splash image while syncing
    click.echo("Starting slideshow...")
    if not display.initialize():
        click.echo("Failed to initialize display.")
        sys.exit(1)

    # Show splash image during sync (if available)
    import time
    splash_start = time.time()
    display.show_splash()

    click.echo("Syncing photos...")
    photos = sync_service.sync_photos()
    click.echo(f"Synced {len(photos)} photos.")

    # Ensure splash is shown for at least 5 seconds
    splash_elapsed = time.time() - splash_start
    if splash_elapsed < 5.0:
        time.sleep(5.0 - splash_elapsed)

    if not photos:
        click.echo("No photos available. Please add photos to the stream via the web app.")
        sys.exit(1)

    display.set_photos(photos)

    def on_photos_updated(new_photos):
        click.echo(f"Photos updated: {len(new_photos)} photos")
        display.update_photos(new_photos)

    sync_service.subscribe(on_photos_updated)

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
