# Supabase + Resend configuration

This project is now fully structured around Supabase as the canonical backend. It does **not** use localStorage as the source of truth for balances, orders, products, payment proofs or customer accounts.

## Public frontend configuration
`surae-config.js` is already configured with this Supabase project:

- Project URL: `https://yoceazwcewyksfzafhlu.supabase.co`
- Public anon key: configured in the file

The public anon key is intentionally browser-visible. Never place a service-role key in this file.

The production `siteUrl` is configured as `https://suraedigitalshop.com`.

## Database
Run `supabase/migrations/20260913_production.sql` once in the Supabase SQL Editor. The migration is designed to create the production tables, RLS policies, private Storage buckets, atomic wallet/order functions, initial products and Piloting rates.

Critical financial RPCs are explicitly revoked from `anon` and `authenticated`; they are callable only through trusted service-role Edge Functions.

## Edge Functions
Deploy:
- `shop-api`
- `track-order`
- `resend-webhook`

## Required server-side secrets
Set these in Supabase Edge Function Secrets / CLI, never in GitHub frontend files:
- `RESEND_API_KEY`
- `RESEND_FROM`
- `SITE_ORIGIN`
- `SITE_URL`
- `RESEND_WEBHOOK_SECRET`

Supabase automatically provides its project runtime credentials to Edge Functions; do not copy a service-role key into frontend code.

## Payment flow
- Guests: Bank / GCash / PayMaya only.
- Registered players: Bank / GCash / PayMaya / Surae Credits.
- Surae Credits are deducted atomically only when checkout succeeds; the order starts at Processing.
- Insufficient credits prevent order creation.
- Wallet top-up accepts Bank / GCash / PayMaya only.
- External payments require a unique reference and a private JPG/PNG/WebP proof file up to 5 MB.
- Admin verification is required before an external-payment order can be Processing or Completed.
- Wallet top-up fulfillment and Surae-Credit refunds are exactly-once database operations.

## Guest tracking
Guest orders receive a 256-bit random tracking token in their receipt. Only its SHA-256 hash is stored. The tracking endpoint exposes a restricted order view and never returns payment proof, full payment reference, contact details, credentials or internal notes.

See `DEPLOYMENT-CHECKLIST.md` for the complete setup sequence and mandatory live verification steps.
