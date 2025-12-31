# Froggie Frame - Raspberry Pi Application

A minimal Python application for displaying photos from Froggie Frame photo streams on a Raspberry Pi.

## Requirements

- Raspberry Pi 3B or newer (4 recommended)
- Raspberry Pi OS (Lite or Desktop)
- HDMI display or official Raspberry Pi touchscreen
- Network connection (WiFi or Ethernet)

## Installation

### Quick Install

```bash
cd pi-frame
chmod +x install.sh
./install.sh
```

### Manual Install

1. Install system dependencies:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-pygame python3-pil libsdl2-2.0-0
```

2. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

## Configuration

Configure your frame to connect to a specific photo stream:

```bash
python3 froggie-frame.py setup \
    --api-url https://your-froggie-frame.vercel.app \
    --stream-id YOUR_STREAM_UUID \
    --api-key YOUR_API_KEY
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-url` | URL of the Froggie Frame web app | Required |
| `--stream-id` | UUID of the photo stream | Required |
| `--api-key` | API key for authentication | Required |
| `--interval` | Slideshow interval in seconds | 30 |
| `--transition` | Transition effect (fade, cut) | fade |
| `--shuffle/--no-shuffle` | Shuffle photo order | true |

## Usage

### Commands

```bash
# Show current status and configuration
python3 froggie-frame.py status

# Sync photos from cloud
python3 froggie-frame.py sync

# Start the slideshow
python3 froggie-frame.py start

# Start without syncing first
python3 froggie-frame.py start --no-sync

# Test display output
python3 froggie-frame.py test-display

# Clear local photo cache
python3 froggie-frame.py clear-cache
```

### Keyboard Controls

During slideshow:
- `Right Arrow` / `Space`: Next photo
- `Left Arrow`: Previous photo
- `Escape` / `Q`: Quit slideshow

## Auto-start on Boot

To automatically start the photo frame when the Pi boots:

```bash
sudo cp froggie-frame.service /etc/systemd/system/
sudo systemctl enable froggie-frame
sudo systemctl start froggie-frame
```

To check status:
```bash
sudo systemctl status froggie-frame
```

To view logs:
```bash
journalctl -u froggie-frame -f
```

## Configuration File

Configuration is stored in `~/.froggie-frame/config.json`:

```json
{
  "api_url": "https://your-app.vercel.app",
  "stream_id": "uuid-of-stream",
  "api_key": "your-api-key",
  "slideshow_interval": 30,
  "transition_effect": "fade",
  "shuffle": true,
  "cache_dir": "~/.froggie-frame/cache",
  "max_cache_size_mb": 500
}
```

## Photo Cache

Photos are cached locally to minimize network usage and allow offline operation. The cache is stored in `~/.froggie-frame/cache/` by default.

- Default max cache size: 500 MB
- Old photos are automatically removed when cache exceeds limit
- Use `clear-cache` command to manually clear

## Troubleshooting

### Display not working

1. Ensure you're running with proper display access:
```bash
export DISPLAY=:0
```

2. For headless Pi, use the framebuffer driver:
```bash
export SDL_VIDEODRIVER=kmsdrm
```

### Permission denied errors

Ensure your user has access to video group:
```bash
sudo usermod -a -G video $USER
```

### Network issues

Test connectivity to your API:
```bash
curl -H "X-API-Key: YOUR_KEY" https://your-app.vercel.app/api/device/photos
```

## License

Apache License 2.0 - See LICENSE file in the root directory.
