import test from 'node:test';
import assert from 'node:assert/strict';
import { readClock, timeControls, formatClock } from '../lib/game-clock.ts';

for (const [mode, { mainMs, periodMs }] of Object.entries(timeControls)) {
  test(`${mode}: main time, overtime and exact timeout boundary`, () => {
    assert.equal(readClock(mainMs, 0, periodMs).mainMs, mainMs);
    assert.equal(readClock(mainMs, mainMs - 1, periodMs).inByoyomi, false);
    assert.deepEqual(readClock(mainMs, mainMs, periodMs), { mainMs: 0, periodMs, inByoyomi: true, expired: false });
    assert.equal(readClock(mainMs, mainMs + periodMs - 1, periodMs).expired, false);
    assert.equal(readClock(mainMs, mainMs + periodMs, periodMs).expired, true);
    assert.equal(readClock(mainMs, mainMs + periodMs + 5000, periodMs).periodMs, 0);
  });
  test(`${mode}: every new move resets overtime without incrementing main time`, () => {
    const previous = readClock(mainMs, mainMs + periodMs / 2, periodMs);
    const next = readClock(previous.mainMs, 0, periodMs);
    assert.equal(next.mainMs, 0);
    assert.equal(next.periodMs, periodMs);
    assert.equal(readClock(mainMs, -10, periodMs).mainMs, mainMs);
  });
}
test('clock display rounds up and never becomes negative', () => {
  assert.equal(formatClock(600000), '10:00');
  assert.equal(formatClock(180000), '03:00');
  assert.equal(formatClock(1), '00:01');
  assert.equal(formatClock(-1), '00:00');
});
