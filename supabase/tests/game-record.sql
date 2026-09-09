begin;
insert into public.players(id,email,display_name) values ('record-a','a@example.invalid','기보초'),('record-b','b@example.invalid','기보한');
insert into public.matches(id,cho_user_id,han_user_id,board_json,initial_board_json,cho_formation,han_formation,rules_version)
values ('22222222-2222-4222-8222-222222222222','record-a','record-b','[]','[]','test','test','test-v1');
update public.matches set version=1,board_json='[{"id":"pawn","x":0,"y":5}]',cho_time_ms=599000,
record_context='{"kind":"move","actorUserId":"record-a","capturedPiece":null}'
where id='22222222-2222-4222-8222-222222222222' and version=0;
-- Requests do not advance the canonical play sequence.
update public.matches set takeback_requested_by='record-a' where id='22222222-2222-4222-8222-222222222222';
update public.matches set version=2,board_json='[]',cho_time_ms=600000,
record_context='{"kind":"takeback","actorUserId":"record-b"}'
where id='22222222-2222-4222-8222-222222222222' and version=1;
-- A stale concurrent mutation must not append an event.
update public.matches set version=2 where id='22222222-2222-4222-8222-222222222222' and version=1;
do $$
begin
  if (select count(*) from public.game_record_events where match_id='22222222-2222-4222-8222-222222222222') <> 3 then raise exception 'Unexpected event count'; end if;
  if (select details->>'undoneSeq' from public.game_record_events where match_id='22222222-2222-4222-8222-222222222222' and seq=2) <> '1' then raise exception 'Wrong undo target'; end if;
  if (select state->>'choTimeMs' from public.game_record_events where match_id='22222222-2222-4222-8222-222222222222' and seq=2) <> '600000' then raise exception 'Clock not restored'; end if;
  begin
    update public.matches set version=3,record_context='{"kind":"timeout"}' where id='22222222-2222-4222-8222-222222222222';
    raise exception 'simulate later statement failure';
  exception when raise_exception then null;
  end;
  if (select record_seq from public.matches where id='22222222-2222-4222-8222-222222222222') <> 2 then raise exception 'Record counter did not roll back'; end if;
  if (select count(*) from public.game_record_events where match_id='22222222-2222-4222-8222-222222222222') <> 3 then raise exception 'Event did not roll back'; end if;
end $$;
rollback;
