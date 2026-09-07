import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getPlayer } from '@/db/players';
import { rankForElo } from '@/lib/rating';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) return Response.json({ registered: false }, { status: 404 });
  const games = profile.wins + profile.losses + profile.draws;
  return Response.json({
    registered: true,
    id: profile.id,
    email: profile.email,
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
