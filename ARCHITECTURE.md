# Froggie Frame Architecture

This document describes the architecture of the Froggie Frame system, which consists of two main components: the Raspberry Pi photo frame application and the cloud-based web management interface.

## System Overview

```mermaid
graph TB
    subgraph "Cloud Infrastructure"
        subgraph "Vercel"
            WEB[Next.js Web App]
            API[API Routes]
        end
        subgraph "Supabase"
            AUTH[Auth Service]
            DB[(PostgreSQL)]
            STORAGE[Storage Buckets]
            RLS[Row Level Security]
        end
    end

    subgraph "Client Devices"
        BROWSER[Web Browser]
        PI[Raspberry Pi Frame]
    end

    BROWSER -->|HTTPS| WEB
    BROWSER -->|HTTPS| API
    WEB --> AUTH
    API --> AUTH
    API --> DB
    API --> STORAGE
    AUTH --> DB
    RLS --> DB

    PI -->|HTTPS REST API| API
    PI -->|Download Photos| STORAGE
```

## Component Architecture

### 1. Web Application (Next.js)

The web application follows Next.js 14 App Router conventions with a focus on security and user experience.

```mermaid
graph LR
    subgraph "Next.js App Router"
        subgraph "App Directory"
            LAYOUT[layout.tsx]
            PAGE[page.tsx]

            subgraph "Routes"
                AUTH_ROUTES[/auth/*]
                DASH[/dashboard]
                STREAMS[/streams/*]
                PHOTOS[/photos/*]
                SETTINGS[/settings]
            end

            subgraph "API Routes"
                API_AUTH[/api/auth/*]
                API_STREAMS[/api/streams/*]
                API_PHOTOS[/api/photos/*]
                API_DEVICE[/api/device/*]
            end
        end

        subgraph "Components"
            UI[UI Components]
            FORMS[Form Components]
            PROVIDERS[Context Providers]
        end

        subgraph "Lib"
            SUPABASE_CLIENT[Supabase Client]
            VALIDATORS[Input Validators]
            UTILS[Utilities]
        end
    end
```

#### Directory Structure

```
web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── verify-otp/
│   │   └── forgot-password/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── streams/
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── photos/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── streams/
│   │   ├── photos/
│   │   └── device/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   ├── photo/
│   ├── ai/
│   └── streams/
├── lib/
│   ├── supabase/
│   ├── validators/
│   ├── ai/
│   ├── exif/
│   └── utils/
├── hooks/
├── types/
└── middleware.ts
```

### 2. Raspberry Pi Application

The Pi Frame application is a lightweight Python application designed for minimal resource usage.

```mermaid
graph TB
    subgraph "Pi Frame Application"
        CLI[CLI Interface]
        CONFIG[Config Manager]
        SYNC[Photo Sync Service]
        DISPLAY[Display Engine]
        CACHE[Local Cache]

        CLI --> CONFIG
        CLI --> SYNC
        CLI --> DISPLAY

        SYNC --> CACHE
        DISPLAY --> CACHE
        CONFIG --> CACHE
    end

    subgraph "External"
        API_EXT[Cloud API]
        STORAGE_EXT[Supabase Storage]
    end

    SYNC -->|Fetch Metadata| API_EXT
    SYNC -->|Download Photos| STORAGE_EXT
```

#### Directory Structure

```
pi-frame/
├── froggie_frame/
│   ├── __init__.py
│   ├── cli.py
│   ├── config.py
│   ├── sync.py
│   ├── display.py
│   └── cache.py
├── froggie-frame.py
├── requirements.txt
├── froggie-frame.service
└── install.sh
```

## Data Model

```mermaid
erDiagram
    users ||--o{ photo_streams : owns
    users ||--o{ api_keys : has
    users ||--o{ otp_secrets : has
    photo_streams ||--o{ photos : contains
    photo_streams ||--o{ api_keys : "accessed by"

    users {
        uuid id PK
        string email
        string encrypted_password
        boolean email_confirmed
        timestamp created_at
        timestamp updated_at
    }

    otp_secrets {
        uuid id PK
        uuid user_id FK
        string encrypted_secret
        boolean is_enabled
        timestamp created_at
    }

    photo_streams {
        uuid id PK
        uuid user_id FK
        string name
        string description
        int slideshow_interval
        boolean shuffle
        string transition_effect
        timestamp created_at
        timestamp updated_at
    }

    photos {
        uuid id PK
        uuid stream_id FK
        uuid user_id FK
        string storage_path
        string filename
        string mime_type
        int file_size
        int width
        int height
        string thumbnail_path
        int sort_order
        float exif_latitude
        float exif_longitude
        float exif_altitude
        timestamp exif_captured_at
        int exif_orientation
        string mood
        float mood_confidence
        string ai_status
        timestamp ai_analyzed_at
        string ai_error
        timestamp created_at
    }

    photos ||--o{ photo_tags : has

    photo_tags {
        uuid id PK
        uuid photo_id FK
        string tag
        string category
        float confidence
        timestamp created_at
    }

    api_keys {
        uuid id PK
        uuid user_id FK
        uuid stream_id FK
        string key_hash
        string name
        timestamp last_used_at
        timestamp expires_at
        timestamp created_at
    }
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant A as Next.js API
    participant S as Supabase Auth
    participant D as Database

    Note over U,D: Registration Flow
    U->>B: Enter email, password
    B->>A: POST /api/auth/register
    A->>S: Create user
    S->>D: Store user
    S-->>A: User created
    A-->>B: Success + redirect to verify email

    Note over U,D: Login Flow (without 2FA)
    U->>B: Enter credentials
    B->>A: POST /api/auth/login
    A->>S: Verify credentials
    S->>D: Check user
    S-->>A: JWT tokens
    A-->>B: Set cookies, redirect to dashboard

    Note over U,D: Login Flow (with 2FA)
    U->>B: Enter credentials
    B->>A: POST /api/auth/login
    A->>S: Verify credentials
    S-->>A: Credentials valid, 2FA required
    A-->>B: Redirect to OTP page
    U->>B: Enter OTP code
    B->>A: POST /api/auth/verify-otp
    A->>D: Verify OTP against secret
    D-->>A: OTP valid
    A->>S: Complete login
    S-->>A: JWT tokens
    A-->>B: Set cookies, redirect to dashboard
```

## Photo Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant A as Next.js API
    participant S as Supabase Storage
    participant D as Database
    participant AI as AI Service

    U->>B: Select/drop photos
    B->>B: Client-side validation

    loop For each photo
        B->>A: POST /api/photos/upload
        A->>A: Validate file type, size
        A->>A: Convert HEIC to JPEG if needed
        A->>A: Extract EXIF metadata
        A->>S: Upload to storage
        S-->>A: Storage path
        A->>D: Create photo record with EXIF
        D-->>A: Photo ID
        A-->>B: Upload complete
        A->>AI: Queue AI analysis (async)
    end

    Note over AI,D: Background Processing
    AI->>AI: Analyze photo (mood, tags)
    AI->>D: Save analysis results

    B->>U: Show uploaded photos
```

## Pi Frame Sync Flow

```mermaid
sequenceDiagram
    participant P as Pi Frame
    participant A as Cloud API
    participant S as Supabase Storage
    participant C as Local Cache

    Note over P,C: Initial Setup
    P->>P: Read config file
    P->>A: GET /api/device/photos (with API key)
    A->>A: Validate API key
    A-->>P: Photo list with metadata

    Note over P,C: Photo Sync
    loop For each photo
        P->>C: Check if cached
        alt Not in cache
            P->>S: Download photo
            S-->>P: Photo data
            P->>C: Store in cache
        end
    end

    P->>A: POST /api/device/sync (report status)

    Note over P,C: Display Loop
    loop Slideshow
        P->>C: Get next photo
        C-->>P: Photo data
        P->>P: Display with transition
        P->>P: Wait interval
    end
```

## Security Architecture

### Authentication Security

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Transport"
            HTTPS[HTTPS Only]
            HSTS[HSTS Headers]
        end

        subgraph "Authentication"
            PASS[Password Hashing - bcrypt]
            OTP[TOTP 2FA]
            SESSION[Secure Sessions]
        end

        subgraph "Authorization"
            RLS_SEC[Row Level Security]
            API_AUTH[API Key Validation]
            RBAC[User Ownership Checks]
        end

        subgraph "Input Validation"
            SANITIZE[Input Sanitization]
            VALIDATE[Schema Validation]
            RATE[Rate Limiting]
        end
    end
```

### Row Level Security Policies

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own streams" ON photo_streams
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own photos" ON photos
    FOR SELECT USING (auth.uid() = user_id);

-- API keys can access associated stream's photos
CREATE POLICY "API keys can view stream photos" ON photos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM api_keys
            WHERE api_keys.stream_id = photos.stream_id
            AND api_keys.key_hash = current_setting('app.api_key_hash')
        )
    );
```

### Security Headers

The application implements comprehensive security headers:

```typescript
const securityHeaders = {
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co;
    connect-src 'self' https://*.supabase.co;
    frame-ancestors 'none';
  `,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "DNS/CDN"
        DNS[Custom Domain]
        CDN[Vercel Edge Network]
    end

    subgraph "Vercel"
        SERVERLESS[Serverless Functions]
        STATIC[Static Assets]
        ISR[Incremental Static Regeneration]
    end

    subgraph "Supabase Cloud"
        PG[PostgreSQL Database]
        AUTH_SVC[Auth Service]
        STORAGE_SVC[Storage Service]
        REALTIME[Realtime Subscriptions]
    end

    DNS --> CDN
    CDN --> SERVERLESS
    CDN --> STATIC

    SERVERLESS --> AUTH_SVC
    SERVERLESS --> PG
    SERVERLESS --> STORAGE_SVC
```

## Raspberry Pi Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Model | Raspberry Pi 3B | Raspberry Pi 4 (2GB+) |
| Storage | 8GB SD Card | 32GB+ SD Card |
| Display | HDMI-compatible | Official 7" Touchscreen |
| Network | WiFi or Ethernet | WiFi 5GHz |

## Performance Considerations

### Web App
- Server-side rendering for initial page loads
- Client-side caching with SWR
- Image optimization via Next.js Image component
- Lazy loading for photo galleries

### Pi Frame
- Local photo caching to minimize network requests
- Preloading next photos during slideshow
- Memory-efficient image handling
- Graceful handling of network interruptions

## Future Enhancements

1. **Real-time Updates**: WebSocket connection for instant photo updates
2. **Multiple Streams per Frame**: Allow frames to cycle through multiple streams
3. **Scheduling**: Time-based stream switching
4. **Analytics**: View statistics and frame status monitoring
5. **Mobile App**: Native iOS/Android companion app
6. **Smart Cropping**: Face detection for portrait photo cropping
7. **Photo Albums**: Auto-organize photos by location, date, or AI-detected content
