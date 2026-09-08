# Infrastructure

## Current production

The deployed Sites application uses Cloudflare D1 and ChatGPT sign-in as its source
of truth. Supabase Realtime carries opaque match-update signals; clients respond by
fetching the latest authorized state from the Sites API. No board, move, account, or
chat content is exposed through the public Realtime subscription.

## Continuous integration

`.github/workflows/ci.yml` runs for pull requests and pushes to `main`:

1. installs dependencies with Node.js 22;
2. checks application-owned source, TypeScript, and the production build;
3. starts a local Supabase stack, rebuilds the database from migrations, and lints it.

No repository secret is needed for CI because database checks run locally. The
separate `Deploy Supabase migrations` workflow is intentionally manual and uses the
protected `production` GitHub environment.

## Local Supabase

Install Docker and the Supabase CLI, then run:

```sh
supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor
supabase db reset
supabase db lint --level warning --fail-on warning
```

Stop the local services with `supabase stop`.

## Connecting a hosted Supabase project

Create a Supabase project, then configure these GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

After adding the secrets, run the `Deploy Supabase migrations` workflow from the
GitHub Actions page. It first previews pending changes and then applies them. You can
also link and push from a trusted developer machine:

```sh
supabase link --project-ref "$SUPABASE_PROJECT_ID"
supabase db push
```

Do not commit `.env`, access tokens, database passwords, or service-role keys. The
service-role key is server-only. Row-level security is enabled and intentionally has
no client policies yet, so direct browser access remains denied until those access
rules are designed.

## Migration plan

1. Keep D1 as the source of truth while Supabase is validated.
2. Add a server-side repository adapter for Supabase.
3. Backfill D1 data into Supabase and compare counts/checksums.
4. Enable realtime match subscriptions and perform two-account tests.
5. Switch reads, then writes, with a documented rollback window.
