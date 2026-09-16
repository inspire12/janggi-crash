import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component callbacks/effects with deterministic hooks and transport.
function fixture(fetch) {
  const slots=[],effects=[],timers=new Map(),listeners=new Map();let cursor=0,nextTimer=0;
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
    useCallback(fn){cursor++;return fn;},useEffect(fn){effects.push(fn);},
  };
  const jsx=(type,props)=>({type,props});
  const fallback=new Proxy({},{get:(_,name)=>name==='__esModule'?true:name});
  const imports={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/game-alerts':{armGameAlerts(){},gameAlert(){}},'@/lib/game-clock':{timeControls:{standard:{label:'일반'}}}};
  const window={setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),location:{assign(){}}};
  const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  const context={exports:{},require:name=>imports[name]??fallback,fetch,AbortSignal,window,document,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout};
  const source=ts.transpileModule(readFileSync(new URL('../app/lobby/lobby-client.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,context);
  const render=()=>{cursor=0;effects.length=0;return context.exports.default({authenticated:true,registered:true});};
  function find(node,predicate){if(!node)return null;if(Array.isArray(node))return node.map(n=>find(n,predicate)).find(Boolean);if(predicate(node))return node;return find(node.props?.children,predicate);}
  const view=()=>find(render(),n=>n.type?.name==='MatchTab').props;
  render();
  return {view,effects,timers,listeners};
}
const response=(queued=false)=>({ok:true,json:async()=>({queued,matchId:null,offer:null,timeControl:'standard'})});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('idle initial GET failure is visible and polling recovers without a reload',async()=>{
  let calls=0;
  const f=fixture(async()=>{if(++calls===1)throw Error('offline');return response();});
  const stop=f.effects[1]();await settle();
  assert.match(f.view().error,/연결/);
  assert.equal(f.view().busy,true);
  await [...f.timers.values()][0]();await settle();
  assert.equal(f.view().error,'');assert.equal(f.view().busy,false);
  stop();
});
test('lost POST response reconciles queued state without replaying POST',async()=>{
  let posts=0;
  const f=fixture(async(_url,options)=>{if(options?.method==='POST'){posts++;throw Error('response lost');}return response(true);});
  await f.view().onQueue('join');await settle();
  assert.equal(posts,1);assert.equal(f.view().queued,true);assert.equal(f.view().error,'');
});
test('offline notice and online event recover status immediately',async()=>{
  let calls=0;
  const f=fixture(async()=>{calls++;return response();});
  const stop=f.effects[1]();await settle();
  f.listeners.get('offline')();assert.match(f.view().error,/인터넷/);
  f.listeners.get('online')();await settle();
  assert.equal(calls,2);assert.equal(f.view().error,'');stop();
});
test('GET failure during acceptance retains the offer and reports connection error',async()=>{
  let calls=0;
  const f=fixture(async()=>{
    if(++calls===2)throw Error('offline');
    return {ok:true,json:async()=>({queued:false,matchId:null,timeControl:'standard',offer:{id:'offer',formation:null,accepted:true,opponentAccepted:false}})};
  });
  const stop=f.effects[1]();await settle();
  await [...f.timers.values()][0]();await settle();
  assert.match(f.view().error,/연결/);assert.equal(f.view().busy,true);
  f.listeners.get('online')();await settle();assert.equal(f.view().error,'');stop();
});
