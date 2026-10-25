import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoachClient} from '../src/coach-client.js';
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
 assert.equal((html.match(/data-explain=/g)||[]).length,2);assert.ok(html.includes('解説したい手を選ぶ'));assert.ok(!html.includes('サンプル解説'));
});
