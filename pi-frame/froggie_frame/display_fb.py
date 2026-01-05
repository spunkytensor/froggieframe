"""Display engine for Froggie Frame using Linux framebuffer directly."""

import mmap
import os
import random
import struct
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional

from PIL import Image


class DisplayEngine:
    """Handles fullscreen photo display using Linux framebuffer."""

    def __init__(
        self,
        slideshow_interval: int = 30,
        transition_effect: str = "fade",
        shuffle: bool = True,
    ):
        self.slideshow_interval = slideshow_interval
        self.transition_effect = transition_effect
        self.shuffle = shuffle
        self.running = False
        self.photos: List[Path] = []
        self.current_index = 0
        self._photos_lock = None
        self._pending_photos: Optional[List[Path]] = None

        # Framebuffer properties
        self.fb_fd = None
        self.fb_mem = None
        self.screen_width = 0
        self.screen_height = 0
        self.bpp = 0
        self.line_length = 0
        self.back_buffer = None  # For double buffering

    def _get_fb_info(self) -> bool:
        """Get framebuffer dimensions and bit depth."""
        try:
            import subprocess
            # Use fbset to get actual visible geometry
            result = subprocess.run(['fbset', '-s'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'geometry' in line:
                        parts = line.split()
                        # geometry xres yres vxres vyres depth
                        self.screen_width = int(parts[1])
                        self.screen_height = int(parts[2])
                        self.bpp = int(parts[5])
                        break

            # Get line length from fbset or sys
            if 'LineLength' in result.stdout:
                for line in result.stdout.split('\n'):
                    if 'LineLength' in line:
                        self.line_length = int(line.split(':')[1].strip())
                        break
            else:
                with open('/sys/class/graphics/fb0/stride', 'r') as f:
                    self.line_length = int(f.read().strip())

            if self.screen_width and self.screen_height and self.bpp:
                return True
        except Exception as e:
            print(f"fbset method failed: {e}")

        # Fallback to sys files
        try:
            with open('/sys/class/graphics/fb0/virtual_size', 'r') as f:
                self.screen_width, self.screen_height = map(int, f.read().strip().split(','))
            with open('/sys/class/graphics/fb0/bits_per_pixel', 'r') as f:
                self.bpp = int(f.read().strip())
            with open('/sys/class/graphics/fb0/stride', 'r') as f:
                self.line_length = int(f.read().strip())
            return True
        except Exception as e2:
            print(f"Failed to get framebuffer info: {e2}")
            return False

    def _hide_cursor(self) -> None:
        """Hide the console cursor."""
        try:
            # Hide cursor using escape sequence
            sys.stdout.write('\033[?25l')
            sys.stdout.flush()

            # Disable fbcon cursor blink at kernel level
            try:
                with open('/sys/class/graphics/fbcon/cursor_blink', 'w') as f:
                    f.write('0')
            except (FileNotFoundError, PermissionError, IOError):
                # Try with sudo via shell
                os.system('echo 0 | sudo tee /sys/class/graphics/fbcon/cursor_blink > /dev/null 2>&1')

            # Hide cursor on all ttys that might be active
            for tty in ['/dev/tty0', '/dev/tty1', '/dev/console']:
                try:
                    with open(tty, 'w') as f:
                        f.write('\033[?25l')  # Hide cursor
                        f.write('\033[?1c')   # Set cursor to invisible
                except (FileNotFoundError, PermissionError, IOError):
                    pass

            # Disable cursor via setterm on tty1
            os.system('setterm -cursor off > /dev/tty1 2>/dev/null')
            os.system('setterm -cursor off > /dev/tty0 2>/dev/null')
        except Exception:
            pass

    def _show_cursor(self) -> None:
        """Show the console cursor."""
        try:
            sys.stdout.write('\033[?25h')
            sys.stdout.flush()
            os.system('setterm -cursor on > /dev/tty1 2>/dev/null')
        except Exception:
            pass

    def initialize(self) -> bool:
        """Initialize framebuffer access."""
        try:
            if not self._get_fb_info():
                return False

            print(f"Framebuffer: {self.screen_width}x{self.screen_height} @ {self.bpp}bpp, stride={self.line_length}")

            # Open framebuffer device
            self.fb_fd = os.open('/dev/fb0', os.O_RDWR)
            fb_size = self.line_length * self.screen_height
            self.fb_mem = mmap.mmap(
                self.fb_fd, fb_size,
                mmap.MAP_SHARED,
                mmap.PROT_WRITE | mmap.PROT_READ
            )

            # Create back buffer for double buffering (eliminates tearing)
            self.back_buffer = bytearray(fb_size)

            self._photos_lock = threading.Lock()

            # Hide console cursor
            self._hide_cursor()

            # Fill with black initially
            self._clear_back_buffer()
            self._flip()

            return True
        except Exception as e:
            print(f"Failed to initialize framebuffer: {e}")
            return False

    def shutdown(self) -> None:
        """Close framebuffer."""
        self.running = False
        self._show_cursor()
        if self.fb_mem:
            self.fb_mem.close()
            self.fb_mem = None
        if self.fb_fd:
            os.close(self.fb_fd)
            self.fb_fd = None
        self.back_buffer = None

    def _clear_back_buffer(self) -> None:
        """Clear back buffer to black."""
        if self.back_buffer:
            self.back_buffer[:] = b'\x00' * len(self.back_buffer)

    def _flip(self) -> None:
        """Copy back buffer to framebuffer (the 'flip' in double buffering)."""
        if self.fb_mem and self.back_buffer:
            self.fb_mem[:len(self.back_buffer)] = self.back_buffer

    def _fill_back_buffer(self, r: int, g: int, b: int) -> None:
        """Fill back buffer with a solid color."""
        if not self.back_buffer:
            return

        if self.bpp == 32:
            pixel = struct.pack('BBBB', b, g, r, 255)  # BGRA
        elif self.bpp == 16:
            pixel = struct.pack('<H', ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3))
        else:
            return

        row = pixel * self.screen_width
        padding = self.line_length - len(row)
        if padding > 0:
            full_row = row + (b'\x00' * padding)
            for y in range(self.screen_height):
                offset = y * self.line_length
                self.back_buffer[offset:offset + self.line_length] = full_row
        else:
            for y in range(self.screen_height):
                offset = y * self.line_length
                self.back_buffer[offset:offset + len(row)] = row

    def _fill_screen(self, r: int, g: int, b: int) -> None:
        """Fill screen with a solid color (using double buffering)."""
        self._fill_back_buffer(r, g, b)
        self._flip()

    def _image_to_fb_format(self, img: Image.Image) -> bytes:
        """Convert PIL Image to framebuffer format."""
        if self.bpp == 32:
            # Convert to BGRA
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            # PIL is RGBA, framebuffer is BGRA
            r, g, b, a = img.split()
            img = Image.merge('RGBA', (b, g, r, a))
            return img.tobytes()
        elif self.bpp == 16:
            # Convert to RGB565 using numpy for speed
            try:
                import numpy as np
                img = img.convert('RGB')
                arr = np.array(img, dtype=np.uint16)
                r = (arr[:, :, 0] >> 3).astype(np.uint16)
                g = (arr[:, :, 1] >> 2).astype(np.uint16)
                b = (arr[:, :, 2] >> 3).astype(np.uint16)
                rgb565 = (r << 11) | (g << 5) | b
                return rgb565.tobytes()
            except ImportError:
                # Fallback to pure Python (slow)
                img = img.convert('RGB')
                pixels = img.load()
                data = bytearray(img.width * img.height * 2)
                idx = 0
                for y in range(img.height):
                    for x in range(img.width):
                        r, g, b = pixels[x, y]
                        rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
                        data[idx:idx+2] = struct.pack('<H', rgb565)
                        idx += 2
                return bytes(data)
        return b''

    def _draw_image_to_buffer(self, img: Image.Image, x: int, y: int) -> None:
        """Draw a PIL Image at position (x, y) to the back buffer."""
        if not self.back_buffer:
            return

        bytes_per_pixel = self.bpp // 8
        img_data = self._image_to_fb_format(img)
        img_width = img.width
        img_height = img.height
        img_line_len = img_width * bytes_per_pixel

        for row in range(img_height):
            if y + row < 0 or y + row >= self.screen_height:
                continue
            src_offset = row * img_line_len
            dst_offset = (y + row) * self.line_length + x * bytes_per_pixel

            # Clip to screen bounds
            copy_start = max(0, -x) * bytes_per_pixel
            copy_end = min(img_width, self.screen_width - x) * bytes_per_pixel

            if copy_end > copy_start:
                dst_start = dst_offset + copy_start
                self.back_buffer[dst_start:dst_start + (copy_end - copy_start)] = \
                    img_data[src_offset + copy_start:src_offset + copy_end]

    def _draw_image(self, img: Image.Image, x: int, y: int) -> None:
        """Draw a PIL Image at position (x, y) and flip to screen."""
        self._draw_image_to_buffer(img, x, y)
        self._flip()

    def set_photos(self, photos: List[Path]) -> None:
        """Set the list of photos to display."""
        self.photos = [p for p in photos if p.exists()]
        if self.shuffle:
            random.shuffle(self.photos)
        self.current_index = 0

    def update_photos(self, photos: List[Path]) -> None:
        """Thread-safe update of photo list from subscription callback."""
        new_photos = [p for p in photos if p.exists()]
        if self.shuffle:
            random.shuffle(new_photos)
        if self._photos_lock:
            with self._photos_lock:
                self._pending_photos = new_photos
        else:
            self.photos = new_photos
            self.current_index = min(self.current_index, max(0, len(self.photos) - 1))

    def load_image(self, path: Path) -> Optional[Image.Image]:
        """Load and scale an image to fit the screen."""
        try:
            img = Image.open(path)
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')

            # Calculate scaling to fit screen while maintaining aspect ratio
            img_width, img_height = img.size
            scale_w = self.screen_width / img_width
            scale_h = self.screen_height / img_height
            scale = min(scale_w, scale_h)

            new_width = int(img_width * scale)
            new_height = int(img_height * scale)

            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            return img
        except Exception as e:
            print(f"Error loading image {path}: {e}")
            return None

    def display_image(self, img: Image.Image) -> None:
        """Display an image centered on the screen."""
        self._fill_back_buffer(0, 0, 0)
        x = (self.screen_width - img.width) // 2
        y = (self.screen_height - img.height) // 2
        self._draw_image_to_buffer(img, x, y)
        self._flip()

    def fade_transition(
        self, old_img: Optional[Image.Image], new_img: Image.Image, duration: float = 1.0
    ) -> None:
        """Perform a smooth crossfade transition at 30fps using double buffering."""
        fps = 30
        frame_time = 1.0 / fps
        total_frames = int(duration * fps)

        # Pre-calculate positions
        new_x = (self.screen_width - new_img.width) // 2
        new_y = (self.screen_height - new_img.height) // 2
        new_rgb = new_img.convert('RGB') if new_img.mode != 'RGB' else new_img

        if old_img:
            old_x = (self.screen_width - old_img.width) // 2
            old_y = (self.screen_height - old_img.height) // 2
            old_rgb = old_img.convert('RGB') if old_img.mode != 'RGB' else old_img

            # Create screen-sized images for proper blending
            old_screen = Image.new('RGB', (self.screen_width, self.screen_height), (0, 0, 0))
            new_screen = Image.new('RGB', (self.screen_width, self.screen_height), (0, 0, 0))
            old_screen.paste(old_rgb, (old_x, old_y))
            new_screen.paste(new_rgb, (new_x, new_y))

            for frame in range(total_frames + 1):
                if not self.running:
                    break

                frame_start = time.time()
                alpha = frame / total_frames

                # Blend the two screen images
                blended = Image.blend(old_screen, new_screen, alpha)

                # Draw to back buffer and flip
                self._fill_back_buffer(0, 0, 0)
                self._draw_image_to_buffer(blended, 0, 0)
                self._flip()

                # Maintain 30fps timing
                elapsed = time.time() - frame_start
                sleep_time = frame_time - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
        else:
            # No old image, just display new one
            self.display_image(new_img)

        # Ensure final frame is correct
        self.display_image(new_img)

    def cut_transition(
        self, old_img: Optional[Image.Image], new_img: Image.Image
    ) -> None:
        """Immediate cut transition."""
        self.display_image(new_img)

    def transition_to(
        self, old_img: Optional[Image.Image], new_img: Image.Image
    ) -> None:
        """Transition to a new image using the configured effect."""
        if self.transition_effect == "fade":
            self.fade_transition(old_img, new_img)
        else:
            self.cut_transition(old_img, new_img)

    def run_slideshow(self) -> None:
        """Run the slideshow loop."""
        if not self.photos:
            print("No photos to display")
            return

        self.running = True
        current_img = None
        print(f"Starting slideshow with {len(self.photos)} photos, interval={self.slideshow_interval}s")

        while self.running:
            # Check for pending photo updates
            if self._photos_lock:
                with self._photos_lock:
                    if self._pending_photos is not None:
                        self.photos = self._pending_photos
                        self._pending_photos = None
                        self.current_index = min(self.current_index, max(0, len(self.photos) - 1))

            if not self.photos:
                time.sleep(1)
                continue

            # Load and display current photo
            if self.current_index < len(self.photos):
                photo_path = self.photos[self.current_index]
                print(f"Showing photo {self.current_index + 1}/{len(self.photos)}: {photo_path.name}")
                new_img = self.load_image(photo_path)

                if new_img:
                    self.transition_to(current_img, new_img)
                    current_img = new_img

            # Wait for slideshow interval
            print(f"Waiting {self.slideshow_interval} seconds...")
            time.sleep(self.slideshow_interval)

            # Move to next photo
            self.current_index = (self.current_index + 1) % len(self.photos)

            # Reshuffle when we loop back to start
            if self.current_index == 0 and self.shuffle:
                random.shuffle(self.photos)

        self.shutdown()

    def show_message(self, message: str, font_size: int = 48) -> None:
        """Clear the screen and log a message to console.

        Note: Text rendering to framebuffer is not implemented.
        This method clears the display and prints the message to stdout.
        """
        self._fill_screen(0, 0, 0)
        print(f"Message: {message}")

    def show_splash(self) -> None:
        """Display the splash/boot image if available."""
        # Look for splash image in common locations
        splash_paths = [
            Path(os.environ.get('HOME', '/home/pi')) / 'froggie-frame' / 'assets' / 'boot.png',
            Path(__file__).parent.parent / 'assets' / 'boot.png',
        ]

        for splash_path in splash_paths:
            if splash_path.exists():
                try:
                    splash_img = self.load_image(splash_path)
                    if splash_img:
                        self.display_image(splash_img)
                        return
                except Exception as e:
                    print(f"Failed to load splash: {e}")

        # No splash found, just show black screen
        self._fill_back_buffer(0, 0, 0)
        self._flip()
