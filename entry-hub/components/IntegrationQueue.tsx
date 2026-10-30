'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/browser';
type Row={entry_id?:string;id?:string;full_name?:string;state?:string;attempts?:number;last_error?:string;lease_until?:string;ends_at?:string;entries?:{full_name:string}|null};
const names:Record<string,string>={pending:'処理待ち',failed:'失敗・再処理可',sending:'送信処理中',syncing:'登録処理中',conflict:'予定重複・日時要調整',expired:'希望日時を経過'};
export default function IntegrationQueue(){
 const [kind,setKind]=useState('mail'),[page,setPage]=useState(0),[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const generation=useRef(0);
 async function refresh(){const token=++generation.current;setLoading(true);try{const r=await api(`/api/admin/integration-queue?kind=${kind}&page=${page}`);if(token===generation.current){setRows(r.rows);setTotal(r.total);}}catch(e){if(token===generation.current)setMessage((e as Error).message);}finally{if(token===generation.current)setLoading(false);}}
 useEffect(()=>{void refresh();return()=>{generation.current++;};},[kind,page]);
 function eligible(row:Row){return row.state!=='expired'&&!(row.ends_at&&Date.parse(row.ends_at)<=Date.now())&&!(row.lease_until&&Date.parse(row.lease_until)>Date.now());}
 async function retry(items:Row[]){setBusy(true);try{const r=await api('/api/admin/integration-queue',{method:'POST',body:JSON.stringify({kind,ids:items.map(row=>row.entry_id||row.id)})});setMessage(r.message);await refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel mb-5"><h2>通知・予定の未処理一覧</h2><p className="mini-note">失敗・上限到達・日時要調整をすべて表示します。自動処理で5回失敗したものも、ここから再処理できます。メールは送信先の受信箱まで保証するものではありません。</p>
 <div className="flex flex-wrap gap-2 mb-3">{[['mail','未送信メール'],['calendar','未登録・要調整の予定'],['missing','予定の処理待ち']].map(([value,label])=><button key={value} className="btn secondary small" aria-pressed={kind===value} disabled={busy} onClick={()=>{setKind(value);setPage(0);setRows([]);}}>{label}</button>)}</div>
 <div className="flex flex-wrap gap-3 items-center mb-3"><strong>{total}件</strong><button className="btn secondary small" disabled={loading} onClick={()=>void refresh()}>結果を更新</button><button className="btn secondary small" disabled={busy||loading||!rows.some(eligible)} onClick={()=>void retry(rows.filter(eligible))}>このページの対象を再処理</button></div>
 {loading?<p role="status">読み込み中…</p>:rows.length===0?<p>この一覧に未処理はありません。</p>:rows.map(row=><div className="note" key={row.entry_id||row.id}><strong>{row.entries?.full_name||row.full_name||row.entry_id||row.id}</strong><br/><small>{row.entry_id||row.id} · {names[row.state||'pending']||row.state} · 試行{row.attempts||0}回{(row.attempts||0)>=5?'（自動再処理の上限・手動対応可）':''}</small>{row.last_error&&<p>{row.last_error}</p>}{row.ends_at&&Date.parse(row.ends_at)<=Date.now()&&<p>希望日時を過ぎています。応募者と日時を調整してください。</p>}{row.state==='conflict'&&<p>重複する予定を調整してから再確認してください。</p>}<button className="btn secondary small mt-2" disabled={busy||!eligible(row)} onClick={()=>void retry([row])}>{row.state==='conflict'?'重複を再確認':'再処理'}</button></div>)}
 <div className="flex gap-3 items-center"><button className="btn secondary small" disabled={page===0||busy||loading} onClick={()=>setPage(page-1)}>前へ</button><span>{page+1} / {Math.max(1,Math.ceil(total/20))}ページ</span><button className="btn secondary small" disabled={(page+1)*20>=total||busy||loading} onClick={()=>setPage(page+1)}>次へ</button></div>
 {message&&<p role="status" className="note mt-3">{message}</p>}</section>;
}
