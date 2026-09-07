import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDatabase } from '@/db';
import { getPlayer, type PlayerProfile } from '@/db/players';
import { applyMove, isCheckmate, legalMoves, type Piece, type Side } from '@/lib/janggi';
import { eloChange, rankForElo } from '@/lib/rating';

type MatchRow = {
  id: string;
  cho_user_id: string;
  han_user_id: string;
  status: 'active' | 'finished';
  turn: Side;
  board_json: string;
  version: number;
  winner_user_id: string | null;
  result_reason: string | null;
  created_at: number;
  updated_at: number;
};

async function ownedMatch(matchId: string, userId: string) {
  return getDatabase()
    .prepare(
      `SELECT id, cho_user_id, han_user_id, status, turn, board_json, version,
              winner_user_id, result_reason, created_at, updated_at
       FROM matches
       WHERE id = ? AND (cho_user_id = ? OR han_user_id = ?)`,
    )
    .bind(matchId, userId, userId)
    .first<MatchRow>();
}

async function player(id: string) {
  return getDatabase()
    .prepare(
      `SELECT id, email, display_name, elo, wins, losses, draws, streak
       FROM players WHERE id = ?`,
    )
    .bind(id)
    .first<PlayerProfile>();
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const account = await getPlayer(user.userId);
  if (!account || account.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const matchId = new URL(request.url).searchParams.get('id');
  if (!matchId) return Response.json({ error: '대국 ID가 필요합니다.' }, { status: 400 });
  const match = await ownedMatch(matchId, user.userId);
  if (!match) return Response.json({ error: '대국을 찾을 수 없습니다.' }, { status: 404 });
  const [cho, han] = await Promise.all([player(match.cho_user_id), player(match.han_user_id)]);
  const side: Side = match.cho_user_id === user.userId ? 'cho' : 'han';
  const presentPlayer = (profile: PlayerProfile | null) => ({
    id: profile?.id,
    displayName: profile?.display_name ?? '지휘관',
    elo: profile?.elo ?? 1200,
    rank: rankForElo(profile?.elo ?? 1200),
  });
  return Response.json({
    match: {
      id: match.id,
      status: match.status,
      turn: match.turn,
      board: JSON.parse(match.board_json) as Piece[],
      version: match.version,
      winnerSide:
        match.winner_user_id === match.cho_user_id
          ? 'cho'
          : match.winner_user_id === match.han_user_id
            ? 'han'
            : null,
      resultReason: match.result_reason,
      updatedAt: match.updated_at,
    },
    you: { side, ...presentPlayer(side === 'cho' ? cho : han) },
    opponent: presentPlayer(side === 'cho' ? han : cho),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const account = await getPlayer(user.userId);
  if (!account || account.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    matchId?: string;
    action?: 'move' | 'resign';
    pieceId?: string;
    to?: { x?: number; y?: number };
    version?: number;
  };
  if (!body.matchId) return Response.json({ error: '대국 ID가 필요합니다.' }, { status: 400 });
  const match = await ownedMatch(body.matchId, user.userId);
  if (!match || match.status !== 'active') {
    return Response.json({ error: '진행 중인 대국이 아닙니다.' }, { status: 409 });
  }
  const side: Side = match.cho_user_id === user.userId ? 'cho' : 'han';
  const opponentId = side === 'cho' ? match.han_user_id : match.cho_user_id;
  if (body.action === 'resign') {
    await finishMatch(match, opponentId, user.userId, 'resign');
    return Response.json({ ok: true, finished: true });
  }
  if (
    body.action !== 'move' ||
    match.turn !== side ||
    body.version !== match.version ||
    !body.pieceId ||
    !Number.isInteger(body.to?.x) ||
    !Number.isInteger(body.to?.y)
  ) {
    return Response.json({ error: '현재 상태에서 둘 수 없는 요청입니다.' }, { status: 409 });
  }
  const pieces = JSON.parse(match.board_json) as Piece[];
  const piece = pieces.find((item) => item.id === body.pieceId);
  const to = { x: body.to!.x!, y: body.to!.y! };
  if (!piece || piece.side !== side || !legalMoves(piece, pieces).some((p) => p.x === to.x && p.y === to.y)) {
    return Response.json({ error: '합법적인 수가 아닙니다.' }, { status: 400 });
  }
  const next = applyMove(pieces, piece.id, to);
  const nextTurn: Side = side === 'cho' ? 'han' : 'cho';
  const checkmate = isCheckmate(nextTurn, next);
  const now = Date.now();
  const db = getDatabase();
  const update = db
    .prepare(
      `UPDATE matches
       SET board_json = ?, turn = ?, version = version + 1, updated_at = ?,
           status = ?, winner_user_id = ?, result_reason = ?
       WHERE id = ? AND version = ? AND status = 'active'`,
    )
    .bind(
      JSON.stringify(next),
      nextTurn,
      now,
      checkmate ? 'finished' : 'active',
      checkmate ? user.userId : null,
      checkmate ? 'checkmate' : null,
      match.id,
      match.version,
    );
  const move = db
    .prepare(
      `INSERT INTO moves
       (match_id, ply, user_id, piece_id, from_x, from_y, to_x, to_y, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(match.id, match.version + 1, user.userId, piece.id, piece.x, piece.y, to.x, to.y, now);
  const results = await db.batch([update, move]);
  if (!results[0].success || results[0].meta.changes !== 1) {
    return Response.json({ error: '상대 수가 먼저 반영되었습니다. 새로고침합니다.' }, { status: 409 });
  }
  if (checkmate) await db.batch(await ratingStatements(user.userId, opponentId));
  return Response.json({ ok: true, checkmate, version: match.version + 1 });
}

async function finishMatch(match: MatchRow, winnerId: string, loserId: string, reason: string) {
  const db = getDatabase();
  const result = await db
      .prepare(
        `UPDATE matches SET status = 'finished', winner_user_id = ?,
         result_reason = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(winnerId, reason, Date.now(), match.id)
      .run();
  if (result.meta.changes === 1) await db.batch(await ratingStatements(winnerId, loserId));
}

async function ratingStatements(winnerId: string, loserId: string) {
  const db = getDatabase();
  const [winner, loser] = await Promise.all([player(winnerId), player(loserId)]);
  const delta = eloChange(winner?.elo ?? 1200, loser?.elo ?? 1200);
  return [
    db
      .prepare(
        `UPDATE players SET elo = elo + ?, wins = wins + 1,
         streak = CASE WHEN streak >= 0 THEN streak + 1 ELSE 1 END, updated_at = ?
         WHERE id = ?`,
      )
      .bind(delta, Date.now(), winnerId),
    db
      .prepare(
        `UPDATE players SET elo = MAX(100, elo - ?), losses = losses + 1,
         streak = CASE WHEN streak <= 0 THEN streak - 1 ELSE -1 END, updated_at = ?
         WHERE id = ?`,
      )
      .bind(delta, Date.now(), loserId),
  ];
}
