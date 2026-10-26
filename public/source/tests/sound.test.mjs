import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PieceSounds,pieceSound,bestCandidate,goodMove} from '../src/sound.js';
const store=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
const audio=()=>{const events=[];let factories=0;const context={state:'suspended',sampleRate:48000,destination:{},resume:async()=>{context.state='running'},createBuffer:(channels,length,rate)=>({duration:length/rate,getChannelData:()=>new Float32Array(length)}),createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createBufferSource:()=>{const node={connect(){},disconnect(){},stop(){events.push('stop')},start(){events.push({duration:node.buffer.duration})}};return node}};return{context,events,get factories(){return factories},contextFactory:()=>{factories++;return context}}};
const candidate=(usi='7g7f',kind='cp',score=10)=>({entries:[{kind,score,pv:[usi]}]});
const review=(mover='sente',usi='7g7f')=>({mover,usi,before:candidate(),after:candidate('8c8d'),outcome:null});
test('normal and strong strikes are short, finite, bounded; strong has more impact and energy',()=>{
 const normal=pieceSound(),strong=pieceSound(44100,true),energy=a=>a.reduce((n,v)=>n+v*v,0);
 for(const a of [normal,strong]){assert.ok(a.length<44100*.3);assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<.95));assert.ok(Math.abs(a.at(-1))<.0001)}
 assert.ok(energy(strong)>energy(normal)*1.5);assert.ok(Math.max(...strong)>Math.max(...normal));
});
test('good-move sounds require the learner and actual best candidate; forced mate against the learner is excluded',()=>{
 assert.ok(goodMove(review(),'sente'));assert.equal(goodMove(review('gote'),'sente'),false);assert.equal(goodMove(review('sente','2g2f'),'sente'),false);
 assert.equal(goodMove({...review(),after:candidate('8c8d','mate',3)},'sente'),false);assert.equal(bestCandidate(candidate('7g7f','mate',-3),'7g7f'),false);
 assert.ok(goodMove({...review(),outcome:{winner:'sente'}},'sente'));assert.equal(goodMove({...review(),outcome:{winner:'gote'}},'sente'),false);
});
test('audio starts only on play, settings persist, muted and zero-volume playback never starts a source',async()=>{
 const stub=audio(),storage=store(),sounds=new PieceSounds({storage,contextFactory:stub.contextFactory});assert.equal(stub.factories,0);
 assert.ok(await sounds.play());assert.equal(stub.context.state,'running');assert.equal(stub.events.filter(e=>typeof e==='object').length,1);
 sounds.setEnabled(false);assert.equal(await sounds.play(),false);const restored=new PieceSounds({storage});assert.equal(restored.enabled,false);
 sounds.setEnabled(true);sounds.setVolume(0);assert.equal(await sounds.play('good'),false);assert.equal(stub.events.filter(e=>typeof e==='object').length,1);
 sounds.setVolume(2);assert.equal(sounds.volume,1);assert.equal(new PieceSounds({storage}).volume,1);
});
test('a good move is rewarded only once, including simultaneous calls and repeated explanations',async()=>{
 const stub=audio(),sounds=new PieceSounds({storage:store(),contextFactory:stub.contextFactory}),record={};
 await Promise.all([sounds.playGood(record),sounds.playGood(record)]);assert.equal(await sounds.playGood(record),false);
 assert.equal(stub.events.filter(e=>typeof e==='object').length,1);assert.equal(stub.events.find(e=>typeof e==='object').duration,.23);
});
test('unsupported audio and hidden tabs fail quietly; muting cancels an awaiting resume',async()=>{
 assert.equal(await new PieceSounds({contextFactory:()=>null}).play(),false);
 const stub=audio(),hidden=new PieceSounds({visible:()=>false,contextFactory:stub.contextFactory});assert.equal(await hidden.play(),false);assert.equal(stub.factories,0);
 let resume;stub.context.resume=()=>new Promise(r=>{resume=r});const sounds=new PieceSounds({contextFactory:stub.contextFactory});const pending=sounds.play();sounds.setEnabled(false);stub.context.state='running';resume();assert.equal(await pending,false);assert.equal(stub.events.length,0);
});
