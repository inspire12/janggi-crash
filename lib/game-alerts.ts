'use client';
let audio:AudioContext|null=null;
export function armGameAlerts() {
  try {audio??=new AudioContext();void audio.resume().catch(()=>{});}catch{/* Audio unavailable. */}
}
export function gameAlert(kind:'match'|'turn') {
  try {
    if(localStorage.getItem('janggi-alert-vibration')==='on' && typeof navigator.vibrate==='function')navigator.vibrate(kind==='match'?[60,60,60]:40);
    if(localStorage.getItem('janggi-alert-sound')!=='on' || audio?.state!=='running')return;
    const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
    oscillator.type='sine';oscillator.frequency.value=kind==='match'?660:520;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(0.08,now+0.015);gain.gain.exponentialRampToValueAtTime(0.001,now+0.18);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+0.2);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }catch{/* Notifications must never interrupt a game. */}
}
