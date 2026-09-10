import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin='http://localhost:3000', cookies=new Map();
async function request(path,method='GET',body) {
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{origin,'content-type':'application/json',cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
  for(const c of response.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}
  return response;
}
assert.equal((await request('/api/rewards','POST')).status,401);
assert.equal((await request('/review')).status,307);
const credentials=JSON.parse(readFileSync('.local-testing.json','utf8'));
assert.equal((await request('/api/dev-login','POST',{slot:'a',password:credentials.a.password})).status,200);
const before=await (await request('/api/rewards')).json();
const responses=await Promise.all(Array.from({length:5},()=>request('/api/rewards','POST')));
assert.ok(responses.every(r=>r.status===200));
const results=await Promise.all(responses.map(r=>r.json()));
const awarded=results.reduce((sum,r)=>sum+r.awarded,0);
assert.equal(results.filter(r=>r.awarded>0).length,before.claimed?0:1);
const after=await (await request('/api/rewards')).json();
assert.equal(after.points,before.points+awarded);
assert.equal(after.claimed,true);
const list=await request('/review');
assert.equal(list.status,200);
const html=await list.text();
const recordId=html.match(/\/review\/([0-9a-f-]{36})/)?.[1];
assert.ok(recordId,'Run test-local-match.mjs first to create a completed record');
assert.equal((await request(`/review/${recordId}`)).status,200);
const record=await (await request(`/api/records?id=${recordId}`)).json();
assert.ok(record.events.length>0);
assert.ok(record.events[0].state.board.length>0);
console.log('PASS: anonymous guards, concurrent attendance awarded once, balance persisted, review list/detail and snapshots accessible');
