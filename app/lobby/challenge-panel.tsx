'use client';
import {useEffect,useState} from 'react';
import {formations,type Formation} from '@/lib/janggi';
type Challenge={id:string;display_name:string;outgoing:boolean;status:string;match_id:string|null;time_control:string};
export default function ChallengePanel({friends}:{friends:Array<{id:string;displayName:string}>}) {
  const [items,setItems]=useState<Challenge[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [formation,setFormation]=useState<Formation>('horse-elephant-elephant-horse'),[time,setTime]=useState('standard');
  async function load(){try{const r=await fetch('/api/challenges',{cache:'no-store'});if(!r.ok)throw new Error('대국 신청을 불러오지 못했습니다.');const d=await r.json() as {challenges:Challenge[]};setItems(d.challenges);const active=d.challenges.find(c=>c.status==='accepted'&&c.match_id);if(active)window.location.assign(`/battle/${active.match_id}`);}catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}}
  useEffect(()=>{const first=window.setTimeout(()=>void load(),0),timer=window.setInterval(()=>void load(),3000);return()=>{clearTimeout(first);clearInterval(timer);};},[]);
  async function act(action:string,id:string){setBusy(true);setError('');try{const r=await fetch('/api/challenges',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...(action==='request'?{userId:id}:{id}),formation,timeControl:time})});const d=await r.json() as {error?:string;matchId?:string};if(!r.ok)throw new Error(d.error??'처리하지 못했습니다.');if(d.matchId)window.location.assign(`/battle/${d.matchId}`);else await load();}catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{setBusy(false);}}
  return <section className="challenge-panel"><h3>친구 대국 · 비랭크</h3><p>수락하면 바로 시작합니다. 기보는 저장되며 랭크 전적·ELO·승강급 점수는 변하지 않습니다.</p><small>신청은 2분 후 만료됩니다. 양쪽 모두 친구 탭에서 확인하세요.</small>
    <fieldset disabled={busy}><legend>내 포진</legend><div className="formation-options">{formations.map(f=><button key={f.value} className={formation===f.value?'selected':''} aria-pressed={formation===f.value} onClick={()=>setFormation(f.value)}>{f.label}</button>)}</div></fieldset>
    <fieldset disabled={busy}><legend>신청할 대국 시간</legend><div className="formation-options">{[['standard','일반 · 10분 / 30초'],['blitz','속기 · 3분 / 10초']].map(([value,label])=><button key={value} aria-pressed={time===value} className={time===value?'selected':''} onClick={()=>setTime(value)}>{label}</button>)}</div></fieldset>
    {error&&<p role="alert">{error}</p>}
    {items.map(c=><div className="challenge-row" key={c.id}><span>{c.display_name} · {c.time_control==='standard'?'일반':'속기'}<small>{c.outgoing?'응답 대기 중':'받은 대국 신청'}</small></span><div>{c.outgoing?<button disabled={busy} onClick={()=>void act('cancel',c.id)}>취소</button>:<><button disabled={busy} onClick={()=>void act('accept',c.id)}>수락</button><button disabled={busy} onClick={()=>void act('reject',c.id)}>거절</button></>}</div></div>)}
    {friends.map(f=><div className="challenge-row" key={f.id}><span>{f.displayName}</span><button disabled={busy||items.length>0} onClick={()=>void act('request',f.id)}>대국 신청</button></div>)}
    {!friends.length&&<p>친구를 추가하면 대국을 신청할 수 있습니다.</p>}
  </section>;
}
