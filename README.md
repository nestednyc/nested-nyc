# Nested NYC

Student-only project network for NYC universities — live at **[nested.social](https://nested.social)**.

Students discover projects, post their own, find teammates, and browse campus events. Signing up requires a university `.edu` email.

## Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the env template and add your project URL + anon key:
   ```bash
   cp .env.example .env
   ```
3. Apply the SQL in `supabase/migrations/` in order

## Build

```bash
npm run build
```

## Tech stack

- React 18 + Vite 5
- Supabase (Postgres, Auth, Storage, RLS, Realtime)
- Vercel
