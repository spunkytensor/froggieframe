# Froggie Frame

![Froggie Frame Logo](assets/logo.png)

![Froggie Frame App Screenshot](assets/app1.jpg)

A open-source digital photo frame solution consisting of a Raspberry Pi display application and a cloud-based photo management web app.

## Overview

Froggie Frame allows you to:
- Display photos on a Raspberry Pi-based digital photo frame
- Manage multiple photo streams through a web interface
- Share different photo collections with different frames
- Securely upload, organize, and curate your photos
- Automatically extract and display EXIF metadata (GPS location, date/time, orientation)
- AI-powered photo analysis with mood detection and automatic tagging

## Components

### 1. Pi Frame (`/pi-frame`)
A minimal Python application for Raspberry Pi that:
- Displays photos in fullscreen slideshow mode
- Syncs with a specific photo stream from the cloud
- Runs automatically on boot
- Supports various image formats (JPEG, PNG, WebP)

### 2. Web App (`/web`)
A Next.js application deployed on Vercel with Supabase backend that provides:
- User authentication with password and OTP 2FA
- Photo stream creation and management
- Photo upload with drag-and-drop support (including HEIC/HEIF conversion)
- EXIF metadata extraction and display with map integration
- AI-powered mood detection and automatic photo tagging
- Photo search by tags, mood, and metadata
- Light and dark mode UI
- Secure API endpoints

## Quick Start

### Web App Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/froggieframe.git
   cd froggieframe/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the SQL migrations from `/supabase/migrations`
   - Copy your project URL and anon key

4. Configure environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Deploy to Vercel:
   ```bash
   vercel deploy
   ```

### Raspberry Pi Setup

1. Install Raspberry Pi OS (Lite or Desktop)

2. Install dependencies:
   ```bash
   sudo apt update
   sudo apt install -y python3 python3-pip python3-pygame libsdl2-2.0-0
   pip3 install -r pi-frame/requirements.txt
   ```

3. Start the frame:
   ```bash
   cd pi-frame
   python3 froggie-frame.py --api-url https://your-app.vercel.app --stream-id YOUR_STREAM_ID --api-key YOUR_API_KEY
   ```

4. (Optional) Set up autostart:
   ```bash
   sudo cp froggie-frame.service /etc/systemd/system/
   sudo systemctl enable froggie-frame
   sudo systemctl start froggie-frame
   ```

## Configuration

### Web App Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

### Pi Frame Configuration

The Pi Frame stores its configuration in `~/.froggie-frame/config.json`:

```json
{
  "api_url": "https://your-app.vercel.app",
  "stream_id": "your-stream-uuid",
  "api_key": "your-api-key",
  "slideshow_interval": 30,
  "transition_effect": "fade",
  "shuffle": true
}
```

## Security Features

- Password hashing using bcrypt via Supabase Auth
- Time-based OTP (TOTP) two-factor authentication
- Row Level Security (RLS) policies on all database tables
- Secure API key generation for Pi Frame devices
- HTTPS-only communication
- Content Security Policy headers
- Rate limiting on authentication endpoints
- Input validation and sanitization

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture documentation.

## API Documentation

### Photo Stream Endpoints

- `GET /api/streams` - List user's photo streams
- `POST /api/streams` - Create a new photo stream
- `GET /api/streams/[id]` - Get stream details
- `PUT /api/streams/[id]` - Update stream settings
- `DELETE /api/streams/[id]` - Delete a stream

### Photo Endpoints

- `GET /api/photos` - List photos (with stream filter)
- `POST /api/photos/upload` - Upload a new photo (extracts EXIF, queues AI analysis)
- `GET /api/photos/[id]` - Get photo details with tags
- `POST /api/photos/[id]/analyze` - Trigger AI analysis for a photo
- `GET /api/photos/search` - Search photos by tags or mood
- `DELETE /api/photos/[id]` - Delete a photo

### Device Endpoints

- `GET /api/device/photos` - Get photos for Pi Frame (uses API key auth)
- `POST /api/device/sync` - Report sync status

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
