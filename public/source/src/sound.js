// Original percussive synthesis: a sharp contact and short wooden board resonances.
// No third-party recordings and no network or analysis requests are made here.
export function pieceSound(sampleRate=44100,strong=false){
 const duration=strong?.23:.15,samples=new Float32Array(Math.ceil(sampleRate*duration));let seed=0x59a74821,low=0;
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
  const noise=(seed>>>0)/2147483648-1;low+=.18*(noise-low);
  const attack=1-Math.exp(-t/.00035),snap=(noise-low)*Math.exp(-t/(strong?.013:.007));
  const body=Math.sin(2*Math.PI*(strong?790:1120)*t)*Math.exp(-t/(strong?.037:.021));
  const wood=.42*Math.sin(2*Math.PI*2180*t)*Math.exp(-t/.014)+.22*Math.sin(2*Math.PI*3670*t)*Math.exp(-t/.009);
  const board=.20*Math.sin(2*Math.PI*205*t)*Math.exp(-t/(strong?.041:.023));
  const slap=strong&&t>.004?(noise-low)*.5*Math.exp(-(t-.004)/.012):0;
  const tail=Math.min(1,(duration-t)/.012);
  samples[i]=Math.tanh((snap*.76+body*.47+wood+board+slap)*attack*(strong?1.22:.78))*tail*.9;
 }
 return samples;
}
export function bestCandidate(analysis,usi){
 const e=analysis?.entries?.[0];return !!e&&e.pv?.[0]===usi&&['cp','mate'].includes(e.kind)&&Number.isFinite(e.score)&&!(e.kind==='mate'&&e.score<=0);
}
export function goodMove(review,human){
 if(!review||review.mover!==human)return false;
 if(review.outcome)return review.outcome.winner===human;
 const after=review.after.entries[0];
 return bestCandidate(review.before,review.usi)&&!(after?.kind==='mate'&&after.score>=0);
}
export class PieceSounds{
 constructor({storage,contextFactory=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null},visible=()=>globalThis.document?.visibilityState!=='hidden'}={}){
  this.storage=storage;try{if(storage===undefined)this.storage=globalThis.localStorage}catch{}this.contextFactory=contextFactory;this.visible=visible;this.enabled=true;this.volume=.55;this.context=null;this.buffers=new Map();this.rewarded=new WeakSet();this.serial=0;
  try{const p=JSON.parse(this.storage?.getItem('kito-sound-v1')||'null');if(p){this.enabled=p.enabled!==false;if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume))}}catch{}
 }
 persist(){try{this.storage?.setItem('kito-sound-v1',JSON.stringify({enabled:this.enabled,volume:this.volume}))}catch{}}
 setEnabled(enabled){this.enabled=!!enabled;if(!this.enabled)this.stop();this.persist()}
 setVolume(volume){if(!Number.isFinite(volume))return;this.volume=Math.max(0,Math.min(1,volume));if(!this.volume)this.stop();this.persist()}
 stop(){this.serial++;try{this.source?.stop()}catch{}this.source=null}
 async unlock(){
  if(!this.enabled||!this.volume||!this.visible())return false;
  try{this.context??=this.contextFactory();if(!this.context)return false;if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running'}catch{return false}
 }
 async play(kind='move',level=1){
  const serial=++this.serial;
  if(!await this.unlock()||serial!==this.serial||!this.enabled||!this.volume||!this.visible())return false;
  try{
   const context=this.context,key=kind==='good'?'good':'move';let buffer=this.buffers.get(key);
   if(!buffer){const samples=pieceSound(context.sampleRate,key==='good');buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);this.buffers.set(key,buffer)}
   try{this.source?.stop()}catch{}
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=Math.pow(this.volume,1.5)*Math.max(0,Math.min(1,level))*.8;
   source.connect(gain);gain.connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();if(this.source===source)this.source=null};this.source=source;source.start();return true;
  }catch{return false}
 }
 async playGood(record){
  if(this.rewarded.has(record)||!this.enabled||!this.volume||!this.visible())return false;
  this.rewarded.add(record);const played=await this.play('good');if(!played)this.rewarded.delete(record);return played;
 }
}
