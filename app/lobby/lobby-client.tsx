'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, Bot, ChevronRight, CircleUserRound, Clock3, Gift, History, LogOut, Menu, Settings, Shield, ShoppingBag, Swords, Trophy, UserRoundPlus, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import FriendPanel from './friend-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formations, type Formation } from '@/lib/janggi';
import { Switch } from '@/components/ui/switch';
import { timeControls, type TimeControl } from '@/lib/game-clock';
import { armGameAlerts, gameAlert } from '@/lib/game-alerts';

type Profile = { email: string; displayName: string; elo: number; wins: number; losses: number; draws: number; streak: number; games: number; winRate: number; allowTakebackRequests: boolean; rank: { name: string; key: string } };
type MatchOffer = {id:string;rated:boolean;expiresAt:number;serverNow:number;formation:Formation|null;accepted:boolean;opponentAccepted:boolean;opponent:{displayName:string;elo:number;rank:string;wins:number;losses:number;draws:number}|null};

const tabItems = [
  { value: 'match', label: '대국', icon: Swords },
  { value: 'review', label: '복기', icon: History },
  { value: 'friends', label: '친구', icon: Users },
  { value: 'ai', label: '연습', icon: Bot },
  { value: 'shop', label: '상점', icon: ShoppingBag },
];

export default function LobbyClient({ authenticated, registered, initialTab = 'match', reviewContent }: { authenticated: boolean; registered: boolean; initialTab?: string; reviewContent?: ReactNode }) {
  const accountPath = authenticated ? '/join' : '/login';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queued, setQueued] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [synced, setSynced] = useState(false);
  const enterMatchedGame = useRef(false);
  const refreshInFlight = useRef<Promise<void>|null>(null);
  const [formation, setFormation] = useState<Formation>('horse-elephant-elephant-horse');
  const [offer, setOffer] = useState<MatchOffer|null>(null);
  const hasOffer=Boolean(offer);
  const lastOffer=useRef<string|null>(null);
  const [timeControl, setTimeControl] = useState<TimeControl>('standard');

  const refreshQueue = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const work = async () => {
    try {
    const response = await fetch('/api/matchmaking', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('대기열 상태를 불러오지 못했습니다.');
    const data = (await response.json()) as { queued: boolean; matchId: string | null; timeControl: TimeControl | null; offer:MatchOffer|null };
    if (data.timeControl) setTimeControl(data.timeControl);
    if (data.matchId && enterMatchedGame.current) window.location.assign(`/battle/${data.matchId}`);
    if(data.queued || data.offer) enterMatchedGame.current=true;
    setConnectionError('');
    setSynced(true);
    setMatchId(data.matchId);
    setQueued(data.queued);
    if(lastOffer.current && !data.offer && !data.matchId) setError('매칭이 거절되었거나 응답 시간이 만료되었습니다. 다시 신청해 주세요.');
    if(data.offer?.formation) setFormation(data.offer.formation);
    if(data.offer && lastOffer.current!==data.offer.id)gameAlert('match');
    lastOffer.current=data.offer?.id ?? null;
    setOffer(data.offer);
    } catch {
      setConnectionError('연결이 원활하지 않습니다. 매칭 상태를 다시 확인하고 있습니다.');
    }
    };
    const promise=work().finally(()=>{refreshInFlight.current=null;});
    refreshInFlight.current=promise;
    return promise;
  }, []);

  useEffect(() => {
    if (!registered) return;
    const timer = window.setTimeout(() => {
      fetch('/api/me', { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('계정 정보를 불러오지 못했습니다.');
        return response.json();
      })
        .then((me) => setProfile(me as Profile))
        .catch((cause) => setError(cause instanceof Error ? cause.message : '연결에 실패했습니다.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshQueue, registered]);

  useEffect(() => {
    if (!registered) return;
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{await refreshQueue();if(!stopped)timer=setTimeout(poll,queued || hasOffer ? 1500 : 5000);};
    void poll();
    const reconnect=()=>{if(document.visibilityState==='visible')void refreshQueue();};
    const offline=()=>setConnectionError('인터넷 연결이 끊겼습니다. 연결되면 매칭 상태를 자동으로 확인합니다.');
    window.addEventListener('online',reconnect);
    window.addEventListener('offline',offline);
    document.addEventListener('visibilitychange',reconnect);
    return () => {stopped=true;clearTimeout(timer);window.removeEventListener('online',reconnect);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',reconnect);};
  }, [registered, queued, hasOffer, refreshQueue]);

  useEffect(()=>{
    const arm=()=>armGameAlerts();
    window.addEventListener('pointerdown',arm,{once:true});
    window.addEventListener('keydown',arm,{once:true});
    return()=>{window.removeEventListener('pointerdown',arm);window.removeEventListener('keydown',arm);};
  },[]);

  async function changeQueue(action: 'join' | 'cancel' | 'accept' | 'decline') {
    armGameAlerts();
    if (!registered) {
      window.location.assign(accountPath);
      return;
    }
    setBusy(true);
    enterMatchedGame.current=true;
    setError('');
    let responseReceived=false;
    try {
      const response = await fetch('/api/matchmaking', { method: 'POST', signal:AbortSignal.timeout(8000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(action==='accept'?{formation}:{}), offerId:offer?.id, timeControl }) });
      const data = (await response.json()) as { queued?: boolean; matchId?: string; error?: string };
      responseReceived=true;
      if (!response.ok) throw new Error(data.error ?? '요청에 실패했습니다.');
      if (data.matchId) return window.location.assign(`/battle/${data.matchId}`);
      await refreshQueue();
    } catch (cause) {
      if(responseReceived)setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.');
      else setConnectionError('요청 결과를 확인하지 못했습니다. 서버 상태를 다시 확인하고 있습니다.');
    } finally {
      // Reconcile even when the POST response was lost; never replay a mutation.
      void refreshQueue();
      setBusy(false);
    }
  }

  return (
    <main className="mobile-lobby-shell">
      {offer && <OnlineFormationDialog key={offer.id} offer={offer} value={formation} onChange={setFormation} onConfirm={() => void changeQueue('accept')} onReject={()=>void changeQueue('decline')} busy={busy || Boolean(connectionError)} error={connectionError || error} />}
      <Tabs defaultValue={initialTab} className="lobby-tabs" onValueChange={(value) => { if (value === 'review' && !reviewContent) window.location.assign('/review'); }}>
        <LobbyHeader profile={profile} onProfileChange={setProfile} />
        <div className="lobby-main">
          {!registered && <p>{authenticated ? <>대국 전에 <Link href="/join">닉네임 설정과 이용 동의</Link>를 완료해 주세요.</> : <>온라인 대국을 시작하려면 <Link href="/login">로그인</Link>해 주세요.</>}</p>}
          <TabsContent value="match">
            <div className="lobby-greeting lobby-match-heading"><h1>대국실</h1></div>
            <fieldset className="formation-side" disabled={queued || busy || Boolean(matchId) || Boolean(offer)}><legend>대국 시간</legend><div className="formation-options">{(Object.keys(timeControls) as TimeControl[]).map((value) => <button type="button" key={value} aria-pressed={timeControl === value} className={timeControl === value ? 'selected' : ''} onClick={() => setTimeControl(value)}>{timeControls[value].label}</button>)}</div></fieldset>
            <MatchTab profile={profile} matchId={matchId} queued={queued} busy={busy || Boolean(offer) || (registered && (!synced || Boolean(connectionError)))} error={connectionError || error} onQueue={changeQueue} onChooseFormation={() => void changeQueue('join')} />
          </TabsContent>
          <TabsContent value="review">{reviewContent ?? <p>내 기보를 불러오는 중…</p>}</TabsContent>
          <TabsContent value="friends">{registered ? <CommunityTab /> : <EmptyTab icon={Users} eyebrow="FRIENDS" title="친구와 대국하기" text="로그인 후 계정 설정을 완료하면 친구 기능을 사용할 수 있어요." action={authenticated ? '계정 설정 완료하기' : '로그인'} href={accountPath} />}</TabsContent>
          <TabsContent value="ai"><EmptyTab icon={Bot} eyebrow="TRAINING" title="연습 대국" text="혼자 양쪽 기물을 움직이며 수를 연습합니다. 컴퓨터 대국은 준비 중입니다." action="연습 대국 시작" href="/practice" /></TabsContent>
          <TabsContent value="shop"><EmptyTab icon={Gift} eyebrow="준비 중" title="상점과 이벤트" text="기물, 장기판, 포획 효과를 고르는 상점을 준비하고 있어요. 출석 보상은 내 계정에서 받을 수 있습니다." action="테마 둘러보기" /></TabsContent>
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
    <div aria-hidden="true" />
    <Link className="lobby-wordmark" href="/"><i>將</i><span>장기: 격돌</span></Link>
    <div className="lobby-account-actions">
      <button className="notification-button" aria-label="알림"><Bell size={20} /></button>
      <Sheet><SheetTrigger className="profile-trigger" aria-label="내 정보 열기"><span className="mini-avatar">將</span><Menu size={20} /></SheetTrigger><ProfileSheet profile={profile} onProfileChange={onProfileChange} /></Sheet>
    </div>
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
  return <SheetContent side="right" className="profile-sheet">
    <SheetHeader className="profile-sheet-head"><div className={`sheet-emblem ${profile?.rank.key ?? ''}`}><Shield size={26} /></div><SheetTitle>{profile?.displayName ?? '지휘관'}</SheetTitle><SheetDescription>{maskedEmail}</SheetDescription></SheetHeader>
    {profile && <><section className="sheet-rating"><span>{profile.rank.name}</span><strong>{profile.elo}</strong><small>ELO</small></section><section className="sheet-record"><div><strong>{profile.games}</strong><span>대국</span></div><div><strong>{profile.wins}</strong><span>승</span></div><div><strong>{profile.losses}</strong><span>패</span></div><div><strong>{profile.winRate}%</strong><span>승률</span></div></section></>}
    {profile && <section className="sheet-preferences"><div><Settings /><span><strong>무르기 요청 받기</strong><small>끄면 상대가 무르기를 요청할 수 없습니다.</small></span><Switch aria-label="무르기 요청 받기" checked={profile.allowTakebackRequests} disabled={savingTakeback} onCheckedChange={(checked) => void changeTakebackPreference(checked)} /></div>{settingError && <p>{settingError}</p>}</section>}
    <nav className="sheet-menu"><Link href="/account"><CircleUserRound /><span>프로필 및 개인정보</span><ChevronRight /></Link><Link href="/account#record"><Trophy /><span>전적과 계급</span><ChevronRight /></Link><Link href="/settings"><Settings /><span>설정</span><ChevronRight /></Link></nav>
    {/* Dispatch-owned authentication requires a top-level anchor navigation. */}
    {/* oxlint-disable-next-line next/no-html-link-for-pages */}
    {profile ? <button className="sheet-signout" onClick={async () => { const response = await fetch('/api/auth', { method: 'DELETE' }); if (response.ok) window.location.assign('/'); }}><LogOut /> 로그아웃</button> : <Link className="sheet-signout" href="/login">로그인 / 계정 설정</Link>}
  </SheetContent>;
}

function MatchTab({ profile, matchId, queued, busy, error, onQueue, onChooseFormation }: { profile: Profile | null; matchId: string | null; queued: boolean; busy: boolean; error: string; onQueue: (action: 'join' | 'cancel') => Promise<void>; onChooseFormation: () => void }) {
  return <div className="match-tab-content">
    {matchId && <section className="resume-match-card"><div><span>두던 대국이 있어요</span><strong>이어서 둘까요?</strong><small><Clock3 size={13} /> 마지막 상태 그대로 보관되어 있어요.</small></div><a href={`/battle/${encodeURIComponent(matchId)}`}>이어서 두기 <ChevronRight /></a></section>}
    <section className="quick-match-card"><div className="quick-rank"><div className={`rank-emblem ${profile?.rank.key ?? ''}`}><Shield size={27} /></div><div><span>나의 기력</span><strong>{profile?.elo ?? '—'} <small>ELO</small></strong><em>{profile?.rank.name ?? '불러오는 중'}</em></div></div><button className={`match-button ${queued ? 'searching' : ''}`} disabled={busy || Boolean(matchId)} onClick={() => queued ? void onQueue('cancel') : onChooseFormation()}><Swords size={21} />{busy ? '연결 중…' : queued ? '상대 찾는 중 · 취소' : matchId ? '진행 중인 대국이 있어요' : '바로 대국하기'}</button>{queued && <p className="queue-message"><i /> 상대를 찾고 있어요. 매칭 후 포진을 선택하고 수락해 주세요.</p>}{error && <p className="form-error">{error}</p>}</section>
    <section className="live-rooms-section"><div className="section-heading"><h2>관전</h2><span>준비 중</span></div></section>
  </div>;
}

function MatchOpponent({opponent}:{opponent:MatchOffer['opponent']}) {
  if(!opponent) return <output>상대 정보를 불러오지 못했습니다.</output>;
  const games=opponent.wins+opponent.losses+opponent.draws;
  const winRate=games?Math.round(opponent.wins/games*100):null;
  return <section className="match-offer-opponent" aria-label="매칭 상대 정보">
    <div className="match-offer-opponent-heading"><Shield size={28} aria-hidden="true" /><div><small>이번 대국 상대</small><h3>{opponent.displayName}</h3></div><strong>{opponent.rank}</strong></div>
    <div className="match-offer-opponent-stats"><span><b>{opponent.elo}</b> ELO</span><span>{opponent.wins}승 {opponent.losses}패 {opponent.draws}무</span><span>{winRate===null?'첫 대국':'승률 '+winRate+'%'}</span></div>
  </section>;
}

function OnlineFormationDialog({ offer, value, onChange, onConfirm, onReject, busy, error }: { offer:MatchOffer; value: Formation; onChange: (formation: Formation) => void; onConfirm: () => void; onReject:()=>void; busy: boolean; error:string }) {
  const [seconds,setSeconds]=useState(Math.max(0,Math.ceil((offer.expiresAt-offer.serverNow)/1000)));
  useEffect(()=>{const end=performance.now()+Math.max(0,offer.expiresAt-offer.serverNow);const tick=()=>setSeconds(Math.max(0,Math.ceil((end-performance.now())/1000)));tick();const timer=window.setInterval(tick,250);return ()=>window.clearInterval(timer);},[offer.expiresAt,offer.serverNow]);
  return <Dialog open onOpenChange={(open)=>{if(!open && !busy) onReject();}}><DialogContent className="online-formation-dialog"><DialogHeader><span className="formation-eyebrow">{offer.rated?'일반 매칭':'친구 대국 · 비랭크'} · {seconds}초</span><DialogTitle>상대를 찾았습니다</DialogTitle><DialogDescription>포진을 고르고 수락해 주세요. 양쪽 모두 수락하면 초시계와 대국이 시작됩니다. 상대의 포진은 시작 후 공개됩니다.</DialogDescription></DialogHeader><MatchOpponent opponent={offer.opponent} /><div className="online-formation-options">{formations.map((item) => <button type="button" disabled={busy || offer.accepted || seconds===0} key={item.value} className={value === item.value ? 'selected' : ''} aria-pressed={value === item.value} onClick={() => onChange(item.value)}><span><i>車</i>{item.order.map((kind, index) => <b key={`${kind}-${index}`}>{kind === 'horse' ? '馬' : '象'}</b>)}<i>車</i></span><strong>{item.label}</strong></button>)}</div><p aria-live="polite">{offer.accepted?'수락 완료 · 상대를 기다리고 있습니다.':offer.opponentAccepted?'상대가 수락했습니다.':'상대도 포진을 선택하고 있습니다.'}</p>{error && <p role="alert" className="form-error">{error}</p>}<button className="formation-start" disabled={busy || offer.accepted || seconds===0} onClick={onConfirm}><Swords size={18} />{offer.accepted?'상대 수락 대기':'이 포진으로 수락'}</button><button className="text-btn" disabled={busy || seconds===0} onClick={onReject}>대국 거절</button></DialogContent></Dialog>;
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
