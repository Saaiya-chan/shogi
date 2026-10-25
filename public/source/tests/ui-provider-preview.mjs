// Local UI fixture. Provider responses are simulated; this never calls an external API.
import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const calls=[];
globalThis.fetch=async(url,opts)=>{
 const body=JSON.parse(opts.body);
 let provider,context,model;
 if(url==='https://api.openai.com/v1/responses'){provider='openai';context=JSON.parse(body.input[0].content);model=body.model}
 else if(url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')){provider='google';context=JSON.parse(body.contents[0].parts[0].text);model=url.split('/models/')[1].split(':')[0]}
 else if(url==='https://api.anthropic.com/v1/messages'){provider='anthropic';context=JSON.parse(body.messages[0].content);model=body.model}
 else throw Error('Fixture blocked unexpected network destination');
 calls.push({task:context.task,actor:context.playedMove?.actor,label:context.playedMove?.label,historyCount:context.history.length,question:context.question,model,provider});
 const text='【UIテスト応答 · '+model+'】'+(context.task==='move'?(context.playedMove.actor==='opponent'?'相手の指し手':'あなたの指し手')+' '+context.playedMove.label+' を説明します。':(context.history.length?'前のやり取りを踏まえた返答です。':'この局面に対する返答です。'));
 if(provider==='google')return Response.json({modelVersion:model,candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});
 if(provider==='anthropic')return Response.json({model,stop_reason:'end_turn',content:[{type:'text',text}]});
 return Response.json({status:'completed',model,output:[{type:'message',content:[{type:'output_text',text}]}]});
};
createServer(async(req,res)=>{
 try{
  if(req.url==='/__test/requests'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(calls));return}
  const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(await Array.fromAsync(req))}:{})});
  const response=await worker.fetch(request,{OPENAI_API_KEY:'test-only',GEMINI_API_KEY:'test-only',ANTHROPIC_API_KEY:'test-only'});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Test fixture error')}
}).listen(5175,'127.0.0.1',()=>console.log('UI test fixture: http://127.0.0.1:5175 (mock providers, no API calls)'));
