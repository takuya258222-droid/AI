import PDFDocument from 'pdfkit';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import type {Profile,Sheet} from './sheet';
export async function makePDF(s:Sheet,p:Profile):Promise<Buffer>{return new Promise((resolve,reject)=>{
 const fontPath=join(process.cwd(),'assets/NotoSansJP-Regular.ttf');if(!existsSync(fontPath)){reject(new Error('PDF_FONT_MISSING'));return;}
 const doc=new PDFDocument({font:fontPath,size:'A4',margins:{top:34,bottom:65,left:36,right:36},bufferPages:true,info:{Title:`エントリーシート ${s.inquiry_no}`,Author:p.company,Subject:'候補者プロフィール'}});const chunks:Buffer[]=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
 try{doc.font(fontPath);const left=36,width=523,ink='#243c32',line='#b9c4bc';let y=34;
 const text=(v:string,x:number,yy:number,w:number,size=9)=>{doc.fillColor('#222b25').fontSize(size).text(v||'未確認',x,yy,{width:w,lineGap:1});};
 const rect=(x:number,yy:number,w:number,h:number,fill?:string)=>{if(fill)doc.rect(x,yy,w,h).fill(fill);doc.rect(x,yy,w,h).lineWidth(.5).stroke(line);};
 function ensure(h:number){if(y+h>765){doc.addPage();y=36;doc.fillColor(ink).fontSize(10).text(`エントリーシート（続き）  ${s.inquiry_no}`,left,y,{width});y+=28;}}
 function section(title:string){ensure(38);doc.rect(left,y,width,18).fill(ink);doc.fillColor('#ffffff').fontSize(9).text(title,left+10,y+3,{width:width-20});y+=23;}
 function row(cells:{label:string;value:string}[]){const cellW=width/cells.length;const height=Math.max(25,...cells.map(c=>doc.fontSize(9).heightOfString(c.value||'未確認',{width:cellW-85})+12));ensure(height);cells.forEach((c,i)=>{const x=left+i*cellW;rect(x,y,cellW,height);rect(x,y,74,height,'#eef2ec');text(c.label,x+7,y+7,61,7.5);text(c.value,x+81,y+6,cellW-88,8.5);});y+=height;}
 function paragraph(title:string,content:string){section(title);if(!content){text('未記入',left+8,y,width-16);y+=28;return;}doc.fontSize(8.2).fillColor('#222b25').text(content,left+8,y,{width:width-16,lineGap:1.5});y=doc.y+3;}
 rect(left,y,370,48,'#f0f3ed');text(s.headline,left+12,y+9,346,12);text(s.offer_note||'看護・介護職の候補者をご紹介いたします',left+12,y+33,346,8);rect(left+382,y,141,48);text('お問い合わせ番号',left+391,y+6,123,8);text(s.inquiry_no,left+391,y+25,123,9);y+=57;
 text('人事採用ご担当者様',left,y,width,10);y+=16;text('この度、ご提案する求職者様のプロフィールをお送りいたします。\nご関心がございましたら、下記担当者までお気軽にお問い合わせください。',left,y,width,8.5);y=doc.y+9;
 section('基本情報');row([{label:'年齢・年代',value:s.age},{label:'性別',value:s.gender}]);row([{label:'資格',value:s.qualifications},{label:'希望雇用形態',value:s.employment}]);row([{label:'通勤方法',value:s.commute},{label:'エリア',value:s.area}]);row([{label:'入職希望日',value:s.join_date},{label:'希望週回数',value:s.work_days}]);
 function options(title:string,names:string[],values:string[]){ensure(38);const w=width/(names.length+1);rect(left,y,w,34,'#eef2ec');text(title,left+5,y+10,w-10,8);names.forEach((name,i)=>{rect(left+w*(i+1),y,w,34);text(name,left+w*(i+1)+3,y+4,w-6,7.5);if(values[i]==='○'){doc.circle(left+w*(i+1)+w/2,y+24,4).lineWidth(.8).stroke(ink);}else{text(values[i],left+w*(i+1)+3,y+18,w-6,8);}});y+=34;}
 options('時間帯',['早出','日勤','遅出','夜勤'],s.shifts);options('曜日',['月','火','水','木','金','土','日','祝'],s.weekdays);y+=9;
 section('簡易経歴 / 新しい順');const widths=[90,100,333];let x=left;['期間','雇用形態','施設形態・業務内容'].forEach((v,i)=>{rect(x,y,widths[i],20,'#eef2ec');text(v,x+7,y+6,widths[i]-14,8);x+=widths[i];});y+=20;
 for(const c of s.careers.length?s.careers:[{period:'-',employment:'-',detail:'実務経験なし'}]){const vals=[c.period,c.employment,c.detail];const h=Math.max(27,...vals.map((v,i)=>doc.fontSize(8.5).heightOfString(v||'未確認',{width:widths[i]-14})+12));ensure(h);let xx=left;vals.forEach((v,i)=>{rect(xx,y,widths[i],h);text(v,xx+7,y+7,widths[i]-14,8.5);xx+=widths[i];});y+=h;}
 y+=10;paragraph('候補者情報',s.candidate_summary);if(s.recommendation.trim())paragraph('人物面・推薦ポイント',s.recommendation);paragraph('見学・面談の希望',s.tour_dates);
 const reply='ご回答欄（チェックだけでもご返信いただけます）\n[ ] 面談希望  [ ] 条件を相談したい  [ ] 今回は見送り\n面談可能日：       月       日     時頃\n貴社名・ご担当者：\n返信先TEL / FAX：';
 const signature=[p.company,`担当者：${p.name}`,`Mail：${p.email}`,[p.phone?`Tel：${p.phone}`:'',p.fax?`FAX：${p.fax}`:''].filter(Boolean).join('   ')].filter(Boolean).join('\n');
 const bottomH=Math.max(70,doc.fontSize(8).heightOfString(signature,{width:191,lineGap:1})+16);ensure(bottomH);rect(left,y,316,bottomH,'#f7f8f4');rect(left+316,y,207,bottomH);text(reply,left+8,y+8,300,8);text(signature,left+324,y+8,191,8);

 const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.fillColor('#8a938b').fontSize(7).text(`候補者の申告内容に基づく資料です。未確認事項は担当者にお問い合わせください。   ${i+1} / ${range.count}`,left,806,{width,align:'center'});}doc.end();
 }catch(e){reject(e);doc.end();}
 });}
