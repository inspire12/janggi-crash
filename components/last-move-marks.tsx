import type {Piece} from '@/lib/janggi';

export default function LastMoveMarks({previous,current,flipped=false}:{previous:Piece[]|null;current:Piece[];flipped?:boolean}) {
  if(!previous)return null;
  const moved=current.filter(p=>{const old=previous.find(o=>o.id===p.id);return old && (old.x!==p.x || old.y!==p.y);});
  if(moved.length!==1)return null;
  const to=moved[0],from=previous.find(p=>p.id===to.id)!;
  return <>{[from,to].map((p,i)=><span key={i} className={`last-move-mark ${i?'destination':'origin'}`} aria-label={i?'마지막 수 도착':'마지막 수 출발'} style={{left:`${(flipped?8-p.x:p.x)*12.5}%`,top:`${(flipped?9-p.y:p.y)*100/9}%`}} />)}</>;
}
