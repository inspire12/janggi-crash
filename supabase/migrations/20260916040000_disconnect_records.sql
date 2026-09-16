ALTER TABLE public.game_record_events DROP CONSTRAINT game_record_events_kind_check;
ALTER TABLE public.game_record_events ADD CONSTRAINT game_record_events_kind_check CHECK (kind IN ('start','checkpoint','move','takeback','resign','timeout','disconnect'));

create or replace function public.record_game_state() returns trigger
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
    if event_kind is null or event_kind not in ('move','takeback','resign','timeout','disconnect') then
      raise exception 'Game mutation requires record context';
    end if;
    if event_kind = 'takeback' then
      new.record_context := new.record_context || jsonb_build_object('undoneSeq',old.record_seq);
    end if;
  end if;
  return new;
end $$;
