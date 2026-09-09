import { getAppUser } from '@/app/auth';
import { getDatabase } from '@/db';
import type { RecordEvent } from '@/lib/game-record';

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const id = params.get('id') ?? '';
  const after = Number(params.get('after') ?? -1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(after) || after < -1) {
    return Response.json({ error: '올바른 기보 조회 요청이 아닙니다.' }, { status: 400 });
  }
  return getDatabase().transaction(async db => {
    const match = await db.prepare(`SELECT id, initial_board_json, cho_formation, han_formation,
      rules_version, record_seq, time_control FROM matches WHERE id = ? AND (cho_user_id = ? OR han_user_id = ?) FOR SHARE`)
      .bind(id, user.userId, user.userId).first<{
        id: string; initial_board_json: string | null; cho_formation: string | null;
        han_formation: string | null; rules_version: string | null; record_seq: number;
        time_control: string;
      }>();
    if (!match) return Response.json({ error: '기보를 찾을 수 없습니다.' }, { status: 404 });
    const rows = await db.prepare(`SELECT seq,kind,details,state,created_at FROM game_record_events
      WHERE match_id = ? AND seq > ? ORDER BY seq LIMIT 201`).bind(id, after).all<RecordEvent>();
    const events = rows.results.slice(0, 200);
    return Response.json({
      format: 'janggi-clash-record', formatVersion: 1, matchId: id,
      completeness: match.initial_board_json ? 'complete' : 'checkpoint-only',
      rulesVersion: match.rules_version,
      timeControl: match.time_control,
      formations: { cho: match.cho_formation, han: match.han_formation },
      initialBoard: match.initial_board_json ? JSON.parse(match.initial_board_json) : null,
      latestSeq: match.record_seq, events,
      nextAfter: rows.results.length > 200 ? events.at(-1)!.seq : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
