import {posFrom,parseUsi,makeSfen,pvLine,moveLabel,side} from './game.js';
export const REVIEW_REVISION=1;
export const REVIEW_TIME=1500;
export const deeperTime=current=>current<5000?5000:current<10000?10000:20000;
function cleanAnalysis(raw,sfen,allowEmpty=false){
 if(!raw||raw.sfen!==sfen||!Array.isArray(raw.entries)||(!allowEmpty&&!raw.entries.length)||raw.entries.length>3)throw Error('判定用の解析と局面が一致しません');
 const p=posFrom(sfen);
 const entries=raw.entries.map(e=>{
  if(!Number.isInteger(e.depth)||e.depth<1||e.depth>200||!['cp','mate'].includes(e.kind)||!Number.isFinite(e.score)||Math.abs(e.score)>100000||!Array.isArray(e.pv)||!e.pv.length||e.pv.length>300||!e.pv.every(t=>typeof t==='string'&&t.length<=6))throw Error('判定用の評価値を確認してください');
  const pv=e.pv.slice(0,12);if(pvLine(p,pv,12).length!==pv.length)throw Error('判定用の読み筋が合法ではありません');
  return {kind:e.kind,score:e.score,depth:e.depth,pv};
 });
 return {sfen,entries,best:entries[0]?.pv[0]||null};
}
export function createMoveReview(beforeSfen,record,beforeRaw,afterRaw,timeMs=REVIEW_TIME){
 const p=posFrom(beforeSfen),m=parseUsi(record.usi);
 if(!m||!p.isLegal(m)||makeSfen(p.play(m))!==record.sfen)throw Error('判定対象の指し手が一致しません');
 if(!Number.isInteger(timeMs)||timeMs<500||timeMs>20000)throw Error('解析時間を確認してください');
 const outcome=p.play(m).outcome();
 const before=cleanAnalysis(beforeRaw,beforeSfen),after=cleanAnalysis(afterRaw,record.sfen,!!outcome);
 const signature=JSON.stringify([timeMs,...[before,after].map(a=>a.entries.map(e=>[e.depth,e.kind,e.score,e.pv]))]);
 return {revision:REVIEW_REVISION,beforeSfen,sfen:record.sfen,usi:record.usi,mover:p.turn,timeMs,before,after,outcome:outcome||null,signature};
}
export function validMoveReview(review,beforeSfen,record){
 if(review?.revision!==REVIEW_REVISION||review.beforeSfen!==beforeSfen||review.sfen!==record.sfen||review.usi!==record.usi)return false;
 try{const rebuilt=createMoveReview(beforeSfen,record,review.before,review.after,review.timeMs);return rebuilt.signature===review.signature&&rebuilt.mover===review.mover&&JSON.stringify(rebuilt.outcome)===JSON.stringify(review.outcome)}catch{return false}
}
export function moveVerdict(review){
 const b=review.before.entries[0],a=review.after.entries[0];const match=b.pv[0]===review.usi;
 const base={label:'判定保留',tone:'neutral',loss:null,bestScore:b.kind==='cp'?b.score:null,playedScore:a?.kind==='cp'?-a.score:null,bestMove:b.pv[0],bestLabel:moveLabel(posFrom(review.beforeSfen),parseUsi(b.pv[0])),perspective:side(review.mover),matched:match};
 if(review.outcome)return {...base,label:review.outcome.winner===review.mover?'詰み・勝ち':'終局',tone:'good'};
 if(match)return {...base,label:'最善手候補',tone:'good'};
 if(b.kind==='mate'&&b.score>0){return {...base,label:a?.kind==='mate'&&a.score<0?'詰み筋を維持':'詰みを逃した可能性',tone:a?.kind==='mate'&&a.score<0?'good':'blunder'}}
 if(a?.kind==='mate'&&a.score>0)return {...base,label:b.kind==='mate'&&b.score<0?'詰み筋あり・比較保留':'詰みを許した',tone:b.kind==='mate'&&b.score<0?'neutral':'blunder'};
 if(b.kind!=='cp'||a?.kind!=='cp')return base;
 const loss=Math.max(0,b.score+a.score);
 return {...base,loss,label:loss>=600?'大悪手':loss>=300?'悪手':loss>=150?'疑問手':'候補に近い',tone:loss>=600?'blunder':loss>=300?'mistake':loss>=150?'dubious':'good'};
}
export async function analyzeMove(engine,beforeSfen,record,timeMs=REVIEW_TIME){
 const before=await engine.analyze(beforeSfen,timeMs,1);
 const after=posFrom(record.sfen).outcome()?{sfen:record.sfen,entries:[]}:await engine.analyze(record.sfen,timeMs,1);
 return createMoveReview(beforeSfen,record,before,after,timeMs);
}
