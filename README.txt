SURAE DIGITAL SHOP — FINAL PRODUCTION SOURCE (v51)

This repository is the canonical project package for the storefront, Admin portal, Supabase backend and Resend transactional-email integration.

FRONTEND
- Static HTML/CSS/JavaScript, suitable for GitHub Pages.
- Public Supabase project URL and anon key are already configured in surae-config.js.
- Cart and Supabase login session are the only browser-local state. Money, balances, orders, products and proofs are canonical in Supabase.

BACKEND
- Supabase migration: supabase/migrations/20260913_production.sql
- Edge Functions: supabase/functions/
- Private payment-proof and piloting-signature Storage buckets are created by the migration.
- Admin/Staff actions are server-authorized.

EMAIL / TRACKING
- Resend is called only from Supabase Edge Functions.
- Guest receipts contain an unguessable private tracking link.
- Registered-player receipts link to their account/order page.
- Resend delivery events can be recorded through the webhook function.

DEPLOYMENT
Read DEPLOYMENT-CHECKLIST.md from top to bottom. Do not accept real customer payments until every Production Verification item is complete.
