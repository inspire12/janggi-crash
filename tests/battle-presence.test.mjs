import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionState} from '../lib/battle-presence.ts';
test('disconnect loss starts at 30 seconds, not before',()=>{
  assert.equal(connectionState(1,30000,30000).loser,null);
  assert.equal(connectionState(1,30001,30001).loser,'cho');
  assert.equal(connectionState(30001,1,30001).loser,'han');
});
test('new and legacy games receive an initial grace period',()=>{
  assert.equal(connectionState(null,null,50000).loser,null);
});
test('a shared outage does not arbitrarily award either player a win',()=>{
  const state=connectionState(1,1,50000);
  assert.equal(state.loser,null);assert.equal(state.bothAbsent,true);
});
test('reconnect before the deadline resets absence',()=>{
  assert.equal(connectionState(29999,30000,30001).loser,null);
});
