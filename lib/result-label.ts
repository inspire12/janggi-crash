export function resultLabel(reason: string | null, won: boolean | null) {
  if (won === null) return '무승부';
  const cause: Record<string, string> = { checkmate: '외통', resign: '항복', timeout: '시간', points: '기물', disconnect: '접속 끊김' };
  const prefix = reason ? cause[reason] : undefined;
  return prefix ? `${prefix} ${won ? '승' : '패'}` : won ? '승리' : '패배';
}
