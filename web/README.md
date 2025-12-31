# Froggie Frame Web App

A Next.js 14 application for managing photo streams and frames.

## Features

- User authentication with email/password
- Two-factor authentication (TOTP)
- Photo stream creation and management
- Photo upload with drag-and-drop
- API key generation for Pi Frames
- Light and dark mode UI
- Responsive design

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Deployment**: Vercel
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

### Database Setup

Run the SQL migrations in `/supabase/migrations` in order:

1. `001_initial_schema.sql`
2. `002_row_level_security.sql`
3. `003_storage_setup.sql`

## Project Structure

```
web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── forms/            # Form components
│   └── ...
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── supabase/        # Supabase client setup
│   ├── validators/      # Zod schemas
│   └── utils/           # Helper functions
├── types/               # TypeScript types
└── middleware.ts        # Next.js middleware
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript check

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns
- Use Tailwind CSS for styling
- Validate inputs with Zod schemas

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Other Platforms

Build the production bundle:
```bash
npm run build
```

The output is in `.next/` directory.

## API Endpoints

### Authentication
- `POST /api/auth/verify-otp` - Verify 2FA code
- `POST /api/auth/setup-otp` - Generate 2FA secret
- `PUT /api/auth/setup-otp` - Enable 2FA
- `DELETE /api/auth/setup-otp` - Disable 2FA

### Streams
- `POST /api/streams/api-key` - Generate API key for stream

### Device (Pi Frame)
- `GET /api/device/photos` - Get photos for stream (API key auth)
- `POST /api/device/sync` - Report sync status

## License

Apache License 2.0
