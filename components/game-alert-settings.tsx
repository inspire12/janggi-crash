'use client';
import {useEffect,useState} from 'react';
import {armGameAlerts,gameAlert} from '@/lib/game-alerts';
import {readImpactLevel,type ImpactLevel} from '@/lib/impact-effects';
export default function GameAlertSettings() {
  const [sound,setSound]=useState(false),[vibration,setVibration]=useState(false);
  const [impact,setImpact]=useState<ImpactLevel>('normal');
  useEffect(()=>{setImpact(readImpactLevel());},[]);
  useEffect(()=>{try{setSound(localStorage.getItem('janggi-alert-sound')==='on');setVibration(localStorage.getItem('janggi-alert-vibration')==='on');}catch{}},[]);
  function save(key:string,value:boolean){try{localStorage.setItem(key,value?'on':'off');}catch{}}
  return <section className="game-alert-settings"><h2>대국 알림</h2><p>매칭 성사와 내 차례를 알려줍니다. 이 브라우저에 저장됩니다.</p>
    <label>격돌 효과 강도 <select value={impact} onChange={e=>{const value=e.target.value as ImpactLevel;setImpact(value);try{localStorage.setItem('janggi-impact',value);}catch{}document.documentElement.dataset.impactStrength=value;}}><option value="off">끄기</option><option value="low">약하게</option><option value="normal">보통</option><option value="high">강하게</option></select></label>
    <label><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);save('janggi-alert-sound',e.target.checked);armGameAlerts();}} /> 소리 알림</label>
    <label><input type="checkbox" checked={vibration} onChange={e=>{setVibration(e.target.checked);save('janggi-alert-vibration',e.target.checked);}} /> 진동 알림 (지원 기기)</label>
    <button onClick={()=>{armGameAlerts();gameAlert('match');}}>알림 시험</button>
  </section>;
}
