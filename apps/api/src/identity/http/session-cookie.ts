export interface CookieResponse {setHeader(name:string,value:string):void;}
export function hostCookie(response:CookieResponse,baseName:string,value:string,maxAge:number){
  if(!/^[a-z0-9_-]+$/.test(baseName)||!Number.isSafeInteger(maxAge)||maxAge<0)throw new Error('Invalid cookie configuration.');
  const production=process.env.NODE_ENV==='production',name=production?'__Host-'+baseName:baseName;
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Set-Cookie',`${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${production?'; Secure':''}`);
}
export function sessionCookie(response:CookieResponse,value:string,csrf:string,clear=false,baseName='delcu_session'){
  hostCookie(response,baseName,clear?'':value,clear?0:1800);return{csrfToken:csrf};
}
