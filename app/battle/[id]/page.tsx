import { requireChatGPTUser } from '@/app/chatgpt-auth';
import OnlineBattle from './online-battle';

export const dynamic = 'force-dynamic';

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireChatGPTUser(`/battle/${id}`);
  return <OnlineBattle matchId={id} />;
}
