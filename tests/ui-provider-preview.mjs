// Local UI test fixture. Never part of the production worker entrypoint.
import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async(url,opts)=>{
 if(url!=='https://api.openai.com/v1/responses')return originalFetch(url,opts);
 const context=JSON.parse(JSON.parse(opts.body).input[0].content);
 calls.push({task:context.task,actor:context.playedMove?.actor,label:context.playedMove?.label,historyCount:context.history.length,question:context.question});
 const text=context.task==='move'?'【UIテスト応答】'+(context.playedMove.actor==='opponent'?'相手の指し手':'あなたの指し手')+' '+context.playedMove.label+' を、受け取った合法な読み筋に沿って説明します。':'【UIテスト応答】'+(context.history.length?'前のやり取りを踏まえた返答です。':'この局面に対する返答です。');
 return Response.json({status:'completed',model:'ui-test-model',output:[{type:'message',content:[{type:'output_text',text}]}]});
};
createServer(async(req,res)=>{
 try{
  if(req.url==='/__test/requests'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(calls));return}
  const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(await Array.fromAsync(req))}:{})});
  const response=await worker.fetch(request,{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'ui-test-model'});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Test fixture error')}
}).listen(5175,'127.0.0.1',()=>console.log('UI test fixture: http://127.0.0.1:5175 (mock provider, no API calls)'));
