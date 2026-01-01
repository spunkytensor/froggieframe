#!/bin/bash
# Froggie Frame Installation Script for Raspberry Pi

set -e

echo "Froggie Frame Installer"
echo "======================="
echo

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "Warning: This doesn't appear to be a Raspberry Pi."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update package list
echo "Updating package list..."
sudo apt update

# Install system dependencies
echo "Installing system dependencies..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-pygame \
    python3-pil \
    libsdl2-2.0-0 \
    libsdl2-image-2.0-0 \
    libsdl2-ttf-2.0-0

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install --user -r requirements.txt

# Create config directory
echo "Creating config directory..."
mkdir -p ~/.froggie-frame/cache

# Copy systemd service
echo "Installing systemd service..."
sudo cp froggie-frame.service /etc/systemd/system/

# Make main script executable
chmod +x froggie-frame.py

echo
echo "Installation complete!"
echo
echo "Next steps:"
echo "1. Start the frame:"
echo "   python3 froggie-frame.py --api-url <URL> --stream-id <ID> --api-key <KEY>"
echo
echo "2. (Optional) Enable autostart on boot:"
echo "   sudo systemctl enable froggie-frame"
echo "   sudo systemctl start froggie-frame"
