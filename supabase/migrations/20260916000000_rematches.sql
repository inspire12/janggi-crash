CREATE TABLE public.rematch_requests (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id),
  requested_by text NOT NULL REFERENCES public.players(id),
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','cancelled')),
  expires_at bigint NOT NULL,
  next_match_id uuid REFERENCES public.matches(id)
);
ALTER TABLE public.rematch_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rematch_requests FROM anon, authenticated;
