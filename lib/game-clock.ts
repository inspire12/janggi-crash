export const timeControls = {
  standard: { label: '일반 · 10분 + 매 수 30초', mainMs: 600_000, periodMs: 30_000 },
  blitz: { label: '속기 · 3분 + 매 수 10초', mainMs: 180_000, periodMs: 10_000 },
} as const;
export type TimeControl = keyof typeof timeControls;

// The period starts only after main time is exhausted; unused period time never accumulates.
export function readClock(mainMs: number, elapsedMs: number, periodMs: number) {
  const elapsed = Math.max(0, elapsedMs);
  const main = Math.max(0, mainMs - elapsed);
  const period = Math.max(0, periodMs - Math.max(0, elapsed - mainMs));
  return { mainMs: main, periodMs: period, inByoyomi: main === 0, expired: elapsed >= mainMs + periodMs };
}

export function formatClock(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
