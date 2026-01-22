# Nested NYC

Student-only project network for NYC universities.

## Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

## Authentication Setup

This app enforces **university-only authentication** using .edu email addresses.

### Quick Setup

1. **Create Supabase project** at [supabase.com](https://supabase.com)
2. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```
3. **Add your Supabase credentials** to `.env`

## Build

```bash
npm run build
```

## Tech Stack

- React 18
- React Router 6
- Vite 5
- Tailwind CSS 3
- Supabase Auth (with .edu email enforcement)

// demo commit
