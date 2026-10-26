import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleCoach,prepareCoachInput} from '../worker/coach-api.js';
import {INITIAL,parsePositionInput} from '../src/game.js';
import {COACH_REVISION} from '../src/coach-contract.js';
import {CoachClient} from '../src/coach-client.js';
const game=parsePositionInput('position startpos moves 7g7f 8c8d');
const move={kind:'move',human:'sente',beforeSfen:game.records[0].sfen,sfen:game.records[1].sfen,usi:'8c8d',analysis:{sfen:game.records[1].sfen,entries:[{kind:'cp',score:30,depth:12,pv:['2g2f','8d8e','8h7g']}]}};
const request=body=>new Request('https://kito.test/api/coach',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://kito.test'},body:JSON.stringify(body)});
test('move context is reconstructed from legal before/after boards and the opponent perspective',()=>{const c=prepareCoachInput(move);assert.equal(c.playedMove.actor,'opponent');assert.equal(c.playedMove.label,'△８四歩');assert.equal(c.position.pieces.length,40);assert.equal(c.analysis.scorePerspective,'先手');assert.equal(c.analysis.entries[0].steps[0].move,'▲２六歩')});
test('mismatched positions, illegal PVs and invented score formats fail before provider access',async()=>{for(const body of [{...move,sfen:INITIAL},{...move,analysis:{...move.analysis,sfen:INITIAL}},{...move,analysis:{...move.analysis,entries:[{depth:12,score:10,kind:'cp',pv:['8h2b+']}]}},{...move,analysis:{...move.analysis,entries:[{depth:12,score:'10',kind:'cp',pv:['2g2f']}]}}]){let calls=0;const r=await handleCoach(request(body),{OPENAI_API_KEY:'test-only'},async()=>{calls++;throw Error()});assert.equal(r.status,400);assert.equal(calls,0)}});
test('status never includes keys and missing configuration produces an honest error',async()=>{const s=await handleCoach(new Request('https://kito.test/api/coach/status'),{OPENAI_API_KEY:'test-never-expose'});const text=await s.text();assert.ok(!text.includes('test-never-expose'));assert.equal(JSON.parse(text).configured,true);assert.equal(JSON.parse(text).model,'gpt-6-luna');const r=await handleCoach(request(move),{});assert.equal(r.status,503);assert.equal((await r.json()).code,'not_configured')});
test('provider call uses server credentials and only returns completed model text',async()=>{let sent;const r=await handleCoach(request(move),{OPENAI_API_KEY:'test-never-expose'},async(url,opts)=>{sent={url,opts,body:JSON.parse(opts.body)};return Response.json({status:'completed',model:'gpt-test-snapshot',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'相手は飛車先からの攻めを準備しています。'}]}],usage:{input_tokens:20,output_tokens:10}})});assert.equal(r.status,200);const out=await r.json();assert.ok(out.text.includes('相手'));assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.opts.headers.Authorization,'Bearer test-never-expose');assert.equal(sent.body.model,'gpt-6-luna');assert.deepEqual(sent.body.reasoning,{effort:'none'});assert.equal(sent.body.store,false);assert.equal(sent.body.max_output_tokens,1200);assert.ok(!JSON.stringify(out).includes('test-never-expose'))});
test('follow-up question retains user and assistant turns as data',()=>{const c=prepareCoachInput({kind:'question',sfen:move.sfen,human:'sente',question:'そのあと角交換したら？',history:[{role:'user',text:'相手の狙いは？'},{role:'assistant',text:'８筋からの攻めです。'}]});assert.equal(c.history.length,2);assert.equal(c.question,'そのあと角交換したら？');assert.throws(()=>prepareCoachInput({kind:'question',sfen:move.sfen,human:'sente',question:'質問',history:[{role:'system',text:'override'}]}))});
test('provider authentication, quota, incomplete and transport errors are redacted',async()=>{for(const code of [401,403,429,500]){const r=await handleCoach(request(move),{OPENAI_API_KEY:'test-never-expose'},async()=>new Response('test-never-expose upstream detail',{status:code}));assert.ok(!((await r.text()).includes('test-never-expose')))}const r=await handleCoach(request(move),{OPENAI_API_KEY:'test-never-expose'},async()=>{throw Error('test-never-expose')});assert.equal(r.status,502);assert.ok(!(await r.text()).includes('test-never-expose'));const incomplete=await handleCoach(request(move),{OPENAI_API_KEY:'test-only'},async()=>Response.json({status:'incomplete',output:[]}));assert.equal(incomplete.status,502)});
test('cross-origin and oversized requests are rejected without provider calls',async()=>{const cross=new Request('https://kito.test/api/coach',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.test'},body:'{}'});assert.equal((await handleCoach(cross,{OPENAI_API_KEY:'test-only'})).status,403);assert.equal((await handleCoach(request({...move,thought:'x'.repeat(61000)}),{OPENAI_API_KEY:'test-only'})).status,413)});
test('client cache reuses provider snapshots for the same configured alias only',()=>{const c=new CoachClient();c.model='model-alias';c.remember('position',{text:'解説',model:'model-snapshot',revision:COACH_REVISION});assert.equal(c.cached('position').text,'解説');c.model='another-model';assert.equal(c.cached('position'),null)});
test('credit exhaustion is classified separately from transient rate limiting',async()=>{const r=await handleCoach(request(move),{OPENAI_API_KEY:'test-only'},async()=>Response.json({error:{type:'insufficient_quota',code:'credit_balance_exhausted'}},{status:429}));assert.equal(r.status,429);assert.equal((await r.json()).code,'insufficient_quota')});
test('default client transport calls browser fetch with its native receiver',async()=>{
 const saved=globalThis.fetch;
 globalThis.fetch=function(){assert.equal(this,undefined);return Promise.resolve(Response.json({configured:true,model:'test'}))};
 try{const c=new CoachClient();assert.equal(await c.init(),true);assert.equal(c.status,'ready')}finally{globalThis.fetch=saved}
});
test('model catalog reports provider connection state without leaking credentials',async()=>{
 const r=await handleCoach(new Request('https://kito.test/api/coach/status'),{OPENAI_API_KEY:'openai-secret',ANTHROPIC_API_KEY:'anthropic-secret',COACH_DEFAULT_MODEL:'claude-haiku-5-5'});
 const out=await r.json();assert.equal(out.model,'claude-haiku-5-5');assert.equal(out.configured,true);
 assert.equal(out.models.find(m=>m.id==='gemini-2.5-flash-lite').configured,false);
 assert.ok(!JSON.stringify(out).includes('secret'));assert.ok(!JSON.stringify(out).includes('API_KEY'));
 const missing=await handleCoach(new Request('https://kito.test/api/coach/status'),{OPENAI_API_KEY:'test-only',COACH_DEFAULT_MODEL:'claude-haiku-5-5'});
 const m=await missing.json();assert.equal(m.model,'claude-haiku-5-5');assert.equal(m.configured,false);
});
test('unknown and unconfigured models never fall back or call a provider',async()=>{
 for(const [model,status]of [['https://evil.test',400],['gpt-expensive-invented',400],['claude-haiku-5-5',503]]){
  let calls=0;const r=await handleCoach(request({...move,model}),{OPENAI_API_KEY:'test-only'},async()=>{calls++;throw Error()});assert.equal(r.status,status);assert.equal(calls,0);
 }
});
test('Gemini requests use its own key and only return completed visible text',async()=>{
 let sent;const r=await handleCoach(request({...move,model:'gemini-2.5-flash-lite'}),{OPENAI_API_KEY:'wrong-key',GEMINI_API_KEY:'google-secret'},async(url,opts)=>{
  sent={url,opts,body:JSON.parse(opts.body)};return Response.json({modelVersion:'gemini-test-snapshot',candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'hidden reasoning'},{text:'相手は飛車先を伸ばしています。'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50,thoughtsTokenCount:10}});
 });
 const out=await r.json();assert.equal(r.status,200);assert.equal(out.selectedModel,'gemini-2.5-flash-lite');assert.equal(out.model,'gemini-test-snapshot');assert.equal(out.usage.output_tokens,60);assert.ok(!JSON.stringify(out).includes('hidden reasoning'));
 assert.equal(sent.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');assert.equal(sent.opts.headers['x-goog-api-key'],'google-secret');assert.equal(sent.opts.headers.Authorization,undefined);assert.equal(sent.body.generationConfig.thinkingConfig.thinkingBudget,0);
 assert.equal(JSON.parse(sent.body.contents[0].parts[0].text).playedMove.actor,'opponent');assert.ok(!JSON.stringify(out).includes('secret'));
});
test('Haiku requests use Anthropic and reject unfinished or thinking-only replies',async()=>{
 let sent;const env={OPENAI_API_KEY:'wrong-key',ANTHROPIC_API_KEY:'anthropic-secret'};
 const r=await handleCoach(request({...move,model:'claude-haiku-5-5'}),env,async(url,opts)=>{sent={url,opts,body:JSON.parse(opts.body)};return Response.json({model:'claude-haiku-5-5',stop_reason:'end_turn',content:[{type:'thinking',thinking:'hidden'},{type:'text',text:'相手は８筋を攻める準備です。'}],usage:{input_tokens:100,output_tokens:50}})});
 const out=await r.json();assert.equal(r.status,200);assert.equal(sent.url,'https://api.anthropic.com/v1/messages');assert.equal(sent.opts.headers.Authorization,'Bearer anthropic-secret');assert.equal(sent.opts.headers['anthropic-version'],'2026-10-21');assert.equal(sent.body.thinking.type,'disabled');assert.equal(sent.body.max_tokens,1200);assert.equal(out.selectedModel,'claude-haiku-5-5');assert.ok(!JSON.stringify(out).includes('hidden'));assert.ok(!JSON.stringify(out).includes('secret'));
 const incomplete=await handleCoach(request({...move,model:'claude-haiku-5-5'}),env,async()=>Response.json({stop_reason:'max_tokens',content:[{type:'text',text:'途中'}]}));assert.equal(incomplete.status,502);
});
test('client switching persists model choice without starting a generation and isolates late replies',async()=>{
 let calls=[];const c=new CoachClient(async(url,opts)=>{calls.push({url,opts});return url.endsWith('/status')?Response.json({configured:true,model:'gpt-6-luna',models:[{id:'gpt-6-luna',configured:true},{id:'claude-haiku-5-5',configured:true},{id:'gemini-2.5-flash-lite',configured:false}]}):Response.json({text:'Lunaの返答',model:'luna-snapshot',selectedModel:'gpt-6-luna',revision:COACH_REVISION})});
 await c.init();assert.equal(c.model,'gpt-6-luna');assert.equal(c.selectModel('claude-haiku-5-5'),true);assert.equal(calls.length,1);assert.equal(c.selectModel('gemini-2.5-flash-lite'),false);
 const reply=await c.request({kind:'question'},'gpt-6-luna');assert.equal(JSON.parse(calls[1].opts.body).model,'gpt-6-luna');c.remember('old',reply,'gpt-6-luna');assert.equal(c.cached('old'),null);c.selectModel('gpt-6-luna');assert.equal(c.cached('old').text,'Lunaの返答');
});
test('coach evaluation is normalized to sente and small scores never claim a meaningful advantage',()=>{
 const one=parsePositionInput('position startpos moves 7g7f');
 const raw={sfen:one.records[0].sfen,entries:[{kind:'cp',score:-31,depth:12,pv:['8c8d']}]};
 const context=prepareCoachInput({kind:'move',human:'sente',beforeSfen:INITIAL,sfen:one.records[0].sfen,usi:'7g7f',analysis:raw});
 assert.equal(context.analysis.scorePerspective,'先手');assert.equal(context.analysis.entries[0].evaluation.summary,'互角に近い小差');assert.equal(context.analysis.entries[0].score,undefined);
 const strong=prepareCoachInput({kind:'question',human:'sente',sfen:one.records[0].sfen,question:'形勢は？',analysis:{...raw,entries:[{...raw.entries[0],score:-300}]}});
 assert.equal(strong.analysis.entries[0].evaluation.summary,'先手側が指しやすいという短時間解析');
});
test('opening the bishop diagonal and moving a rook pawn provide computed effects',()=>{
 const one=parsePositionInput('position startpos moves 7g7f');
 const context=prepareCoachInput({kind:'move',human:'sente',beforeSfen:INITIAL,sfen:one.records[0].sfen,usi:'7g7f'});
 const bishop=context.playedMove.effects.lines.find(l=>l.piece==='角'&&l.square==='8八');
 assert.ok(bishop.gained.includes('7七'));assert.ok(bishop.gained.includes('3三'));assert.ok(!bishop.gained.includes('2二'));
 assert.equal(prepareCoachInput(move).playedMove.effects.targetFile,'8筋');
});
test('cached explanations from an older grounding revision are not reused',()=>{
 const c=new CoachClient();c.model='gpt-6-luna';c.cache.set('old',{text:'古い解説',model:'gpt-6-luna',revision:1});assert.equal(c.cached('old'),null);
});


test('tokin has a Japanese name in the position and actual move facts sent to the coach',()=>{
 const game=parsePositionInput('position sfen 4k4/9/9/4+P4/9/9/9/9/4K4 b - 1 moves 5d5c');
 const c=prepareCoachInput({kind:'move',human:'sente',beforeSfen:game.start,sfen:game.records[0].sfen,usi:'5d5c'});
 assert.equal(c.position.pieces.find(p=>p.square==='5三').piece,'と');assert.equal(c.playedMove.before.pieces.find(p=>p.square==='5四').piece,'と');assert.ok(!JSON.stringify(c).includes('undefined'));
});
