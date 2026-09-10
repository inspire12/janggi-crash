import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAppUser } from '@/app/auth';
import { getPlayer } from '@/db/players';
import AccountSettings from '@/app/account/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireAppUser('/settings');
  const profile = await getPlayer(user.userId);
  if (!profile?.terms_accepted_at) redirect('/join');
  return <main className="account-page preferences-page">
    <header className="account-page-header"><Link href="/lobby">← 대국실</Link><h1>설정</h1></header>
    <div className="account-page-content">
      <AccountSettings mode="preferences" initialName={profile.display_name} initialTakeback={profile.allow_takeback_requests === 1} />
      <Link className="account-record-link" href="/account">닉네임 · 전적 · 포인트 <span>내 정보 →</span></Link>
    </div>
  </main>;
}
