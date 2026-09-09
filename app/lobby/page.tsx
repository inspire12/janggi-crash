import { requireAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import LobbyClient from './lobby-client';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const user = await requireAppUser('/lobby');
  const profile = await getPlayer(user.userId);
  return <LobbyClient registered={Boolean(profile?.terms_accepted_at)} />;
}
