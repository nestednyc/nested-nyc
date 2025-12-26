# Backend Enforcement Setup Guide

This guide shows you how to enforce .edu email validation at the **backend level** in Supabase, ensuring that even if someone bypasses frontend validation, they cannot create an account with a non-.edu email.

## Why Backend Enforcement?

- **Security**: Frontend validation can be bypassed
- **Data Integrity**: Ensures only valid university emails exist in your database
- **Compliance**: Meets requirements for student-only platforms

## Method 1: Edge Function with Auth Hook (Recommended)

This is the most reliable method and works with Supabase's auth system.

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login and Link Project

1. **Login to Supabase**:
   ```bash
   supabase login
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Supabase dashboard → Settings → General → Reference ID)

### Step 3: Deploy the Edge Function

```bash
supabase functions deploy validate-email
```

### Step 4: Set Up Auth Hook in Supabase Dashboard

1. Go to your **Supabase Dashboard**
2. Navigate to **Database** → **Hooks** (or **Database** → **Webhooks**)
3. Click **Create a new hook** (or **New Webhook**)
4. Configure:
   - **Name**: `validate-edu-email`
   - **Table**: `auth.users`
   - **Events**: Select `INSERT`
   - **Type**: `HTTP Request`
   - **HTTP Request**:
     - **Method**: `POST`
     - **URL**: `https://your-project-ref.supabase.co/functions/v1/validate-email`
     - **Headers**:
       ```
       Authorization: Bearer YOUR_SERVICE_ROLE_KEY
       Content-Type: application/json
       ```
     - **Body**:
       ```json
       {
         "email": "{{ $1.email }}",
         "type": "signup"
       }
       ```

5. **Enable the hook** and save

**Note**: If you don't see Hooks/Webhooks in your dashboard, you may need to use the SQL approach (Method 2) or set up the hook via SQL.

### Step 5: Set Service Role Key

The Edge Function needs the service role key. Set it when deploying:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or set it in the Supabase dashboard under **Settings** → **API** → **service_role key** (keep this secret!)

---

## Method 2: Database Function + Trigger (Alternative)

This method uses PostgreSQL triggers to validate emails.

### Step 1: Run the Migration

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `supabase/migrations/001_enforce_edu_emails.sql`
3. Run the SQL script

### Step 2: Create the Trigger

**Note**: Direct triggers on `auth.users` may require special permissions. If you can't create a trigger directly, use Method 1 (Edge Function) instead.

If you have the necessary permissions, run this in SQL Editor:

```sql
-- Create trigger on auth.users (requires elevated permissions)
CREATE TRIGGER validate_edu_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_edu_email_on_signup();
```

### Step 3: Test

Try creating a user with a non-.edu email - it should be rejected.

---

## Method 3: Using Supabase Auth Hooks (Simplest)

Supabase now supports auth hooks that can intercept signup events.

### Step 1: Create Auth Hook Function

1. Go to **Database** → **Functions** in Supabase dashboard
2. Create a new function or use the SQL from the migration file
3. The function will automatically be called on user signup

### Step 2: Configure Hook

In Supabase dashboard:
1. Go to **Authentication** → **Hooks**
2. Create a new hook that calls your validation function
3. Set it to trigger on `user.created` event

---

## Testing Backend Enforcement

### Test 1: Valid .edu Email (Should Succeed)

```bash
curl -X POST 'https://your-project-ref.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@university.edu",
    "password": "securepassword123"
  }'
```

**Expected**: Success (200 OK)

### Test 2: Invalid Non-.edu Email (Should Fail)

```bash
curl -X POST 'https://your-project-ref.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@gmail.com",
    "password": "securepassword123"
  }'
```

**Expected**: Error (400 Bad Request) with message about .edu emails only

### Test 3: Bypass Frontend Validation

1. Open browser DevTools
2. Disable JavaScript or modify the form
3. Try to submit signup form with non-.edu email
4. **Expected**: Request should still be rejected by backend

### Test 4: Direct API Call (Bypass Frontend)

Use Postman or curl to directly call the Supabase auth API with a non-.edu email. It should be rejected.

---

## Quick Setup (Recommended Path)

1. **Deploy Edge Function**:
   ```bash
   supabase functions deploy validate-email
   ```

2. **Set up Auth Hook** in Supabase dashboard (see Method 1, Step 4)

3. **Test** with the curl commands above

4. **Monitor** logs in Supabase dashboard → Logs → Edge Functions

---

## Monitoring

Check your Supabase logs to see validation attempts:
1. Go to **Logs** → **Edge Functions**
2. Filter by `validate-email` function
3. Review validation attempts and failures

## Troubleshooting

### Edge Function Not Being Called
- Check hook configuration in Supabase dashboard
- Verify function URL is correct: `https://your-project-ref.supabase.co/functions/v1/validate-email`
- Check function logs for errors
- Ensure service role key is set correctly

### Function Returns 500 Error
- Check function logs in Supabase dashboard
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Ensure function has proper permissions
- Check that the function code is deployed correctly

### Validation Not Working
- Test the function directly via curl:
  ```bash
  curl -X POST 'https://your-project-ref.supabase.co/functions/v1/validate-email' \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@gmail.com", "type": "signup"}'
  ```
- Check that hook is enabled
- Verify email format in function logic matches your requirements

### Hook Not Available in Dashboard
- Some Supabase projects may not have the Hooks UI
- Use Method 2 (Database Function + Trigger) instead
- Or contact Supabase support to enable hooks

## Security Best Practices

1. **Never expose service role key** in frontend code
2. **Use environment variables** for all secrets
3. **Enable rate limiting** in Supabase dashboard (Settings → Auth → Rate Limits)
4. **Monitor auth logs** for suspicious activity
5. **Keep function code updated** with latest validation rules
6. **Use HTTPS** for all API calls in production

## Supported Email Domains

The validation currently supports:
- `.edu` - US universities
- `.ac.uk` - UK universities
- `.edu.au` - Australian universities
- `.edu.ca` - Canadian universities
- `.ac.za` - South African universities
- `.edu.sg` - Singapore universities
- `.ac.jp` - Japanese universities
- `.edu.cn` - Chinese universities
- `.ac.in` - Indian universities
- `.edu.mx` - Mexican universities
- `.edu.br` - Brazilian universities

To add more domains, update the `isEduEmail` function in:
- `supabase/functions/validate-email/index.ts`
- `supabase/migrations/001_enforce_edu_emails.sql`

## Next Steps

After setting up backend enforcement:
1. ✅ Test thoroughly with various email formats
2. ✅ Monitor logs for validation attempts
3. ✅ Update frontend error messages to match backend errors
4. ✅ Consider adding email domain whitelist for specific universities
5. ✅ Set up alerts for repeated validation failures
6. ✅ Document your validation rules for your team

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
