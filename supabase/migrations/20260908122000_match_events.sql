create table public.match_events (
  match_id text primary key,
  version integer not null default 0,
  event text not null,
  updated_at timestamptz not null default now()
);

alter table public.match_events enable row level security;

create policy "Match update signals are readable"
on public.match_events
for select
to anon, authenticated
using (true);

grant select on public.match_events to anon, authenticated;

alter publication supabase_realtime add table public.match_events;
