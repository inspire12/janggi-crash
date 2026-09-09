# Cloudflare + Supabase deployment

The runtime no longer uses Sites authentication or D1. Former Sites data has
not been imported or deleted. `db/schema.ts` is the historical D1 schema;
Supabase migrations are now authoritative. Do not run `db:generate` for production.

## Required Worker secrets

- `DATABASE_URL`: Supabase Connect → Transaction pooler, port 6543. URL-encode
  the password. Never put it in build variables, git, screenshots or chat.
- `SUPABASE_URL`: project API URL.
- `SUPABASE_ANON_KEY`: browser-safe project key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only, used to publish match notifications.

Use the existing Seoul project. No paid resources or Hyperdrive are required
by this configuration. Free-plan CPU and request quotas still apply; build
success alone does not establish capacity for production load.

## Database

Back up any existing data before applying migrations. Apply all files under
`supabase/migrations` in order using the existing manual GitHub Actions migration
workflow. The 20260910 migration preserves Supabase records while converting
timestamps to epoch milliseconds and board fields to the repository wire format.
The browser has no direct access to private game tables; only the Worker may
write game state. Realtime remains a notification layer with polling fallback.

## Authentication

Enable Supabase Email authentication. In the Magic Link email template include
`{{ .Token }}` (the app accepts an emailed OTP, not a magic-link callback).
Set the site URL to the deployed Worker URL.
Supabase's default mail service is restricted; configure a verified SMTP provider
before inviting arbitrary players. Never disable email verification to bypass it.
Kakao login needs provider credentials and is not enabled by this migration.

## Cloudflare Git build settings

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Preview/version command: `npx wrangler versions upload --config dist/server/wrangler.json`
- Root: `/`

The root `wrangler.jsonc` also supports the existing bare `wrangler deploy`
command by building first; it prevents incorrect Vite static auto-detection.
The generated Worker is named `janggi-crash`
and enables its workers.dev URL. Keep the Workers Free plan selected.

## Acceptance checks before calling the deployment playable

1. Verify migrations, Worker secrets, email delivery and OTP login/logout.
2. Verify forged `oai-authenticated-*` headers do not authenticate anyone.
3. Register two distinct accounts and match simultaneously: exactly one game.
4. Choose both formations, exchange moves, approve/reject takeback, resign.
5. Confirm reconnect, persisted board, clock and exactly-once rating updates.
6. Check actual Worker CPU usage under free-plan limits.

Cleanup planning is in `docs/infra-cleanup.md`; no live resources are removed
by the cleanup script.
