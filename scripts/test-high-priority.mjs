// Creates isolated LOCAL fixtures; never uses an existing player's active game.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import postgres from 'postgres';
const config=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(config.API_URL).origin,'http://127.0.0.1:54321');
assert.equal(new URL(config.DB_URL).host,'127.0.0.1:54322');
const sql=postgres(config.DB_URL,{ssl:false,max:1});
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const base='http://localhost:3000',suffix=Date.now().toString(36);
async function fixture(slot){
  const email=`safety-${suffix}-${slot}@janggi.test`,password=crypto.randomUUID();
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.equal(created.error,null);
  const jar=new Map();
  const client=createServerClient(config.API_URL,config.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>jar.set(c.name,c.value))}});
  assert.equal((await client.auth.signInWithPassword({email,password})).error,null);
  async function api(path,body){
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{origin:base,'content-type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined});
    for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}
    const data=await r.json().catch(()=>({}));return {http:r.status,...data};
  }
  assert.equal((await api('/api/account',{displayName:`검증${suffix}${slot}`,termsAccepted:true})).http,200);
  return {id:created.data.user.id,api};
}
const formation='horse-elephant-elephant-horse';
try {
  const a=await fixture('a'),b=await fixture('b');
  const join=api=>api('/api/matchmaking',{action:'join',formation,timeControl:'standard'});
  assert.equal((await join(a.api)).queued,true);
  await sql`UPDATE matchmaking_queue SET expires_at=${Date.now()+1000} WHERE user_id=${a.id}`;
  assert.equal((await a.api('/api/presence',{})).http,204);
  assert.ok(Number((await sql`SELECT expires_at FROM matchmaking_queue WHERE user_id=${a.id}`)[0].expires_at)>Date.now()+60000);
  await sql`UPDATE matchmaking_queue SET expires_at=${Date.now()-1000} WHERE user_id=${a.id}`;
  await a.api('/api/presence',{});
  assert.equal((await a.api('/api/matchmaking')).queued,false);
  assert.equal((await join(b.api)).queued,true);
  assert.equal((await b.api('/api/matchmaking')).matchId,null);
  console.log('PASS: valid lease renewed; expired lease not revived or matched');
  const ranked=await join(a.api);assert.ok(ranked.matchId);
  await a.api('/api/matches',{action:'resign',matchId:ranked.matchId});
  const rankedResult=await b.api(`/api/matches?id=${ranked.matchId}`);
  assert.equal(rankedResult.match.rated,true);assert.equal(rankedResult.rankResult.after_score,3);
  const stats=async id=>(await sql`SELECT elo,wins,losses,draws,streak,rank_score FROM players WHERE id=${id}`)[0];
  const beforeA=await stats(a.id),beforeB=await stats(b.id);
  await a.api('/api/friends',{action:'request',userId:b.id});
  assert.equal((await b.api('/api/friends',{action:'accept',userId:a.id})).http,200);
  const invitation=await a.api('/api/challenges',{action:'request',userId:b.id,formation,timeControl:'standard'});assert.equal(invitation.http,200);
  const accepted=await Promise.all([b.api('/api/challenges',{action:'accept',id:invitation.id,formation}),b.api('/api/challenges',{action:'accept',id:invitation.id,formation})]);
  assert.ok(accepted[0].matchId);assert.equal(accepted[0].matchId,accepted[1].matchId);
  const id=accepted[0].matchId;
  assert.equal((await a.api(`/api/matches?id=${id}`)).match.rated,false);
  assert.equal((await a.api('/api/matches',{action:'resign',matchId:id})).http,200);
  assert.deepEqual(await stats(a.id),beforeA);assert.deepEqual(await stats(b.id),beforeB);
  assert.equal((await sql`SELECT * FROM rank_results WHERE match_id=${id}`).length,0);
  assert.ok((await a.api(`/api/records?id=${id}`)).events.length>=2);
  console.log('PASS: ranked rewards retained; friend result changes no ranked stats and preserves record');
  assert.equal((await a.api('/api/community',{action:'block',userId:b.id})).http,200);
  for(const who of [a,b]) {const f=await who.api('/api/friends');assert.equal(f.friends.length,0);assert.equal(f.incoming.length,0);assert.equal(f.outgoing.length,0);}
  assert.equal((await b.api('/api/friends',{action:'organize',userId:a.id,favorite:true,groupName:'test'})).http,403);
  assert.equal((await b.api('/api/challenges',{action:'request',userId:a.id,formation,timeControl:'standard'})).http,403);
  await a.api('/api/community',{action:'unblock',userId:b.id});
  await a.api('/api/friends',{action:'remove',userId:b.id});
  await a.api('/api/friends',{action:'request',userId:b.id});
  await a.api('/api/community',{action:'block',userId:b.id});
  assert.equal((await b.api('/api/friends',{action:'accept',userId:a.id})).http,403);
  console.log('PASS: bilateral block hides presence/lists and denies accept, organize, challenge');
} finally {await sql.end();}
