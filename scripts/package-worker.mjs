import { readFileSync,readdirSync,writeFileSync,mkdirSync,rmSync } from 'node:fs';
import { extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8','.gz':'application/gzip'};
const assets={};
function collect(dir,prefix=''){for(const f of readdirSync(dir,{withFileTypes:true})){const name=prefix+'/'+f.name;if(f.name==='source'||f.name==='_headers'||f.name==='.openai')continue;if(f.isDirectory())collect(dir+'/'+f.name,name);else assets[name]={type:types[extname(f.name)]||'application/octet-stream',data:readFileSync(dir+'/'+f.name).toString('base64')}}}
collect('dist');
const entry="import {serveAsset} from './worker/serve.js'; import {handleCoach} from './worker/coach-api.js'; const assets="+JSON.stringify(assets)+"; export default {fetch(request,env){return new URL(request.url).pathname.startsWith('/api/coach')?handleCoach(request,env):serveAsset(request,assets)}};";
const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'worker-entry.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,minify:true});
const output=bundled.outputFiles[0].text;
rmSync('dist',{recursive:true});mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',output);writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
console.log('Worker: '+Object.keys(assets).length+' assets, '+(gzipSync(output).length/1024).toFixed(0)+' KB gzip');
