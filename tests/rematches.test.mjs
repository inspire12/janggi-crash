import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture({user='a',status='finished',row=null,active=false,blocked=false}={}) {
  const writes=[];
  const match={id:'old',cho_user_id:'a',han_user_id:'b',status,cho_formation:'f',han_formation:'f',time_control:'blitz'};
  const db={transaction:async(fn,lock)=>{assert.equal(lock,736421);return fn(db);},prepare(sql){return {bind(...args){return {first:async()=>sql.includes('FROM match_offers')?null:sql.includes('FROM rematch_requests')?row:sql.includes('FROM blocked_players')?blocked:sql.includes("status='active'")?active:user==='stranger'?null:match,run:async()=>{writes.push({sql,args});}};}};}};
  const imports={
    '@/app/auth':{getAppUser:async()=>user?{userId:user}:null},
    '@/db':{getDatabase:()=>db},
    '@/lib/janggi':{isFormation:()=>true,createInitialPieces:()=>[]},
    '@/lib/game-clock':{timeControls:{blitz:{mainMs:180000},standard:{mainMs:600000}}},
  };
  const source=ts.transpileModule(readFileSync(new URL('../app/api/rematches/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{},require:name=>imports[name],Response,Request,URL,Date,crypto:{randomUUID:()=> 'new'}};
  vm.runInNewContext(source,context);
  return {writes,post:action=>context.exports.POST(new Request('http://localhost/api/rematches',{method:'POST',body:JSON.stringify({matchId:'old',action})}))};
}
test('only authenticated finished-game participants can request',async()=>{
  for(const [options,code] of [[{user:null},401],[{user:'stranger'},404],[{status:'active'},409],[{blocked:true},403],[{active:true},409]]) {
    const f=fixture(options);assert.equal((await f.post('request')).status,code);assert.equal(f.writes.length,0);
  }
});
test('request records a two-minute invitation without creating a game',async()=>{
  const f=fixture();assert.equal((await f.post('request')).status,200);
  assert.equal(f.writes.length,1);assert.match(f.writes[0].sql,/INSERT INTO rematch_requests/);
  assert.ok(f.writes[0].args[2]>Date.now()+119000);
});
test('only opponent can accept an unexpired request',async()=>{
  for(const row of [{requested_by:'a',status:'pending',expires_at:Date.now()+120000},{requested_by:'b',status:'pending',expires_at:0}]) {
    const f=fixture({row});assert.equal((await f.post('accept')).status,409);assert.equal(f.writes.length,0);
  }
});
test('accept swaps sides, preserves time control, creates one unrated match',async()=>{
  const f=fixture({row:{requested_by:'b',status:'pending',expires_at:Date.now()+120000}});
  assert.equal((await f.post('accept')).status,200);
  const inserts=f.writes.filter(x=>x.sql.includes('INSERT INTO matches'));
  assert.equal(inserts.length,1);assert.deepEqual(inserts[0].args.slice(0,3),['new','b','a']);
  assert.equal(inserts[0].args.at(-1),'blitz');assert.match(inserts[0].sql,/false/);
});
test('accepted request retry returns existing game without writes',async()=>{
  const f=fixture({row:{requested_by:'b',status:'accepted',next_match_id:'existing'}});
  assert.equal((await (await f.post('accept')).json()).matchId,'existing');assert.equal(f.writes.length,0);
});
