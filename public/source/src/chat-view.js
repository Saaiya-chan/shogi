import {moveCommentary} from './move-coach.js';
import {replyKey,replyMatches} from './coach-client.js';
// Conversation state is scoped to a board position; requests are sent by main.js.
const conversations = new Map();
const drafts = new Map();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rememberChatDraft(sfen,text){drafts.set(sfen,text.slice(0,1000))}
export function beginQuestion(key,text){
 const question=text.trim().slice(0,1000);if(!question)return null;
 const messages=conversations.get(key)||[];
 const history=messages.filter(m=>['user','coach'].includes(m.role)&&!m.pending&&!m.error).slice(-10).map(m=>({role:m.role==='coach'?'assistant':'user',text:m.text.slice(0,2500)}));
 const id=crypto.randomUUID();
 messages.push({role:'user',text:question},{role:'coach',text:'',pending:true,id});
 conversations.set(key,messages.slice(-24));drafts.delete(key);
 return{id,question,history};
}
export function finishQuestion(key,id,reply,error){const messages=conversations.get(key)||[];const m=messages.find(m=>m.id===id);if(m){m.pending=false;m.error=error||null;m.text=reply?.text||'';m.model=reply?.model||''}}
function simulationController(sim,ico){
  return `<div class="bubble-simulation" aria-label="解説の予想手順コントローラ">
    <div class="simulation-heading"><span>${ico('Eye')}予想手順をシミュレーション</span><small>${sim.authored?'サンプル手順':'エンジンの読み筋'}</small></div>
    <div class="simulation-line">${sim.line.map((m,i)=>`<button data-sim-step="${i+1}" class="${sim.step===i+1?'current':''}" aria-label="予想手順 ${i+1}手目 ${escapeHtml(m.label)}">${escapeHtml(m.label)}</button>`).join('<span>→</span>')}</div>
    <div class="simulation-controls"><button class="icon-btn" data-action="sim-first" aria-label="予想手順の開始局面へ" ${sim.step===0?'disabled':''}>${ico('ChevronsLeft')}</button><button class="icon-btn" data-action="sim-prev" aria-label="予想手順を1手戻す" ${sim.step===0?'disabled':''}>${ico('ChevronLeft')}</button><button class="simulation-play" data-action="sim-play" aria-label="${sim.playing?'予想手順を停止':'予想手順を再生'}">${ico(sim.playing?'Pause':'Play')}</button><button class="icon-btn" data-action="sim-next" aria-label="予想手順を1手進める" ${sim.step>=sim.line.length?'disabled':''}>${ico('ChevronRight')}</button><span class="simulation-progress">${sim.step}<small> / ${sim.line.length} 手</small></span></div>
    <div class="simulation-bottom"><span>${sim.step===0?'開始局面':sim.line[sim.step-1].label} ${sim.playing?'· 再生中':sim.step===sim.line.length?'· 手順の最後':''}</span><button data-action="pv-close">対局へ戻る ${ico('RotateCcw')}</button></div>
  </div>`;
}
export function chatHTML({sfen,ply,turn,analysis,ico,moveLabel,p,start,records,human,simulation,busy,demo,coach,moveStates,questionBusy}){
  const contextKey=human+'|'+sfen;
  const messages=conversations.get(contextKey)||[];
  const entry=analysis?.entries[0];
  const moves=records.slice(0,ply).map((record,i)=>{const m=moveCommentary(start,records,i,human);const before=i?records[i-1].sfen:start;const key=replyKey(human,before,record,coach?.model);const saved=record.aiCoach?.sfen===record.sfen&&record.aiCoach?.human===human?record.aiCoach:null;return{...m,ai:coach?.cached(key)||saved,job:moveStates?.get(key)}});
  return `<section class="chat-panel" aria-label="双方の指し手の解説と質問">
  <div class="chat-preview-notice"><span class="preview-dot"></span><span>${coach?.blockedMessage?'APIの利用残高を確認してください':coach?.configured?'AIが一手ごとに解説':coach?.status==='checking'?'AIコーチの接続を確認':escapeHtml(coach?.selected?.label||'AIコーチ')+' · 未接続'}</span><small>${coach?.configured?'読み筋を添えて説明':coach?.status==='checking'?'接続を確認中…':'接続設定が必要です'}</small></div>
  ${coach?.blockedMessage?`<div class="api-billing-note">${escapeHtml(coach.blockedMessage)}</div>`:''}<div class="chat-context"><span class="context-board">${ico('LayoutDashboard')}</span><div><b>${simulation?simulation.sourcePly+'手目からの検討':ply===0?'開始局面':ply+'手目の局面'} <span>· ${turn}の手番</span></b><small>${simulation?'予想手順を検討中 · 実戦の棋譜は保持しています':'自分も、相手も。一手の意味をたどろう。'}</small></div><span class="attached-badge">${ico('Check')}${simulation?'検討中':'局面付き'}</span></div>
  <div class="chat-messages move-timeline" id="chat-messages" role="log" aria-label="指し手ごとの解説">
    <div class="chat-date-divider"><span>${moves.length?'一手ずつ、意図を読み解く':'指すたびに、ここへ解説が届きます'}</span></div>
    ${moves.length?moves.map(m=>`<article class="move-commentary ${m.own?'own-move':'opponent-move'}" data-commentary-ply="${m.ply}"><div class="move-chat-marker"><span class="move-side-icon">${ico(m.own?'Target':'Swords')}</span><span>${m.actor}</span><b>${escapeHtml(m.label)}</b><small>${m.ply}手目</small></div><div class="chat-message coach"><span class="chat-avatar">${ico('Sparkles')}</span><div class="chat-message-inner"><span class="chat-speaker">棋灯コーチ<small>${m.ai?'AI解説 · '+escapeHtml(m.ai.model):m.job?.status==='pending'?'AIが考えています…':m.authored?'サンプル解説':'盤上の事実から'}</small></span><div class="chat-bubble"><span class="commentary-tag">${escapeHtml(m.ai?'狙いと応手':m.tag)}</span>${m.ai&&m.job?.status==='pending'?'<p class="ai-pending-text">選択中のモデルで解説を作っています…</p>':m.ai&&m.job?.status==='error'?`<p class="ai-error-text">${escapeHtml(m.job.error)}</p>`:''}${m.job?.status==='pending'&&!m.ai?'<p class="ai-pending-text">局面と読み筋を確認して、解説を作っています…</p>':m.job?.status==='error'&&!m.ai?`<p class="ai-error-text">${escapeHtml(m.job.error)}</p>`:`<p>${escapeHtml(m.ai?.text||m.text).replace(/\n/g,'<br>')}</p>`}${!replyMatches(m.ai,coach?.model)&&m.job?.status!=='pending'&&coach?.configured?`<button class="ai-explain-retry" data-explain="${m.ply}">${m.job?.status==='error'?'解説を再試行':m.ai?'選択中のモデルでこの手を解説':'この手をAIで解説'}</button>`:''}</div>${simulation?.messageId===m.id?simulationController(simulation,ico):`<button class="simulate-from-bubble" data-simulate="${m.ply}" ${busy?'disabled':''}>${ico('Play')}この続きをシミュレーション ${ico('ChevronRight')}</button>`}</div></div></article>`).join(''):`<div class="chat-welcome"><span>${ico('Sparkles')}</span><h3>その一手の「なぜ」を、一緒に。</h3><p>あなたが指すと、その手の意味を。<br>相手が指すと、相手の狙いを解説します。</p><button class="outline-btn" data-action="demo-start">${ico('Play')}4手のサンプルで試してみる</button><small>現在の対局はそのまま残ります</small></div>`}
    ${messages.map(m=>`<div class="chat-message ${m.role==='user'?'user':'coach'}">${m.role==='coach'?`<span class="chat-avatar">${ico('Sparkles')}</span>`:''}<div class="chat-message-inner"><span class="chat-speaker">${m.role==='user'?'あなた':'棋灯コーチ'}${m.model?'<small>'+escapeHtml(m.model)+'</small>':''}</span><div class="chat-bubble ${m.error?'ai-error-text':''}">${m.pending?'局面を踏まえて考えています…':m.error?escapeHtml(m.error):escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div></div>`).join('')}
    ${busy?`<div class="chat-thinking"><span></span><span></span><span></span><small>局面を読んでいます…</small></div>`:''}
  </div>
  <div class="chat-suggestions"><span>気になったら、その場で質問</span><div>${suggestedQuestions.map((q,i)=>`<button data-question="${i}">${escapeHtml(q)} ${ico('Plus')}</button>`).join('')}</div></div>
  <form class="chat-composer" id="chat-form"><label class="sr-only" for="chat-input">コーチへの質問</label><textarea id="chat-input" rows="2" maxlength="1000" placeholder="「ここで角交換したら？」など、気になることを">${escapeHtml(drafts.get(contextKey)||'')}</textarea><div class="chat-composer-bottom"><span>${ico('LayoutDashboard')}${simulation?'検討中の局面':entry?'局面 ＋ 実際の読み筋':'表示中の局面'}を添付</span><button type="submit" class="chat-send" aria-label="コーチに質問する" ${drafts.get(contextKey)?.trim()&&!questionBusy&&coach?.configured?'':'disabled'}>${ico('ArrowRight')}</button></div></form>
  <div class="chat-footnote">${coach?.configured?'局面・読み筋・質問を'+escapeHtml(coach.providerLabel)+'へ送信します。':coach?.status==='checking'?'AIコーチの接続を確認中です。':coach?.status==='unavailable'?'AIコーチの接続確認に失敗しました。ページを再読み込みしてください。':escapeHtml(coach?.providerLabel||'AIサービス')+'の接続設定が必要です。'}</div>
  ${demo?`<button class="demo-return" data-action="demo-end">${ico('RotateCcw')}サンプルを閉じて、自分の対局へ戻る</button>`:`<button class="chat-analysis-link" data-action="chat-analysis"><span>${ico('Cpu')}<span><b>${entry?'エンジンの読みと照らし合わせる':'候補手と読み筋を調べる'}</b><small>${entry?'深さ '+entry.depth+' · '+escapeHtml(moveLabel(p,entry.pv[0])):'やねうら王で実際に解析できます'}</small></span></span>${ico('ChevronRight')}</button>`}
  </section>`;
}
export const suggestedQuestions=['相手の狙いをもう少し詳しく','ここで別の手を指したら？','定跡からどう変わった？'];
