'use client';
import {useEffect} from 'react';
export default function Presence() {
  useEffect(()=>{
    const ping=()=>{if(document.visibilityState==='visible')void fetch('/api/presence',{method:'POST'}).catch(()=>{});};
    ping();const timer=window.setInterval(ping,30000);
    document.addEventListener('visibilitychange',ping);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',ping);};
  },[]);
  return null;
}
