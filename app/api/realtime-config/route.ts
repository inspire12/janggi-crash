import { getChatGPTUser } from '@/app/chatgpt-auth';
import { publicSupabaseConfig } from '@/lib/supabase-events';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const config = publicSupabaseConfig();
  if (!config) return Response.json({ enabled: false });
  return Response.json({ enabled: true, ...config });
}
