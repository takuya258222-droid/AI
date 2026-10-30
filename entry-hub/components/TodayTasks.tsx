'use client';
import {useEffect,useMemo,useState} from 'react';
import type {Entry} from '@/lib/model';
import {callWindow,todayTasks,type TaskGroup} from '@/lib/today-tasks';
const labels:Record<TaskGroup,string>={overdue:'希望時間を過ぎた未対応',today:'今日の電話希望',unhandled:'未対応の応募すべて'};
export default function TodayTasks({entries,loading,onChoose}:{entries:Entry[];loading:boolean;onChoose:(id:string)=>void}){
 const [now,setNow]=useState(()=>Date.now()),[group,setGroup]=useState<TaskGroup>('overdue'),[count,setCount]=useState(5);
 useEffect(()=>{const refresh=()=>setNow(Date.now());const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 const tasks=useMemo(()=>todayTasks(entries,now),[entries,now]);
 const [chosen,setChosen]=useState(false);
 const active=chosen?group:tasks.overdue.length?'overdue':tasks.today.length?'today':'unhandled';
 return <section className="panel mb-5" aria-label="今日やること"><div className="flex flex-wrap items-center justify-between gap-2"><h2>今日やること</h2><small>{new Date(now).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}・日本時間</small></div><p className="mini-note">まず希望時間を過ぎた未対応を確認し、次に今日の電話へ。対応済み・対象外は表示しません。電話済みかどうかは、対応ステータスで判断します。</p>
 <div className="flex flex-wrap gap-2 mb-4">{(Object.keys(labels) as TaskGroup[]).map(key=><button key={key} type="button" className={`chip ${active===key?'selected':''}`} aria-pressed={active===key} onClick={()=>{setGroup(key);setChosen(true);setCount(5);}}>{labels[key]} <strong>{loading?'…':tasks[key].length}件</strong></button>)}</div>
 {loading?<p role="status">応募を確認しています…</p>:tasks[active].length===0?<p>この項目に対象者はいません。</p>:<ul className="space-y-3">{tasks[active].slice(0,count).map(entry=><li key={entry.id} className="rounded-xl border border-stone-200 p-3"><div className="flex flex-wrap justify-between items-center gap-3"><div><strong>{entry.full_name}</strong><span className="ml-2 text-sm">{entry.age}・{entry.job_type}</span><p className="mini-note !mb-0">{entry.qualifications} ／ {entry.work_days} ／ {entry.work_hours}</p><small>電話希望：{callWindow(entry).label}</small></div><button type="button" className="btn secondary small" onClick={()=>onChoose(entry.id)}>確認・対応する →</button></div></li>)}</ul>}
 {!loading&&tasks[active].length>count&&<button type="button" className="link-button mt-3" onClick={()=>setCount(n=>n+10)}>さらに10名を表示（残り{tasks[active].length-count}名）</button>}
 <p className="mini-note mt-3 !mb-0">「未対応すべて」には、今日の電話希望・時間超過の方も含みます。新しい応募は「最新情報に更新」で取得できます。</p></section>;
}
