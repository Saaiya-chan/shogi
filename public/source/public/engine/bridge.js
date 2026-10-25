/* USI runs off the UI thread. The engine's own pthread workers stay same-origin. */
importScripts('./yaneuraou.k-p.js');
let engine;
const boot = YaneuraOu_K_P({mainScriptUrlOrBlob:new URL('./yaneuraou.k-p.js',self.location.href).href,locateFile:file=>new URL(file,self.location.href).href}).then(e=>{
 engine=e;
 e.addMessageListener(line=>postMessage({type:'line',line}));
 postMessage({type:'loaded'});
}).catch(error=>postMessage({type:'error',message:String(error)}));
onmessage=async({data})=>{await boot;if(engine)engine.postMessage(data)};
