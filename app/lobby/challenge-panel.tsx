'use client';
import {useEffect,useState} from 'react';
type Challenge={id:string;display_name:string;outgoing:boolean;status:string;match_id:string|null;time_control:string};
export default function ChallengePanel({friends}:{friends:Array<{id:string;displayName:string}>}) {
  const [items,setItems]=useState<Challenge[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [time,setTime]=useState('standard');
  async function load(){try{const r=await fetch('/api/challenges',{cache:'no-store'});if(!r.ok)throw new Error('대국 신청을 불러오지 못했습니다.');const d=await r.json() as {challenges:Challenge[]};setItems(d.challenges);const active=d.challenges.find(c=>c.status==='accepted'&&c.match_id);if(active)window.location.assign(`/battle/${active.match_id}`);}catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}}
  useEffect(()=>{const first=window.setTimeout(()=>void load(),0),timer=window.setInterval(()=>void load(),3000);return()=>{clearTimeout(first);clearInterval(timer);};},[]);
  async function act(action:string,id:string){setBusy(true);setError('');try{const r=await fetch('/api/challenges',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({action,...(action==='request'?{userId:id}:{id}),timeControl:time})});const d=await r.json() as {error?:string;matchId?:string};if(!r.ok)throw new Error(d.error??'처리하지 못했습니다.');if(d.matchId)window.location.assign(`/battle/${d.matchId}`);else await load();}catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{setBusy(false);}}
  return <section className="challenge-panel"><h3>친구 대국 · 비랭크</h3><p>신청을 수락하면 양쪽에 포진 선택 화면이 열립니다. 각자 포진을 고르고 준비를 완료해야 대국이 시작됩니다. 랭크는 변하지 않습니다.</p><small>초대는 2분, 포진 선택은 60초 후 만료됩니다.</small>
    <fieldset disabled={busy}><legend>신청할 대국 시간</legend><div className="formation-options">{[['standard','일반 · 10분 / 30초'],['blitz','속기 · 3분 / 10초']].map(([value,label])=><button key={value} aria-pressed={time===value} className={time===value?'selected':''} onClick={()=>setTime(value)}>{label}</button>)}</div></fieldset>
    {error&&<p role="alert">{error}</p>}
    {items.map(c=><div className="challenge-row" key={c.id}><span>{c.display_name} · {c.time_control==='standard'?'일반':'속기'}<small>{c.outgoing?'응답 대기 중':'받은 대국 신청'}</small></span><div>{c.outgoing?<button disabled={busy} onClick={()=>void act('cancel',c.id)}>취소</button>:<><button disabled={busy} onClick={()=>void act('accept',c.id)}>수락</button><button disabled={busy} onClick={()=>void act('reject',c.id)}>거절</button></>}</div></div>)}
    {friends.map(f=><div className="challenge-row" key={f.id}><span>{f.displayName}</span><button disabled={busy||items.length>0} onClick={()=>void act('request',f.id)}>대국 신청</button></div>)}
    {!friends.length&&<p>친구를 추가하면 대국을 신청할 수 있습니다.</p>}
  </section>;
}
