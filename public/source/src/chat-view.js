// UI preview only. These messages are authored examples, never API responses.
const conversations = new Map();
const drafts = new Map();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sample = [
  {role:'coach',text:'この局面、どんな方針で指したいですか？\n候補手だけでなく、狙いも聞かせてください。',sample:true},
  {role:'user',text:'攻めたいけれど、相手の反撃が気になります。',sample:true},
  {role:'coach',text:'では、攻める手と受ける手を一つずつ比べてみましょう。\n\nそれぞれに対する、相手の一番厳しい応手は何だと思いますか？',sample:true},
];
export function rememberChatDraft(sfen,text){drafts.set(sfen,text.slice(0,1000))}
export function sendPreviewMessage(sfen,text){
  const question=text.trim().slice(0,1000);
  if(!question)return false;
  const messages=conversations.get(sfen)||[];
  messages.push({role:'user',text:question,sample:false});
  messages.push({role:'notice',text:'質問を入力したときの表示例です。API接続後、ここに今の局面と読み筋を踏まえた返答が届きます。',sample:false});
  conversations.set(sfen,messages.slice(-20));drafts.delete(sfen);
  return true;
}
export function chatHTML({sfen,ply,turn,analysis,ico,moveLabel,p}){
  const messages=conversations.get(sfen);
  const entry=analysis?.entries[0];
  return `<section class="chat-panel" aria-label="AIコーチの会話プレビュー">
  <div class="chat-preview-notice"><span class="preview-dot"></span><span>会話UIのプレビュー</span><small>API未接続</small></div>
  <div class="chat-context"><span class="context-board">${ico('LayoutDashboard')}</span><div><b>${ply===0?'開始局面':ply+'手目の局面'} <span>· ${turn}の手番</span></b><small>表示中の盤面を、コーチに共有</small></div><span class="attached-badge">${ico('Check')}局面付き</span></div>
  <div class="chat-messages" id="chat-messages" role="log" aria-label="会話サンプルと入力した質問">
    <div class="chat-date-divider"><span>${messages?'この局面について':'こんなふうに、一緒に考える'}</span></div>
    ${(messages||sample).map(m=>m.role==='notice'?`<div class="chat-pending">${ico('Info')}<p>${escapeHtml(m.text)}</p></div>`:`<div class="chat-message ${m.role}">${m.role==='coach'?`<span class="chat-avatar">${ico('Sparkles')}</span>`:''}<div class="chat-message-inner"><span class="chat-speaker">${m.role==='coach'?'棋灯コーチ':'あなた'}${m.sample?'<small>会話例</small>':''}</span><div class="chat-bubble">${escapeHtml(m.text).replace(/\n/g,'<br>')}</div></div></div>`).join('')}
  </div>
  <div class="chat-suggestions"><span>たとえば、こんな相談</span><div>${['この局面で何を優先する？','自分の候補手を比較したい','答えを見ずにヒントがほしい'].map((q,i)=>`<button data-question="${i}">${escapeHtml(q)} ${ico('Plus')}</button>`).join('')}</div></div>
  <form class="chat-composer" id="chat-form"><label class="sr-only" for="chat-input">コーチへの質問</label><textarea id="chat-input" rows="2" maxlength="1000" placeholder="候補手や迷っていることを聞かせてください">${escapeHtml(drafts.get(sfen)||'')}</textarea><div class="chat-composer-bottom"><span>${ico('LayoutDashboard')}${entry?'局面 ＋ 実際の読み筋':'表示中の局面'}を添付</span><button type="submit" class="chat-send" aria-label="質問の送信表示を試す" ${drafts.get(sfen)?.trim()?'':'disabled'}>${ico('ArrowRight')}</button></div></form>
  <div class="chat-footnote">送信も表示確認のみ。入力内容は外部に送信されません。</div>
  <button class="chat-analysis-link" data-action="chat-analysis"><span>${ico('Cpu')}<span><b>${entry?'エンジンの読みと照らし合わせる':'候補手と読み筋を調べる'}</b><small>${entry?'深さ '+entry.depth+' · '+escapeHtml(moveLabel(p,entry.pv[0])):'やねうら王で実際に解析できます'}</small></span></span>${ico('ChevronRight')}</button>
  </section>`;
}
export const suggestedQuestions=['この局面で何を優先する？','自分の候補手を比較したい','答えを見ずにヒントがほしい'];
