import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,Navigate,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,CheckCircle2,ClipboardList,LogOut,Package,ShieldCheck,UserRound} from 'lucide-react';
import {Empty,Loading,Notice,useShop} from '../App';
import {api} from '../lib/api';
import {money,type Order,type Profile} from '../lib/types';

function AuthFrame({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){
  return <div className="auth-page"><div className="auth-panel"><div className="auth-heading"><span className="round-icon"><UserRound size={24}/></span><p className="eyebrow">YOUR STORE ACCOUNT</p><h1>{title}</h1><p>{subtitle}</p></div>{children}</div><aside className="auth-aside"><span className="eyebrow">THOUGHTFUL SHOPPING</span><h2>Every order,<br/><em>all in one place.</em></h2><p>Track your purchases, update your account details and make your next checkout even simpler.</p><div className="auth-aside-icon"><Package size={110} strokeWidth={0.7}/></div></aside></div>;
}
function AuthForm({children,onSubmit,busy,submit}:{children:ReactNode;onSubmit:(e:FormEvent)=>void;busy:boolean;submit:string}){
  return <form className="auth-form" onSubmit={onSubmit}>{children}<button className="button primary full big" disabled={busy}>{busy?'Please wait…':submit} <ArrowRight size={17}/></button></form>;
}
function PasswordField({value,onChange,autoComplete='current-password',label='Password'}:{value:string;onChange:(v:string)=>void;autoComplete?:string;label?:string}){
  return <label>{label}<input type="password" minLength={label==='Password'&&autoComplete==='current-password'?1:15} maxLength={128} autoComplete={autoComplete} value={value} onChange={e=>onChange(e.target.value)} required/></label>;
}
export function AccountPage(){
  const {screen='login'}=useParams(),[search]=useSearchParams(),navigate=useNavigate(),qc=useQueryClient();
  const {handle,profile,profileLoading,login,logout,store}=useShop();
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[token,setToken]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
  const next=search.get('next')==='checkout'?`/s/${handle}/checkout`:`/s/${handle}/account/orders`;
  useEffect(()=>{setError(null);setNotice('');setPassword('');setToken('');},[screen]);
  useEffect(()=>{if(profile){setName(profile.name);setEmail(profile.email);}},[profile?.id]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError(null);setNotice('');try{
    if(screen==='login'){await login(email,password);navigate(next,{replace:true});}
    else if(screen==='signup'){await api.post(handle,'/customer/auth/signup',{name,email,password});setPassword('');navigate(`/s/${handle}/account/verify?email=${encodeURIComponent(email)}${search.get('next')==='checkout'?'&next=checkout':''}`);}
    else if(screen==='verify'){await api.post(handle,'/customer/auth/verification/confirm',{token});setNotice('Email verified. You can now sign in.');setPassword('');setToken('');}
    else if(screen==='forgot'){await api.post(handle,'/customer/auth/password/forgot',{email});setNotice('If this email has an account, recovery instructions have been sent.');}
    else if(screen==='reset'){await api.post(handle,'/customer/auth/password/reset',{token,password});setNotice('Password updated. Please sign in.');setPassword('');setToken('');}
    else if(screen==='profile'){const p=await api.patch<Profile>(handle,'/customer/profile',{name});qc.setQueryData(['shop',handle,'profile'],p);setNotice('Your name has been updated.');}
    else if(screen==='security'){await api.post(handle,'/customer/auth/password/change',{currentPassword,password});setCurrentPassword('');setPassword('');setNotice('Password changed. Other sessions may be revoked by your account policy.');}
  }catch(err){setError(err)}finally{setBusy(false)}}
  async function resend(){setBusy(true);setError(null);try{await api.post(handle,'/customer/auth/verification/resend',{email:email||search.get('email')});setNotice('If an unverified account exists, another verification email has been sent.');}catch(err){setError(err)}finally{setBusy(false)}}
  if(profileLoading)return <Loading label="Checking your account…"/>;
  if(!profile&&['profile','security'].includes(screen))return <Navigate to={`/s/${handle}/account/login`} replace/>;
  if(profile&&['login','signup'].includes(screen))return <Navigate to={next} replace/>;
  if(!store&&screen==='signup')return <Empty title="Registration unavailable" description="This store is not accepting new accounts at the moment."/>;
  const titles:Record<string,[string,string,string]>={login:['Welcome back','Sign in to see your orders and complete checkout.','Sign in'],signup:['Create your account','Use a 15-character or longer password. Verify your email to activate your account.','Create account'],verify:['Verify your email','Enter the verification token from the email sent to you.','Verify email'],forgot:['Reset your password','Enter your email to request a password reset link.','Send reset instructions'],reset:['Set a new password','Enter the recovery token from your email and a new 15-character or longer password.','Reset password'],profile:['Your profile','Keep your customer details up to date.','Save changes'],security:['Account security','Choose a long, unique password for this store account.','Change password']};
  const config=titles[screen];if(!config)return <Navigate to={`/s/${handle}/account/login`} replace/>;
  return <AuthFrame title={config[0]} subtitle={config[1]}><Notice error={error}/>{notice&&<Notice>{notice}</Notice>}
    <AuthForm onSubmit={submit} busy={busy} submit={config[2]}>
      {['signup','profile'].includes(screen)&&<label>Full name<input required minLength={1} maxLength={100} value={name} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>}
      {['login','signup','forgot'].includes(screen)&&<label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      {['verify','reset'].includes(screen)&&<label>Email token<input required minLength={43} maxLength={43} autoComplete="one-time-code" value={token} onChange={e=>setToken(e.target.value.trim())} placeholder="Paste the token from your email"/></label>}
      {screen==='security'&&<PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword}/>}
      {['login','signup','reset','security'].includes(screen)&&<PasswordField label={screen==='login'?'Password':'New password'} autoComplete={screen==='login'?'current-password':'new-password'} value={password} onChange={setPassword}/>}
    </AuthForm>
    <div className="auth-links">{screen==='login'?<><Link to={`/s/${handle}/account/forgot`}>Forgot password?</Link>{store&&<Link to={`/s/${handle}/account/signup${search.get('next')==='checkout'?'?next=checkout':''}`}>Create an account</Link>}</>:null}
      {screen==='verify'&&<><button className="text-button" disabled={busy} onClick={resend}>Resend verification email</button><Link to={`/s/${handle}/account/login${search.get('next')==='checkout'?'?next=checkout':''}`}>Sign in after verification</Link></>}
      {screen==='forgot'&&<Link to={`/s/${handle}/account/reset`}>I already have a reset token</Link>}
      {['signup','forgot','reset'].includes(screen)&&<Link to={`/s/${handle}/account/login`}>Back to sign in</Link>}
      {['profile','security'].includes(screen)&&<><Link to={`/s/${handle}/account/orders`}>Your orders</Link><Link to={`/s/${handle}/account/${screen==='profile'?'security':'profile'}`}>{screen==='profile'?'Change password':'Edit profile'}</Link></>}
    </div>
    {profile&&<button className="text-button danger auth-logout" disabled={busy} onClick={async()=>{setBusy(true);try{await logout();navigate(`/s/${handle}/account/login`)}catch(e){setError(e)}finally{setBusy(false)}}}><LogOut size={15}/> Sign out</button>}
  </AuthFrame>;
}

function OrderStatus({order}:{order:Order}){return <div className="order-statuses"><span className="status-chip"><ClipboardList size={14}/> {order.status}</span><span className="status-chip"><Package size={14}/> {order.fulfillmentStatus}</span><span className="status-chip"><ShieldCheck size={14}/> Payment {order.paymentStatus}</span></div>}
export function OrdersPage(){
  const {handle,profile,profileLoading}=useShop(),[offset,setOffset]=useState(0);
  const {data,error,isPending}=useQuery({queryKey:['shop',handle,'orders',profile?.id,offset],enabled:!!profile,queryFn:()=>api.get<{items:Order[];nextOffset:number|null}>(handle,`/customer/orders?limit=20&offset=${offset}`),retry:false});
  if(profileLoading)return <Loading/>;
  if(!profile)return <Empty title="Sign in for order history" description="Only the customer who placed an order can view its details."><Link className="button primary" to={`/s/${handle}/account/login`}>Sign in</Link></Empty>;
  return <section className="account-content"><div className="section-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Order history</h1><p>Welcome, {profile.name}. View your purchases and fulfillment updates.</p></div><Link className="text-button" to={`/s/${handle}/account/profile`}>Manage profile <ArrowRight size={17}/></Link></div><Notice error={error}/>{isPending?<Loading/>:<><div className="order-list">{data?.items.map(order=><Link className="order-tile" key={order.id} to={`/s/${handle}/account/orders/${order.id}`}><div><p className="eyebrow">ORDER #{order.number}</p><h3>{new Date(order.createdAt).toLocaleDateString()}</h3><OrderStatus order={order}/></div><div className="order-amount"><strong>{money(order.totalMinor,order.currencyCode)}</strong><ArrowRight size={19}/></div></Link>)}</div>{!data?.items.length&&<Empty title="No orders yet" description="Your purchase history will appear here after checkout."><Link className="button primary" to={`/s/${handle}`}>Start shopping</Link></Empty>}<div className="pager"><button className="button outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</button><span>Page {Math.floor(offset/20)+1}</span><button className="button outline" disabled={data?.nextOffset==null} onClick={()=>setOffset(data!.nextOffset!)}>Next</button></div></>}
  </section>;
}

export function OrderPage(){
  const {orderId=''}=useParams(),{handle,profile,profileLoading}=useShop();
  const {data:order,error,isPending}=useQuery({queryKey:['shop',handle,'order',profile?.id,orderId],enabled:!!profile,queryFn:()=>api.get<Order>(handle,`/customer/orders/${orderId}`),retry:false});
  const refunds=useQuery({queryKey:['shop',handle,'refunds',orderId],enabled:!!order,queryFn:()=>api.get<{items:Array<{id:string;status:string;amountMinor:string;createdAt:string}>}>(handle,`/customer/orders/${orderId}/refunds?limit=50`),retry:false});
  if(profileLoading)return <Loading/>;
  if(!profile)return <Empty title="Sign in to view this order" description="Orders are visible only to their verified customer."><Link className="button primary" to={`/s/${handle}/account/login`}>Sign in</Link></Empty>;
  if(isPending)return <Loading label="Loading order…"/>;
  if(error||!order)return <Empty title="Order not found" description="This order may not belong to your account."><Notice error={error}/></Empty>;
  return <section className="account-content order-detail"><Link className="text-button" to={`/s/${handle}/account/orders`}><ArrowLeft size={17}/> All orders</Link><div className="section-heading"><div><p className="eyebrow">ORDER DETAILS</p><h1>Order #{order.number}</h1><p>Placed {new Date(order.createdAt).toLocaleString()}</p></div><strong className="order-total-head">{money(order.totalMinor,order.currencyCode)}</strong></div><OrderStatus order={order}/>
    <div className="order-detail-grid"><div className="checkout-panel"><h2>Items</h2>{order.items.map(item=><div className="order-item" key={item.id}><span><strong>{item.productName}</strong><small>{item.variantName} × {item.quantity}</small></span><b>{money(item.subtotalMinor,order.currencyCode)}</b></div>)}<div className="price-breakdown"><div className="summary-line"><span>Subtotal</span><strong>{money(order.subtotalMinor||'0',order.currencyCode)}</strong></div><div className="summary-line"><span>Shipping</span><strong>{money(order.shippingMinor||'0',order.currencyCode)}</strong></div><div className="summary-line"><span>Tax</span><strong>{money(order.taxMinor||'0',order.currencyCode)}</strong></div><div className="summary-line total"><span>Total</span><strong>{money(order.totalMinor,order.currencyCode)}</strong></div></div></div>
      <div className="checkout-panel"><h2>Delivery and payment</h2><strong>{order.shippingAddress.name}</strong><p>{order.shippingAddress.line1}<br/>{order.shippingAddress.line2&&<>{order.shippingAddress.line2}<br/></>}{order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}<br/>{order.shippingAddress.countryCode}<br/>{order.shippingAddress.phone}</p><div className="section-divider"/><p>Method: <strong>{order.paymentMethod}</strong></p><p>Paid: <strong>{money(order.paidMinor,order.currencyCode)}</strong></p><p>Due: <strong>{money(order.amountDueMinor,order.currencyCode)}</strong></p><p>Refunded: <strong>{money(order.refundedMinor,order.currencyCode)}</strong></p></div>
      <div className="checkout-panel"><h2>Order timeline</h2>{order.events.length?order.events.map(event=><div className="timeline-entry" key={event.id}><span className="timeline-dot"/><div><strong>{event.kind.replaceAll('_',' ')}</strong><small>{new Date(event.createdAt).toLocaleString()}</small>{event.carrier&&<p>{event.carrier} · {event.reference||'No tracking reference'}</p>}</div></div>):<p>No public events yet.</p>}</div>
      <div className="checkout-panel"><h2>Refunds</h2><Notice error={refunds.error}/>{refunds.isPending?<Loading/>:refunds.data?.items.length?refunds.data.items.map(refund=><div key={refund.id} className="summary-line"><span>{refund.status} · {new Date(refund.createdAt).toLocaleDateString()}</span><strong>{money(refund.amountMinor,order.currencyCode)}</strong></div>):<p>No refunds recorded.</p>}</div>
    </div><div className="order-thanks"><CheckCircle2 size={25}/> Thank you for shopping with this independent merchant.</div>
  </section>;
}
