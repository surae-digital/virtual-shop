# Surae Digital Shop — Production deployment checklist

Use this order: **GitHub → Supabase → Resend → Z.com/custom domain → live transaction verification**.

## 1. GitHub
1. Create a repository, for example `Surae-Digital-Shop`.
2. Upload the complete contents of this package to the repository root.
3. Do **not** add any service-role, Resend, database, Z.com or GitHub private credentials to files.
4. In GitHub: **Settings → Pages → Source → GitHub Actions**.
5. The included `.github/workflows/pages.yml` publishes only the storefront files; the `supabase/` backend source and setup documents are not included in the public Pages artifact.
6. Push to `main` and confirm the Pages URL opens the storefront.

## 2. Supabase database
Project ref: `yoceazwcewyksfzafhlu`

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Run the full file: `supabase/migrations/20260913_production.sql`.
4. Confirm the tables, private Storage buckets, functions and RLS policies were created without errors.
5. In **Authentication → URL Configuration**, set the Site URL to your final HTTPS shop domain once it is known. Add the GitHub Pages URL temporarily while testing if necessary.

### Create the first Admin
1. Register a normal account through the storefront or create a user in Supabase Auth.
2. Copy that user's UUID from **Authentication → Users**.
3. Run in SQL Editor, replacing the UUID:

```sql
update public.user_roles
set role = 'admin'
where user_id = 'USER-UUID-HERE';
```

Do not create an Admin role from frontend JavaScript.

## 3. Deploy Supabase Edge Functions
Install the Supabase CLI on your own computer, log in and link the project:

```bash
supabase login
supabase link --project-ref yoceazwcewyksfzafhlu
supabase functions deploy shop-api
supabase functions deploy track-order
supabase functions deploy resend-webhook
```

The project contains `supabase/config.toml` with JWT verification disabled for these endpoints because authentication/authorization is explicitly handled inside the functions. Admin endpoints still require a valid user session and Admin/Staff database role.

## 4. Resend
1. Add and verify your sending domain in Resend.
2. Add the DNS records Resend gives you inside Z.com DNS.
3. Create a Resend API key.
4. Never put that key in GitHub or `surae-config.js`.
5. Set the Edge Function secrets in Supabase. Replace the examples with your real values:

```bash
supabase secrets set \
  RESEND_API_KEY="YOUR_PRIVATE_RESEND_KEY" \
  RESEND_FROM="Surae Digital Shop <orders@suraedigitalshop.com>" \
  SITE_ORIGIN="https://suraedigitalshop.com" \
  SITE_URL="https://suraedigitalshop.com" \
  RESEND_WEBHOOK_SECRET="YOUR_PRIVATE_WEBHOOK_SECRET"
```

`SITE_ORIGIN` may contain comma-separated allowed origins while testing, for example your GitHub Pages origin and final domain.

6. In Resend, create a webhook pointing to:

`https://yoceazwcewyksfzafhlu.supabase.co/functions/v1/resend-webhook`

Subscribe to the email delivery events you want recorded (for example sent/delivered/bounced/complained).

## 5. Z.com / custom domain
1. In GitHub Pages, add your final custom domain. `suraedigitalshop.com` is a simple recommended primary hostname.
2. GitHub will show the DNS records required for that repository/domain. Add those exact records in Z.com DNS.
3. Add the Resend SPF/DKIM records exactly as shown by Resend. GitHub and Resend DNS records can coexist.
4. Wait until GitHub reports the domain verified and HTTPS is available.
5. Update `surae-config.js`:

```js
siteUrl: 'https://suraedigitalshop.com'
```

6. Make sure the same final origin is stored in Supabase `SITE_URL` and `SITE_ORIGIN` secrets, then redeploy the Edge Functions if necessary.

## 6. Product/pricing setup before launch
The migration seeds the existing product catalog at **₱0.00 intentionally**. Products with zero price cannot be purchased.

1. Log in to `admin.html` using the Admin account.
2. Enter the final price, visibility and stock state for each product you intend to sell.
3. Configure MLBB and CODM Piloting rates.
4. Confirm payment methods under Admin settings.
5. Keep the store offline until the live verification below is complete if desired.

## 7. Production verification — required before accepting real money
Perform these with a small controlled payment/reference, then reverse/refund it manually as appropriate:

- Guest checkout by Bank, GCash and PayMaya.
- Registered checkout by Bank, GCash and PayMaya.
- Registered Surae Credits order: confirm credits are deducted only after Place Order and status starts at Processing.
- Insufficient Surae Credits: confirm no order is created and Top Up prompt appears.
- Wallet top-up: confirm credits do not increase until Admin verifies proof and marks the top-up Completed.
- Duplicate payment reference: confirm second use is rejected.
- Invalid/oversized/non-image proof: confirm rejected.
- Admin cannot move an unverified external-payment order to Processing or Completed.
- Cancelling/rejecting a Surae-Credits order refunds exactly once and the refunded order cannot be reactivated.
- Completing a wallet top-up credits exactly once.
- Guest receipt arrives and its private Track Order link works.
- Registered receipt opens the player Orders area.
- Admin status change produces the expected status email.
- Payment proof is accessible only through the Admin signed URL and not by a public Storage URL.
- Log out and verify protected Player/Admin pages no longer expose the signed-in session.

Only after these live checks pass should the store be considered ready to receive production payments.

## Final source QA
The packaged source passed the checks documented in `QA-REPORT-FINAL.txt`. Complete the live smoke tests above after deployment because external Supabase, Resend and DNS configuration cannot be validated by static source QA alone.
