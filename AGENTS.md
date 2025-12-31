# Froggie Frame - Agent Guidelines

## Architecture
Two-component system: **web/** (Next.js 14 + Supabase, deployed on Vercel) and **pi-frame/** (Python + Pygame for Raspberry Pi). See ARCHITECTURE.md for detailed diagrams.

## Build & Test Commands
```bash
# Web app (in web/)
npm install && npm run dev        # Development server
npm run build                     # Production build
npm run lint                      # ESLint
npm run type-check                # TypeScript check

# Pi Frame (in pi-frame/)
pip install -r requirements.txt   # Install deps
python3 froggie-frame.py start    # Run frame
```

## Code Style
- **Web**: TypeScript, Next.js App Router, Tailwind CSS, Zod for validation
- **Pi Frame**: Python 3, Click CLI, type hints encouraged
- Use existing patterns from neighboring files; prefer Supabase client from `lib/supabase/`
- Never commit secrets; use `.env.local` for credentials
- RLS policies enforce data isolation—always validate user ownership server-side
