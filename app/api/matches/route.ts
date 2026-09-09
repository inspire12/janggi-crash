import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import { getPlayer, type PlayerProfile } from '@/db/players';
import { applyMove, isCheckmate, legalMoves, type Piece, type Side } from '@/lib/janggi';
import { eloChange, rankForElo } from '@/lib/rating';
import { publishMatchEvent } from '@/lib/supabase-events';

type MatchRow = {
  id: string;
  cho_user_id: string;
  han_user_id: string;
  status: 'active' | 'finished';
  turn: Side;
  board_json: string;
  previous_board_json: string | null;
  previous_turn: Side | null;
  previous_cho_time_ms: number | null;
  previous_han_time_ms: number | null;
  takeback_requested_by: string | null;
  version: number;
  winner_user_id: string | null;
  result_reason: string | null;
  cho_time_ms: number;
  han_time_ms: number;
  turn_started_at: number;
  created_at: number;
  updated_at: number;
};

async function ownedMatch(matchId: string, userId: string) {
  return getDatabase()
    .prepare(
      `SELECT id, cho_user_id, han_user_id, status, turn, board_json,
              previous_board_json, previous_turn, previous_cho_time_ms,
              previous_han_time_ms, takeback_requested_by, version,
              winner_user_id, result_reason, cho_time_ms, han_time_ms,
              turn_started_at, created_at, updated_at
       FROM matches
       WHERE id = ? AND (cho_user_id = ? OR han_user_id = ?)`,
    )
    .bind(matchId, userId, userId)
    .first<MatchRow>();
}

async function player(id: string) {
  return getDatabase()
    .prepare(
      `SELECT id, email, display_name, elo, wins, losses, draws, streak,
              allow_takeback_requests, terms_accepted_at
       FROM players WHERE id = ?`,
    )
    .bind(id)
    .first<PlayerProfile>();
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const account = await getPlayer(user.userId);
  if (!account || account.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const matchId = new URL(request.url).searchParams.get('id');
  if (!matchId) return Response.json({ error: '대국 ID가 필요합니다.' }, { status: 400 });
  const match = await ownedMatch(matchId, user.userId);
  if (!match) return Response.json({ error: '대국을 찾을 수 없습니다.' }, { status: 404 });
  const [cho, han] = await Promise.all([player(match.cho_user_id), player(match.han_user_id)]);
  const side: Side = match.cho_user_id === user.userId ? 'cho' : 'han';
  const now = Date.now();
  const elapsed = match.status === 'active' ? Math.max(0, now - match.turn_started_at) : 0;
  const choTimeMs = Math.max(0, match.cho_time_ms - (match.turn === 'cho' ? elapsed : 0));
  const hanTimeMs = Math.max(0, match.han_time_ms - (match.turn === 'han' ? elapsed : 0));
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
      choTimeMs,
      hanTimeMs,
      clockSyncedAt: now,
      updatedAt: match.updated_at,
      canTakeback: Boolean(match.previous_board_json),
      takebackRequested: Boolean(match.takeback_requested_by),
      takebackRequestedByMe: match.takeback_requested_by === user.userId,
      opponentAllowsTakeback: (side === 'cho' ? han : cho)?.allow_takeback_requests === 1,
    },
    you: { side, ...presentPlayer(side === 'cho' ? cho : han) },
    opponent: presentPlayer(side === 'cho' ? han : cho),
  });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const account = await getPlayer(user.userId);
  if (!account || account.terms_accepted_at === 0) return Response.json({ error: '게임 계정 생성이 필요합니다.' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    matchId?: string;
    action?: 'move' | 'resign' | 'takeback-request' | 'takeback-accept' | 'takeback-reject';
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
    const finished = await finishMatch(match, opponentId, user.userId, 'resign');
    if (finished) await publishMatchEvent(match.id, match.version + 1, 'resign');
    return Response.json({ ok: true, finished: true });
  }
  if (body.action === 'takeback-request') {
    if (!match.previous_board_json) return Response.json({ error: '무를 수 있는 수가 없습니다.' }, { status: 409 });
    const result = await getDatabase().prepare(
      `UPDATE matches SET takeback_requested_by = ?, updated_at = ?
       WHERE id = ? AND status = 'active' AND takeback_requested_by IS NULL
         AND EXISTS (
           SELECT 1 FROM players
           WHERE id = ? AND allow_takeback_requests = 1
         )`,
    ).bind(user.userId, Date.now(), match.id, opponentId).run();
    if (result.meta.changes !== 1) {
      const opponent = await getPlayer(opponentId);
      return Response.json(
        { error: opponent?.allow_takeback_requests === 0 ? '상대가 무르기 요청을 받지 않도록 설정했습니다.' : '이미 무르기 요청이 진행 중입니다.' },
        { status: 409 },
      );
    }
    await publishMatchEvent(match.id, match.version, 'takeback-request');
    return Response.json({ ok: true });
  }
  if (body.action === 'takeback-reject') {
    if (!match.takeback_requested_by || match.takeback_requested_by === user.userId) return Response.json({ error: '응답할 무르기 요청이 없습니다.' }, { status: 409 });
    const result = await getDatabase().prepare(
      'UPDATE matches SET takeback_requested_by = NULL, updated_at = ? WHERE id = ? AND takeback_requested_by = ?',
    ).bind(Date.now(), match.id, match.takeback_requested_by).run();
    if (result.meta.changes !== 1) return Response.json({ error: '무르기 요청 상태가 변경되었습니다.' }, { status: 409 });
    await publishMatchEvent(match.id, match.version, 'takeback-reject');
    return Response.json({ ok: true });
  }
  if (body.action === 'takeback-accept') {
    if (!match.takeback_requested_by || match.takeback_requested_by === user.userId || !match.previous_board_json || !match.previous_turn) return Response.json({ error: '수락할 무르기 요청이 없습니다.' }, { status: 409 });
    const now = Date.now();
    const result = await getDatabase().prepare(
      `UPDATE matches SET board_json = previous_board_json, turn = previous_turn,
       cho_time_ms = COALESCE(previous_cho_time_ms, cho_time_ms),
       han_time_ms = COALESCE(previous_han_time_ms, han_time_ms),
       previous_board_json = NULL, previous_turn = NULL,
       previous_cho_time_ms = NULL, previous_han_time_ms = NULL,
       takeback_requested_by = NULL, version = version + 1,
       turn_started_at = ?, updated_at = ?
       WHERE id = ? AND version = ? AND takeback_requested_by = ?`,
    ).bind(now, now, match.id, match.version, match.takeback_requested_by).run();
    if (result.meta.changes !== 1) return Response.json({ error: '대국 상태가 변경되었습니다.' }, { status: 409 });
    await publishMatchEvent(match.id, match.version + 1, 'takeback-accept');
    return Response.json({ ok: true });
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
  const elapsed = Math.max(0, now - match.turn_started_at);
  const choTimeMs = Math.max(0, match.cho_time_ms - (side === 'cho' ? elapsed : 0));
  const hanTimeMs = Math.max(0, match.han_time_ms - (side === 'han' ? elapsed : 0));
  if ((side === 'cho' ? choTimeMs : hanTimeMs) === 0) {
    const finished = await finishMatch(match, opponentId, user.userId, 'timeout');
    if (finished) await publishMatchEvent(match.id, match.version + 1, 'timeout');
    return Response.json({ error: '제한시간이 종료되었습니다.' }, { status: 409 });
  }
  const db = getDatabase();
  const update = db
    .prepare(
      `UPDATE matches
       SET board_json = ?, turn = ?, version = version + 1, updated_at = ?,
           status = ?, winner_user_id = ?, result_reason = ?,
           cho_time_ms = ?, han_time_ms = ?, turn_started_at = ?,
           previous_board_json = ?, previous_turn = ?,
           previous_cho_time_ms = ?, previous_han_time_ms = ?,
           takeback_requested_by = NULL
       WHERE id = ? AND version = ? AND status = 'active'`,
    )
    .bind(
      JSON.stringify(next),
      nextTurn,
      now,
      checkmate ? 'finished' : 'active',
      checkmate ? user.userId : null,
      checkmate ? 'checkmate' : null,
      choTimeMs,
      hanTimeMs,
      now,
      match.board_json,
      match.turn,
      match.cho_time_ms,
      match.han_time_ms,
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
  const ratings = checkmate ? await ratingStatements(user.userId, opponentId) : [];
  const results = await db.batch([update, move, ...ratings], true);
  if (!results[0].success || results[0].meta.changes !== 1) {
    return Response.json({ error: '상대 수가 먼저 반영되었습니다. 새로고침합니다.' }, { status: 409 });
  }
  await publishMatchEvent(match.id, match.version + 1, checkmate ? 'checkmate' : 'move');
  return Response.json({ ok: true, checkmate, version: match.version + 1 });
}

async function finishMatch(match: MatchRow, winnerId: string, loserId: string, reason: string) {
  const db = getDatabase();
  const update = db
      .prepare(
        `UPDATE matches SET status = 'finished', winner_user_id = ?,
         result_reason = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(winnerId, reason, Date.now(), match.id);
  const [result] = await db.batch([update, ...await ratingStatements(winnerId, loserId)], true);
  return result.meta.changes === 1;
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
        `UPDATE players SET elo = GREATEST(100, elo - ?), losses = losses + 1,
         streak = CASE WHEN streak <= 0 THEN streak - 1 ELSE -1 END, updated_at = ?
         WHERE id = ?`,
      )
      .bind(delta, Date.now(), loserId),
  ];
}
