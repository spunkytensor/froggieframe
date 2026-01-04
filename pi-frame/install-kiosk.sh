#!/bin/bash
# Froggie Frame Kiosk Mode Installation Script for Raspberry Pi OS Full
# This script configures the Pi to boot directly into the photo frame application
# with a splash screen, bypassing the desktop environment.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/home/$USER/froggie-frame"
ASSETS_DIR="$INSTALL_DIR/assets"
BOOT_IMAGE="boot.png"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[*]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "  Froggie Frame Kiosk Mode Installer"
echo "=========================================="
echo

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please run this script as a regular user, not root."
    print_error "The script will use sudo when needed."
    exit 1
fi

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    print_warning "This doesn't appear to be a Raspberry Pi."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for Raspberry Pi OS with desktop
if ! command -v startx &> /dev/null && ! systemctl is-active --quiet lightdm 2>/dev/null; then
    print_warning "Desktop environment not detected."
    print_warning "This script is designed for Raspberry Pi OS Full (with desktop)."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Starting kiosk mode installation..."
echo

# Update package list
print_status "Updating package list..."
sudo apt update

# Install system dependencies
print_status "Installing system dependencies..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-pygame \
    python3-pil \
    libsdl2-2.0-0 \
    libsdl2-image-2.0-0 \
    libsdl2-ttf-2.0-0 \
    fbi \
    plymouth \
    plymouth-themes

# Create installation directory
print_status "Creating installation directory at $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$ASSETS_DIR"
mkdir -p ~/.froggie-frame/cache

# Copy application files
print_status "Copying application files..."
cp "$SCRIPT_DIR/froggie-frame.py" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/froggie-frame.py"

# Copy froggie_frame module if it exists
if [ -d "$SCRIPT_DIR/froggie_frame" ]; then
    cp -r "$SCRIPT_DIR/froggie_frame" "$INSTALL_DIR/"
fi

# Copy boot image
if [ -f "$SCRIPT_DIR/../assets/$BOOT_IMAGE" ]; then
    print_status "Copying boot splash image..."
    cp "$SCRIPT_DIR/../assets/$BOOT_IMAGE" "$ASSETS_DIR/"
elif [ -f "$SCRIPT_DIR/$BOOT_IMAGE" ]; then
    cp "$SCRIPT_DIR/$BOOT_IMAGE" "$ASSETS_DIR/"
else
    print_warning "Boot image not found. Splash screen will be skipped."
fi

# Install Python dependencies
print_status "Installing Python dependencies..."
pip3 install --user -r "$INSTALL_DIR/requirements.txt" --break-system-packages 2>/dev/null || \
pip3 install --user -r "$INSTALL_DIR/requirements.txt"

# Create the splash screen service
print_status "Creating splash screen service..."
sudo tee /etc/systemd/system/froggie-splash.service > /dev/null << EOF
[Unit]
Description=Froggie Frame Splash Screen
DefaultDependencies=no
After=local-fs.target
Before=froggie-frame.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/fbi -T 1 -d /dev/fb0 --noverbose --autozoom $ASSETS_DIR/$BOOT_IMAGE
ExecStartPost=/bin/sleep 2
RemainAfterExit=yes
StandardInput=tty
StandardOutput=tty

[Install]
WantedBy=sysinit.target
EOF

# Create the main photo frame service
print_status "Creating photo frame service..."
sudo tee /etc/systemd/system/froggie-frame.service > /dev/null << EOF
[Unit]
Description=Froggie Frame Photo Display
After=network-online.target froggie-splash.service
Wants=network-online.target
Requires=froggie-splash.service

[Service]
Type=simple
User=$USER
Environment=SDL_VIDEODRIVER=kmsdrm
Environment=SDL_FBDEV=/dev/fb0
WorkingDirectory=$INSTALL_DIR
ExecStartPre=/usr/bin/python3 $INSTALL_DIR/froggie-frame.py sync
ExecStart=/usr/bin/python3 $INSTALL_DIR/froggie-frame.py start --no-sync
Restart=always
RestartSec=10
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=tty

[Install]
WantedBy=multi-user.target
EOF

# Disable the desktop environment
print_status "Disabling desktop environment..."
sudo systemctl set-default multi-user.target

# Disable lightdm (display manager)
if systemctl is-enabled lightdm 2>/dev/null; then
    print_status "Disabling lightdm..."
    sudo systemctl disable lightdm
fi

# Disable graphical login
if systemctl is-enabled gdm 2>/dev/null; then
    sudo systemctl disable gdm
fi
if systemctl is-enabled gdm3 2>/dev/null; then
    sudo systemctl disable gdm3
fi

# Configure auto-login to console
print_status "Configuring auto-login to console..."
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d/
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf > /dev/null << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER --noclear %I \$TERM
EOF

# Hide boot messages and show splash (optional, makes boot cleaner)
print_status "Configuring boot splash..."
if [ -f /boot/cmdline.txt ]; then
    CMDLINE_FILE="/boot/cmdline.txt"
elif [ -f /boot/firmware/cmdline.txt ]; then
    CMDLINE_FILE="/boot/firmware/cmdline.txt"
else
    print_warning "cmdline.txt not found, skipping boot splash configuration"
    CMDLINE_FILE=""
fi

if [ -n "$CMDLINE_FILE" ]; then
    # Backup original cmdline.txt
    sudo cp "$CMDLINE_FILE" "${CMDLINE_FILE}.backup"

    # Add quiet splash parameters if not present
    if ! grep -q "quiet" "$CMDLINE_FILE"; then
        sudo sed -i 's/$/ quiet/' "$CMDLINE_FILE"
    fi
    if ! grep -q "splash" "$CMDLINE_FILE"; then
        sudo sed -i 's/$/ splash/' "$CMDLINE_FILE"
    fi
    if ! grep -q "logo.nologo" "$CMDLINE_FILE"; then
        sudo sed -i 's/$/ logo.nologo/' "$CMDLINE_FILE"
    fi
    if ! grep -q "vt.global_cursor_default=0" "$CMDLINE_FILE"; then
        sudo sed -i 's/$/ vt.global_cursor_default=0/' "$CMDLINE_FILE"
    fi
fi

# Configure Plymouth for boot splash (optional enhancement)
print_status "Configuring Plymouth splash theme..."
if [ -f "$ASSETS_DIR/$BOOT_IMAGE" ]; then
    # Create custom Plymouth theme
    PLYMOUTH_THEME_DIR="/usr/share/plymouth/themes/froggie"
    sudo mkdir -p "$PLYMOUTH_THEME_DIR"
    sudo cp "$ASSETS_DIR/$BOOT_IMAGE" "$PLYMOUTH_THEME_DIR/splash.png"

    sudo tee "$PLYMOUTH_THEME_DIR/froggie.plymouth" > /dev/null << EOF
[Plymouth Theme]
Name=Froggie Frame
Description=Froggie Frame boot splash
ModuleName=script

[script]
ImageDir=$PLYMOUTH_THEME_DIR
ScriptFile=$PLYMOUTH_THEME_DIR/froggie.script
EOF

    sudo tee "$PLYMOUTH_THEME_DIR/froggie.script" > /dev/null << 'EOF'
wallpaper_image = Image("splash.png");
screen_width = Window.GetWidth();
screen_height = Window.GetHeight();
resized_wallpaper_image = wallpaper_image.Scale(screen_width, screen_height);
wallpaper_sprite = Sprite(resized_wallpaper_image);
wallpaper_sprite.SetZ(-100);
EOF

    # Set the Plymouth theme
    sudo plymouth-set-default-theme froggie 2>/dev/null || true
    sudo update-initramfs -u 2>/dev/null || true
fi

# Disable screen blanking
print_status "Disabling screen blanking..."
sudo tee /etc/profile.d/froggie-display.sh > /dev/null << 'EOF'
# Disable screen blanking for Froggie Frame
export TERM=linux
setterm -blank 0 -powerdown 0 2>/dev/null || true
EOF
chmod +x /etc/profile.d/froggie-display.sh

# Add user to video group for framebuffer access
print_status "Adding user to video group..."
sudo usermod -a -G video "$USER"

# Reload systemd
print_status "Reloading systemd..."
sudo systemctl daemon-reload

# Enable services
print_status "Enabling services..."
sudo systemctl enable froggie-splash.service
sudo systemctl enable froggie-frame.service

echo
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo
print_status "Froggie Frame has been installed in kiosk mode."
echo
echo "Before rebooting, you need to configure your stream:"
echo
echo "  1. Create a configuration file:"
echo "     nano ~/.froggie-frame/config.json"
echo
echo "  2. Add your stream configuration:"
echo '     {'
echo '       "api_url": "https://your-froggie-frame.vercel.app",'
echo '       "stream_id": "YOUR_STREAM_UUID",'
echo '       "api_key": "YOUR_API_KEY"'
echo '     }'
echo
echo "  3. Reboot to start in kiosk mode:"
echo "     sudo reboot"
echo
print_warning "To restore the desktop environment later, run:"
echo "     sudo systemctl set-default graphical.target"
echo "     sudo systemctl enable lightdm"
echo "     sudo reboot"
echo
