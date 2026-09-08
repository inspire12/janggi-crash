'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Bot, ChevronRight, CircleUserRound, Clock3, Gift, History, LogOut, Menu, Radio, Settings, Shield, ShoppingBag, Swords, Trophy, UserRoundPlus, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import FriendPanel from './friend-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formations, type Formation } from '@/lib/janggi';
import { Switch } from '@/components/ui/switch';

type Profile = { email: string; displayName: string; elo: number; wins: number; losses: number; draws: number; streak: number; games: number; winRate: number; allowTakebackRequests: boolean; rank: { name: string; key: string } };

const tabItems = [
  { value: 'match', label: '대국', icon: Swords },
  { value: 'review', label: '복기', icon: History },
  { value: 'friends', label: '친구', icon: Users },
  { value: 'ai', label: 'AI', icon: Bot },
  { value: 'shop', label: '상점', icon: ShoppingBag },
];

export default function LobbyClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queued, setQueued] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formation, setFormation] = useState<Formation>('horse-elephant-elephant-horse');
  const [formationOpen, setFormationOpen] = useState(false);

  const refreshQueue = useCallback(async (enterMatchedGame = false) => {
    const response = await fetch('/api/matchmaking', { cache: 'no-store' });
    if (!response.ok) throw new Error('대기열 상태를 불러오지 못했습니다.');
    const data = (await response.json()) as { queued: boolean; matchId: string | null };
    if (data.matchId && enterMatchedGame) window.location.assign(`/battle/${data.matchId}`);
    setMatchId(data.matchId);
    setQueued(data.queued);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([fetch('/api/me', { cache: 'no-store' }).then((response) => response.json()), refreshQueue(false)])
        .then(([me]) => setProfile(me as Profile))
        .catch((cause) => setError(cause instanceof Error ? cause.message : '연결에 실패했습니다.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshQueue]);

  useEffect(() => {
    if (!queued) return;
    const timer = window.setInterval(() => void refreshQueue(true).catch(() => {}), 1500);
    return () => window.clearInterval(timer);
  }, [queued, refreshQueue]);

  async function changeQueue(action: 'join' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/matchmaking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, formation }) });
      const data = (await response.json()) as { queued?: boolean; matchId?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? '요청에 실패했습니다.');
      if (data.matchId) return window.location.assign(`/battle/${data.matchId}`);
      setQueued(Boolean(data.queued));
      setFormationOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile-lobby-shell">
      <OnlineFormationDialog open={formationOpen} value={formation} onOpenChange={setFormationOpen} onChange={setFormation} onConfirm={() => void changeQueue('join')} busy={busy} />
      <Tabs defaultValue="match" className="lobby-tabs">
        <LobbyHeader profile={profile} onProfileChange={setProfile} />
        <div className="lobby-main">
          <TabsContent value="match"><MatchTab profile={profile} matchId={matchId} queued={queued} busy={busy} error={error} formation={formation} onQueue={changeQueue} onChooseFormation={() => setFormationOpen(true)} /></TabsContent>
          <TabsContent value="review"><EmptyTab icon={History} eyebrow="GAME RECORDS" title="기보와 복기" text="완료한 대국의 수순을 다시 보고, 중요한 장면을 저장해 분석합니다." action="내 기보 보기" /></TabsContent>
          <TabsContent value="friends"><CommunityTab /></TabsContent>
          <TabsContent value="ai"><EmptyTab icon={Bot} eyebrow="TRAINING" title="컴퓨터와 두기" text="난이도와 진영을 선택하고 시간 제한 없이 새로운 수를 연습합니다." action="연습 대국 시작" href="/" /></TabsContent>
          <TabsContent value="shop"><EmptyTab icon={Gift} eyebrow="COLLECTION" title="상점과 이벤트" text="기물, 장기판, 포획 효과를 둘러보고 보유한 테마를 장착합니다." action="테마 둘러보기" /></TabsContent>
        </div>
        <TabsList className="lobby-bottom-nav" aria-label="로비 메뉴">
          {tabItems.map(({ value, label, icon: Icon }) => <TabsTrigger value={value} key={value}><Icon /><span>{label}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
    </main>
  );
}

function LobbyHeader({ profile, onProfileChange }: { profile: Profile | null; onProfileChange: (profile: Profile) => void }) {
  return <header className="mobile-lobby-header">
    <Sheet><SheetTrigger className="profile-trigger" aria-label="내 정보 열기"><Menu size={20} /><span className="mini-avatar">將</span></SheetTrigger><ProfileSheet profile={profile} onProfileChange={onProfileChange} /></Sheet>
    <Link className="lobby-wordmark" href="/"><i>將</i><span>장기: 격돌</span></Link>
    <button className="notification-button" aria-label="알림"><Bell size={20} /><i /></button>
  </header>;
}

function ProfileSheet({ profile, onProfileChange }: { profile: Profile | null; onProfileChange: (profile: Profile) => void }) {
  const [savingTakeback, setSavingTakeback] = useState(false);
  const [settingError, setSettingError] = useState('');
  const maskedEmail = profile?.email.replace(/^(.{2}).*(@.*)$/, '$1••••$2') ?? '';
  async function changeTakebackPreference(allowTakebackRequests: boolean) {
    if (!profile) return;
    setSavingTakeback(true);
    setSettingError('');
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ allowTakebackRequests }),
      });
      const result = await response.json() as { error?: string; allowTakebackRequests?: boolean };
      if (!response.ok) throw new Error(result.error ?? '설정을 저장하지 못했습니다.');
      onProfileChange({ ...profile, allowTakebackRequests: Boolean(result.allowTakebackRequests) });
    } catch (cause) {
      setSettingError(cause instanceof Error ? cause.message : '설정을 저장하지 못했습니다.');
    } finally {
      setSavingTakeback(false);
    }
  }
  return <SheetContent side="left" className="profile-sheet">
    <SheetHeader className="profile-sheet-head"><div className={`sheet-emblem ${profile?.rank.key ?? ''}`}><Shield size={26} /></div><SheetTitle>{profile?.displayName ?? '지휘관'}</SheetTitle><SheetDescription>{maskedEmail}</SheetDescription></SheetHeader>
    {profile && <><section className="sheet-rating"><span>{profile.rank.name}</span><strong>{profile.elo}</strong><small>ELO</small></section><section className="sheet-record"><div><strong>{profile.games}</strong><span>대국</span></div><div><strong>{profile.wins}</strong><span>승</span></div><div><strong>{profile.losses}</strong><span>패</span></div><div><strong>{profile.winRate}%</strong><span>승률</span></div></section></>}
    {profile && <section className="sheet-preferences"><div><Settings /><span><strong>무르기 요청 받기</strong><small>끄면 상대가 무르기를 요청할 수 없습니다.</small></span><Switch aria-label="무르기 요청 받기" checked={profile.allowTakebackRequests} disabled={savingTakeback} onCheckedChange={(checked) => void changeTakebackPreference(checked)} /></div>{settingError && <p>{settingError}</p>}</section>}
    <nav className="sheet-menu"><button><CircleUserRound /><span>프로필 및 개인정보</span><ChevronRight /></button><button><Trophy /><span>전적과 계급</span><ChevronRight /></button><button><Settings /><span>환경설정</span><ChevronRight /></button></nav>
    {/* Dispatch-owned authentication requires a top-level anchor navigation. */}
    {/* oxlint-disable-next-line next/no-html-link-for-pages */}
    <a className="sheet-signout" href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut /> 로그아웃</a>
  </SheetContent>;
}

function MatchTab({ profile, matchId, queued, busy, error, formation, onQueue, onChooseFormation }: { profile: Profile | null; matchId: string | null; queued: boolean; busy: boolean; error: string; formation: Formation; onQueue: (action: 'join' | 'cancel') => Promise<void>; onChooseFormation: () => void }) {
  const formationLabel = formations.find((item) => item.value === formation)?.label;
  return <div className="match-tab-content">
    <div className="lobby-greeting"><span><Radio size={13} /> 오늘도 한판!</span><h1>대국하기</h1><p>실력이 비슷한 상대와 가볍게 한판 시작해요.</p></div>
    {matchId && <section className="resume-match-card"><div><span>두던 대국이 있어요</span><strong>이어서 둘까요?</strong><small><Clock3 size={13} /> 마지막 상태 그대로 보관되어 있어요.</small></div><Link href={`/battle/${matchId}`}>이어서 두기 <ChevronRight /></Link></section>}
    <section className="quick-match-card"><div className="quick-rank"><div className={`rank-emblem ${profile?.rank.key ?? ''}`}><Shield size={27} /></div><div><span>나의 기력</span><strong>{profile?.elo ?? '—'} <small>ELO</small></strong><em>{profile?.rank.name ?? '불러오는 중'}</em></div></div>{queued && <div className="queued-formation"><span>선택 포진</span><strong>{formationLabel}</strong></div>}<button className={`match-button ${queued ? 'searching' : ''}`} disabled={busy || Boolean(matchId)} onClick={() => queued ? void onQueue('cancel') : onChooseFormation()}><Swords size={21} />{busy ? '연결 중…' : queued ? '상대 찾는 중 · 취소' : matchId ? '진행 중인 대국이 있어요' : '바로 대국하기'}</button>{queued && <p className="queue-message"><i /> 포진을 잠그고 비슷한 실력의 상대를 찾고 있어요.</p>}{error && <p className="form-error">{error}</p>}</section>
    <section className="live-rooms-section"><div className="section-heading"><div><span>구경하기</span><h2>지금 두는 대국</h2></div><button>전체 보기 <ChevronRight /></button></div><div className="empty-room"><Radio /><strong>아직 관전할 대국이 없어요</strong><span>새 대국이 시작되면 바로 알려드릴게요.</span></div></section>
  </div>;
}

function OnlineFormationDialog({ open, value, onOpenChange, onChange, onConfirm, busy }: { open: boolean; value: Formation; onOpenChange: (open: boolean) => void; onChange: (formation: Formation) => void; onConfirm: () => void; busy: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="online-formation-dialog"><DialogHeader><span className="formation-eyebrow">ONLINE FORMATION</span><DialogTitle>내 포진 선택</DialogTitle><DialogDescription>매칭이 시작되면 포진은 잠기며, 상대의 포진은 대국판에서 공개됩니다.</DialogDescription></DialogHeader><div className="online-formation-options">{formations.map((item) => <button type="button" key={item.value} className={value === item.value ? 'selected' : ''} aria-pressed={value === item.value} onClick={() => onChange(item.value)}><span><i>車</i>{item.order.map((kind, index) => <b key={`${kind}-${index}`}>{kind === 'horse' ? '馬' : '象'}</b>)}<i>車</i></span><strong>{item.label}</strong></button>)}</div><button className="formation-start" disabled={busy} onClick={onConfirm}><Swords size={18} />{busy ? '매칭 준비 중…' : '이 포진으로 상대 찾기'}</button></DialogContent></Dialog>;
}

function EmptyTab({ icon: Icon, eyebrow, title, text, action, href }: { icon: typeof History; eyebrow: string; title: string; text: string; action: string; href?: string }) {
  const content = <><Icon size={21} />{action}</>;
  return <section className="feature-empty"><div className="feature-icon"><Icon size={36} /></div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p>{href ? <Link className="feature-action" href={href}>{content}</Link> : <button className="feature-action" disabled>{content}<small>준비 중</small></button>}</section>;
}

type Community = { guild: { id: string; name: string; role: string; member_count: number } | null; blocked: Array<{ id: string; display_name: string }> };
function CommunityTab() {
  const [data, setData] = useState<Community | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/community', { cache: 'no-store' });
    if (response.ok) setData(await response.json() as Community);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function createGuild(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const response = await fetch('/api/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create-guild', name }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setError(result.error ?? '길드를 만들지 못했습니다.');
    setName(''); await load();
  }
  async function unblock(userId: string) {
    await fetch('/api/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'unblock', userId }) });
    await load();
  }
  return <section className="community-tab">
    <div className="lobby-greeting"><span><Users size={13} /> COMMUNITY</span><h1>길드와 친구</h1><p>함께할 동료를 모으고 친선 대국을 준비하세요.</p></div>
    <FriendPanel />
    <div className="community-grid"><article><div className="community-icon"><Users /></div><span>MY GUILD</span>{data?.guild ? <><h2>{data.guild.name}</h2><p>{data.guild.member_count}명 · {data.guild.role === 'owner' ? '길드장' : '길드원'}</p><button disabled>길드 관리 <small>준비 중</small></button></> : <><h2>소속 길드 없음</h2><p>길드를 만들고 이후 친구 초대 기능을 이용할 수 있습니다.</p><form onSubmit={createGuild}><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={16} placeholder="길드명" aria-label="길드명" required /><button>길드 만들기</button></form>{error && <p className="form-error">{error}</p>}</>}</article>
      <article><div className="community-icon villain"><UserRoundPlus /></div><span>BLOCK LIST</span><h2>악당 목록</h2>{data?.blocked.length ? <ul>{data.blocked.map((player) => <li key={player.id}><span>{player.display_name}</span><button onClick={() => void unblock(player.id)}>해제</button></li>)}</ul> : <p>등록된 악당이 없습니다. 대국 채팅에서 상대를 등록하면 메시지가 차단됩니다.</p>}</article></div>
  </section>;
}
