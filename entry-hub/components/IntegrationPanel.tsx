'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/browser';
type Status={mailConfigured:boolean;mailRecipient:string;calendarConfigured:boolean;mailConnected:boolean;calendarConnected:boolean;pendingMail:number;pendingCalendar:number;turnstileConfigured:boolean;oauthReady:boolean;connected:boolean;account:string|null;redirectUri:string|null;expiresAt:string|null};
const results:Record<string,string>={connected:'Googleとの再連携が完了しました。切断中にたまったメール通知とカレンダー予定も自動で再処理しました。',cancelled:'連携はキャンセルされました。必要なときに再接続できます。',invalid_state:'操作の有効期限が切れました。「Googleと連携」からやり直してください。',exchange_failed:'Googleの認証情報を確認できませんでした。管理者がClient ID・秘密キー・戻り先URLを確認してください。',account_mismatch:'指定された送信元アカウントと異なります。正しいGoogleアカウントで再接続してください。',missing_scope:'必要な権限が許可されていません。再接続してメール送信・予定管理・空き時間確認を許可してください。',missing_refresh:'継続利用の許可を取得できませんでした。再接続してください。',save_failed:'接続情報を保存できませんでした。時間をおいて再接続してください。'};
export default function IntegrationPanel(){
 const [status,setStatus]=useState<Status|null>(null),[message,setMessage]=useState(''),[start,setStart]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 async function check(){try{setStatus(await api('/api/admin/integrations'));}catch(e){setMessage((e as Error).message);}}
 useEffect(()=>{const query=new URLSearchParams(window.location.search);const result=query.get('google');if(result){setOpen(true);setMessage(results[result]||'Googleとの連携を完了できませんでした。再接続してください。');void check();query.delete('google');window.history.replaceState(null,'',window.location.pathname+(query.size?'?'+query.toString():''));}},[]);
 async function connect(){setBusy(true);setMessage('');try{const result=await api('/api/admin/google/start',{method:'POST'});window.location.assign(result.url);}catch(e){setMessage((e as Error).message);setBusy(false);}}
 async function run(kind:string){setBusy(true);setMessage('');setUrl('');try{const result=await api('/api/admin/integrations',{method:'POST',body:JSON.stringify({kind,start:start?start+':00+09:00':''})});setMessage(result.message);if(result.url)setUrl(result.url);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <details className="panel !p-5 mb-5" open={open} onToggle={e=>{setOpen(e.currentTarget.open);if(e.currentTarget.open&&!status)void check();}}>
 <summary className="cursor-pointer font-semibold">Google連携・メール通知の設定</summary>
 {status&&<div className="mt-4 space-y-4">
 <div className="rounded-2xl bg-stone-50 p-4 space-y-3"><p className="font-semibold">{status.connected?'Google接続済み':'Googleとつないで、通知・日程管理をスムーズに'}</p>
 <p className="mini-note">{status.connected?`連携先：${status.account}`:'ログインして許可するだけ。認証キーのコピーは不要です。'}</p>
 <button className="btn primary" disabled={busy||!status.oauthReady} onClick={connect}>{status.connected?'Googleに再接続':'Googleと連携'}</button>
 <p className="mini-note">メール送信・カレンダーの予定管理・空き時間確認を許可します。求職者のログインは不要です。</p>
 {!status.oauthReady&&<p role="status">管理者による初期設定が必要です。</p>}
 {status.expiresAt&&<p className="mini-note">接続の有効期限：{new Date(status.expiresAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</p>}
 <p className="mini-note">Google側が「テスト中」の場合、通常7日で再接続が必要です。継続運用前に公開ステータスを確認してください。</p>
 </div>
 <div className="grid2"><div className="note !mb-0"><strong>メール：{status.mailConnected?'連携済み':'未連携'}</strong><br/><small>{status.pendingMail?`未送信 ${status.pendingMail}件（再連携時に自動送信）`:'未送信なし'}</small></div><div className="note !mb-0"><strong>カレンダー：{status.calendarConnected?'連携済み':'未連携'}</strong><br/><small>{status.pendingCalendar?`未反映 ${status.pendingCalendar}件（再連携時に自動登録）`:'未反映なし'}</small></div></div>
 <p className="mini-note">フォーム保護：{status.turnstileConfigured?'設定あり':'未設定'}</p>
 <div className="flex flex-wrap gap-3 items-center"><button className="btn secondary small" disabled={busy||!status.mailConfigured} onClick={()=>run('email')}>テストメールを送信</button><small>宛先：{status.mailRecipient}</small></div>
 <div className="flex flex-wrap gap-3 items-center"><input className="!w-64" type="datetime-local" aria-label="カレンダーテスト日時" value={start} onChange={e=>setStart(e.target.value)}/><button className="btn secondary small" disabled={busy||!start||!status.calendarConfigured} onClick={()=>run('calendar')}>30分のテスト予定を登録</button></div>
 <p className="mini-note">日本時間。「接続テスト」として実際のカレンダーに登録します。求職者情報や招待メールは含めません。</p>
 <details><summary className="mini-note cursor-pointer">管理者向け：初回設定</summary><p className="mini-note">Google CloudのOAuthクライアントに、次の「承認済みのリダイレクトURI」を追加してください。</p><code className="block break-all text-xs mt-2">{status.redirectUri}</code><button className="btn secondary small mt-3" onClick={async()=>{try{await navigator.clipboard.writeText(status.redirectUri||'');setMessage('戻り先URLをコピーしました');}catch{setMessage('表示された戻り先URLを選択してコピーしてください');}}}>戻り先URLをコピー</button></details>
 </div>}
 {message&&<p role="status" className="note mt-4 !mb-0">{message}{url&&<a className="block" href={url} target="_blank" rel="noreferrer">登録したテスト予定を開く ↗</a>}</p>}
 </details>;
}
