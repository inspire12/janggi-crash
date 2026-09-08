export type Side = 'cho' | 'han';
export type Kind =
  | 'king'
  | 'guard'
  | 'rook'
  | 'cannon'
  | 'horse'
  | 'elephant'
  | 'pawn';
export type Piece = {
  id: string;
  label: string;
  side: Side;
  x: number;
  y: number;
  kind: Kind;
  name: string;
};
export type Point = { x: number; y: number };
export type Formation =
  | 'horse-elephant-horse-elephant'
  | 'horse-elephant-elephant-horse'
  | 'elephant-horse-elephant-horse'
  | 'elephant-horse-horse-elephant';

export const formations: Array<{
  value: Formation;
  label: string;
  order: Array<'horse' | 'elephant'>;
}> = [
  { value: 'horse-elephant-horse-elephant', label: '마상마상', order: ['horse', 'elephant', 'horse', 'elephant'] },
  { value: 'horse-elephant-elephant-horse', label: '마상상마', order: ['horse', 'elephant', 'elephant', 'horse'] },
  { value: 'elephant-horse-elephant-horse', label: '상마상마', order: ['elephant', 'horse', 'elephant', 'horse'] },
  { value: 'elephant-horse-horse-elephant', label: '상마마상', order: ['elephant', 'horse', 'horse', 'elephant'] },
];

export function isFormation(value: unknown): value is Formation {
  return typeof value === 'string' && formations.some((formation) => formation.value === value);
}

const labelsBySideAndKind: Record<Side, Record<Kind, string>> = {
  cho: { king: '楚', guard: '士', rook: '車', cannon: '包', horse: '馬', elephant: '象', pawn: '卒' },
  han: { king: '漢', guard: '士', rook: '車', cannon: '包', horse: '馬', elephant: '象', pawn: '兵' },
};

export function pieceLabel(piece: Pick<Piece, 'side' | 'kind'>) {
  return labelsBySideAndKind[piece.side][piece.kind];
}

const make = (
  id: string,
  label: string,
  side: Side,
  x: number,
  y: number,
  kind: Kind,
  name: string,
): Piece => ({
  id,
  label,
  side,
  x,
  y,
  kind,
  name,
});

const basePieces: Piece[] = [
  make('hr1', '車', 'han', 0, 0, 'rook', '차'),
  make('he1', '象', 'han', 1, 0, 'elephant', '상'),
  make('hh1', '馬', 'han', 2, 0, 'horse', '마'),
  make('hg1', '士', 'han', 3, 0, 'guard', '사'),
  make('hg2', '士', 'han', 5, 0, 'guard', '사'),
  make('hh2', '馬', 'han', 6, 0, 'horse', '마'),
  make('he2', '象', 'han', 7, 0, 'elephant', '상'),
  make('hr2', '車', 'han', 8, 0, 'rook', '차'),
  make('hk', '漢', 'han', 4, 1, 'king', '궁'),
  make('hc1', '包', 'han', 1, 2, 'cannon', '포'),
  make('hc2', '包', 'han', 7, 2, 'cannon', '포'),
  ...[0, 2, 4, 6, 8].map((x, i) =>
    make(`hp${i}`, '兵', 'han', x, 3, 'pawn', '병'),
  ),
  ...[0, 2, 4, 6, 8].map((x, i) =>
    make(`cp${i}`, '卒', 'cho', x, 6, 'pawn', '졸'),
  ),
  make('cc1', '包', 'cho', 1, 7, 'cannon', '포'),
  make('cc2', '包', 'cho', 7, 7, 'cannon', '포'),
  make('ck', '楚', 'cho', 4, 8, 'king', '궁'),
  make('cr1', '車', 'cho', 0, 9, 'rook', '차'),
  make('ch1', '馬', 'cho', 1, 9, 'horse', '마'),
  make('ce1', '象', 'cho', 2, 9, 'elephant', '상'),
  make('cg1', '士', 'cho', 3, 9, 'guard', '사'),
  make('cg2', '士', 'cho', 5, 9, 'guard', '사'),
  make('ce2', '象', 'cho', 6, 9, 'elephant', '상'),
  make('ch2', '馬', 'cho', 7, 9, 'horse', '마'),
  make('cr2', '車', 'cho', 8, 9, 'rook', '차'),
];

export function createInitialPieces(
  choFormation: Formation = 'horse-elephant-elephant-horse',
  hanFormation: Formation = 'elephant-horse-horse-elephant',
): Piece[] {
  const selected: Record<Side, Formation> = { cho: choFormation, han: hanFormation };
  const backRankSlots = [1, 2, 6, 7];
  const variableIds = new Set(['he1', 'hh1', 'hh2', 'he2', 'ch1', 'ce1', 'ce2', 'ch2']);
  const pieces = basePieces.filter((piece) => !variableIds.has(piece.id));

  for (const side of ['han', 'cho'] as Side[]) {
    const formation = formations.find((item) => item.value === selected[side]) ?? formations[0];
    const counts = { horse: 0, elephant: 0 };
    formation.order.forEach((kind, index) => {
      counts[kind] += 1;
      pieces.push(make(
        `${side === 'cho' ? 'c' : 'h'}${kind === 'horse' ? 'h' : 'e'}${counts[kind]}`,
        kind === 'horse' ? '馬' : '象',
        side,
        backRankSlots[index],
        side === 'han' ? 0 : 9,
        kind,
        kind === 'horse' ? '마' : '상',
      ));
    });
  }
  return pieces;
}

export const initialPieces: Piece[] = createInitialPieces();

const inside = ({ x, y }: Point) => x >= 0 && x <= 8 && y >= 0 && y <= 9;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const occupant = (pieces: Piece[], p: Point) =>
  pieces.find((piece) => same(piece, p));
const palaceOrigin = (p: Point) =>
  p.x >= 3 && p.x <= 5 && p.y >= 0 && p.y <= 2
    ? 0
    : p.x >= 3 && p.x <= 5 && p.y >= 7 && p.y <= 9
      ? 7
      : null;
const isPalaceDiagonalEdge = (a: Point, b: Point) => {
  const origin = palaceOrigin(a);
  if (origin === null || palaceOrigin(b) !== origin) return false;
  const center = { x: 4, y: origin + 1 };
  const corner = (p: Point) =>
    (p.x === 3 || p.x === 5) && (p.y === origin || p.y === origin + 2);
  return (same(a, center) && corner(b)) || (same(b, center) && corner(a));
};

function palaceSteps(piece: Piece) {
  const points: Point[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const to = { x: piece.x + dx, y: piece.y + dy };
      if (palaceOrigin(to) !== palaceOrigin(piece)) continue;
      if (dx === 0 || dy === 0 || isPalaceDiagonalEdge(piece, to))
        points.push(to);
    }
  return points;
}

function palaceDiagonalRays(piece: Piece): Point[][] {
  const origin = palaceOrigin(piece);
  if (origin === null) return [];
  const center = { x: 4, y: origin + 1 };
  const corners = [
    { x: 3, y: origin },
    { x: 5, y: origin },
    { x: 3, y: origin + 2 },
    { x: 5, y: origin + 2 },
  ];
  if (same(piece, center)) return corners.map((c) => [c]);
  const opposite = { x: 8 - piece.x, y: 2 * (origin + 1) - piece.y };
  return isPalaceDiagonalEdge(piece, center) ? [[center, opposite]] : [];
}

function rayMoves(piece: Piece, pieces: Piece[], cannon: boolean) {
  const rays: Point[][] = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of directions) {
    const ray: Point[] = [];
    for (let n = 1; n < 10; n++) {
      const p = { x: piece.x + dx * n, y: piece.y + dy * n };
      if (!inside(p)) break;
      ray.push(p);
    }
    rays.push(ray);
  }
  rays.push(...palaceDiagonalRays(piece));
  const moves: Point[] = [];
  for (const ray of rays) {
    if (!cannon) {
      for (const p of ray) {
        const hit = occupant(pieces, p);
        if (!hit) moves.push(p);
        else {
          if (hit.side !== piece.side) moves.push(p);
          break;
        }
      }
      continue;
    }
    let screen = false;
    for (const p of ray) {
      const hit = occupant(pieces, p);
      if (!screen) {
        if (!hit) continue;
        if (hit.kind === 'cannon') break;
        screen = true;
        continue;
      }
      if (!hit) moves.push(p);
      else {
        if (hit.side !== piece.side && hit.kind !== 'cannon') moves.push(p);
        break;
      }
    }
  }
  return moves;
}

export function pseudoMoves(piece: Piece, pieces: Piece[]): Point[] {
  let candidates: Point[] = [];
  if (piece.kind === 'king' || piece.kind === 'guard')
    candidates = palaceSteps(piece);
  if (piece.kind === 'rook') candidates = rayMoves(piece, pieces, false);
  if (piece.kind === 'cannon') candidates = rayMoves(piece, pieces, true);
  if (piece.kind === 'horse') {
    const patterns = [
      { leg: [1, 0], end: [2, 1] },
      { leg: [1, 0], end: [2, -1] },
      { leg: [-1, 0], end: [-2, 1] },
      { leg: [-1, 0], end: [-2, -1] },
      { leg: [0, 1], end: [1, 2] },
      { leg: [0, 1], end: [-1, 2] },
      { leg: [0, -1], end: [1, -2] },
      { leg: [0, -1], end: [-1, -2] },
    ];
    candidates = patterns
      .filter(
        ({ leg }) =>
          !occupant(pieces, { x: piece.x + leg[0], y: piece.y + leg[1] }),
      )
      .map(({ end }) => ({ x: piece.x + end[0], y: piece.y + end[1] }));
  }
  if (piece.kind === 'elephant') {
    const patterns = [
      {
        path: [
          [1, 0],
          [2, 1],
        ],
        end: [3, 2],
      },
      {
        path: [
          [1, 0],
          [2, -1],
        ],
        end: [3, -2],
      },
      {
        path: [
          [-1, 0],
          [-2, 1],
        ],
        end: [-3, 2],
      },
      {
        path: [
          [-1, 0],
          [-2, -1],
        ],
        end: [-3, -2],
      },
      {
        path: [
          [0, 1],
          [1, 2],
        ],
        end: [2, 3],
      },
      {
        path: [
          [0, 1],
          [-1, 2],
        ],
        end: [-2, 3],
      },
      {
        path: [
          [0, -1],
          [1, -2],
        ],
        end: [2, -3],
      },
      {
        path: [
          [0, -1],
          [-1, -2],
        ],
        end: [-2, -3],
      },
    ];
    candidates = patterns
      .filter(({ path }) =>
        path.every(
          ([dx, dy]) => !occupant(pieces, { x: piece.x + dx, y: piece.y + dy }),
        ),
      )
      .map(({ end }) => ({ x: piece.x + end[0], y: piece.y + end[1] }));
  }
  if (piece.kind === 'pawn') {
    const forward = piece.side === 'han' ? 1 : -1;
    candidates = [
      { x: piece.x - 1, y: piece.y },
      { x: piece.x + 1, y: piece.y },
      { x: piece.x, y: piece.y + forward },
    ];
    for (const dx of [-1, 1]) {
      const diagonal = { x: piece.x + dx, y: piece.y + forward };
      if (isPalaceDiagonalEdge(piece, diagonal)) candidates.push(diagonal);
    }
  }
  return candidates
    .filter(inside)
    .filter((p) => occupant(pieces, p)?.side !== piece.side);
}

export function applyMove(pieces: Piece[], id: string, to: Point) {
  return pieces
    .filter((p) => p.id === id || !same(p, to))
    .map((p) => (p.id === id ? { ...p, ...to } : p));
}

export function isInCheck(side: Side, pieces: Piece[]) {
  const king = pieces.find((p) => p.side === side && p.kind === 'king');
  if (!king) return true;
  return pieces.some(
    (p) =>
      p.side !== side && pseudoMoves(p, pieces).some((to) => same(to, king)),
  );
}

export function legalMoves(piece: Piece, pieces: Piece[]) {
  return pseudoMoves(piece, pieces).filter(
    (to) => !isInCheck(piece.side, applyMove(pieces, piece.id, to)),
  );
}

export function hasLegalMove(side: Side, pieces: Piece[]) {
  return pieces.some(
    (piece) => piece.side === side && legalMoves(piece, pieces).length > 0,
  );
}

export function isCheckmate(side: Side, pieces: Piece[]) {
  return isInCheck(side, pieces) && !hasLegalMove(side, pieces);
}
