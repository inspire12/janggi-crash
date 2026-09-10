CREATE TABLE public.friend_challenges (
 id uuid PRIMARY KEY,
 sender text NOT NULL REFERENCES players(id),
 recipient text NOT NULL REFERENCES players(id),
 formation text NOT NULL,
 time_control text NOT NULL CHECK(time_control IN ('standard','blitz')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled','expired')),
 match_id uuid REFERENCES matches(id),
 expires_at bigint NOT NULL,
 created_at bigint NOT NULL,
 CHECK(sender<>recipient)
);
CREATE INDEX friend_challenges_participants ON public.friend_challenges(sender,recipient,status);
ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_challenges FROM anon,authenticated;
