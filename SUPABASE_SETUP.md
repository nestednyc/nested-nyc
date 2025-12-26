# Supabase Setup Guide for .edu Email Authentication

This guide will help you set up Supabase to enforce .edu email-only authentication.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - Name: `nested-nyc` (or your preferred name)
   - Database Password: (choose a strong password)
   - Region: (choose closest to your users)
4. Click "Create new project"

## Step 2: Get Your API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

## Step 3: Configure Environment Variables

1. Create a `.env` file in the root of your project:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials to `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Important**: Add `.env` to your `.gitignore` to keep your keys secure!

## Step 4: Set Up Email Domain Restriction (Backend Enforcement)

**⚠️ IMPORTANT**: For production, you MUST set up backend enforcement to prevent users from bypassing frontend validation.

See **[BACKEND_ENFORCEMENT_SETUP.md](./BACKEND_ENFORCEMENT_SETUP.md)** for complete instructions on enforcing .edu email validation at the backend level.

Supabase doesn't have built-in email domain restrictions, so we'll use a combination of:

### Option A: Database Function (Recommended)

1. Go to **SQL Editor** in your Supabase dashboard
2. Run this SQL to create a function that validates .edu emails:

```sql
-- Function to check if email is .edu
CREATE OR REPLACE FUNCTION is_edu_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~* '@.*\.edu$' OR 
         email ~* '@.*\.ac\.uk$' OR
         email ~* '@.*\.edu\.au$' OR
         email ~* '@.*\.edu\.ca$' OR
         email ~* '@.*\.ac\.za$';
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate email on signup
CREATE OR REPLACE FUNCTION validate_edu_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_edu_email(NEW.email) THEN
    RAISE EXCEPTION 'Only .edu email addresses are allowed. Please use your university email address.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table
-- Note: You may need to enable this via Supabase dashboard or contact support
-- as direct triggers on auth.users may require special permissions
```

### Option B: Edge Function (Alternative)

1. Go to **Edge Functions** in Supabase dashboard
2. Create a new function called `validate-email`
3. This function will be called before user creation

### Option C: Postgres Hook (Most Reliable)

1. Go to **Database** → **Functions** in Supabase
2. Create a function that runs on user creation
3. Use Supabase's webhook system to validate emails

## Step 5: Configure Email Templates

1. Go to **Authentication** → **Email Templates** in Supabase
2. Customize the "Magic Link" template to mention .edu requirement
3. Update the confirmation email template

## Step 6: Test the Setup

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/uni-email` in your app
3. Try entering:
   - ✅ `student@university.edu` (should work)
   - ❌ `user@gmail.com` (should show error)
   - ❌ `test@company.com` (should show error)

## Step 7: Production Considerations

### Rate Limiting
- Configure rate limits in Supabase dashboard to prevent abuse
- Go to **Authentication** → **Rate Limits**

### Email Verification
- Ensure email verification is enabled
- Go to **Authentication** → **Settings** → **Email Auth**
- Enable "Confirm email"

### Custom SMTP (Optional)
- For production, set up custom SMTP
- Go to **Settings** → **Auth** → **SMTP Settings**

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env` file has the correct keys
- Restart your dev server after changing `.env`

### Emails not sending
- Check Supabase dashboard for email logs
- Verify SMTP settings if using custom SMTP
- Check spam folder

### Domain validation not working
- The frontend validation should catch most cases
- Backend validation via database function provides additional security
- Check Supabase logs for any errors

## Security Notes

1. **Never commit `.env` file** - It contains sensitive keys
2. **Use Row Level Security (RLS)** - Enable RLS on your tables
3. **Validate on both frontend and backend** - Frontend for UX, backend for security
4. **Monitor auth logs** - Regularly check Supabase dashboard for suspicious activity

## Additional Resources

- **[BACKEND_ENFORCEMENT_SETUP.md](./BACKEND_ENFORCEMENT_SETUP.md)** - Complete guide for backend email validation enforcement
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)


