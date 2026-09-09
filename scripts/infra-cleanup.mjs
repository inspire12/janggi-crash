#!/usr/bin/env node
// Read-only cleanup planner: never executes remote mutations or reads secrets.
const targets = {
  cloudflare: {
    resource: 'janggi-crash',
    account: '48890562f463f171894825cde58e83f1',
    url: 'https://dash.cloudflare.com/48890562f463f171894825cde58e83f1/workers/services/view/janggi-crash/production',
    steps: [
      'Confirm this Worker is no longer serving users.',
      'Export its configuration and record secret names without exposing values.',
      'Disconnect its Git build trigger and disable any deployment workflow targeting it.',
      'Delete only janggi-crash in the dashboard after reviewing its bindings.',
      'Do not delete bound D1/R2 resources: they require their own backup and review.',
    ],
  },
  supabase: {
    resource: 'puiwukfftwbwkdsnpwuw (janggi-clash)',
    url: 'https://supabase.com/dashboard/project/puiwukfftwbwkdsnpwuw',
    steps: [
      'Confirm both the Cloudflare app and the Sites app have stopped using this project.',
      'Export database data, schema, Auth configuration and Storage objects; verify restoration.',
      'Disable the Deploy Supabase migrations GitHub workflow.',
      'Prefer pausing the project when available; permanent deletion requires separate approval.',
      'After retirement, remove project-specific GitHub and application secrets.',
      'Do not revoke a shared Supabase access token used by other projects.',
    ],
  },
  sites: {
    resource: 'appgprj_6a9d67dd61d88191be9a4f780384e5d5',
    url: 'https://janggi-clash-prototype.inspire12.chatgpt.site',
    steps: [
      'Complete independent authentication and database migration first.',
      'Verify account creation and a full two-player game on the replacement deployment.',
      'Export and verify the Sites D1 database before retiring this site.',
      'Retire the site through Sites settings only after confirming the replacement works.',
    ],
  },
};
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !Object.hasOwn(targets, args[0]) && args[0] !== 'all')) {
  console.error('Usage: node scripts/infra-cleanup.mjs [all|cloudflare|supabase|sites]');
  console.error('Read-only planner. No --apply or deletion option is supported.');
  process.exitCode = 1;
} else {
  const selection = !args[0] || args[0] === 'all' ? Object.entries(targets) : [[args[0], targets[args[0]]]];
  console.log('CLEANUP PREVIEW ONLY — no resources have been changed.');
  for (const [name, target] of selection) {
    console.log(`\n${name}: ${target.resource}\n${target.url}`);
    target.steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
  }
}
