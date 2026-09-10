ALTER TABLE public.players ADD COLUMN last_seen_at bigint;
CREATE TABLE public.friend_preferences (
 owner_id text NOT NULL REFERENCES players(id),
 friend_id text NOT NULL REFERENCES players(id),
 favorite boolean NOT NULL DEFAULT false,
 group_name text NOT NULL DEFAULT '' CHECK(char_length(group_name)<=20),
 PRIMARY KEY(owner_id,friend_id)
);
ALTER TABLE public.friend_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_preferences FROM anon,authenticated;
