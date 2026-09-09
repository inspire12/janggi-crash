-- Preserve existing Supabase records and align the server wire format.
-- Does not import or delete the former Sites D1 database.
alter table public.matches alter column status drop default;
alter table public.matches alter column status type text using
  case when status::text = 'completed' then 'finished' else status::text end;
alter table public.matches alter column status set default 'active';
alter table public.matches add constraint matches_status_check check (status in ('active', 'finished', 'cancelled'));
alter table public.matches rename column board to board_json;
alter table public.matches alter column board_json type text using board_json::text;
alter table public.matches rename column previous_board to previous_board_json;
alter table public.matches alter column previous_board_json type text using previous_board_json::text;
alter table public.players alter column allow_takeback_requests drop default;
alter table public.players alter column allow_takeback_requests type integer using case when allow_takeback_requests then 1 else 0 end;
alter table public.players alter column allow_takeback_requests set default 1;
alter table public.players add constraint players_takeback_check check (allow_takeback_requests in (0,1));

do $$
declare item record;
begin
  for item in select table_name, column_name from information_schema.columns
    where table_schema = 'public' and data_type = 'timestamp with time zone'
      and table_name in ('players','matchmaking_queue','matches','moves','guilds','guild_members','friendships','blocked_players','match_chats','chat_messages')
  loop
    execute format('alter table public.%I alter column %I drop default', item.table_name, item.column_name);
    execute format('alter table public.%I alter column %I type bigint using (extract(epoch from %I) * 1000)::bigint', item.table_name, item.column_name, item.column_name);
    execute format('alter table public.%I alter column %I set default ((extract(epoch from now()) * 1000)::bigint)', item.table_name, item.column_name);
  end loop;
end $$;
update public.players set terms_accepted_at = 0 where terms_accepted_at is null;
alter table public.players alter column terms_accepted_at set default 0;
alter table public.players alter column terms_accepted_at set not null;

-- Only the authenticated Worker may access game records.
revoke all on public.players, public.matchmaking_queue, public.matches,
  public.moves, public.guilds, public.guild_members, public.friendships,
  public.blocked_players, public.match_chats, public.chat_messages from anon, authenticated;
