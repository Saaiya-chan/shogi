import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoachClient,moveKey} from '../src/coach-client.js';
import {formatCoachText} from '../src/coach-text.js';
import {chatHTML} from '../src/chat-view.js';
import {INITIAL,parsePositionInput} from '../src/game.js';

test('automatic explanations default off, persist explicit choice and never call a provider on toggle',()=>{
 const old=globalThis.localStorage;const data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 try{
  let calls=0;const c=new CoachClient(()=>{calls++;throw Error('Unexpected request')});assert.equal(c.autoExplain,false);
  c.setAutoExplain(true);assert.equal(new CoachClient().autoExplain,true);
  c.setAutoExplain(false);assert.equal(new CoachClient().autoExplain,false);assert.equal(calls,0);
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old}
});
test('coordinate references omit square suffixes and movement counts read naturally',()=>{
 assert.equal(formatCoachText('７三の升、7三の升目、七3の升、７三のマスへ。'),'７三、7三、七3、７三へ。');
 assert.equal(formatCoachText('角が動ける升が増えます。'),'角が動ける範囲が増えます。');
});
test('every move offers an explicit explanation without showing authored demo explanations automatically',()=>{
 const game=parsePositionInput('position startpos moves 7g7f 8c8d');const coach={configured:true,model:'test',cached:()=>null,autoExplain:false};
 const html=chatHTML({sfen:game.records.at(-1).sfen,ply:2,turn:'先手',ico:()=>'',start:INITIAL,records:game.records,human:'sente',coach,moveStates:new Map()});
 assert.equal((html.match(/data-analyze-move=/g)||[]).length,2);assert.ok(html.includes('「解析」で判定と理由を確認'));assert.ok(!html.includes('サンプル解説'));
});

test('OFF never reveals a cached explanation for a newly played move without pressing its button',()=>{
 const game=parsePositionInput('position startpos moves 7g7f 8c8d');
 const coach={configured:true,model:'test',cached:()=>({text:'自動で見えてはいけない過去の解説',model:'test',revision:2}),autoExplain:false};
 const html=chatHTML({sfen:game.records.at(-1).sfen,ply:2,turn:'先手',ico:()=>'',start:INITIAL,records:game.records,human:'sente',coach,moveStates:new Map()});
 assert.ok(!html.includes('自動で見えてはいけない過去の解説'));assert.equal((html.match(/>解析<\/button>/g)||[]).length,2);
});
test('automatic requests are rejected at the transport boundary while OFF',async()=>{
 let calls=0;const c=new CoachClient(()=>{calls++;return Promise.resolve(Response.json({text:'unexpected'}))});
 await assert.rejects(c.request({kind:'move'},'test',{automatic:true,generation:c.autoGeneration}),{name:'AbortError'});assert.equal(calls,0);
});
test('turning OFF cancels an in-flight automatic explanation and invalidates queued work after re-enabling',async()=>{
 let calls=0;const c=new CoachClient((url,options)=>{calls++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}))});
 c.setAutoExplain(true);const generation=c.autoGeneration;
 const pending=c.request({kind:'move'},'test',{automatic:true,generation});
 c.setAutoExplain(false);await assert.rejects(pending,{name:'AbortError'});
 c.setAutoExplain(true);await assert.rejects(c.request({kind:'move'},'test',{automatic:true,generation}),{name:'AbortError'});assert.equal(calls,1);
});
test('a late provider response is ignored after OFF even if its transport did not honor abort',async()=>{
 let resolve;const c=new CoachClient(()=>new Promise(r=>{resolve=r}));c.setAutoExplain(true);
 const pending=c.request({kind:'move'},'test',{automatic:true,generation:c.autoGeneration});c.setAutoExplain(false);
 resolve(Response.json({text:'遅れて届いた自動解説'}));await assert.rejects(pending,{name:'AbortError'});
});
test('an OFF setting from another tab is checked immediately before an automatic request',async()=>{
 const old=globalThis.localStorage;const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 try{let calls=0;const c=new CoachClient(()=>{calls++;throw Error()});c.setAutoExplain(true);const generation=c.autoGeneration;data.set('kito-coach-auto-explain','false');await assert.rejects(c.request({kind:'move'},'test',{automatic:true,generation}),{name:'AbortError'});assert.equal(calls,0);assert.equal(c.autoExplain,false)}finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old}
});

test('legacy explanations from before move reviews are not revealed automatically on restore',()=>{
 const game=parsePositionInput('position startpos moves 7g7f');game.records[0].aiCoach={revision:2,human:'sente',sfen:game.records[0].sfen,text:'以前の自動解説',model:'test'};
 const html=chatHTML({sfen:game.records[0].sfen,ply:1,turn:'後手',ico:()=>'',start:INITIAL,records:game.records,human:'sente',coach:{configured:true,model:'test'},moveStates:new Map()});
 assert.ok(!html.includes('以前の自動解説'));
});

test('unanalysed moves offer one enabled Analyse action beside the move and hide the bubble, including legacy automatic results',()=>{
 const game=parsePositionInput('position startpos moves 7g7f');game.records[0].moveReview={signature:'old-automatic-result'};
 const html=chatHTML({sfen:game.records[0].sfen,ply:1,turn:'後手',ico:()=>'',start:INITIAL,records:game.records,human:'sente',coach:{configured:true,model:'test'},moveStates:new Map()});
 assert.ok(html.includes('data-analyze-move="1"'));assert.ok(html.includes('data-regenerate="false" >解析</button>'));assert.ok(!html.includes('data-review='));assert.ok(!html.includes('data-explain='));assert.ok(!html.includes('さらに深く解析'));assert.ok(!html.includes('class="chat-bubble"'));assert.ok(!html.includes('class="chat-message coach"'));assert.ok(html.indexOf('data-analyze-move=')>html.indexOf('<b>▲７六歩</b>'));assert.ok(html.indexOf('data-analyze-move=')<html.indexOf('<small>1手目</small>'));
});


test('only a requested move reveals its pending bubble; the adjacent move stays compact',()=>{
 const game=parsePositionInput('position startpos moves 7g7f 8c8d'),model='test';
 const moveStates=new Map([[moveKey('sente',INITIAL,game.records[0],model),{status:'pending'}]]);
 const html=chatHTML({sfen:game.records[1].sfen,ply:2,turn:'先手',ico:()=>'',start:INITIAL,records:game.records,human:'sente',coach:{configured:true,model},moveStates});
 assert.equal((html.match(/class="chat-message coach"/g)||[]).length,1);assert.equal((html.match(/data-analyze-move=/g)||[]).length,2);assert.ok(html.includes('解析中…'));
});
