create extension if not exists pgcrypto;

create type public.match_status as enum ('active', 'completed', 'cancelled');
create type public.player_side as enum ('cho', 'han');
create type public.friendship_status as enum ('pending', 'accepted', 'rejected');
create type public.chat_request_status as enum ('pending', 'accepted', 'rejected');

create table public.players (
  id text primary key,
  email text not null,
  display_name text not null check (char_length(display_name) between 2 and 16),
  elo integer not null default 1200 check (elo >= 100),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  streak integer not null default 0,
  allow_takeback_requests boolean not null default true,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index players_display_name_lower_key on public.players (lower(display_name));

create table public.matchmaking_queue (
  user_id text primary key references public.players(id) on delete cascade,
  elo integer not null,
  formation text not null default 'horse-elephant-elephant-horse',
  joined_at timestamptz not null default now()
);
create index matchmaking_queue_joined_at_idx on public.matchmaking_queue (joined_at);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  cho_user_id text not null references public.players(id),
  han_user_id text not null references public.players(id),
  status public.match_status not null default 'active',
  turn public.player_side not null default 'cho',
  board jsonb not null,
  previous_board jsonb,
  previous_turn public.player_side,
  version integer not null default 0,
  winner_user_id text references public.players(id),
  result_reason text,
  cho_time_ms integer not null default 600000 check (cho_time_ms >= 0),
  han_time_ms integer not null default 600000 check (han_time_ms >= 0),
  previous_cho_time_ms integer,
  previous_han_time_ms integer,
  turn_started_at timestamptz not null default now(),
  takeback_requested_by text references public.players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cho_user_id <> han_user_id),
  check (winner_user_id is null or winner_user_id in (cho_user_id, han_user_id))
);
create index matches_cho_status_idx on public.matches (cho_user_id, status);
create index matches_han_status_idx on public.matches (han_user_id, status);

create table public.moves (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  ply integer not null check (ply > 0),
  user_id text not null references public.players(id),
  piece_id text not null,
  from_x smallint not null check (from_x between 0 and 8),
  from_y smallint not null check (from_y between 0 and 9),
  to_x smallint not null check (to_x between 0 and 8),
  to_y smallint not null check (to_y between 0 and 9),
  created_at timestamptz not null default now(),
  unique (match_id, ply)
);

create table public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id text not null references public.players(id),
  created_at timestamptz not null default now()
);
create unique index guilds_name_lower_key on public.guilds (lower(name));

create table public.guild_members (
  user_id text primary key references public.players(id) on delete cascade,
  guild_id uuid not null references public.guilds(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now()
);
create index guild_members_guild_id_idx on public.guild_members (guild_id);

create table public.friendships (
  pair_key text primary key,
  requester_user_id text not null references public.players(id) on delete cascade,
  addressee_user_id text not null references public.players(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_user_id <> addressee_user_id)
);
create index friendships_requester_status_idx on public.friendships (requester_user_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_user_id, status);

create table public.blocked_players (
  blocker_user_id text not null references public.players(id) on delete cascade,
  blocked_user_id text not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table public.match_chats (
  match_id uuid primary key references public.matches(id) on delete cascade,
  requester_user_id text not null references public.players(id),
  status public.chat_request_status not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_user_id text not null references public.players(id),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chat_messages_match_created_at_idx on public.chat_messages (match_id, created_at);

alter table public.players enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.matches enable row level security;
alter table public.moves enable row level security;
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
alter table public.friendships enable row level security;
alter table public.blocked_players enable row level security;
alter table public.match_chats enable row level security;
alter table public.chat_messages enable row level security;

-- Application traffic initially uses the server-only service role. RLS remains
-- enabled and closed to anon/authenticated clients until client access is designed.

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.match_chats;
alter publication supabase_realtime add table public.chat_messages;
