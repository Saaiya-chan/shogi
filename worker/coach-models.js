export const DEFAULT_MODEL='gpt-6-luna';
// Only server-approved models can incur provider charges. URLs and key names never come from the client.
export const MODELS=[
 {id:'gpt-6-luna',label:'GPT-6 Luna',provider:'openai',providerLabel:'OpenAI',key:'OPENAI_API_KEY'},
 {id:'gpt-5.4-mini',label:'GPT-5.4 mini',provider:'openai',providerLabel:'OpenAI',key:'OPENAI_API_KEY'},
 {id:'gemini-2.5-flash-lite',label:'Gemini 2.5 Flash-Lite',provider:'google',providerLabel:'Google',key:'GEMINI_API_KEY'},
 {id:'gemini-3.5-flash-lite',label:'Gemini 3.5 Flash-Lite',provider:'google',providerLabel:'Google',key:'GEMINI_API_KEY'},
 {id:'claude-haiku-5-5',label:'Claude Haiku 5.5',provider:'anthropic',providerLabel:'Anthropic',key:'ANTHROPIC_API_KEY'},
];
export const findModel=id=>MODELS.find(m=>m.id===id);
export function modelStatus(env){
 const models=MODELS.map(({key,...m})=>({...m,configured:!!env[key]?.trim()}));
 const preferred=env.COACH_DEFAULT_MODEL||env.OPENAI_MODEL||DEFAULT_MODEL;
 const chosen=models.find(m=>m.id===preferred)||models.find(m=>m.id===DEFAULT_MODEL);
 return {configured:chosen.configured,model:chosen.id,models};
}
export function providerRequest(model,key,instructions,context){
 const text=JSON.stringify(context),headers={'Content-Type':'application/json'};
 if(model.provider==='openai')return {url:'https://api.openai.com/v1/responses',headers:{...headers,Authorization:'Bearer '+key},body:{model:model.id,reasoning:{effort:'none'},instructions,input:[{role:'user',content:text}],store:false,max_output_tokens:1200}};
 if(model.provider==='google')return {url:'https://generativelanguage.googleapis.com/v1beta/models/'+model.id+':generateContent',headers:{...headers,'x-goog-api-key':key},body:{systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text}]}],generationConfig:{maxOutputTokens:1200,thinkingConfig:model.id==='gemini-2.5-flash-lite'?{thinkingBudget:0}:{thinkingLevel:'minimal'}}}};
 return {url:'https://api.anthropic.com/v1/messages',headers:{...headers,Authorization:'Bearer '+key,'anthropic-version':'2026-10-21'},body:{model:model.id,system:instructions,messages:[{role:'user',content:text}],max_tokens:1200,thinking:{type:'disabled'}}};
}
export function providerReply(model,data){
 if(model.provider==='openai')return {text:(data.output||[]).flatMap(i=>i.type==='message'?(i.content||[]).filter(c=>c.type==='output_text').map(c=>c.text):[]).join('\n').trim(),complete:data.status==='completed',model:data.model||model.id,usage:data.usage&&{input_tokens:data.usage.input_tokens,output_tokens:data.usage.output_tokens}};
 if(model.provider==='google'){
  const c=data.candidates?.[0];
  return {text:(c?.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('\n').trim(),complete:c?.finishReason==='STOP',model:data.modelVersion||model.id,usage:data.usageMetadata&&{input_tokens:data.usageMetadata.promptTokenCount,output_tokens:(data.usageMetadata.candidatesTokenCount||0)+(data.usageMetadata.thoughtsTokenCount||0)}};
 }
 return {text:(data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim(),complete:['end_turn','stop_sequence'].includes(data.stop_reason),model:data.model||model.id,usage:data.usage&&{input_tokens:data.usage.input_tokens,output_tokens:data.usage.output_tokens}};
}
