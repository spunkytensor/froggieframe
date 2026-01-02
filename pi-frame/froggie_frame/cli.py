"""Command-line interface for Froggie Frame."""

import sys
import click

from .config import Config
from .cache import PhotoCache
from .sync import SyncService
from .display import DisplayEngine


@click.command()
@click.option("--api-url", required=True, help="URL of the Froggie Frame web app")
@click.option("--stream-id", required=True, help="UUID of the photo stream to display")
@click.option("--api-key", required=True, help="API key for authentication")
@click.option("--interval", default=30, help="Slideshow interval in seconds (default: 30)")
@click.option("--transition", default="fade", type=click.Choice(["fade", "cut"]), help="Transition effect")
@click.option("--shuffle/--no-shuffle", default=True, help="Shuffle photos (default: true)")
@click.option("--supabase-url", default=None, help="Supabase project URL for realtime updates")
@click.option("--supabase-anon-key", default=None, help="Supabase anon key for realtime updates")
@click.option("--max-cache-mb", default=500, help="Maximum cache size in MB (default: 500)")
@click.option("--windowed", is_flag=True, default=False, help="Run in windowed mode for development")
def cli(api_url, stream_id, api_key, interval, transition, shuffle, supabase_url, supabase_anon_key, max_cache_mb, windowed):
    """Froggie Frame - Raspberry Pi Photo Frame Application
    
    Starts the photo frame slideshow with automatic sync and live updates.
    """
    config = Config()

    api_url = api_url.rstrip("/")

    config.set("api_url", api_url)
    config.set("stream_id", stream_id)
    config.set("api_key", api_key)
    config.set("slideshow_interval", interval)
    config.set("transition_effect", transition)
    config.set("shuffle", shuffle)
    config.set("max_cache_size_mb", max_cache_mb)

    if supabase_url:
        config.set("supabase_url", supabase_url)
    if supabase_anon_key:
        config.set("supabase_anon_key", supabase_anon_key)

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
