import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import wawoff2 from 'wawoff2';
// Decompress the Japanese font once during build, never in a live PDF request.
await mkdir('assets',{recursive:true});
const font=await readFile('node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2');
await writeFile('assets/NotoSansJP-Regular.ttf',await wawoff2.decompress(font));
await build({entryPoints:['lib/pdf-worker.ts'],outfile:'.pdf-worker/worker.cjs',bundle:true,platform:'node',target:'node22',format:'cjs',packages:'external'});
