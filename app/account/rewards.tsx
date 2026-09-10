'use client';
import { useEffect, useState } from 'react';
type Rewards = {points:number;streak:number;claimed:boolean;awarded:number};
export default function RewardPanel() {
  const [data,setData]=useState<Rewards|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function load(claim=false) {
    setBusy(true); setError('');
    try {
      const response=await fetch('/api/rewards',{method:claim?'POST':'GET'});
      const result=await response.json() as Rewards & {error?:string};
      if(!response.ok) throw new Error(result.error ?? '보상을 불러오지 못했습니다.');
      setData(result);
    } catch(cause) {setError(cause instanceof Error?cause.message:'연결을 확인해 주세요.');}
    finally {setBusy(false);}
  }
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return ()=>window.clearTimeout(timer);},[]);
  return <section className="account-settings"><h2>포인트와 미션</h2>
    {data && <><strong>{data.points.toLocaleString()} P</strong><p>연속 출석 {data.streak}일 · 오늘 {data.claimed?'출석 완료':'미출석'}</p></>}
    <p>매일 출석 100 P · 7일 연속 출석마다 추가 300 P</p><small>한국 시간 자정 기준 · 하루 쉬면 연속 출석이 초기화됩니다.</small>
    <button className="match-button" disabled={busy || Boolean(data?.claimed)} onClick={()=>void load(true)}>{busy?'확인 중…':data?.claimed?'오늘 출석 완료':'출석 체크'}</button>
    <output aria-live="polite">{data?.awarded ? `${data.awarded} P를 받았습니다.`:''}</output>
    {error && <p role="alert">{error}</p>}
  </section>;
}
