export function rankForScore(score: number) {
  const level = Math.min(26, Math.floor(Math.max(0, score) / 100));
  const name = level < 18 ? `${18-level}급` : `${level-17}단`;
  const key = level < 18 ? `geup-${18-level}` : `dan-${level-17}`;
  return {name,key,code:key,points:score % 100,next:level===26?null:100-score%100};
}

export function rankForElo(elo: number) {
  if (elo >= 2100) {
    const dan = Math.min(9, Math.floor((elo - 2100) / 100) + 1);
    const code = `dan-${dan}`;
    return { name: `${dan}단`, code, key: code };
  }

  // 1200 ELO is the starting point (18급). Ratings below the starting
  // score keep the 18급 label, while each 50-point band promotes one 급.
  const promotedBands = Math.min(17, Math.floor((Math.max(1200, elo) - 1200) / 50));
  const geup = 18 - promotedBands;
  const code = `geup-${geup}`;
  return { name: `${geup}급`, code, key: code };
}

export function eloChange(winnerElo: number, loserElo: number, k = 32) {
  const expected = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}
