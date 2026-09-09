alter table public.matches
  add column initial_board_json text,
  add column cho_formation text,
  add column han_formation text,
  add column rules_version text,
  add column record_seq integer not null default 0,
  add column record_context jsonb;

create table public.game_record_events (
  match_id uuid not null references public.matches(id) on delete cascade,
  seq integer not null check (seq >= 0),
  kind text not null check (kind in ('start','checkpoint','move','takeback','resign','timeout')),
  details jsonb not null,
  state jsonb not null,
  created_at bigint not null,
  primary key (match_id, seq)
);
alter table public.game_record_events enable row level security;
revoke all on public.game_record_events from anon, authenticated;

-- Legacy games start at a known checkpoint, not an invented initial position.
insert into public.game_record_events (match_id,seq,kind,details,state,created_at)
select id,0,'checkpoint','{}'::jsonb,
  jsonb_build_object('board',board_json::jsonb,'turn',turn,
    'choTimeMs',cho_time_ms,'hanTimeMs',han_time_ms,'status',status,
    'winnerUserId',winner_user_id,'resultReason',result_reason),
  (extract(epoch from now())*1000)::bigint
from public.matches;

create function public.record_game_state() returns trigger
language plpgsql set search_path = '' as $$
declare event_kind text;
begin
  if TG_OP = 'INSERT' then
    if new.initial_board_json is null or new.rules_version is null
      or new.cho_formation is null or new.han_formation is null then
      raise exception 'New matches require initial position, formations and rules version';
    end if;
    new.record_seq := 0;
    event_kind := 'start';
  else
    if new.initial_board_json is distinct from old.initial_board_json
      or new.cho_formation is distinct from old.cho_formation
      or new.han_formation is distinct from old.han_formation
      or new.rules_version is distinct from old.rules_version then
      raise exception 'Initial record metadata is immutable';
    end if;
    if new.version = old.version then return new; end if;
    if new.version <> old.version + 1 then raise exception 'Invalid game version'; end if;
    new.record_seq := old.record_seq + 1;
    event_kind := new.record_context->>'kind';
    if event_kind is null or event_kind not in ('move','takeback','resign','timeout') then
      raise exception 'Game mutation requires record context';
    end if;
    if event_kind = 'takeback' then
      new.record_context := new.record_context || jsonb_build_object('undoneSeq',old.record_seq);
    end if;
  end if;
  return new;
end $$;

create function public.append_game_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.version = old.version then return new; end if;
  end if;
  insert into public.game_record_events(match_id,seq,kind,details,state,created_at)
  values(new.id,new.record_seq,
    case when TG_OP = 'INSERT' then 'start' else new.record_context->>'kind' end,
    coalesce(new.record_context,'{}'::jsonb),
    jsonb_build_object('board',new.board_json::jsonb,'turn',new.turn,
      'choTimeMs',new.cho_time_ms,'hanTimeMs',new.han_time_ms,'status',new.status,
      'winnerUserId',new.winner_user_id,'resultReason',new.result_reason),new.updated_at);
  return new;
end $$;

create trigger prepare_game_record before insert or update on public.matches
for each row execute function public.record_game_state();
create trigger append_game_record after insert or update on public.matches
for each row execute function public.append_game_record();
