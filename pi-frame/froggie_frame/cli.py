"""Command-line interface for Froggie Frame."""

import sys
import click

from .config import Config
from .cache import PhotoCache
from .sync import SyncService
from .display import DisplayEngine


@click.group()
@click.pass_context
def cli(ctx):
    """Froggie Frame - Raspberry Pi Photo Frame Application"""
    ctx.ensure_object(dict)
    ctx.obj["config"] = Config()


@cli.command()
@click.option("--api-url", required=True, help="URL of the Froggie Frame web app")
@click.option("--stream-id", required=True, help="UUID of the photo stream to display")
@click.option("--api-key", required=True, help="API key for authentication")
@click.option("--interval", default=30, help="Slideshow interval in seconds (default: 30)")
@click.option("--transition", default="fade", type=click.Choice(["fade", "cut"]), help="Transition effect")
@click.option("--shuffle/--no-shuffle", default=True, help="Shuffle photos (default: true)")
@click.pass_context
def setup(ctx, api_url, stream_id, api_key, interval, transition, shuffle):
    """Configure the photo frame with a stream."""
    config = ctx.obj["config"]

    # Normalize API URL
    api_url = api_url.rstrip("/")

    config.set("api_url", api_url)
    config.set("stream_id", stream_id)
    config.set("api_key", api_key)
    config.set("slideshow_interval", interval)
    config.set("transition_effect", transition)
    config.set("shuffle", shuffle)

    config.save()

    click.echo(f"Configuration saved to {config.config_path}")
    click.echo(f"  API URL: {api_url}")
    click.echo(f"  Stream ID: {stream_id}")
    click.echo(f"  Slideshow interval: {interval}s")
    click.echo(f"  Transition: {transition}")
    click.echo(f"  Shuffle: {shuffle}")
    click.echo()
    click.echo("Run 'froggie-frame sync' to download photos.")
    click.echo("Run 'froggie-frame start' to begin the slideshow.")


@cli.command()
@click.pass_context
def status(ctx):
    """Show current configuration and status."""
    config = ctx.obj["config"]

    if not config.is_configured():
        click.echo("Froggie Frame is not configured.")
        click.echo("Run 'froggie-frame setup' to configure.")
        return

    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)

    click.echo("Froggie Frame Status")
    click.echo("=" * 40)
    click.echo(f"API URL: {config.api_url}")
    click.echo(f"Stream ID: {config.stream_id}")
    click.echo(f"Slideshow interval: {config.slideshow_interval}s")
    click.echo(f"Transition: {config.transition_effect}")
    click.echo(f"Shuffle: {config.shuffle}")
    click.echo()
    click.echo(f"Cached photos: {len(cache.get_cached_photos())}")
    click.echo(f"Cache size: {cache.get_cache_size_mb():.2f} MB / {config.max_cache_size_mb} MB")


@cli.command()
@click.pass_context
def sync(ctx):
    """Sync photos from the cloud."""
    config = ctx.obj["config"]

    if not config.is_configured():
        click.echo("Error: Froggie Frame is not configured.")
        click.echo("Run 'froggie-frame setup' first.")
        sys.exit(1)

    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)
    sync_service = SyncService(config, cache)

    click.echo("Syncing photos...")

    def progress(current, total, filename):
        click.echo(f"  [{current}/{total}] {filename}")

    photos = sync_service.sync_photos(progress_callback=progress)

    click.echo(f"\nSynced {len(photos)} photos.")
    click.echo(f"Cache size: {cache.get_cache_size_mb():.2f} MB")


@cli.command()
@click.option("--no-sync", is_flag=True, help="Skip initial sync")
@click.pass_context
def start(ctx, no_sync):
    """Start the photo frame slideshow."""
    config = ctx.obj["config"]

    if not config.is_configured():
        click.echo("Error: Froggie Frame is not configured.")
        click.echo("Run 'froggie-frame setup' first.")
        sys.exit(1)

    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)
    sync_service = SyncService(config, cache)
    display = DisplayEngine(
        slideshow_interval=config.slideshow_interval,
        transition_effect=config.transition_effect,
        shuffle=config.shuffle,
    )

    # Initial sync unless disabled
    if not no_sync:
        click.echo("Syncing photos...")
        photos = sync_service.sync_photos()
        click.echo(f"Synced {len(photos)} photos.")
    else:
        photos = cache.get_cached_photos()

    if not photos:
        click.echo("No photos available. Run 'froggie-frame sync' first.")
        sys.exit(1)

    # Initialize display
    click.echo("Starting slideshow...")
    if not display.initialize():
        click.echo("Failed to initialize display.")
        sys.exit(1)

    display.set_photos(photos)

    # Define sync callback for periodic updates
    def on_sync_check():
        if sync_service.check_for_updates():
            new_photos = sync_service.sync_photos()
            if new_photos:
                display.set_photos(new_photos)

    try:
        display.run_slideshow(sync_callback=on_sync_check)
    except KeyboardInterrupt:
        pass
    finally:
        display.shutdown()
        click.echo("Slideshow stopped.")


@cli.command()
@click.pass_context
def clear_cache(ctx):
    """Clear the photo cache."""
    config = ctx.obj["config"]
    cache = PhotoCache(config.cache_dir, config.max_cache_size_mb)

    size_before = cache.get_cache_size_mb()
    cache.clear()

    click.echo(f"Cleared {size_before:.2f} MB from cache.")


@cli.command()
@click.pass_context
def test_display(ctx):
    """Test the display output."""
    display = DisplayEngine()

    if not display.initialize():
        click.echo("Failed to initialize display.")
        sys.exit(1)

    display.show_message("Froggie Frame Test", font_size=72)

    click.echo("Display test running. Press Ctrl+C to exit.")

    try:
        import time
        while True:
            if not display.handle_events():
                break
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        display.shutdown()


def main():
    """Main entry point."""
    cli(obj={})


if __name__ == "__main__":
    main()
