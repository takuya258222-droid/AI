import {renderPDF} from '../lib/pdf-service';
import {initialSheet} from '../lib/sheet';
import {writeFileSync,mkdirSync} from 'node:fs';
import type {Entry} from '../lib/model';
const e={id:'ENT-20261029000000',age:'30代前半',gender:'女性',job_type:'介護',qualifications:'介護福祉士',history_summary:'1. 特養：3年（最新）\nデイサービス：計2年',total_exp:5,work_hours:'日勤',work_days:'週4日',join_date:'2026-11-01',early_join:'前倒し相談可能',desired_employment:'派遣社員',commute_method:'公共交通機関',commute_minutes:'30分以内',nearest_station:'本町',weekend_availability:'相談可能'} as Entry;
const sheet=initialSheet(e),profile={id:'sample',company:'株式会社サンプル',name:'テスト担当者',email:'test@example.com',phone:'',fax:''};
async function main(){
 let ticks=0;const timer=setInterval(()=>ticks++,20);const start=performance.now();
 const job=renderPDF(sheet,profile);const same=renderPDF(sheet,profile);
 if(job!==same)throw new Error('Duplicate request did not share work');
 await renderPDF({...sheet,headline:'another'},profile).then(()=>{throw new Error('Concurrency guard failed')},e=>{if(e.message!=='PDF_BUSY')throw e;});
 const bytes=await job;const duration=performance.now()-start;clearInterval(timer);
 if(bytes.subarray(0,4).toString()!=='%PDF')throw new Error('Invalid PDF');
 const cachedStart=performance.now();await renderPDF(sheet,profile);const cacheMs=performance.now()-cachedStart;
 mkdirSync('output',{recursive:true});writeFileSync('output/worker-sample.pdf',bytes);
 writeFileSync('output/worker-long.pdf',await renderPDF({...sheet,recommendation:'面談時に確認した経験と希望条件を記載します。\n'.repeat(50)},profile));
 console.log(JSON.stringify({pdfBytes:bytes.length,generationMs:Math.round(duration),mainThreadTicks:ticks,cachedMs:Math.round(cacheMs),peakRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
 if(ticks<3)throw new Error('Main thread did not respond during generation');
}
void main();
