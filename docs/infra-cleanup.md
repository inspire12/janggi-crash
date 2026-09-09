# Infrastructure cleanup

Run `node scripts/infra-cleanup.mjs` to review all known project resources, or pass
`cloudflare`, `supabase`, or `sites` to narrow the plan. This command is read-only;
it never deletes resources, opens credentials, or calls provider APIs. The inventory
is the known project configuration, not a live resource discovery result.

The Sites application still owns the authoritative D1 game data and ChatGPT login.
Supabase currently supplies Realtime signals. Neither service is disposable merely
because a Cloudflare Worker has been created. Complete and verify the migration
before retiring either resource.

Delete a remote resource only after reviewing its exact identity, backing up data,
and obtaining explicit approval. Disable its deployment automation first to avoid
recreating it accidentally. Do not delete unrelated projects or shared tokens.
