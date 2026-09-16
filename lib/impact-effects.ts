import type {Piece} from './janggi';
export const impactLevels={off:0,low:0.45,normal:0.8,high:1.25};
export type ImpactLevel=keyof typeof impactLevels;
export function readImpactLevel():ImpactLevel {
  try{const v=localStorage.getItem('janggi-impact');return v && Object.hasOwn(impactLevels,v)?v as ImpactLevel:'normal';}catch{return 'normal';}
}
export function capturedPiece(previous:Piece[],next:Piece[]) {
  const removed=previous.filter(p=>!next.some(n=>n.id===p.id));
  if(removed.length!==1)return null;
  const victim=removed[0];
  const attacker=next.find(p=>p.x===victim.x && p.y===victim.y && p.side!==victim.side && previous.some(old=>old.id===p.id));
  return attacker?{victim,attacker}:null;
}
