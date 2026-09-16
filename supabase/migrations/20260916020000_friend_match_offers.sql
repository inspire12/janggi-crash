ALTER TABLE public.match_offers
  ADD COLUMN friend_challenge_id uuid UNIQUE REFERENCES public.friend_challenges(id),
  ADD COLUMN rated boolean NOT NULL DEFAULT true;
ALTER TABLE public.friend_challenges ALTER COLUMN formation DROP NOT NULL;
