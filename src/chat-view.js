import {moveCommentary} from './move-coach.js';
// UI preview only. No text is sent to an external model.
const conversations = new Map();
const drafts = new Map();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rememberChatDraft(sfen,text){drafts.set(sfen,text.slice(0,1000))}
export function sendPreviewMessage(sfen,text){
  const question=text.trim().slice(0,1000);if(!question)return false;
  const messages=conversations.get(sfen)||[];
  messages.push({role:'user',text:question});
  messages.push({role:'notice',text:'質問の表示例です。API接続後、ここにこの局面についての返答が届きます。'});
  conversations.set(sfen,messages.slice(-20));drafts.delete(sfen);return true;
}
function simulationController(sim,ico){
  return `<div class="bubble-simulation" aria-label="解説の予想手順コントローラ">
    <div class="simulation-heading"><span>${ico('Eye')}予想手順をシミュレーション</span><small>${sim.authored?'サンプル手順':'エンジンの読み筋'}</small></div>
    <div class="simulation-line">${sim.line.map((m,i)=>`<button data-sim-step="${i+1}" class="${sim.step===i+1?'current':''}" aria-label="予想手順 ${i+1}手目 ${escapeHtml(m.label)}">${escapeHtml(m.label)}</button>`).join('<span>→</span>')}</div>
    <div class="simulation-controls"><button class="icon-btn" data-action="sim-first" aria-label="予想手順の開始局面へ" ${sim.step===0?'disabled':''}>${ico('ChevronsLeft')}</button><button class="icon-btn" data-action="sim-prev" aria-label="予想手順を1手戻す" ${sim.step===0?'disabled':''}>${ico('ChevronLeft')}</button><button class="simulation-play" data-action="sim-play" aria-label="${sim.playing?'予想手順を停止':'予想手順を再生'}">${ico(sim.playing?'Pause':'Play')}</button><button class="icon-btn" data-action="sim-next" aria-label="予想手順を1手進める" ${sim.step>=sim.line.length?'disabled':''}>${ico('ChevronRight')}</button><span class="simulation-progress">${sim.step}<small> / ${sim.line.length} 手</small></span></div>
    <div class="simulation-bottom"><span>${sim.step===0?'開始局面':sim.line[sim.step-1].label} ${sim.playing?'· 再生中':sim.step===sim.line.length?'· 手順の最後':''}</span><button data-action="pv-close">対局へ戻る ${ico('RotateCcw')}</button></div>
  </div>`;
}
export function chatHTML({sfen,ply,turn,analysis,ico,moveLabel,p,start,records,human,simulation,busy,demo}){
  const messages=conversations.get(sfen)||[];
  const entry=analysis?.entries[0];
  const moves=records.slice(0,ply).map((_,i)=>moveCommentary(start,records,i,human));
  return `<section class="chat-panel" aria-label="双方の指し手の解説と質問">
  <div class="chat-preview-notice"><span class="preview-dot"></span><span>一手ごとの解説UI</span><small>定型・会話例 / API未接続</small></div>
  <div class="chat-context"><span class="context-board">${ico('LayoutDashboard')}</span><div><b>${simulation?simulation.sourcePly+'手目からの検討':ply===0?'開始局面':ply+'手目の局面'} <span>· ${turn}の手番</span></b><small>${simulation?'予想手順を検討中 · 実戦の棋譜は保持しています':'自分も、相手も。一手の意味をたどろう。'}</small></div><span class="attached-badge">${ico('Check')}${simulation?'検討中':'局面付き'}</span></div>
  <div class="chat-messages move-timeline" id="chat-messages" role="log" aria-label="指し手ごとの解説">
    <div class="chat-date-divider"><span>${moves.length?'一手ずつ、意図を読み解く':'指すたびに、ここへ解説が届きます'}</span></div>
    ${moves.length?moves.map(m=>`<article class="move-commentary ${m.own?'own-move':'opponent-move'}" data-commentary-ply="${m.ply}"><div class="move-chat-marker"><span class="move-side-icon">${ico(m.own?'Target':'Swords')}</span><span>${m.actor}</span><b>${escapeHtml(m.label)}</b><small>${m.ply}手目</small></div><div class="chat-message coach"><span class="chat-avatar">${ico('Sparkles')}</span><div class="chat-message-inner"><span class="chat-speaker">棋灯コーチ<small>${m.authored?'解説の表示例':'盤上の事実から'}</small></span><div class="chat-bubble"><span class="commentary-tag">${escapeHtml(m.tag)}</span><p>${escapeHtml(m.text).replace(/\n/g,'<br>')}</p></div>${simulation?.messageId===m.id?simulationController(simulation,ico):`<button class="simulate-from-bubble" data-simulate="${m.ply}" ${busy?'disabled':''}>${ico('Play')}この続きをシミュレーション ${ico('ChevronRight')}</button>`}</div></div></article>`).join(''):`<div class="chat-welcome"><span>${ico('Sparkles')}</span><h3>その一手の「なぜ」を、一緒に。</h3><p>あなたが指すと、その手の意味を。<br>相手が指すと、相手の狙いを解説します。</p><button class="outline-btn" data-action="demo-start">${ico('Play')}4手のサンプルで試してみる</button><small>現在の対局はそのまま残ります</small></div>`}
    ${messages.map(m=>m.role==='notice'?`<div class="chat-pending">${ico('Info')}<p>${escapeHtml(m.text)}</p></div>`:`<div class="chat-message user"><div class="chat-message-inner"><span class="chat-speaker">あなた</span><div class="chat-bubble">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div></div>`).join('')}
    ${busy?`<div class="chat-thinking"><span></span><span></span><span></span><small>局面を読んでいます…</small></div>`:''}
  </div>
  <div class="chat-suggestions"><span>気になったら、その場で質問</span><div>${suggestedQuestions.map((q,i)=>`<button data-question="${i}">${escapeHtml(q)} ${ico('Plus')}</button>`).join('')}</div></div>
  <form class="chat-composer" id="chat-form"><label class="sr-only" for="chat-input">コーチへの質問</label><textarea id="chat-input" rows="2" maxlength="1000" placeholder="「ここで角交換したら？」など、気になることを">${escapeHtml(drafts.get(sfen)||'')}</textarea><div class="chat-composer-bottom"><span>${ico('LayoutDashboard')}${simulation?'検討中の局面':entry?'局面 ＋ 実際の読み筋':'表示中の局面'}を添付</span><button type="submit" class="chat-send" aria-label="質問の送信表示を試す" ${drafts.get(sfen)?.trim()?'':'disabled'}>${ico('ArrowRight')}</button></div></form>
  <div class="chat-footnote">会話UIのプレビュー。質問は外部に送信されません。</div>
  ${demo?`<button class="demo-return" data-action="demo-end">${ico('RotateCcw')}サンプルを閉じて、自分の対局へ戻る</button>`:`<button class="chat-analysis-link" data-action="chat-analysis"><span>${ico('Cpu')}<span><b>${entry?'エンジンの読みと照らし合わせる':'候補手と読み筋を調べる'}</b><small>${entry?'深さ '+entry.depth+' · '+escapeHtml(moveLabel(p,entry.pv[0])):'やねうら王で実際に解析できます'}</small></span></span>${ico('ChevronRight')}</button>`}
  </section>`;
}
export const suggestedQuestions=['相手の狙いをもう少し詳しく','ここで別の手を指したら？','定跡からどう変わった？'];
