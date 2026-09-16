'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Piece } from './janggi';
import {capturedPiece,impactLevels,readImpactLevel} from './impact-effects';

export function hoppingPiece(previous: Piece[], next: Piece[]) {
  const moved=next.filter(piece=>{
    const old=previous.find(item=>item.id===piece.id);
    return old && (old.x!==piece.x || old.y!==piece.y);
  });
  // Initial load, formation changes and whole-board resets should not bounce.
  return moved.length===1 && ['cannon','horse','elephant'].includes(moved[0].kind)?moved[0]:null;
}

export function usePieceHop(pieces: Piece[], effectsEnabled=true) {
  const boardRef=useRef<HTMLDivElement>(null);
  const previous=useRef<Piece[]>([]);
  const animations=useRef(new Set<Animation>());
  const timers=useRef(new Set<ReturnType<typeof setTimeout>>());
  const rings=useRef(new Set<HTMLElement>());
  useLayoutEffect(()=>{
    const before=previous.current;
    const piece=hoppingPiece(previous.current,pieces);
    previous.current=pieces;
    const capture=capturedPiece(before,pieces),power=impactLevels[readImpactLevel()];
    if(capture && power && effectsEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const board=boardRef.current;
      const element=board?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(capture.attacker.id)}"]`);
      if(element && board){
        const old=before.find(p=>p.id===capture.attacker.id);
        const delay=old && (old.x!==capture.attacker.x || old.y!==capture.attacker.y)?(parseFloat(getComputedStyle(element).transitionDuration)||0.32)*1000:0;
        const timer=setTimeout(()=>{
          timers.current.delete(timer);
          if(!element.isConnected)return;
          const strength=power*(['pawn','guard'].includes(capture.victim.kind)?0.65:capture.victim.kind==='rook'?1.25:1);
          const ring=document.createElement('i');ring.className='capture-shock-ring';ring.setAttribute('aria-hidden','true');
          ring.style.left=element.style.left;ring.style.top=element.style.top;board.appendChild(ring);rings.current.add(ring);
          const shock=ring.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.7},{transform:`translate(-50%,-50%) scale(${1.5+strength})`,opacity:0}],{duration:320,easing:'ease-out'});
          animations.current.add(shock);shock.onfinish=()=>{ring.remove();rings.current.delete(ring);animations.current.delete(shock);};
          const shift=3*strength;
          for(const animation of [element.animate([{scale:'1'},{scale:String(1+.09*strength),offset:.25},{scale:'1'}],{duration:180}),board.animate([{translate:'0 0'},{translate:`${shift}px 0`},{translate:`${-shift*.65}px 0`},{translate:'0 0'}],{duration:180})]){animations.current.add(animation);animation.onfinish=()=>animations.current.delete(animation);}
        },delay);
        timers.current.add(timer);
      }
    }
    if(!piece || window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const element=boardRef.current?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(piece.id)}"]`);
    if(!element)return;
    const duration=(parseFloat(getComputedStyle(element).transitionDuration)||0.32)*1000;
    // Individual scale leaves the board-centering transform and capture glow intact.
    const animation=element.animate([
      {scale:'1',zIndex:9,offset:0},
      {scale:'1.1',zIndex:9,offset:0.45},
      {scale:'1.06',zIndex:9,offset:0.72},
      {scale:'1',zIndex:9,offset:1},
    ],{duration,easing:'ease-in-out'});
    animations.current.add(animation);
    animation.onfinish=()=>animations.current.delete(animation);
  },[pieces,effectsEnabled]);
  useEffect(()=>{
    const active=animations.current;
    const pending=timers.current,activeRings=rings.current;
    document.documentElement.dataset.impactStrength=readImpactLevel();
    return()=>{for(const timer of pending)clearTimeout(timer);for(const ring of activeRings)ring.remove();for(const animation of active)animation.cancel();active.clear();pending.clear();activeRings.clear();};
  },[]);
  return boardRef;
}
