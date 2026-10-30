export interface CookieResponse {setHeader(name:string,value:string):void;}
export function sessionCookie(response:CookieResponse,value:string,csrf:string,clear=false,baseName='delcu_session'){
  if(!/^[a-z0-9_-]+$/.test(baseName))throw new Error('Invalid cookie configuration.');
  const production=process.env.NODE_ENV==='production',name=production?'__Host-'+baseName:baseName;
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Set-Cookie',`${name}=${clear?'':value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear?0:1800}${production?'; Secure':''}`);
  return{csrfToken:csrf};
}
