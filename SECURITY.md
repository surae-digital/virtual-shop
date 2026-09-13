# Security rules for Surae Digital Shop

- `surae-config.js` may contain only the public Supabase project URL and public anon/publishable key.
- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, database passwords, GitHub tokens, or Z.com credentials.
- Canonical balances, orders, prices, payment references and proof files are stored in Supabase, not browser storage.
- Payment proofs and piloting signatures use private Supabase Storage buckets.
- Financial SECURITY DEFINER RPCs are revoked from browser roles and executable only by `service_role` through trusted Edge Functions.
- Admin and Staff authorization is checked server-side against `public.user_roles`.
- Guest tracking uses a 256-bit random token; only its SHA-256 hash is stored in the database.
- If a private key is ever committed, rotate it immediately; deleting it from a later commit is not enough.

## Checkout integrity
- Checkout requests use a 256-bit client request ID. Supabase stores only its SHA-256 hash and enforces uniqueness so network retries cannot create a second debit/order.
- Product prices, availability, cart quantities, payment methods and piloting quotes are revalidated server-side. Browser totals are display-only.
- Cancelled, Rejected, Completed/fulfilled and refunded-credit states have protected transitions; terminal orders cannot be silently reactivated.
- Payment reference uniqueness is normalized server-side to reduce duplicate-reference variants.
