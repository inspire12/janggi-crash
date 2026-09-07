export function rankForElo(elo: number) {
  if (elo >= 2000) return { name: '천상', code: 'master' };
  if (elo >= 1700) return { name: '명인', code: 'diamond' };
  if (elo >= 1500) return { name: '고수', code: 'platinum' };
  if (elo >= 1300) return { name: '중수', code: 'gold' };
  if (elo >= 1100) return { name: '초단', code: 'silver' };
  return { name: '입문', code: 'bronze' };
}

export function eloChange(winnerElo: number, loserElo: number, k = 32) {
  const expected = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}
