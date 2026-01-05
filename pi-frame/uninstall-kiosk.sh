#!/bin/bash
# Froggie Frame Kiosk Mode Uninstall Script
# Restores the Raspberry Pi to normal desktop mode

set -e

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

echo "=========================================="
echo "  Froggie Frame Kiosk Mode Uninstaller"
echo "=========================================="
echo

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}[ERROR]${NC} Please run this script as a regular user, not root."
    exit 1
fi

read -p "This will restore the desktop environment. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Stop and disable services
print_status "Stopping and disabling Froggie Frame services..."
sudo systemctl stop froggie-frame.service 2>/dev/null || true
sudo systemctl disable froggie-frame.service 2>/dev/null || true

# Remove service files
print_status "Removing service files..."
sudo rm -f /etc/systemd/system/froggie-frame.service

# Restore graphical target
print_status "Restoring graphical desktop..."
sudo systemctl set-default graphical.target

# Re-enable lightdm
if [ -f /lib/systemd/system/lightdm.service ]; then
    print_status "Re-enabling lightdm..."
    sudo systemctl enable lightdm
fi

# Remove auto-login configuration
print_status "Removing auto-login configuration..."
sudo rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
sudo rmdir /etc/systemd/system/getty@tty1.service.d/ 2>/dev/null || true

# Restore cmdline.txt from backup
if [ -f /boot/cmdline.txt.backup ]; then
    print_status "Restoring boot configuration..."
    sudo cp /boot/cmdline.txt.backup /boot/cmdline.txt
elif [ -f /boot/firmware/cmdline.txt.backup ]; then
    sudo cp /boot/firmware/cmdline.txt.backup /boot/firmware/cmdline.txt
fi

# Remove display configuration
print_status "Removing display configuration..."
sudo rm -f /etc/profile.d/froggie-display.sh

# Optionally remove Plymouth theme
if [ -d /usr/share/plymouth/themes/froggie ]; then
    print_status "Removing custom Plymouth theme..."
    sudo rm -rf /usr/share/plymouth/themes/froggie
    sudo plymouth-set-default-theme default 2>/dev/null || true
    sudo update-initramfs -u 2>/dev/null || true
fi

# Reload systemd
sudo systemctl daemon-reload

echo
echo "=========================================="
echo "  Uninstallation Complete!"
echo "=========================================="
echo
print_status "Desktop environment has been restored."
echo
print_warning "Note: Application files in ~/froggie-frame were NOT removed."
print_warning "To remove them manually: rm -rf ~/froggie-frame"
echo
echo "Reboot to return to normal desktop mode:"
echo "  sudo reboot"
echo
