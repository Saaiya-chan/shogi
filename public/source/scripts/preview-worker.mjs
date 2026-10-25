import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
try{process.loadEnvFile('.env.local')}catch{}
const port=Number(process.env.PORT||5174);
const server=createServer(async(req,res)=>{try{const response=await worker.fetch(new Request('http://'+(req.headers.host||'127.0.0.1:'+port)+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(await Array.fromAsync(req))}:{})}),{OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,COACH_DEFAULT_MODEL:process.env.COACH_DEFAULT_MODEL,GEMINI_API_KEY:process.env.GEMINI_API_KEY,ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
