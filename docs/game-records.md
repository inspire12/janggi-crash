# Game records v1

Apply `20260910010000_game_records.sql` after the Worker runtime migration,
then deploy the matching code. This change has not been applied to production.

New games preserve immutable initial board, both formations and the rules
version `janggi-clash-v1`. Changes to rules semantics must bump that version.
The `game_record_events` table is the canonical replay source, not `moves.ply`.
`moves` remains the legacy move index; its ply still follows game versions.

Events have a per-game contiguous `seq`, starting at zero. Kinds are start,
move, takeback, resign and timeout. A checkmating move includes `checkmate: true`
and its final state includes the winner and checkmate result reason. Accepted
takebacks identify the undone event; requests and rejections do not change the
play timeline. Move details include actor, coordinates, piece and captured piece.
Every event has a full board/turn/clock/result snapshot, so replay does not depend
on future rule-engine behavior. Record rows and game mutations commit or roll
back together via PostgreSQL triggers; stale optimistic updates create no event.

Existing games retain only a checkpoint at migration time and all later events.
Unknown initial position, formations and older undo history are not fabricated.
They are returned as `checkpoint-only` and cannot claim a complete final line.

Authenticated participants can read `GET /api/records?id=<match UUID>`. Responses
contain up to 200 events; pass `after=<nextAfter>` until nextAfter is null. The
match header is share-locked while each page is read for consistency. Append-only
sequences keep paging stable as the game progresses. Browser roles cannot access
the table directly, and other players cannot retrieve the record through the API.

`replayRecord` takes all pages, checks sequence continuity, and returns both the
actual timeline (including undone moves) and the surviving final move sequence.
Snapshots are stored at action time, not continuously ticking clock values.
The format is app-specific JSON, not a claim of compatibility with an external
janggi file standard. A graphical replay screen and download UI are not added
by this storage/API change.
