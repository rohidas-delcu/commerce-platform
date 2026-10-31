type Method='GET'|'POST'|'PUT'|'PATCH'|'DELETE';
export class ApiError extends Error {
  constructor(public status:number,message:string,public details?:unknown){super(message);this.name='ApiError';}
}
const csrfTokens=new Map<string,string>();
const pending=new Map<string,Promise<void>>();
function url(handle:string,path:string){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)||!path.startsWith('/')&&path!=='')throw new Error('Invalid storefront API path.');
  return `/v1/storefront/${encodeURIComponent(handle)}${path}`;
}
async function read(response:Response){
  if(response.status===204)return null;
  const body=await response.text();
  if(!body)return null;
  try{return JSON.parse(body) as unknown;}catch{throw new ApiError(response.status,'Unexpected API response.');}
}
function message(body:unknown,status:number){
  if(body&&typeof body==='object'){
    const value=(body as {message?:unknown}).message;
    if(Array.isArray(value))return value.join('; ');
    if(typeof value==='string')return value;
  }
  return `Request failed (${status}).`;
}
export async function ensureCsrf(handle:string){
  if(csrfTokens.has(handle))return;
  let active=pending.get(handle);
  if(!active){
    active=(async()=>{
      const result=await fetch(url(handle,'/customer/auth/csrf'),{credentials:'include',cache:'no-store'});
      const body=await read(result);
      if(!result.ok)throw new ApiError(result.status,message(body,result.status),body);
      const token=(body as {csrfToken?:unknown}|null)?.csrfToken;
      if(typeof token!=='string'||!token)throw new ApiError(502,'Customer CSRF session unavailable.');
      csrfTokens.set(handle,token);
    })().finally(()=>pending.delete(handle));
    pending.set(handle,active);
  }
  await active;
}
export async function request<T>(handle:string,path:string,method:Method='GET',data?:unknown,idempotencyKey?:string):Promise<T>{
  if(method!=='GET')await ensureCsrf(handle);
  const headers:Record<string,string>={Accept:'application/json'};
  if(method!=='GET')headers['x-csrf-token']=csrfTokens.get(handle)!;
  if(data!==undefined)headers['Content-Type']='application/json';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const response=await fetch(url(handle,path),{method,headers,body:data===undefined?undefined:JSON.stringify(data),credentials:'include',cache:'no-store'});
  const body=await read(response);
  if(!response.ok)throw new ApiError(response.status,message(body,response.status),body);
  if(body&&typeof body==='object'&&typeof (body as {csrfToken?:unknown}).csrfToken==='string')csrfTokens.set(handle,(body as {csrfToken:string}).csrfToken);
  return body as T;
}
export const api={
  get:<T>(handle:string,path:string)=>request<T>(handle,path),
  post:<T>(handle:string,path:string,body?:unknown,idempotencyKey?:string)=>request<T>(handle,path,'POST',body,idempotencyKey),
  put:<T>(handle:string,path:string,body:unknown)=>request<T>(handle,path,'PUT',body),
  patch:<T>(handle:string,path:string,body:unknown)=>request<T>(handle,path,'PATCH',body),
  delete:<T>(handle:string,path:string,body?:unknown)=>request<T>(handle,path,'DELETE',body),
  clear:(handle:string)=>{csrfTokens.delete(handle);pending.delete(handle);},
};
