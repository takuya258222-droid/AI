import { db, env } from './server';
import type { Entry } from './model';
export const labels:Record<string,string>={id:'管理ID',created_at:'登録日時',status:'ステータス',full_name:'氏名',phone:'電話番号',postal_code:'郵便番号',age:'年代',job_type:'職種',qualifications:'保有資格',status_current:'現在の状況',recent_emp_type:'直近雇用形態',total_exp:'通算経験年数',history_summary:'職歴サマリー',work_hours:'希望勤務時間',work_days:'希望週回数',call_date_1:'電話第1希望日',call_time_1:'電話第1希望時間',call_date_2:'電話第2希望日',call_time_2:'電話第2希望時間',tour_date_1:'見学第1希望日',tour_time_1:'見学第1希望時間',tour_date_2:'見学第2希望日',tour_time_2:'見学第2希望時間',tour_date_3:'見学第3希望日',tour_time_3:'見学第3希望時間',join_date:'入職希望日',early_join:'前倒し相談',user_memo:'求職者要望',internal_memo:'社内メモ'};
export async function notifyEntry(id:string){const client=db();const claim=await client.rpc('claim_notification',{target:id});if(claim.error)throw claim.error;if(!claim.data)return;
 try{const {data:e,error}=await client.from('entries').select('*').eq('id',id).single();if(error)throw error;
 const text=Object.entries(labels).map(([k,label])=>`${label}：${e[k as keyof Entry]||'未入力'}`).join('\n')+`\n\n管理画面：${env('APP_URL')}/admin`;
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`entry-${id}`},body:JSON.stringify({from:env('EMAIL_FROM'),to:[process.env.NOTIFY_EMAIL||'t-sugimoto@kikari.co.jp'],subject:`【新規エントリー】${id}`,text}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(`Mail provider HTTP ${response.status}`);
 const saved=await client.from('notifications').update({state:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('entry_id',id);if(saved.error)throw saved.error;
 await client.from('entries').update({notification_status:'sent'}).eq('id',id);
 }catch{await client.from('notifications').update({state:'failed',lease_until:null,last_error:'送信失敗。環境設定または配信サービスを確認してください。'}).eq('entry_id',id);await client.from('entries').update({notification_status:'failed'}).eq('id',id);}
}
