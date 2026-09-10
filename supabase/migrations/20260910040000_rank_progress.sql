ALTER TABLE public.players ADD COLUMN rank_score integer NOT NULL DEFAULT 0 CHECK(rank_score BETWEEN 0 AND 2699);
UPDATE public.players SET rank_score = CASE WHEN elo >= 2100 THEN (18 + LEAST(8,(elo-2100)/100))*100 ELSE LEAST(17,GREATEST(0,(elo-1200)/50))*100 END;
CREATE TABLE public.rank_results (
  match_id uuid NOT NULL REFERENCES public.matches(id),
  player_id text NOT NULL REFERENCES public.players(id),
  before_score integer NOT NULL,
  after_score integer NOT NULL,
  PRIMARY KEY(match_id,player_id)
);
ALTER TABLE public.rank_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rank_results FROM anon,authenticated;
CREATE FUNCTION public.apply_rank_result() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p record; delta integer; next_score integer;
BEGIN
  IF OLD.status='active' AND NEW.status='finished' THEN
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
CREATE TRIGGER rank_result_on_finish AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.apply_rank_result();
