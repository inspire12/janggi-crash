import { getAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import LobbyClient from './lobby-client';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  const user = await getAppUser();
  const profile = user ? await getPlayer(user.userId) : null;
  return <LobbyClient authenticated={Boolean(user)} registered={Boolean(profile?.terms_accepted_at)} />;
}
