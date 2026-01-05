"""Display engine for Froggie Frame using pygame."""

import os
import platform
import random
import threading
import time
from enum import Enum
from pathlib import Path
from typing import List, Optional, Union


class EventResult(Enum):
    """Result of handling pygame events."""
    CONTINUE = "continue"
    QUIT = "quit"
    NEXT = "next"
    PREV = "prev"

# Set SDL to use the framebuffer on Raspberry Pi (Linux only)
# On macOS/Windows, let pygame use the native video driver
if platform.system() == "Linux":
    os.environ.setdefault("SDL_VIDEODRIVER", "kmsdrm")

import pygame
from PIL import Image


class DisplayEngine:
    """Handles fullscreen photo display with transitions."""

    def __init__(
        self,
        slideshow_interval: int = 30,
        transition_effect: str = "fade",
        shuffle: bool = True,
        windowed: bool = False,
    ):
        self.slideshow_interval = slideshow_interval
        self.transition_effect = transition_effect
        self.shuffle = shuffle
        self.windowed = windowed
        self.running = False
        self.screen = None
        self.screen_size = (1920, 1080)
        self.photos: List[Path] = []
        self.current_index = 0
        self.clock = None
        self._photos_lock = None
        self._pending_photos: Optional[List[Path]] = None

    def initialize(self) -> bool:
        """Initialize pygame and the display."""
        try:
            pygame.init()

            if self.windowed:
                # Windowed mode for development
                pygame.mouse.set_visible(True)
                self.screen_size = (1280, 720)
                flags = pygame.RESIZABLE
            else:
                # Fullscreen mode for production
                pygame.mouse.set_visible(False)

                # Try to get display info
                try:
                    display_info = pygame.display.Info()
                    self.screen_size = (display_info.current_w, display_info.current_h)
                except Exception:
                    pass

                # Set display flags based on platform
                # HWSURFACE is only relevant for Linux framebuffer
                if platform.system() == "Linux":
                    flags = pygame.FULLSCREEN | pygame.DOUBLEBUF | pygame.HWSURFACE
                else:
                    flags = pygame.FULLSCREEN | pygame.DOUBLEBUF

            self.screen = pygame.display.set_mode(self.screen_size, flags)
            pygame.display.set_caption("Froggie Frame")
            self.clock = pygame.time.Clock()
            self._photos_lock = threading.Lock()

            # Fill with black initially
            self.screen.fill((0, 0, 0))
            pygame.display.flip()

            return True
        except Exception as e:
            print(f"Failed to initialize display: {e}")
            return False

    def shutdown(self) -> None:
        """Shutdown pygame."""
        self.running = False
        pygame.quit()

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

    def load_image(self, path: Path) -> Optional[pygame.Surface]:
        """Load and scale an image to fit the screen."""
        try:
            # Use PIL to load for better format support
            pil_image = Image.open(path)

            # Convert to RGB if necessary
            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")

            # Calculate scaling to fit screen while maintaining aspect ratio
            img_width, img_height = pil_image.size
            screen_width, screen_height = self.screen_size

            scale_w = screen_width / img_width
            scale_h = screen_height / img_height
            scale = min(scale_w, scale_h)

            new_width = int(img_width * scale)
            new_height = int(img_height * scale)

            # Resize image
            pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Convert to pygame surface
            mode = pil_image.mode
            size = pil_image.size
            data = pil_image.tobytes()

            surface = pygame.image.fromstring(data, size, mode)
            return surface

        except Exception as e:
            print(f"Error loading image {path}: {e}")
            return None

    def display_image(self, surface: pygame.Surface) -> None:
        """Display an image centered on the screen."""
        # Clear screen
        self.screen.fill((0, 0, 0))

        # Center the image
        x = (self.screen_size[0] - surface.get_width()) // 2
        y = (self.screen_size[1] - surface.get_height()) // 2

        self.screen.blit(surface, (x, y))
        pygame.display.flip()

    def fade_transition(
        self, old_surface: Optional[pygame.Surface], new_surface: pygame.Surface, duration: float = 1.0
    ) -> None:
        """Perform a fade transition between two images."""
        steps = 30
        step_duration = duration / steps

        # Create a surface for the new image with alpha
        new_with_alpha = new_surface.copy()
        new_with_alpha.set_alpha(0)

        # Center positions
        new_x = (self.screen_size[0] - new_surface.get_width()) // 2
        new_y = (self.screen_size[1] - new_surface.get_height()) // 2

        if old_surface:
            old_x = (self.screen_size[0] - old_surface.get_width()) // 2
            old_y = (self.screen_size[1] - old_surface.get_height()) // 2

        for i in range(steps + 1):
            if not self.running:
                break

            alpha = int(255 * i / steps)

            self.screen.fill((0, 0, 0))

            if old_surface:
                old_surface.set_alpha(255 - alpha)
                self.screen.blit(old_surface, (old_x, old_y))

            new_surface.set_alpha(alpha)
            self.screen.blit(new_surface, (new_x, new_y))

            pygame.display.flip()
            time.sleep(step_duration)

            # Handle events during transition
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                        self.running = False

    def cut_transition(
        self, old_surface: Optional[pygame.Surface], new_surface: pygame.Surface
    ) -> None:
        """Immediate cut transition."""
        self.display_image(new_surface)

    def transition_to(
        self, old_surface: Optional[pygame.Surface], new_surface: pygame.Surface
    ) -> None:
        """Transition to a new image using the configured effect."""
        if self.transition_effect == "fade":
            self.fade_transition(old_surface, new_surface)
        else:
            self.cut_transition(old_surface, new_surface)

    def handle_events(self) -> EventResult:
        """Handle pygame events. Returns EventResult indicating action to take."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return EventResult.QUIT
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                    return EventResult.QUIT
                elif event.key == pygame.K_RIGHT or event.key == pygame.K_SPACE:
                    return EventResult.NEXT
                elif event.key == pygame.K_LEFT:
                    return EventResult.PREV
            elif event.type == pygame.MOUSEBUTTONDOWN or event.type == pygame.FINGERDOWN:
                return EventResult.NEXT
            elif event.type == pygame.VIDEORESIZE and self.windowed:
                # Handle window resize in windowed mode
                self.screen_size = (event.w, event.h)
                self.screen = pygame.display.set_mode(self.screen_size, pygame.RESIZABLE)
        return EventResult.CONTINUE

    def run_slideshow(self) -> None:
        """Run the slideshow loop with automatic photo updates.

        Handles starting with an empty photo list by showing a waiting message
        until photos become available via update_photos().
        """
        self.running = True
        current_surface = None
        waiting_for_photos = not self.photos
        last_message = None

        while self.running:
            if self._photos_lock:
                with self._photos_lock:
                    if self._pending_photos is not None:
                        self.photos = self._pending_photos
                        self._pending_photos = None
                        if waiting_for_photos and self.photos:
                            waiting_for_photos = False
                            self.current_index = 0
                        else:
                            self.current_index = min(self.current_index, max(0, len(self.photos) - 1))

            if not self.photos:
                # Show waiting message (only update if message changed to avoid flicker)
                message = "Syncing photos..."
                if message != last_message:
                    self.show_message(message)
                    last_message = message
                time.sleep(0.5)
                continue

            # Clear last_message when we have photos
            last_message = None

            if self.current_index < len(self.photos):
                photo_path = self.photos[self.current_index]
                new_surface = self.load_image(photo_path)

                if new_surface:
                    self.transition_to(current_surface, new_surface)
                    current_surface = new_surface

            wait_start = time.time()
            while self.running and (time.time() - wait_start) < self.slideshow_interval:
                result = self.handle_events()
                if result == EventResult.QUIT:
                    self.running = False
                    break
                elif result == EventResult.NEXT:
                    break
                elif result == EventResult.PREV:
                    self.current_index = (self.current_index - 2) % len(self.photos)
                    break

                self.clock.tick(30)

            self.current_index = (self.current_index + 1) % len(self.photos)

            if self.current_index == 0 and self.shuffle:
                random.shuffle(self.photos)

        self.shutdown()

    def show_message(self, message: str, font_size: int = 48) -> None:
        """Display a message on screen."""
        if not self.screen:
            return

        self.screen.fill((0, 0, 0))

        try:
            font = pygame.font.Font(None, font_size)
            text = font.render(message, True, (255, 255, 255))
            x = (self.screen_size[0] - text.get_width()) // 2
            y = (self.screen_size[1] - text.get_height()) // 2
            self.screen.blit(text, (x, y))
            pygame.display.flip()
        except Exception as e:
            print(f"Error displaying message: {e}")
