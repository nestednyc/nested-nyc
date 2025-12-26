# Validate Email Edge Function

This Edge Function enforces .edu email validation at the backend level, preventing non-university emails from being used for signup even if frontend validation is bypassed.

## Deployment

### Prerequisites
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref your-project-ref`

### Deploy

```bash
# From project root
supabase functions deploy validate-email
```

### Set Service Role Key

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get your service role key from: Supabase Dashboard → Settings → API → service_role key

## Usage

This function is called automatically via Supabase Auth Hooks when a user attempts to sign up.

### Manual Testing

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/validate-email' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "type": "signup"
  }'
```

Expected response for invalid email:
```json
{
  "error": "INVALID_EMAIL_DOMAIN",
  "message": "Only .edu email addresses are allowed. Please use your university email address."
}
```

## Configuration

The function validates emails ending in:
- `.edu` (US universities)
- `.ac.uk` (UK universities)
- `.edu.au` (Australian universities)
- `.edu.ca` (Canadian universities)
- `.ac.za` (South African universities)
- And more (see function code)

To add more domains, edit the `isEduEmail` function in `index.ts`.

