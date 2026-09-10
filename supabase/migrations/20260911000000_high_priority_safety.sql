-- Existing queue entries have no verified lease; clients must rejoin.
ALTER TABLE public.matchmaking_queue ADD COLUMN expires_at bigint NOT NULL DEFAULT 0;
CREATE INDEX matchmaking_queue_expiry ON public.matchmaking_queue(expires_at);
ALTER TABLE public.matches ADD COLUMN rated boolean NOT NULL DEFAULT true;
-- Preserve already-settled historical ratings. Only unfinished friend games change.
UPDATE public.matches m SET rated=false WHERE m.status='active'
 AND EXISTS(SELECT 1 FROM public.friend_challenges c WHERE c.match_id=m.id);

CREATE OR REPLACE FUNCTION public.apply_rank_result() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p record; delta integer; next_score integer;
BEGIN
  IF OLD.status='active' AND NEW.status='finished' AND NEW.rated THEN
    FOR p IN SELECT id,rank_score FROM players WHERE id IN (NEW.cho_user_id,NEW.han_user_id) ORDER BY id FOR UPDATE LOOP
      delta := CASE WHEN p.rank_score < 800 THEN 3 WHEN p.rank_score < 1800 THEN 5 ELSE 10 END;
      IF NEW.winner_user_id IS NULL THEN delta:=0;
      ELSIF p.id <> NEW.winner_user_id THEN delta:=-delta; END IF;
      next_score:=GREATEST(0,LEAST(2699,p.rank_score+delta));
      INSERT INTO rank_results VALUES(NEW.id,p.id,p.rank_score,next_score);
      UPDATE players SET rank_score=next_score WHERE id=p.id;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
