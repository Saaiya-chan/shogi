import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL,parsePositionInput} from '../src/game.js';
import {createMoveReview,moveVerdict,validMoveReview,analyzeMove,deeperTime} from '../src/move-review.js';
import {createSimulation,stepSimulation} from '../src/move-coach.js';
import {replyKey} from '../src/coach-client.js';
import {prepareCoachInput} from '../worker/coach-api.js';
const game=parsePositionInput('position startpos moves 7g7f 8c8d');
const raw=(sfen,score,pv,kind='cp',depth=14)=>({sfen,entries:[{score,kind,pv,depth}]});
const review=(index=0,b=100,a=400,bkind='cp',akind='cp')=>{
 const before=index?game.records[index-1].sfen:INITIAL,record=game.records[index];
 return createMoveReview(before,record,raw(before,b,[index?'3c3d':'2g2f'],bkind),raw(record.sfen,a,[index?'2g2f':'8c8d'],akind));
};
test('sente and gote losses use the mover perspective and flip the after-position score',()=>{
 for(const i of [0,1]){const r=review(i),v=moveVerdict(r);assert.equal(v.loss,500);assert.equal(v.bestScore,100);assert.equal(v.playedScore,-400);assert.equal(v.label,'悪手');assert.equal(v.perspective,i?'後手':'先手')}
});
test('thresholds are explicit, improvements are not penalized, and matching best moves are not called mistakes',()=>{
 for(const [loss,label]of [[0,'候補に近い'],[149,'候補に近い'],[150,'疑問手'],[300,'悪手'],[600,'大悪手']])assert.equal(moveVerdict(review(0,0,loss)).label,label);
 assert.equal(moveVerdict(review(0,0,-100)).loss,0);
 const r=review();r.before.entries[0].pv=['7g7f'];assert.equal(moveVerdict(r).label,'最善手候補');assert.equal(moveVerdict(r).loss,null);
});
test('mate evaluations never become invented numeric losses',()=>{
 assert.equal(moveVerdict(review(0,5,0,'mate')).label,'詰みを逃した可能性');
 assert.equal(moveVerdict(review(0,5,-3,'mate','mate')).label,'詰み筋を維持');
 assert.equal(moveVerdict(review(0,0,3,'cp','mate')).label,'詰みを許した');
 const lost=moveVerdict(review(0,-5,3,'mate','mate'));assert.equal(lost.tone,'neutral');assert.equal(lost.loss,null);
});
test('comparison rejects mismatched boards, scores and illegal PVs',()=>{
 const r=review();assert.ok(validMoveReview(r,INITIAL,game.records[0]));
 assert.equal(validMoveReview({...r,sfen:INITIAL},INITIAL,game.records[0]),false);
 assert.equal(validMoveReview({...r,mover:'gote'},INITIAL,game.records[0]),false);
 assert.equal(validMoveReview({...r,outcome:{winner:'sente'}},INITIAL,game.records[0]),false);
 assert.throws(()=>createMoveReview(INITIAL,game.records[0],raw(INITIAL,0,['8h2b+']),r.after));
 assert.throws(()=>createMoveReview(INITIAL,game.records[0],raw(INITIAL,Infinity,['2g2f']),r.after));
 assert.throws(()=>createMoveReview(INITIAL,game.records[0],r.before,raw(INITIAL,0,['7g7f'])));
});
test('a better-line simulation starts before the actual move and preserves the original game',()=>{
 const r=review(),original=JSON.stringify(game);let sim=createSimulation(r.beforeSfen,r.before.entries[0].pv,{better:true});
 assert.equal(sim.sfen,INITIAL);sim=stepSimulation(sim,1);assert.notEqual(sim.sfen,game.records[0].sfen);assert.equal(stepSimulation(sim,-1).sfen,INITIAL);assert.equal(JSON.stringify(game),original);
});
test('deeper analysis gives equal time to both boards and creates a new explanation cache identity',async()=>{
 const calls=[];const engine={analyze:async(sfen,ms,multi)=>{calls.push({sfen,ms,multi});return raw(sfen,sfen===INITIAL?100:400,[sfen===INITIAL?'2g2f':'8c8d'])}};
 const r=await analyzeMove(engine,INITIAL,game.records[0],5000);assert.deepEqual(calls.map(x=>x.ms),[5000,5000]);assert.deepEqual(calls.map(x=>x.sfen),[INITIAL,game.records[0].sfen]);
 assert.notEqual(replyKey('sente',INITIAL,{...game.records[0],moveReview:r},'test'),replyKey('sente',INITIAL,{...game.records[0],moveReview:review()},'test'));
 assert.deepEqual([1500,5000,10000,20000].map(deeperTime),[5000,10000,20000,20000]);
});
test('the reason prompt gets the calculated judgement and a separate legal alternative line',()=>{
 const r=review(1);const c=prepareCoachInput({kind:'move',human:'sente',beforeSfen:r.beforeSfen,sfen:r.sfen,usi:r.usi,analysis:r.after,moveReview:r});
 assert.equal(c.moveReview.judgement,'悪手');assert.equal(c.moveReview.loss,500);assert.equal(c.moveReview.bestMove,'△３四歩');assert.equal(c.moveReview.beforeAnalysis.entries[0].steps[0].move,'△３四歩');
 assert.throws(()=>prepareCoachInput({kind:'move',human:'sente',beforeSfen:r.beforeSfen,sfen:r.sfen,usi:r.usi,analysis:r.after,moveReview:{...r,usi:'3c3d'}}));
});
