# Froggie Frame - Raspberry Pi Application

A minimal Python application for displaying photos from Froggie Frame photo streams on a Raspberry Pi.

## Requirements

- Raspberry Pi 3B or newer (4 recommended), or macOS/Linux desktop for development
- Raspberry Pi OS (Lite or Desktop) for Pi deployment
- HDMI display or official Raspberry Pi touchscreen
- Network connection (WiFi or Ethernet)

## Installation

### Option 1: Conda Environment (Recommended for macOS/Development)

This method uses Miniforge3 to create an isolated Python environment, which is especially useful for macOS or when you want to avoid conflicts with system Python.

#### Install Miniforge3

**macOS (Apple Silicon or Intel):**
```bash
# Download and install Miniforge3
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh"
bash Miniforge3-$(uname)-$(uname -m).sh
```

**Linux/Raspberry Pi:**
```bash
# For ARM64 (Raspberry Pi 4, Pi 5)
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-aarch64.sh"
bash Miniforge3-Linux-aarch64.sh

# For x86_64 Linux
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh"
bash Miniforge3-Linux-x86_64.sh
```

Follow the prompts, then restart your terminal or run:
```bash
source ~/.bashrc  # or ~/.zshrc on macOS
```

#### Create and Activate Environment

```bash
# Create a new environment named 'froggie' with Python 3.12
conda create -n froggie python=3.12

# Activate the environment
conda activate froggie

# Install dependencies
cd pi-frame
pip install -r requirements.txt
```

#### Running with Conda

Always activate the environment before running:
```bash
conda activate froggie
python froggie-frame.py start
```

### Option 2: Quick Install (Raspberry Pi)

```bash
cd pi-frame
chmod +x install.sh
./install.sh
```

### Option 3: Manual Install (System Python)

1. Install system dependencies:
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-pygame python3-pil libsdl2-2.0-0
```

2. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

## Usage

Start the slideshow with your stream configuration:

```bash
python3 froggie-frame.py \
    --api-url https://your-froggie-frame.vercel.app \
    --stream-id YOUR_STREAM_UUID \
    --api-key YOUR_API_KEY
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-url` | URL of the Froggie Frame web app | Required |
| `--stream-id` | UUID of the photo stream | Required |
| `--api-key` | API key for authentication | Required |
| `--interval` | Slideshow interval in seconds | 30 |
| `--transition` | Transition effect (fade, cut) | fade |
| `--shuffle/--no-shuffle` | Shuffle photo order | true |
| `--max-cache-mb` | Maximum cache size in MB | 500 |
| `--supabase-url` | Supabase project URL for realtime | Optional |
| `--supabase-anon-key` | Supabase anon key for realtime | Optional |

### Automatic Updates

The frame automatically subscribes to stream changes and updates photos in real-time:
- **With Supabase Realtime**: Instant updates when photos are added/removed
- **Polling fallback**: Checks for updates every 60 seconds when Supabase is not configured

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

## Photo Cache

Photos are cached locally to minimize network usage and allow offline operation. The cache is stored in `~/.froggie-frame/cache/` by default.

- Default max cache size: 500 MB
- Old photos are automatically removed when cache exceeds limit (LRU eviction)
- Photos removed from the stream are automatically pruned from cache
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
