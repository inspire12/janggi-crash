'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { replayRecord, type RecordEvent } from '@/lib/game-record';
import { pieceLabel } from '@/lib/janggi';
import JanggiBoardMarks from '@/components/janggi-board-marks';
const labels:Record<string,string>={start:'시작 포진',checkpoint:'중간 저장 지점',move:'이동',takeback:'무르기',resign:'기권',timeout:'시간패'};
export default function Replay({id}:{id:string}) {
  const [events,setEvents]=useState<RecordEvent[]>([]), [index,setIndex]=useState(0), [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    async function load() {
      try {
        const all:RecordEvent[]=[]; let after=-1;
        do {
          const response=await fetch(`/api/records?id=${encodeURIComponent(id)}&after=${after}`,{signal:controller.signal});
          const data=await response.json() as {events:RecordEvent[];nextAfter:number|null;error?:string};
          if(!response.ok) throw new Error(data.error ?? '기보를 불러오지 못했습니다.');
          all.push(...data.events);
          if(data.nextAfter===null) break;
          if(data.nextAfter<=after) throw new Error('기보 페이지가 올바르지 않습니다.');
          after=data.nextAfter;
        } while(!controller.signal.aborted);
        replayRecord(all);
        if(!controller.signal.aborted) {setEvents(all);setIndex(all.length-1);}
      } catch(cause) {if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'연결을 확인해 주세요.');}
    }
    void load(); return ()=>controller.abort();
  },[id]);
  const current=events[index];
  return <main className="replay-shell review-theme"><Link href="/review">← 내 기보</Link><h1>대국 복기</h1>
    {error?<p role="alert">{error}</p>:!current?<p>기보를 불러오는 중…</p>:<>
      {events[0].kind==='checkpoint' && <p>이 기보는 중간 저장 지점부터 확인할 수 있습니다.</p>}
      <output aria-live="polite">{index} / {events.length-1} · {labels[current.kind] ?? current.kind} · {current.state.turn==='cho'?'초':'한'} 차례{current.state.status==='finished'?' · 대국 종료':''}</output>
      <div className="arena"><div className="board-frame"><div className="board" aria-label="복기 장기판">
        <div className="palace palace-top"/><div className="palace palace-bottom"/><JanggiBoardMarks/>
        {current.state.board.map(p=><div key={p.id} className={`piece ${p.side} piece-${p.kind} ${['pawn','guard'].includes(p.kind)?'piece-small':p.kind==='king'?'piece-king':'piece-medium'}`} style={{left:`${p.x*12.5}%`,top:`${p.y*100/9}%`}}><span>{pieceLabel(p)}</span></div>)}
      </div></div></div>
      <fieldset className="game-action-tabs" aria-label="복기 탐색"><button disabled={!index} onClick={()=>setIndex(0)}>처음</button><button disabled={!index} onClick={()=>setIndex(index-1)}>이전</button><button disabled={index===events.length-1} onClick={()=>setIndex(index+1)}>다음</button><button disabled={index===events.length-1} onClick={()=>setIndex(events.length-1)}>끝</button></fieldset>
      <label htmlFor="replay-position">기보 위치</label><input id="replay-position" type="range" min={0} max={events.length-1} value={index} onChange={event=>setIndex(Number(event.target.value))}/>
    </>}
  </main>;
}
