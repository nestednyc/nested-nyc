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
4. **Set up backend enforcement** (required for production):
   - See **[BACKEND_ENFORCEMENT_SETUP.md](./BACKEND_ENFORCEMENT_SETUP.md)** for complete instructions
   - This ensures non-.edu emails cannot be used even if frontend validation is bypassed

### Documentation

- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Initial Supabase setup guide
- **[BACKEND_ENFORCEMENT_SETUP.md](./BACKEND_ENFORCEMENT_SETUP.md)** - Backend email validation enforcement
- **[AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)** - Authentication implementation details

## Build

```bash
npm run build
```

## Testing Backend Validation

Test that backend enforcement is working:

```bash
./scripts/test-backend-validation.sh
```

## Tech Stack

- React 18
- React Router 6
- Vite 5
- Tailwind CSS 3
- Supabase Auth (with .edu email enforcement)

// demo commit
