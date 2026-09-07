import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensurePlayer } from '@/db/players';
import { rankForElo } from '@/lib/rating';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await ensurePlayer(user);
  if (!profile) return Response.json({ error: '프로필을 불러오지 못했습니다.' }, { status: 500 });
  const games = profile.wins + profile.losses + profile.draws;
  return Response.json({
    id: profile.id,
    displayName: profile.display_name,
    elo: profile.elo,
    wins: profile.wins,
    losses: profile.losses,
    draws: profile.draws,
    streak: profile.streak,
    games,
    winRate: games ? Math.round((profile.wins / games) * 100) : 0,
    rank: rankForElo(profile.elo),
  });
}
