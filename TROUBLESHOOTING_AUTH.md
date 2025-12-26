# Troubleshooting Authentication: "Failed to fetch" Error

## Problem
Signup fails with "Failed to fetch" error when submitting a valid .edu email.

## Common Causes & Solutions

### 1. Missing Environment Variables

**Symptom**: Error occurs immediately, console shows "Supabase not configured"

**Solution**:
1. Create `.env` file in project root:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Restart the dev server** after creating/updating `.env`:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### 2. Invalid Supabase Credentials

**Symptom**: Network error, 401/403 responses

**Solution**:
1. Verify credentials in Supabase Dashboard:
   - Go to **Settings** → **API**
   - Copy **Project URL** (not project ref)
   - Copy **anon/public key** (not service_role key)

2. Check `.env` file:
   - No quotes around values
   - No trailing spaces
   - Correct format: `VITE_SUPABASE_URL=https://...`

### 3. CORS Issues

**Symptom**: CORS error in browser console

**Solution**:
1. Check Supabase dashboard → **Settings** → **API** → **CORS**
2. Ensure your localhost is allowed (should be by default)
3. For production, add your domain to allowed origins

### 4. Network Connectivity

**Symptom**: Timeout errors, network unreachable

**Solution**:
1. Check internet connection
2. Verify Supabase service status: https://status.supabase.com
3. Check firewall/proxy settings
4. Try accessing Supabase URL directly in browser

### 5. Supabase Project Issues

**Symptom**: 404 or project not found errors

**Solution**:
1. Verify project is active in Supabase dashboard
2. Check project hasn't been paused (free tier pauses after inactivity)
3. Verify project URL matches your project

## Diagnostic Steps

### Step 1: Check Environment Variables

Open browser console and check:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing')
```

### Step 2: Test Supabase Connection

In browser console:
```javascript
import { logSupabaseDiagnostics } from './src/lib/supabaseDiagnostics'
logSupabaseDiagnostics()
```

### Step 3: Test Direct API Call

```bash
curl -X POST 'https://your-project-id.supabase.co/auth/v1/otp' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@university.edu"}'
```

### Step 4: Check Browser Network Tab

1. Open DevTools → Network tab
2. Try to sign up
3. Look for the failed request
4. Check:
   - Request URL (should be your Supabase URL)
   - Request headers (should include apikey)
   - Response status and error message

## Quick Fix Checklist

- [ ] `.env` file exists in project root
- [ ] `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Values don't contain placeholder text
- [ ] Dev server was restarted after creating/updating `.env`
- [ ] Supabase project is active (not paused)
- [ ] Credentials are correct (from Supabase dashboard)
- [ ] No CORS errors in browser console
- [ ] Internet connection is working

## Error Messages Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Failed to fetch" | Network/CORS issue or missing config | Check .env and network |
| "Supabase not configured" | Missing env vars | Create .env file |
| "Unable to connect" | Network issue | Check connection and Supabase status |
| "Invalid API key" | Wrong credentials | Verify keys in Supabase dashboard |
| "Project not found" | Wrong URL | Check project URL |

## Still Having Issues?

1. **Check browser console** for detailed error messages
2. **Check Network tab** to see the actual request/response
3. **Verify Supabase project** is active and accessible
4. **Test with curl** to isolate frontend vs backend issues
5. **Check Supabase logs** in dashboard for server-side errors

## Testing After Fix

Once configured, test with:
```bash
# Should succeed
curl -X POST 'https://your-project.supabase.co/auth/v1/otp' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@university.edu"}'
```

Expected response: `{"message": "Email sent"}` or similar success message.

