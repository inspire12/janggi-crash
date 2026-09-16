import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const id='11111111-1111-4111-8111-111111111111';
function fixture({expired=false,blocked=false,active=false}={}) {
  let user='a';
  const offer={id,cho_user_id:'a',han_user_id:'b',cho_formation:null,han_formation:null,time_control:'standard',status:'pending',expires_at:Date.now()+(expired?-1000:60000),match_id:null,rated:true,friend_challenge_id:null};
  const writes=[];
  const db={transaction:async(fn,lock)=>{assert.equal(lock,736421);return fn(db);},prepare(sql){return {bind(...args){return {
    first:async()=>{
      if(sql.includes('FROM match_offers'))return user==='outsider'?null:{...offer};
      if(sql.includes('FROM blocked_players'))return blocked?{}:null;
      if(sql.includes('FROM matches'))return active?{id:'busy'}:null;
      return null;
    },
    run:async()=>{
      writes.push({sql,args});
      if(sql.includes("SET status='expired'") && offer.expires_at<=Date.now())offer.status='expired';
      if(sql.includes("SET status='declined'"))offer.status='declined';
      if(sql.includes('SET cho_formation'))offer.cho_formation=args[0];
      if(sql.includes('SET han_formation'))offer.han_formation=args[0];
      if(sql.includes("SET status='accepted'")){offer.status='accepted';offer.match_id=args[0];}
    },
  };}};}};
  const imports={
    '@/app/auth':{getAppUser:async()=>({userId:user})},
    '@/db':{getDatabase:()=>db},
    '@/db/players':{getPlayer:async()=>({terms_accepted_at:1,elo:1200})},
    '@/lib/rating':{rankForScore:()=>({name:'18급'})},
    '@/lib/janggi':{isFormation:value=>['f1','f2','f3','f4'].includes(value),createInitialPieces:(cho,han)=>[{cho,han}]},
    '@/lib/game-clock':{timeControls:{standard:{mainMs:600000},blitz:{mainMs:180000}}},
  };
  const source=ts.transpileModule(readFileSync(new URL('../app/api/matchmaking/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{},require:name=>imports[name],Response,URL,Date,crypto:{randomUUID:()=> 'new'}};
  vm.runInNewContext(source,context);
  return {offer,writes,post:async(who,action,formation='f1')=>{
    user=who;
    return context.exports.POST(new Request('http://localhost/api/matchmaking',{method:'POST',body:JSON.stringify({action,offerId:id,formation})}));
  }};
}
test('first acceptance creates no game; second starts one with both formations',async()=>{
  const f=fixture();
  assert.equal((await f.post('a','accept','f2')).status,200);
  assert.equal(f.writes.filter(x=>x.sql.includes('INSERT INTO matches')).length,0);
  const response=await f.post('b','accept','f4');
  assert.equal((await response.json()).matchId,'new');
  const games=f.writes.filter(x=>x.sql.includes('INSERT INTO matches'));
  assert.equal(games.length,1);
  assert.deepEqual(JSON.parse(games[0].args[3]),[{cho:'f2',han:'f4'}]);
  assert.equal(games[0].args[4],600000);
  await f.post('b','accept');
  assert.equal(f.writes.filter(x=>x.sql.includes('INSERT INTO matches')).length,1);
});
test('accepted formation cannot change on retry',async()=>{
  const f=fixture();await f.post('a','accept','f2');await f.post('a','accept','f3');
  assert.equal(f.offer.cho_formation,'f2');
});
test('decline after first acceptance prevents starting',async()=>{
  const f=fixture();await f.post('a','accept');await f.post('b','decline');
  assert.equal((await f.post('b','accept')).status,409);
  assert.equal(f.writes.some(x=>x.sql.includes('INSERT INTO matches')),false);
});
test('expiry, busy player, blocking, invalid formation and outsiders cannot start',async()=>{
  for(const [options,who,formation,code] of [[{expired:true},'a','f1',409],[{blocked:true},'a','f1',409],[{active:true},'a','f1',409],[{},'outsider','f1',404],[{},'a','invalid',400]]){
    const f=fixture(options);assert.equal((await f.post(who,'accept',formation)).status,code);
    assert.equal(f.writes.some(x=>x.sql.includes('INSERT INTO matches')),false);
  }
});
