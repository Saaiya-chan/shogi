// Every response needs isolation headers, including the document and pthread scripts.
export function serveAsset(request, assets) {
  const headers = new Headers({
    'Cross-Origin-Opener-Policy':'same-origin',
    'Cross-Origin-Embedder-Policy':'require-corp',
    'Cross-Origin-Resource-Policy':'same-origin',
    'X-Content-Type-Options':'nosniff',
    'Cache-Control':'no-cache',
  });
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
  const path=new URL(request.url).pathname;
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404,headers});
  headers.set('Content-Type',asset.type);
  if(path.startsWith('/assets/'))headers.set('Cache-Control','public, max-age=31536000, immutable');
  const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{status:200,headers});
}
