import type { Piece, Kind } from '@/lib/janggi';
const values:Record<Kind,number>={king:0,rook:13,cannon:7,horse:5,elephant:3,guard:3,pawn:2};
export default function MatchInfo({board,moves}:{board:Piece[];moves:number|null}) {
  const score=(side:string)=>board.filter(p=>p.side===side).reduce((sum,p)=>sum+values[p.kind],0);
  return <section className="match-info" aria-label="대국 진행 정보"><div><span>진행</span><strong>{moves ?? '—'} <small>/ 200수</small></strong></div><div><span>초 기물</span><strong>{score('cho')}<small>점</small></strong></div><div><span>한 기물</span><strong>{score('han')}<small>점</small></strong></div><p>한 번의 착수 = 1수 · 기물 점수는 덤 제외</p></section>;
}
