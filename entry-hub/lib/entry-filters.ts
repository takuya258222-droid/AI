export function matchesEntryFilters(entry:{created_at:string;work_days:string},filters:{dateFrom:string;dateTo:string;weekFilter:string}){
 const registered=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(entry.created_at));
 if(filters.dateFrom&&registered<filters.dateFrom||filters.dateTo&&registered>filters.dateTo)return false;
 if(!filters.weekFilter)return true;
 if(filters.weekFilter==='相談して決めたい')return entry.work_days===filters.weekFilter;
 const range=entry.work_days.match(/^週(\d)(?:[-〜～](\d))?日$/);
 return Boolean(range&&Number(filters.weekFilter)>=Number(range[1])&&Number(filters.weekFilter)<=Number(range[2]||range[1]));
}
