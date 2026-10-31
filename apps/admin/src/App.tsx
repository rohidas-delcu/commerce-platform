import { createContext, useContext, useRef, useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Box, Boxes, ChevronDown, CircleHelp, CreditCard, ExternalLink, Gift, Layers, LogOut, Menu, Package, Settings2, ShieldCheck, ShoppingBag, Store as StoreIcon, Tag, Users, X } from 'lucide-react';
import { api, ApiError, key } from './lib/api';
import { type MerchantAccount, type Page, type Store, pageItems } from './lib/types';
import { OverviewPage, ProductsPage, CollectionsPage, InventoryPage, OrdersPage, CouponsPage, PricingPage, TeamPage, StoreSettingsPage, FinancePage, ProfilePage } from './pages';

type Identity = { id: string; name: string; email: string; status?: string };
type StoreContextValue = { store: Store; stores: Store[]; accounts: MerchantAccount[]; reload: () => Promise<void> };
const StoreContext = createContext<StoreContextValue | null>(null);
export function useStoreContext() { const value = useContext(StoreContext); if (!value) throw new Error('Store context missing'); return value; }

export function ErrorNotice({error}: {error: unknown}) {
  if (!error) return null;
  return <div className="notice error" role="alert">{error instanceof Error ? error.message : 'Something went wrong. Please try again.'}</div>;
}
export function InfoNotice({children}: {children: ReactNode}) {return <div className="notice info">{children}</div>;}
export function Loading({text='Loading workspace…'}: {text?: string}) { return <div className="loading" role="status"><span className="spinner"/>{text}</div>; }
export function PageHead({eyebrow,title,subtitle,children}: {eyebrow:string;title:string;subtitle:string;children?:ReactNode}) {
  return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-desc">{subtitle}</p></div><div className="page-actions">{children}</div></div>;
}
export function Panel({title,subtitle,children,actions}: {title?:string;subtitle?:string;children:ReactNode;actions?:ReactNode}) {
  return <section className="panel">{title && <div className="panel-header"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{actions}</div>}<div className="panel-body">{children}</div></section>;
}
export function Status({value}: {value:string|undefined|null}) {const status=(value||'UNKNOWN').toUpperCase();const cls= /PAID|ACTIVE|PUBLISHED|SUCCEEDED|DELIVERED|COMPLETED|CONFIRMED/.test(status)?'success':/DRAFT|PENDING|DUE|UNKNOWN|REVIEW/.test(status)?'warning':/CANCELLED|FAILED|ARCHIVED|SUSPENDED/.test(status)?'danger':'neutral';return <span className={`badge ${cls}`}>{status.replaceAll('_',' ')}</span>;}

function Authentication({onAuthenticated}: {onAuthenticated:()=>void}) {
  const navigate=useNavigate(), location=useLocation();
  const [mode,setMode]=useState<'login'|'signup'|'verify'|'forgot'|'reset'>(()=>location.pathname.includes('signup')?'signup':location.pathname.includes('verify')?'verify':location.pathname.includes('forgot')?'forgot':location.pathname.includes('reset')?'reset':'login');
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[token,setToken]=useState(new URLSearchParams(location.search).get('token')||'');
  const [pending,setPending]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
  useEffect(()=>{const next=location.pathname.includes('signup')?'signup':location.pathname.includes('verify')?'verify':location.pathname.includes('forgot')?'forgot':location.pathname.includes('reset')?'reset':'login';setMode(next);setError(null);},[location.pathname]);
  const changeMode=(screen:typeof mode)=>{setMode(screen);setError(null);setNotice('');navigate(`/${screen}`);};
  async function submit(event:FormEvent) {
    event.preventDefault();setPending(true);setError(null);setNotice('');
    try {
      if(mode==='login'){await api.post('/v1/auth/login',{email,password});onAuthenticated();navigate('/app');}
      if(mode==='signup'){
        if(password!==confirm)throw new Error('Passwords do not match.');
        await api.post('/v1/auth/signup',{email,password,name});
        changeMode('verify');setNotice('Check your email for a one-time verification link or token.');
      }
      if(mode==='verify'){await api.post('/v1/auth/verification/confirm',{token});changeMode('login');setNotice('Email verified. Sign in to continue.');}
      if(mode==='forgot'){await api.post('/v1/auth/password/forgot',{email});changeMode('reset');setNotice('If the address is registered, a password reset email will arrive.');}
      if(mode==='reset'){if(password!==confirm)throw new Error('Passwords do not match.');await api.post('/v1/auth/password/reset',{token,password});changeMode('login');setNotice('Password reset. Sign in to continue.');}
    }catch(e){setError(e);}finally{setPending(false);}
  }
  const title={login:'Welcome back',signup:'Start your own store',verify:'Verify your email',forgot:'Forgot your password?',reset:'Choose a new password'}[mode];
  return <div className="auth-layout"><div className="auth-visual"><div className="auth-logo"><span className="brand-mark">c.</span><span>commerce<strong>studio</strong></span></div><div><span className="auth-kicker">THE MERCHANT WORKSPACE</span><h2>Everything your business needs, in one beautiful place.</h2><p>Build a store, curate your catalog, manage every order and keep moving.</p><div className="auth-art"><span>Live store insights</span><div className="auth-art-bars"><i/><i/><i/><i/><i/><i/></div></div></div><span className="auth-footnote">Your products. Your customers. Your brand.</span></div>
    <main className="auth-main"><div className="auth-card"><div className="mobile-logo"><span className="brand-mark">c.</span> Commerce Studio</div><p className="eyebrow">SECURE MERCHANT ACCESS</p><h1>{title}</h1><p className="page-desc">{mode==='login'?'Sign in to manage your store and keep business moving.':mode==='signup'?'Create your merchant account. Verify your email to get started.':mode==='verify'?'Use the single-use token delivered by email.':mode==='forgot'?'We will send reset instructions if the address exists.':'Enter the token from your reset email and a strong new password.'}</p>
      {notice&&<div className="notice success" role="status">{notice}</div>}<ErrorNotice error={error}/>
      <form onSubmit={submit} className="form-stack">
        {mode==='signup'&&<label>Full name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name"/></label>}
        {['signup','login','forgot'].includes(mode)&&<label>Email address<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@business.com"/></label>}
        {['verify','reset'].includes(mode)&&<label>One-time email token<input required value={token} onChange={e=>setToken(e.target.value.trim())} autoComplete="off" placeholder="Paste your email token"/></label>}
        {['login','signup','reset'].includes(mode)&&<label>{mode==='reset'?'New password':'Password'}<input required type="password" minLength={mode==='login'?1:15} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='login'?'Enter your password':'At least 15 characters'}/></label>}
        {['signup','reset'].includes(mode)&&<label>Confirm password<input required minLength={15} maxLength={128} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password"/></label>}
        <button className="btn primary full" disabled={pending} type="submit">{pending?'Please wait…':({login:'Sign in to workspace',signup:'Create account',verify:'Verify email',forgot:'Send reset instructions',reset:'Update password'})[mode]}</button>
      </form>
      <div className="auth-links">{mode==='login'?<><button className="link" onClick={()=>changeMode('forgot')}>Forgot password?</button><span>New here? <button className="link" onClick={()=>changeMode('signup')}>Create an account</button></span></>:<><button className="link" onClick={()=>changeMode('login')}>Back to sign in</button>{mode==='verify'&&<button className="link" onClick={async()=>{try{await api.post('/v1/auth/verification/resend',{email});setNotice('If eligible, a new verification email will be sent.');}catch(e){setError(e);}}}>Resend verification</button>}</>}</div>
      <p className="auth-small">Real verification and password recovery are email-based. This UI never uses demo credentials.</p>
    </div></main></div>;
}

function Setup({accounts,onReload}: {accounts:MerchantAccount[];onReload:()=>Promise<void>}) {
  const navigate=useNavigate(),[accountId,setAccountId]=useState(accounts[0]?.id||''),[accountName,setAccountName]=useState(''),[name,setName]=useState(''),[handle,setHandle]=useState(''),[country,setCountry]=useState('IN'),[currency,setCurrency]=useState('INR');
  const [invitationToken,setInvitationToken]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState<unknown>(null);
  const createAttempt=useRef<{payload:string;idempotencyKey:string}|null>(null);
  useEffect(()=>{if(!accountId&&accounts[0])setAccountId(accounts[0].id)},[accounts,accountId]);
  async function submit(e:FormEvent) {e.preventDefault();setPending(true);setError(null);try{
    let id=accountId;
    if(!id){
      const a=await api.post<MerchantAccount>('/v1/merchant/accounts',{name:accountName});
      id=a.id;
      // Account creation is not idempotent. Retain the newly created account if
      // the subsequent store request fails, so retry cannot create duplicates.
      setAccountId(id);
      await onReload();
    }
    const payload={merchantId:id,name,handle,countryCode:country,currencyCode:currency};
    const fingerprint=JSON.stringify(payload);
    if(createAttempt.current?.payload!==fingerprint){createAttempt.current={payload:fingerprint,idempotencyKey:key('store')};}
    await api.post('/v1/merchant/stores',payload,createAttempt.current.idempotencyKey);
    await onReload();navigate('/app/settings');
  }catch(e){setError(e)}finally{setPending(false)}}
  return <div className="setup-layout"><div className="setup-card"><span className="brand-mark">c.</span><p className="eyebrow">LET'S GET YOUR BUSINESS READY</p><h1>Set up a store</h1><p>Start with the essentials. Configure payments and shipping before publishing.</p><ErrorNotice error={error}/><form className="form-stack" onSubmit={submit}>
    {accounts.length?<label>Merchant account<select value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}<option value="">Create another account…</option></select></label>:null}
    {!accountId&&<label>Business / account name<input value={accountName} onChange={e=>setAccountName(e.target.value)} required placeholder="My company"/></label>}
    <label>Store name<input required value={name} onChange={e=>{setName(e.target.value);if(!handle)setHandle(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));}} maxLength={100} placeholder="My Store"/></label>
    <label>Store handle<input required value={handle} onChange={e=>setHandle(e.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" minLength={3} maxLength={63} placeholder="my-store"/></label>
    <div className="two-col"><label>Market<select value={country} onChange={e=>{const next=e.target.value;setCountry(next);setCurrency(({IN:'INR',US:'USD',GB:'GBP',CA:'CAD',AU:'AUD'} as Record<string,string>)[next]);}}><option value="IN">India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="AU">Australia</option></select></label><label>Currency<input readOnly value={currency}/></label></div>
    <button className="btn primary full" disabled={pending}>{pending?'Creating store…':'Create store & continue'}</button>
  </form><div className="section-divider"/><h3>Joining an existing team?</h3><p>Paste the token from your merchant invitation to join their account and store.</p><form className="form-stack" onSubmit={async e=>{e.preventDefault();setPending(true);setError(null);try{await api.post('/v1/merchant/invitations/accept',{token:invitationToken});await onReload();navigate('/app');}catch(e){setError(e)}finally{setPending(false)}}}><label>Invitation token<input required minLength={43} maxLength={43} value={invitationToken} onChange={e=>setInvitationToken(e.target.value)}/></label><button className="btn" disabled={pending}>Accept invitation</button></form></div></div>;
}

const navigation=[
  {to:'/app',label:'Overview',icon:BarChart3,end:true},
  {to:'/app/orders',label:'Orders',icon:ShoppingBag},
  {to:'/app/products',label:'Products',icon:Package},
  {to:'/app/collections',label:'Collections',icon:Layers},
  {to:'/app/inventory',label:'Inventory',icon:Boxes},
  {to:'/app/discounts',label:'Discounts',icon:Tag},
];
const settingsNav=[
  {to:'/app/settings',label:'Store settings',icon:Settings2},
  {to:'/app/pricing',label:'Shipping & payments',icon:CreditCard},
  {to:'/app/team',label:'Team & invites',icon:Users},
  {to:'/app/finance',label:'Payments & refunds',icon:Gift},
];

function Workspace({identity,stores,accounts,onReload,onLogout}: {identity:Identity;stores:Store[];accounts:MerchantAccount[];onReload:()=>Promise<void>;onLogout:()=>void}) {
  const [storeId,setStoreId]=useState(()=>localStorage.getItem('commerce:active-store')||''),[menuOpen,setMenuOpen]=useState(false);
  const navigate=useNavigate(),location=useLocation();const store=stores.find(s=>s.id===storeId)||stores[0];
  useEffect(()=>{if(store?.id) {setStoreId(store.id);localStorage.setItem('commerce:active-store',store.id);}},[store?.id]);
  if(!store) return <Setup accounts={accounts} onReload={onReload}/>;
  const value:StoreContextValue={store,stores,accounts,reload:onReload};
  const item=({to,label,icon:Icon,end}: typeof navigation[number])=><NavLink key={to} to={to} end={end} onClick={()=>setMenuOpen(false)} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={18}/><span>{label}</span></NavLink>;
  return <StoreContext.Provider value={value}><div className="app-shell"><aside className={`sidebar ${menuOpen?'mobile-open':''}`}><div className="sidebar-brand"><span className="brand-mark">c.</span><div><div className="logo-name">commerce<span>studio</span></div><small className="logo-sub">Merchant workspace</small></div><button aria-label="Close navigation" className="mobile-close" onClick={()=>setMenuOpen(false)}><X size={20}/></button></div>
    <label className="store-picker"><span className="store-avatar">{store.name.slice(0,2).toUpperCase()}</span><span className="store-picker-copy"><strong>{store.name}</strong><small>{store.status==='PUBLISHED'?'Published':'Unpublished'} · {store.currencyCode}</small></span><ChevronDown size={16}/><select aria-label="Select active store" value={store.id} onChange={e=>{setStoreId(e.target.value);localStorage.setItem('commerce:active-store',e.target.value);navigate('/app');}}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <nav aria-label="Merchant navigation"><p className="sidebar-label">WORKSPACE</p>{navigation.map(item)}<p className="sidebar-label">MANAGEMENT</p>{settingsNav.map(item)}</nav><div className="sidebar-bottom"><div className="help-card"><strong>Keep your store moving</strong><p>Changes to your published catalog are reflected through the headless storefront API.</p><NavLink to="/app/settings">Review store setup →</NavLink></div></div>
  </aside>{menuOpen&&<button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}
  <div className="main-area"><header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><span className="breadcrumb">Workspace</span><span className="breadcrumb-divider">/</span><strong>{location.pathname.split('/').at(-1)==='app'?'Overview':location.pathname.split('/').at(-1)}</strong></div><div className="top-actions"><span className="top-status"><span className={`status-dot ${store.status==='PUBLISHED'?'live':''}`}/>{store.status==='PUBLISHED'?'Live':'Draft'}</span><NavLink className="btn small" to="/app/profile">{identity.name||identity.email}</NavLink><button className="icon-button" aria-label="Sign out" onClick={onLogout}><LogOut size={18}/></button></div></header>
    <main className="app-content"><div className="store-status-ribbon"><span><ShieldCheck size={16}/> <strong>{store.name}</strong> · {store.status==='PUBLISHED'?'Published storefront':'Store is not published yet'}</span><div><a target="_blank" rel="noreferrer" href={`/v1/storefront/${store.handle}`} title="Public JSON metadata endpoint">Public API <ExternalLink size={13}/></a><NavLink to="/app/settings">Store setup</NavLink></div></div><Outlet/></main>
  </div></div></StoreContext.Provider>;
}

export default function App() {
  const queryClient=useQueryClient(),navigate=useNavigate();
  const [signedOut,setSignedOut]=useState(false);
  useEffect(()=>{
    const expired=()=>{api.clearSession();queryClient.clear();setSignedOut(true);navigate('/login');};
    window.addEventListener('commerce:session-expired',expired);
    return()=>window.removeEventListener('commerce:session-expired',expired);
  },[queryClient,navigate]);
  const me=useQuery({queryKey:['merchant','me'],queryFn:()=>api.get<Identity>('/v1/auth/me'),enabled:!signedOut,retry:false});
  const authenticated=!signedOut&&!!me.data;
  const accounts=useQuery({queryKey:['merchant','accounts'],queryFn:()=>api.get<Page<MerchantAccount>>('/v1/merchant/accounts?limit=100'),enabled:authenticated,retry:false});
  const stores=useQuery({queryKey:['merchant','stores'],queryFn:()=>api.get<Page<Store>>('/v1/merchant/stores?limit=100'),enabled:authenticated,retry:false});
  const loading=(!signedOut && me.isPending) || (authenticated && (accounts.isPending || stores.isPending));
  const onReload=async()=>{await Promise.all([queryClient.invalidateQueries({queryKey:['merchant','accounts']}),queryClient.invalidateQueries({queryKey:['merchant','stores']})]);};
  const onAuthenticated=()=>{setSignedOut(false);void queryClient.invalidateQueries({queryKey:['merchant']});};
  const onLogout=async()=>{try{await api.post('/v1/auth/logout');}catch(e){if(!(e instanceof ApiError && e.status===401)){console.warn('Logout failed',e);return;}}api.clearSession();setSignedOut(true);queryClient.clear();queryClient.setQueryData(['merchant','me'],null);navigate('/login');};
  if(loading) return <Loading/>;
  if(!authenticated) return <Routes><Route path="*" element={<Authentication onAuthenticated={onAuthenticated}/>}/></Routes>;
  if(accounts.error||stores.error) return <div className="setup-layout"><Panel title="Unable to open your workspace"><ErrorNotice error={accounts.error||stores.error}/><button className="btn" onClick={onReload}>Try again</button></Panel></div>;
  return <Routes>
    <Route path="/setup" element={<Setup accounts={pageItems(accounts.data)} onReload={onReload}/>}/>
    <Route path="/app" element={<Workspace identity={me.data} accounts={pageItems(accounts.data)} stores={pageItems(stores.data)} onReload={onReload} onLogout={onLogout}/> }>
      <Route index element={<OverviewPage/>}/>
      <Route path="products" element={<ProductsPage/>}/>
      <Route path="collections" element={<CollectionsPage/>}/>
      <Route path="inventory" element={<InventoryPage/>}/>
      <Route path="orders" element={<OrdersPage/>}/>
      <Route path="discounts" element={<CouponsPage/>}/>
      <Route path="settings" element={<StoreSettingsPage/>}/>
      <Route path="pricing" element={<PricingPage/>}/>
      <Route path="team" element={<TeamPage/>}/>
      <Route path="finance" element={<FinancePage/>}/>
      <Route path="profile" element={<ProfilePage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/app" replace/>}/>
  </Routes>;
}
