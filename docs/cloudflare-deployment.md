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

Use the existing Seoul project and the free Hyperdrive binding. No paid resources
are required by this configuration. Free-plan CPU and request quotas still apply; build
success alone does not establish capacity for production load.

## Database

Production uses the `HYPERDRIVE` binding (`janggi-supabase`) to connect to the
Supabase direct endpoint. Hyperdrive verifies the Supabase CA and hostname with
`verify-full`; query caching is disabled and the origin connection limit is 5.
The public CA is `prod-ca-2021.crt` (expires April 26, 2031). Never disable
certificate verification to work around a connection error. Rotate the uploaded
CA before expiry. Local tests continue to use the loopback `DATABASE_URL`.
Hyperdrive is available within Workers Free quotas; no paid plan was enabled.

Back up any existing data before applying migrations. Apply all files under
`supabase/migrations` in order using the existing manual GitHub Actions migration
workflow. The 20260910 migration preserves Supabase records while converting
timestamps to epoch milliseconds and board fields to the repository wire format.
The browser has no direct access to private game tables; only the Worker may
write game state. Realtime remains a notification layer with polling fallback.

## Authentication

The app now uses Kakao OAuth, not email OTP. Follow `docs/kakao-login.md` to
configure provider credentials and the two distinct callback URLs. SMTP is not
required. Provider activation and a real Kakao login must be verified separately.

## GitHub Actions tag releases

`main` pushes and pull requests run CI only. Pushing a stable `vMAJOR.MINOR.PATCH`
tag runs the same app and database checks, then the `production` deployment job.
The tag must point to a commit merged into `main`. No tag is created automatically.
The tested `dist` artifact is deployed without rebuilding after migrations.

Required GitHub Actions secrets (repository or `production` environment):
- `CLOUDFLARE_API_TOKEN`: dedicated token scoped to the production Cloudflare account,
  with Workers deployment permissions. Do not copy a personal Wrangler OAuth token.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`.

Set the Cloudflare token in GitHub Settings → Secrets and variables → Actions.
Never paste it into chat or commit it. The workflow checks missing secrets before
migrations. Protect the production environment and release tags against untrusted changes.

Example (choose a new, unused version):
```sh
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

Disable automatic production-branch deployments in Cloudflare Workers Builds
(Worker → Settings → Builds) to prevent `main` pushes from bypassing this CI gate.
This repository workflow cannot itself disable a dashboard Git integration.
Do not remove existing Worker runtime secrets or Hyperdrive bindings.

Migrations and Worker deployment serialize with the manual Supabase workflow.
If Worker upload fails after migrations, fix and rerun the tagged workflow; schema
changes are not automatically reversed. Use backward-compatible migrations.
Smoke checks cover public HTTP responses, not authenticated two-player gameplay.

## Legacy Cloudflare Git build settings (disable automatic builds for tag releases)

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

1. Verify migrations, Worker secrets and Kakao login/logout.
2. Verify forged `oai-authenticated-*` headers do not authenticate anyone.
3. Register two distinct accounts and match simultaneously: exactly one game.
4. Choose both formations, exchange moves, approve/reject takeback, resign.
5. Confirm reconnect, persisted board, clock and exactly-once rating updates.
6. Check actual Worker CPU usage under free-plan limits.

Cleanup planning is in `docs/infra-cleanup.md`; no live resources are removed
by the cleanup script.
