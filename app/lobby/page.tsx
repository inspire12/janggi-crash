import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { getPlayer } from '@/db/players';
import { redirect } from 'next/navigation';
import LobbyClient from './lobby-client';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const user = await requireChatGPTUser('/lobby');
  const profile = await getPlayer(user.userId);
  if (!profile || profile.terms_accepted_at === 0) redirect('/join');
  return <LobbyClient />;
}
