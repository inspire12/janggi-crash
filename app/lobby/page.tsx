import { requireChatGPTUser } from '@/app/chatgpt-auth';
import LobbyClient from './lobby-client';

export const dynamic = 'force-dynamic';

export default async function LobbyPage() {
  await requireChatGPTUser('/lobby');
  return <LobbyClient />;
}
