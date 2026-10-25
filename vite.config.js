import { defineConfig } from 'vite';
export default defineConfig({
 server:{proxy:{'/api/coach':'http://127.0.0.1:5174'},headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
 preview:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
 build:{target:'es2022'}
});
