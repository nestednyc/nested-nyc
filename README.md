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

## Tests

```bash
npm test           # unit tests (node --test, every *.test.js)
npm run test:db    # SQL acceptance proofs — needs the local Supabase stack (supabase start)
```

GitHub Actions runs the unit tests, the production build and a syntax check on every push (`.github/workflows/ci.yml`), and applies every migration to a fresh Postgres + runs the SQL proofs when `supabase/` changes (`db.yml`). Vercel runs `npm test` (the unit tests) before every build, so a red unit test never deploys; the Actions workflows are checks, not deploy gates.

## Tech stack

- React 18 + Vite 5
- Supabase (Postgres, Auth, Storage, RLS, Realtime)
- Vercel
