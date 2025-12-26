# Quick Start: Environment Variables Setup

## Local Development

### Step 1: Create .env file
```bash
cp .env.example .env
```

### Step 2: Add your Supabase credentials
Edit `.env` and add:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get credentials from: https://app.supabase.com/project/_/settings/api

### Step 3: Restart dev server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 4: Verify
Check browser console:
- ✅ "Supabase client initialized successfully" = Working!
- ⚠️ Warning message = Check your .env file

## Production (Vercel)

### Step 1: Go to Vercel Dashboard
- Project → Settings → Environment Variables

### Step 2: Add Variables
Click "Add New" and add:
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://your-project-id.supabase.co`
- **Environment**: Production (and Preview if needed)

- **Name**: `VITE_SUPABASE_ANON_KEY`
- **Value**: `your-anon-key-here`
- **Environment**: Production (and Preview if needed)

### Step 3: Redeploy
- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"

## Important Notes

- ✅ Variables **must** start with `VITE_` (Vite requirement)
- ✅ `.env` file is **not** committed (in .gitignore)
- ✅ Restart dev server after changing `.env`
- ✅ Redeploy after changing Vercel env vars

## Troubleshooting

**Error: "Supabase is not configured"**
1. Check `.env` file exists in project root
2. Check variable names are correct (`VITE_SUPABASE_URL`, not `SUPABASE_URL`)
3. Check no typos in values
4. Restart dev server

**Still not working?**
- Check browser console for detailed error messages
- See `ENV_SETUP_FIX.md` for complete troubleshooting guide

