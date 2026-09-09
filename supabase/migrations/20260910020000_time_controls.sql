-- Preserve running games under their original sudden-death rule.
ALTER TABLE public.matches ADD COLUMN time_control text NOT NULL DEFAULT 'legacy'
  CHECK (time_control IN ('legacy', 'standard', 'blitz'));
ALTER TABLE public.matchmaking_queue ADD COLUMN time_control text NOT NULL DEFAULT 'standard'
  CHECK (time_control IN ('standard', 'blitz'));
CREATE INDEX idx_queue_time_control ON public.matchmaking_queue(time_control, joined_at);
