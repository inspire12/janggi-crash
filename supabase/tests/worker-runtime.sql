begin;
insert into public.players(id,email,display_name,terms_accepted_at)
values ('migration-check-cho','cho@example.invalid','검증초',1788960000000),
       ('migration-check-han','han@example.invalid','검증한',1788960000000);
insert into public.matches(id,cho_user_id,han_user_id,board_json,initial_board_json,cho_formation,han_formation,rules_version)
values ('11111111-1111-4111-8111-111111111111','migration-check-cho','migration-check-han','[]','[]','test','test','test-v1');
update public.matches set status='finished', winner_user_id='migration-check-cho',version=version+1,
record_context='{"kind":"resign","actorUserId":"migration-check-han"}'::jsonb
where id='11111111-1111-4111-8111-111111111111' and version=0;
update public.players set elo=greatest(100,elo-15) where id='migration-check-han';
do $$
begin
  if (select version from public.matches where id='11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Match update failed';
  end if;
  if (select terms_accepted_at from public.players where id='migration-check-cho') <> 1788960000000 then
    raise exception 'Timestamp conversion failed';
  end if;
  if has_table_privilege('anon','public.matches','SELECT') or has_table_privilege('authenticated','public.players','UPDATE') then
    raise exception 'Private game tables exposed to browser roles';
  end if;
  if (select count(*) from public.game_record_events where match_id='11111111-1111-4111-8111-111111111111') <> 2 then
    raise exception 'Missing atomic game record';
  end if;
  if has_table_privilege('anon','public.game_record_events','SELECT') then raise exception 'Private records exposed'; end if;
end $$;
rollback;
