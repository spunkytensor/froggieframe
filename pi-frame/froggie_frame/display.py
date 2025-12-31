"""Display engine for Froggie Frame using pygame."""

import os
import random
import time
from pathlib import Path
from typing import List, Optional

# Set SDL to use the framebuffer on Raspberry Pi
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
    ):
        self.slideshow_interval = slideshow_interval
        self.transition_effect = transition_effect
        self.shuffle = shuffle
        self.running = False
        self.screen = None
        self.screen_size = (1920, 1080)
        self.photos: List[Path] = []
        self.current_index = 0
        self.clock = None

    def initialize(self) -> bool:
        """Initialize pygame and the display."""
        try:
            pygame.init()
            pygame.mouse.set_visible(False)

            # Try to get display info
            try:
                display_info = pygame.display.Info()
                self.screen_size = (display_info.current_w, display_info.current_h)
            except Exception:
                pass

            # Create fullscreen display
            self.screen = pygame.display.set_mode(
                self.screen_size,
                pygame.FULLSCREEN | pygame.DOUBLEBUF | pygame.HWSURFACE
            )
            pygame.display.set_caption("Froggie Frame")
            self.clock = pygame.time.Clock()

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

    def handle_events(self) -> bool:
        """Handle pygame events. Returns False if should quit."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE or event.key == pygame.K_q:
                    return False
                elif event.key == pygame.K_RIGHT or event.key == pygame.K_SPACE:
                    # Skip to next photo
                    return "next"
                elif event.key == pygame.K_LEFT:
                    # Go to previous photo
                    return "prev"
        return True

    def run_slideshow(self, sync_callback=None) -> None:
        """Run the slideshow loop."""
        if not self.photos:
            print("No photos to display")
            return

        self.running = True
        current_surface = None
        last_sync_check = time.time()
        sync_interval = 300  # Check for updates every 5 minutes

        while self.running:
            # Load and display current photo
            if self.current_index < len(self.photos):
                photo_path = self.photos[self.current_index]
                new_surface = self.load_image(photo_path)

                if new_surface:
                    self.transition_to(current_surface, new_surface)
                    current_surface = new_surface

            # Wait for slideshow interval
            wait_start = time.time()
            while self.running and (time.time() - wait_start) < self.slideshow_interval:
                result = self.handle_events()
                if result is False:
                    self.running = False
                    break
                elif result == "next":
                    break
                elif result == "prev":
                    self.current_index = (self.current_index - 2) % len(self.photos)
                    break

                self.clock.tick(30)

            # Move to next photo
            self.current_index = (self.current_index + 1) % len(self.photos)

            # Reshuffle when we've shown all photos
            if self.current_index == 0 and self.shuffle:
                random.shuffle(self.photos)

            # Check for updates periodically
            if sync_callback and (time.time() - last_sync_check) > sync_interval:
                sync_callback()
                last_sync_check = time.time()

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
