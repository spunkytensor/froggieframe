# Feature Backlog

Ideas for enhancing Froggie Frame's end-user value.

---

# Architecture Rethink: Frame-First, Aggregation-Focused

## Philosophy Shift

The current model requires users to upload photos and manage streams, then generate per-stream API keys for each frame. This creates friction and positions Froggie Frame as "yet another photo storage service."

**New vision:** Froggie Frame should be a **photo aggregation layer** and **smart display manager**, not a photo storage service. Frames become first-class entities that pull from users' existing photo libraries.

### Current Model (awkward)
```
User → Upload photos → Create stream → Generate API key → Configure frame
       (per stream, per frame)
```

### Proposed Model (frame-first)
```
User → Enroll frame → Connect photo sources → Configure what to display
       (frame is independent, pulls from multiple sources)
```

---

## Frame Enrollment & Identity

### Easy Pairing Methods
- **QR code pairing** - Frame displays QR code, scan with phone to claim it
- **Device code flow** - Frame shows 6-digit code, enter on web app (like TV login)
- **Local network discovery** - Auto-detect frames on same WiFi, click to claim
- **Claim code** - Pre-printed code on device/packaging for first-time setup
- **Bluetooth pairing** - Tap phone to frame for NFC/BLE pairing

### Frame as First-Class Entity
- **Frame identity** - Each frame has its own persistent identity, independent of streams
- **Frame naming** - "Living Room", "Kitchen", "Grandma's House"
- **Frame location** - Associate with physical location for weather, timezone, etc.
- **Frame credentials** - Single device token per frame (not per-stream API keys)
- **Frame transfer** - Gift or reassign frames to other users

### Frame Settings (per device)
- **Display preferences** - Brightness, orientation, transition effects, slideshow interval
- **Schedule** - Wake/sleep times, quiet hours
- **Widgets enabled** - Clock, weather, calendar overlay
- **Alert preferences** - Which notifications to show
- **Offline cache size** - How many photos to store locally
- **Network settings** - WiFi configuration, proxy support

---

## Source Aggregation (primary) + Direct Uploads (supplementary)

### Core Concept
Users primarily **connect existing photo sources** rather than uploading everything to Froggie Frame. The frame aggregates and displays from multiple sources without duplicating storage.

Direct uploads to Froggie Frame remain supported as a **supplementary source** for:
- Quick one-off photos (e.g., snapped at a family gathering)
- Photos not stored elsewhere
- Contributions from family members without cloud accounts
- Legacy content from the current stream model

But the primary value proposition is aggregation, not storage.

### Supported Source Types

**Cloud Photo Services (OAuth connection)**
- Google Photos albums/shared albums
- iCloud Photo Library / Shared Albums
- Amazon Photos
- Dropbox folders
- OneDrive / Microsoft Photos
- Flickr albums

**Social Media (OAuth connection)**
- Facebook albums
- Instagram saved posts
- Pinterest boards

**Direct Feeds**
- RSS/Atom feeds with images
- Public URL galleries
- WebDAV/network folders
- S3/cloud storage buckets (self-hosted)

**Family & Sharing**
- Other Froggie Frame users' shared sources
- Shared family albums (anyone in family can contribute sources)
- Guest contribution links (temporary access to add photos)

**Curated Content (subscriptions)**
- Art museum collections
- Nature photography feeds
- Daily wallpapers
- Custom content channels

**Froggie Frame Direct (supplementary)**
- Direct photo uploads via web app
- Mobile app quick-share
- Email-to-frame (send photos to unique email address)
- SMS/MMS to frame (text photos to a number)

### Source Configuration
- **Sync frequency** - Real-time, hourly, daily
- **Photo selection** - All photos, favorites only, specific albums
- **Date range** - Last 30 days, last year, all time
- **Smart filters** - People, places, things (if source supports)
- **Freshness weighting** - Prefer recent photos vs. even distribution

---

## Frame Content Configuration

### Multi-Source Display
- **Source mixing** - Display from multiple sources on one frame
- **Source weighting** - "70% family photos, 20% art, 10% nature"
- **Source scheduling** - "Google Photos in morning, art in evening"
- **Round-robin vs. weighted random** - How to cycle through sources

### Smart Playlists
- **All sources combined** - Unified stream from all connected sources
- **Favorites across sources** - Aggregate favorites/likes from all services
- **This day in history** - "On this day" from all sources
- **People-focused** - Photos containing specific people (cross-source)
- **Location-focused** - Photos from specific places (cross-source)
- **Recent memories** - Last 30/60/90 days across all sources

### Display Rules
- **Content filters** - Exclude screenshots, exclude duplicates
- **Quality threshold** - Skip blurry/dark photos
- **Orientation matching** - Prefer landscape for landscape frames
- **Aspect ratio handling** - Crop, letterbox, or skip mismatched photos

---

## Multi-Frame Management

### Household View
- **Frame dashboard** - See all frames at a glance
- **Bulk configuration** - Apply settings to multiple frames
- **Frame groups** - "Downstairs frames", "Kids' rooms"
- **Frame templates** - Save and apply configurations

### Frame Relationships
- **Synced frames** - Multiple frames showing same content in sync
- **Complementary frames** - Different content, coordinated themes
- **Primary/secondary** - One frame controls, others follow

### Remote Management
- **Remote preview** - See what a frame is currently displaying
- **Remote control** - Skip photo, pause, change source from app
- **Push content** - Send a specific photo to display immediately
- **Remote troubleshooting** - View logs, restart, update firmware

---

## Migration Path

### From Current Model
1. Existing streams become a "Local Uploads" source type
2. Existing API keys continue to work during transition
3. Users prompted to "upgrade" frames to new enrollment
4. Gradual deprecation of per-stream API keys

### Backwards Compatibility
- Legacy API remains functional
- Streams can coexist with external sources
- No forced migration, incentivize with new features

---

# AI-Powered Features

## Smart Photo Organization

- **Auto-tagging & categorization** - Automatically tag photos with people, places, objects, and events (e.g., "beach", "birthday", "sunset")
- **Face recognition** - Group photos by person, allowing users to create streams focused on specific family members
- **Duplicate detection** - Identify and flag duplicate or near-duplicate photos to save storage and avoid repetition in slideshows
- **Scene clustering** - Auto-organize uploads into suggested collections based on visual similarity

## Intelligent Slideshow Curation

- **Quality scoring** - Rank photos by technical quality (sharpness, lighting, composition) to prioritize the best shots
- **Context-aware scheduling** - Show calmer, darker photos in evening hours; vibrant photos during the day
- **"On This Day" memories** - Surface photos from the same date in previous years
- **Mood-based playlists** - Generate thematic collections (e.g., "Relaxing", "Energetic", "Family Moments")

## Photo Enhancement

- **Auto-enhancement** - One-click AI improvement of color balance, exposure, and contrast
- **Upscaling** - Enhance resolution of older/smaller photos to look better on the frame
- **Smart cropping** - Auto-crop to focus on subjects for different frame aspect ratios
- **Background cleanup** - Remove unwanted elements or photobombers

## Natural Language Search

- **Semantic search** - Find photos by describing them: "photos of grandma in the garden" or "birthday cake with candles"
- **Visual similarity search** - "Find more photos like this one"

## AI Content & Accessibility

- **Auto-captioning** - Generate descriptive captions for each photo
- **Alt-text generation** - Improve accessibility with AI-generated descriptions
- **Content moderation** - Detect and flag potentially inappropriate images before they display on shared frames

## AI Personalization & Insights

- **Learning preferences** - Track which photos display longer (if the Pi reports viewing time) and favor similar content
- **Photo insights** - "Your stream has 40% landscapes, 35% family photos, 25% pets"
- **Smart suggestions** - "You haven't added photos from December yet" or "Your beach collection could use more variety"

## AI Privacy & Security

- **Sensitive content detection** - Blur or exclude photos containing visible IDs, license plates, or private documents
- **NSFW filtering** - Ensure family-friendly content on shared frames

---

# General Features

## Video & Media Support

- **Video playback** - Support short video clips in slideshows (with configurable max duration)
- **GIF support** - Display animated GIFs
- **Live photos** - Support Apple Live Photos with motion
- **Audio slideshows** - Optional background music or audio tracks
- **Photo collages** - Auto-generate multi-photo layouts for single display

## Emergency Alerts & Notifications

- **AMBER alerts** - Display critical emergency broadcasts
- **Weather alerts** - Show severe weather warnings for the frame's location
- **Custom family alerts** - Push urgent messages to all family frames ("Dinner's ready!", "Call grandma")
- **Medical reminders** - Medication and appointment reminders displayed on frame
- **School closures** - Integrate with local school notification systems
- **Power outage notifications** - Alert when a frame goes offline unexpectedly

## Security & Home Integration

- **Security camera snapshots** - Display live or recent snapshots from home cameras
- **Doorbell integration** - Show Ring/Nest doorbell camera when someone arrives
- **Motion-activated display** - Wake frame when motion detected, sleep when room is empty
- **Baby monitor view** - Quick switch to nursery camera feed
- **Pet cam integration** - Check on pets via the frame
- **Home sensor alerts** - Display smoke detector, water leak, or door sensor alerts

## Smart Home & IoT

- **Voice control** - Alexa/Google Home integration ("Show beach photos on the living room frame")
- **Home automation triggers** - Change streams based on time, presence, or other smart home events
- **Smart lighting sync** - Adjust room lighting to complement displayed photos
- **Presence detection** - Different content when home vs. away
- **Multi-room audio** - Sync with Sonos/HomePod for ambient audio

## Cloud Photo Integration Details

See "Source Aggregation" section above for the full vision. Technical details for key integrations:

### Google Photos
- OAuth 2.0 with Photos Library API
- Album selection with incremental sync
- Shared album support (view others' shared albums)
- Partner sharing integration
- Handle API quota limits gracefully

### Apple iCloud
- Challenge: No official API; options include:
  - iCloud.com web scraping (fragile)
  - Local sync agent on Mac/PC that uploads to Froggie
  - Shared Albums via public URLs
  - CloudKit integration (requires Apple Developer account)

### Amazon Photos
- OAuth via Login with Amazon
- Drive API for photo access
- Prime member unlimited storage integration

### Social Platforms
- Facebook: Graph API for albums (limited after privacy changes)
- Instagram: Basic Display API for user's own media
- Pinterest: API for boards (rate limited)

### Self-Hosted Options
- Nextcloud/ownCloud WebDAV
- Synology/QNAP NAS integration
- Immich API (open-source Google Photos alternative)
- PhotoPrism API
- Home Assistant integration

## Scheduling & Automation

- **Time-based streams** - Different streams for morning, afternoon, evening
- **Day-of-week scheduling** - Weekend vs. weekday content
- **Calendar integration** - Show relevant photos on birthdays, anniversaries, holidays
- **Seasonal themes** - Automatic seasonal or holiday-themed content
- **Wake/sleep schedule** - Auto on/off times to save power
- **Vacation mode** - Simulate presence with random display activity
- **Event countdown** - Display countdown to upcoming events with relevant photos

## Multi-User & Sharing

- **Family accounts** - Multiple users under one household
- **Role-based permissions** - Admin, contributor, viewer roles
- **Guest upload links** - QR codes for party guests to contribute photos
- **Shared streams** - Collaborative streams across family members
- **Remote family contributions** - Grandparents can add photos from afar
- **Approval workflow** - Review submitted photos before they appear
- **Photo requests** - Request specific photos from family members

## Device & Display Management

- **Multi-frame dashboard** - Manage all household frames from one view
- **Frame grouping** - Push content to multiple frames at once
- **Remote display settings** - Adjust brightness, orientation, transition effects remotely
- **Frame health monitoring** - Battery level, connectivity status, last sync time
- **Offline mode** - Robust caching for poor connectivity
- **Display calibration** - Color profile adjustments per frame
- **Orientation lock** - Portrait vs. landscape per stream

## Social & Interactive Features

- **Photo reactions** - Family members can heart/react to displayed photos
- **Comments** - Add comments visible when photo displays
- **Photo voting** - Vote on favorites for "best of" compilations
- **Caption contests** - Fun family caption games
- **Photo stories** - Curated sequences with captions telling a story
- **Live sharing** - Real-time photo sharing during events

## Information Widgets

- **Weather display** - Current conditions and forecast overlay
- **Clock/date** - Customizable clock display between photos
- **Calendar events** - Show upcoming appointments
- **News headlines** - Optional news ticker or headlines
- **Sports scores** - Live scores for favorite teams
- **Stock ticker** - Market updates for investors
- **Quotes of the day** - Inspirational or funny quotes

## Accessibility

- **Voice descriptions** - Audio descriptions of displayed photos
- **High contrast mode** - Enhanced visibility options
- **Large text overlays** - Bigger captions and UI elements
- **Screen reader support** - Full accessibility for web app
- **Colorblind modes** - Adjusted color palettes
- **Reduced motion** - Minimize transitions for sensitivity

## Health & Wellness

- **Blue light scheduling** - Warmer tones in evening hours
- **Gentle wake-up** - Gradual brightness increase as alarm
- **Meditation mode** - Calming nature photos with optional ambient sounds
- **Exercise reminders** - Activity prompts with motivational photos
- **Hydration reminders** - Periodic health nudges
- **Screen time awareness** - Suggested break notifications

## Analytics & Insights

- **Viewing statistics** - Which photos displayed most, engagement metrics
- **Storage analytics** - Usage by stream, file type breakdown
- **Device uptime** - Connectivity and display statistics
- **Family engagement** - Who's uploading, viewing, reacting
- **Popular times** - When the frame is viewed most

## Print & Physical Products

- **One-click print ordering** - Order prints of displayed photos
- **Photo book creation** - Generate photo books from streams
- **Canvas prints** - Order wall art from favorites
- **Calendar creation** - Generate yearly calendars from best photos
- **Gift integration** - Send framed prints to family

## Content Discovery

- **Curated art** - Optional famous artwork or photography
- **Nature screensavers** - Beautiful landscapes when no personal photos
- **Daily wallpapers** - Fresh content from curated sources
- **Museum partnerships** - Display artwork from partner institutions
- **Photographer spotlights** - Featured professional photography

## Privacy & Parental Controls

- **Kid-safe mode** - Restrict to approved content only
- **Guest mode** - Limited display when guests are present
- **Private photos** - Mark photos as "home only" vs. shareable
- **Viewing history** - Audit log of what was displayed
- **Data export** - Download all photos and metadata
- **Account deletion** - Full GDPR-compliant data removal

## Developer & Power User

- **API access** - Public API for custom integrations
- **Webhook support** - Trigger external actions on events
- **IFTTT/Zapier integration** - Connect to automation platforms
- **Custom CSS themes** - Personalize web app appearance
- **Plugin system** - Community-developed extensions
- **Self-hosting option** - Run entirely on own infrastructure
