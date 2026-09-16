import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as impacts from '../lib/impact-effects.ts';
const context={exports:{},require:name=>name==='./impact-effects'?impacts:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/use-piece-hop.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {hoppingPiece}=context.exports;
import {initialPieces} from '../lib/janggi.ts';

for(const kind of ['cannon','horse','elephant','rook','pawn','king','guard']) {
  test(`${kind}: only hopping pieces animate on position changes`,()=>{
    const piece=initialPieces.find(p=>p.kind===kind);
    const next=initialPieces.map(p=>p.id===piece.id?{...p,y:p.y+1}:p);
    assert.equal(hoppingPiece(initialPieces,next)?.id,['cannon','horse','elephant'].includes(kind)?piece.id:undefined);
  });
}
test('initial load, unchanged polls and multi-piece resets do not hop',()=>{
  assert.equal(hoppingPiece([],initialPieces),null);
  assert.equal(hoppingPiece(initialPieces,initialPieces.map(p=>({...p}))),null);
  assert.equal(hoppingPiece(initialPieces,initialPieces.map(p=>({...p,y:p.y+1}))),null);
});
test('capture detection supports online and delayed practice removal',()=>{
  const attacker={...initialPieces[0],x:1,y:1,side:'cho'};
  const victim={...initialPieces[1],id:'victim',x:2,y:2,side:'han'};
  const moved={...attacker,x:2,y:2};
  assert.equal(impacts.capturedPiece([attacker,victim],[moved]).victim.id,'victim');
  assert.equal(impacts.capturedPiece([moved,victim],[moved]).victim.id,'victim');
  assert.equal(impacts.capturedPiece([attacker,victim],[attacker,victim]),null);
  assert.equal(impacts.capturedPiece([],initialPieces),null);
});
