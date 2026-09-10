CREATE TABLE public.player_rewards (
  player_id text PRIMARY KEY REFERENCES public.players(id),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  streak integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_day date
);
CREATE TABLE public.point_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id text NOT NULL REFERENCES public.players(id),
  day date NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  UNIQUE(player_id, day, reason)
);
ALTER TABLE public.player_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_rewards, public.point_ledger FROM anon, authenticated;
