export const candidateOrigin='https://kikari-entry-form.onrender.com';
export function candidateHeaders(origin:string|null):Record<string,string>{return origin===candidateOrigin?{'Access-Control-Allow-Origin':candidateOrigin,'Vary':'Origin'}:{};}
