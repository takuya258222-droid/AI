import {db} from './server';
export type IntegrationKind='mail'|'calendar';
// Diagnostic recording must never change the outcome of an external operation.
export async function recordIntegrationResult(kind:IntegrationKind,ok:boolean){
 try{const {error}=await db().from('integration_results').insert({kind,ok});if(error)console.error('Integration result recording failed');}
 catch{console.error('Integration result recording unavailable');}
}
export async function trackIntegration<T>(kind:IntegrationKind,work:()=>Promise<T>):Promise<T>{
 try{const result=await work();await recordIntegrationResult(kind,true);return result;}
 catch(error){await recordIntegrationResult(kind,false);throw error;}
}
export async function integrationHealth(){
 const client=db();
 const rows=await Promise.all((['mail','calendar'] as const).map(async kind=>{
  const [latest,success]=await Promise.all([
   client.from('integration_results').select('ok,created_at').eq('kind',kind).order('created_at',{ascending:false}).limit(1).maybeSingle(),
   client.from('integration_results').select('created_at').eq('kind',kind).eq('ok',true).order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if(latest.error||success.error)throw latest.error||success.error;
  return [kind,{lastResult:latest.data?.ok??null,lastCheckedAt:latest.data?.created_at??null,lastSuccessAt:success.data?.created_at??null}];
 }));
 return Object.fromEntries(rows);
}
