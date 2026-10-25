import { INITIAL, posFrom, parseUsi, isDrop, factsForMove, pvLine } from './game.js';

export const DEMO_USI='position startpos moves 7g7f 8c8d 2g2f 8d8e';
// Authored opening examples for the UI. These are not generated AI responses.
const openingExamples = {
  '7g7f': {
    text:'角道を開ける一手です。８八の角が盤の中央をにらめるようになり、相手の出方を見て駒組みを選べます。',
    tag:'角道を開ける',
    variation:['8c8d','2g2f','8d8e','8h7g'],
  },
  '7g7f 8c8d': {
    text:'相手のこの手は、飛車先の歩を伸ばして８筋から攻める準備です。次の△８五歩に対して、先手がどう受けるかに注目しましょう。',
    tag:'相手の狙い · 飛車先',
    variation:['2g2f','8d8e','8h7g','3c3d'],
  },
  '7g7f 8c8d 2g2f': {
    text:'飛車先を伸ばし、２筋に攻めの足場をつくる一手です。８筋の攻めと２筋の攻め、どちらが先に形になるかを比べていきましょう。',
    tag:'自分の狙い · 飛車先',
    variation:['8d8e','8h7g','3c3d','7i8h'],
  },
  '7g7f 8c8d 2g2f 8d8e': {
    text:'相手のこの手は、次に△８六歩から飛車先の歩を交換する狙いです。\n\n▲７七角なら８六の地点を守れます。その後に角道を開けられた場合、角交換の変化も考えてみましょう。',
    tag:'定跡・変化の会話例',
    variation:['8h7g','3c3d','7i8h','2b7g+','8h7g'],
  },
};

export function moveCommentary(start,records,index,human='sente') {
  const record=records[index];
  const before=posFrom(index?records[index-1].sfen:start);
  const move=parseUsi(record.usi);
  if(!move||!before.isLegal(move))throw Error('解説対象の指し手が不正です');
  const example=start===INITIAL?openingExamples[records.slice(0,index+1).map(r=>r.usi).join(' ')]:null;
  const own=before.turn===human;
  const piece=isDrop(move)?{role:move.role}:before.board.pieceAt(move.from);
  let text,tag;
  if(example){text=example.text;tag=example.tag;if(own){text=text.replace('相手のこの手は','この手は');tag=tag.replace('相手の狙い','自分の狙い')}else{text=text.replace('こちらも','相手も');tag=tag.replace('自分の狙い','相手の狙い')}}
  else {
    text=factsForMove(before,{pv:[record.usi]}).join('\n');
    if(before.play(move).isCheck())tag='王手への対応';
    else if(before.board.pieceAt(move.to))tag='駒の交換';
    else if(isDrop(move))tag='持ち駒の活用';
    else if(piece.role==='king')tag='玉の配置';
    else tag='駒の働き';
  }
  return {
    id:'move-'+(index+1),ply:index+1,label:record.label,own,
    actor:own?'あなたの一手':'相手の一手',text,tag,
    authored:!!example,
    sfen:record.sfen,
    variation:example?.variation||null,
  };
}

export function createSimulation(start,tokens,meta={}) {
  const line=pvLine(posFrom(start),tokens,20);
  if(!line.length||line.length!==Math.min(tokens.length,20))throw Error('予想手順に不正な指し手があります');
  return {...meta,start,line,step:0,sfen:start,playing:false};
}
export function stepSimulation(sim,delta) {
  if(!sim)return null;
  const step=Math.max(0,Math.min(sim.line.length,sim.step+delta));
  return {...sim,step,sfen:step?sim.line[step-1].sfen:sim.start,playing:false};
}
