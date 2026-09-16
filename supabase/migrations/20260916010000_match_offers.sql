CREATE TABLE public.match_offers (
  id uuid PRIMARY KEY,
  cho_user_id text NOT NULL REFERENCES public.players(id),
  han_user_id text NOT NULL REFERENCES public.players(id),
  time_control text NOT NULL CHECK (time_control IN ('standard','blitz')),
  cho_formation text,
  han_formation text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL,
  match_id uuid REFERENCES public.matches(id),
  CHECK (cho_user_id <> han_user_id)
);
CREATE INDEX match_offers_cho ON public.match_offers(cho_user_id,status);
CREATE INDEX match_offers_han ON public.match_offers(han_user_id,status);
ALTER TABLE public.match_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_offers FROM anon,authenticated;
