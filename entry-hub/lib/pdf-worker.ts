import {parentPort,workerData} from 'node:worker_threads';
import {makePDF} from './pdf';
makePDF(workerData.sheet,workerData.profile).then(bytes=>{
 const result=Uint8Array.from(bytes);
 parentPort!.postMessage({bytes:result},[result.buffer]);
}).catch(error=>parentPort!.postMessage({error:error instanceof Error&&error.message==='PDF_FONT_MISSING'?'PDF_FONT_MISSING':'PDF_RENDER_FAILED'}));
