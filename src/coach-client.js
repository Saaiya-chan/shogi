import {COACH_REVISION} from './coach-contract.js';
export const replyKey=(human,before,record,model='')=>[human,before,record.usi,record.sfen,model].join('|');
export const replyMatches=(reply,model)=>!!reply&&reply.revision===COACH_REVISION&&(reply.configurationModel||reply.selectedModel||reply.model)===model;
export class CoachClient {
 constructor(fetcher=(...args)=>fetch(...args)){
  this.autoExplain=false;this.autoGeneration=0;
  try{this.autoExplain=localStorage.getItem('kito-coach-auto-explain')==='true'}catch{}
  this.fetcher=fetcher;this.configured=false;this.model='';this.models=[];this.status='checking';this.cache=new Map();this.blocked=new Map();
  try{this.preferredModel=localStorage.getItem('kito-coach-model')||'';for(const [key,value]of JSON.parse(localStorage.getItem('kito-ai-replies-v1')||'[]'))if(typeof value?.text==='string'&&value.text.length<6000)this.cache.set(key,value)}catch{}
 }
 setAutoExplain(enabled){this.autoExplain=enabled===true;this.autoGeneration++;try{localStorage.setItem('kito-coach-auto-explain',String(this.autoExplain))}catch{}}
 get selected(){return this.models.find(m=>m.id===this.model)}
 get providerLabel(){return this.selected?.providerLabel||'AIサービス'}
 get blockedMessage(){return this.blocked.get(this.model)||''}
 async init(){
  try{
   const r=await this.fetcher('/api/coach/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();
   this.models=Array.isArray(data.models)?data.models:[{id:String(data.model||''),label:String(data.model||''),provider:'openai',providerLabel:'OpenAI',configured:data.configured===true}];
   this.selectModel(this.models.some(m=>m.id===this.preferredModel&&m.configured)?this.preferredModel:String(data.model||''),false);
  }catch{this.status='unavailable';this.configured=false}return this.configured;
 }
 selectModel(id,persist=true){
  const m=this.models.find(m=>m.id===id);if(!m||(persist&&!m.configured))return false;
  this.model=m.id;this.configured=m.configured===true;this.status=this.configured?'ready':'unconfigured';
  if(persist)try{localStorage.setItem('kito-coach-model',id)}catch{}
  return true;
 }
 async request(body,model=this.model){
  const r=await this.fetcher('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,model}),signal:AbortSignal.timeout(55000)});
  let data;try{data=await r.json()}catch{throw Error('AIコーチの返答を読み取れませんでした。')}
  if(!r.ok){if(data.code==='insufficient_quota')this.blocked.set(model,data.error);const error=Error(data.error||'AIコーチに接続できませんでした。');error.code=data.code;throw error}
  if(typeof data.text!=='string'||!data.text.trim())throw Error('AIコーチの返答が空でした。');this.blocked.delete(model);return {...data,configurationModel:model};
 }
 cached(key,model=this.model){const value=this.cache.get(key);return replyMatches(value,model)?value:null}
 remember(key,reply,model=this.model){this.cache.set(key,{...reply,configurationModel:model});while(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);try{localStorage.setItem('kito-ai-replies-v1',JSON.stringify([...this.cache]))}catch{}}
}
