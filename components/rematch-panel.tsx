'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type State = {status:string; requestedByMe:boolean; matchId:string|null};
export default function RematchPanel({matchId}:{matchId:string}) {
  const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const response=await fetch(`/api/rematches?id=${encodeURIComponent(matchId)}`,{cache:'no-store'});
    const body=await response.json() as State & {error?:string};
    if(!response.ok) throw new Error(body.error ?? '재대국 상태를 불러오지 못했습니다.');
    setState(body);
    if(body.status==='accepted' && body.matchId) window.location.assign(`/battle/${encodeURIComponent(body.matchId)}`);
  },[matchId]);
  useEffect(()=>{
    const check=()=>void refresh().catch(cause=>setError(cause.message));
    check();
    const timer=window.setInterval(check,3000);
    return ()=>window.clearInterval(timer);
  },[refresh]);
  async function act(action:string) {
    setBusy(true); setError('');
    try {
      const response=await fetch('/api/rematches',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({matchId,action})});
      const body=await response.json() as {error?:string};
      if(!response.ok) throw new Error(body.error ?? '재대국 요청에 실패했습니다.');
      await refresh();
    } catch(cause) {setError(cause instanceof Error?cause.message:'재대국 요청에 실패했습니다.');}
    finally {setBusy(false);}
  }
  const pending=state?.status==='pending';
  return <section className="takeback-request" aria-label="재대국" style={{flexWrap:'wrap',marginTop:16}}>
    <div aria-live="polite"><strong>{pending ? state.requestedByMe?'상대의 응답을 기다리고 있습니다':'상대가 재대국을 신청했습니다' : state?.status==='declined'?'상대가 재대국을 거절했습니다':state?.status==='expired'?'재대국 요청이 만료되었습니다':state?.status==='cancelled'?'재대국 요청을 취소했습니다':'한 판 더 두시겠어요?'}</strong><p>진영 교대 · 기존 포진 유지 · 친선전 · 요청 유효 시간 2분</p>{error && <p role="alert">{error}</p>}</div>
    <div>
      {state?.status==='none' && <button disabled={busy} onClick={()=>void act('request')}>재대국 신청</button>}
      {pending && (state.requestedByMe ? <button disabled={busy} onClick={()=>void act('cancel')}>신청 취소</button> : <><button disabled={busy} onClick={()=>void act('accept')}>재대국 수락</button><button disabled={busy} onClick={()=>void act('decline')}>거절</button></>)}
      <Link className="text-btn" href={`/review/${encodeURIComponent(matchId)}`}>복기</Link>
      <Link className="text-btn" href="/lobby">로비</Link>
    </div>
  </section>;
}
