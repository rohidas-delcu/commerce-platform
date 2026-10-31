import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient,type UseQueryResult} from '@tanstack/react-query';
import {Link,NavLink,Navigate,Outlet,Route,Routes,useParams} from 'react-router-dom';
import {ArrowRight,Menu,Package,ShoppingBag,UserRound,X} from 'lucide-react';
import {api,ApiError,ensureCsrf} from './lib/api';
import {type Cart,type CheckoutOptions,type Profile,type Store} from './lib/types';
import {CatalogPage,ProductPage,CartPage,CheckoutPage,ConfirmationPage,AccountPage,OrdersPage,OrderPage} from './pages';

export function Notice({error,children}:{error?:unknown;children?:ReactNode}){
  if(!error&&!children)return null;
  return <div className={`notice ${error?'error':'info'}`} role={error?'alert':'status'}>{error instanceof Error?error.message:error?String(error):children}</div>;
}
export function Loading({label='Loading…'}:{label?:string}){return <div className="loading"><span className="spinner"/>{label}</div>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}){return <section className="empty"><Package size={36} strokeWidth={1.4}/><h2>{title}</h2><p>{description}</p>{children}</section>;}

interface ShopContext {
  handle:string;
  store:Store|null;
  profile:Profile|null;
  profileLoading:boolean;
  cart:Cart|null;
  cartLoading:boolean;
  cartError:unknown;
  options:CheckoutOptions|null;
  optionsError:unknown;
  refreshCart:()=>Promise<void>;
  mutateCart:(path:string,method:'POST'|'PUT'|'DELETE',data?:unknown)=>Promise<Cart>;
  login:(email:string,password:string)=>Promise<void>;
  logout:()=>Promise<void>;
}
const Context=createContext<ShopContext|null>(null);
export function useShop(){const shop=useContext(Context);if(!shop)throw new Error('Store context unavailable');return shop;}

function DiscoverStore(){
  const [handle,setHandle]=useState('');
  return <div className="discover"><div className="discover-card"><span className="wordmark">commerce<span>studio.</span></span><p className="eyebrow">INDEPENDENT STORES, BEAUTIFULLY CONNECTED</p><h1>Discover your favorite store.</h1><p>Each merchant has their own storefront. Enter the store handle shared by the merchant to begin.</p><form onSubmit={e=>{e.preventDefault();if(handle)window.location.assign(`/s/${handle}`);}}><label>Store handle<input required value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="e.g. northline-goods" minLength={1}/></label><button className="button primary">Continue <ArrowRight size={17}/></button></form><p className="smallprint">No store? Ask the merchant for their public storefront link.</p></div></div>;
}

function StoreHandleRoot(){
  const {handle=''}=useParams();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))return <Navigate to="/" replace/>;
  return <Storefront key={handle} handle={handle}/>;
}

function Storefront({handle}:{handle:string}){
  const qc=useQueryClient(),[menuOpen,setMenuOpen]=useState(false);
  const storeQuery=useQuery({queryKey:['shop',handle,'store'],queryFn:()=>api.get<Store>(handle,''),retry:false});
  const profileQuery=useQuery({queryKey:['shop',handle,'profile'],queryFn:async()=>{
    try{await ensureCsrf(handle);return await api.get<Profile>(handle,'/customer/profile');}
    catch(e){if(e instanceof ApiError && (e.status===401||e.status===404))return null;throw e;}
  },retry:false});
  const profile=profileQuery.data||null;
  const cartKey=['shop',handle,'cart',profile?.id||'guest'];
  const cartQuery:UseQueryResult<Cart,Error>=useQuery({queryKey:cartKey,enabled:!!storeQuery.data&&!!profileQuery.isSuccess,queryFn:async()=>{
    await ensureCsrf(handle);
    try{return await api.get<Cart>(handle,'/cart');}
    catch(e){if(e instanceof ApiError&&e.status===404)return api.post<Cart>(handle,'/cart');throw e;}
  },retry:false});
  const optionsQuery=useQuery({queryKey:['shop',handle,'options'],enabled:!!storeQuery.data,queryFn:()=>api.get<CheckoutOptions>(handle,'/checkout-options'),retry:false});
  async function refreshCart(){await qc.invalidateQueries({queryKey:['shop',handle,'cart']});}
  async function mutateCart(path:string,method:'POST'|'PUT'|'DELETE',data?:unknown){
    const result=await api[method.toLowerCase() as 'post'|'put'|'delete']<Cart>(handle,`/cart${path}`,data);
    qc.setQueryData(cartKey,result);
    return result;
  }
  async function login(email:string,password:string){
    const guest=profile?null:cartQuery.data;
    await api.post(handle,'/customer/auth/login',{email,password});
    const current=await api.get<Profile>(handle,'/customer/profile');
    qc.setQueryData(['shop',handle,'profile'],current);
    // Guest capability remains in an HttpOnly cookie. Merge once against the
    // authenticated cart using the pre-login version, never by copying client prices.
    if(guest?.items.length){
      const owned=await api.post<Cart>(handle,'/cart');
      await api.post<Cart>(handle,'/cart/merge',{expectedVersion:owned.version,guestVersion:guest.version});
    }
    await refreshCart();
  }
  async function logout(){
    await api.post(handle,'/customer/auth/logout');
    api.clear(handle);
    qc.setQueryData(['shop',handle,'profile'],null);
    qc.removeQueries({queryKey:['shop',handle,'cart']});
  }
  useEffect(()=>{setMenuOpen(false);},[handle]);
  const store=storeQuery.data||null;
  const brand=store?.branding.name||handle.replaceAll('-',' ');
  const count=cartQuery.data?.items.reduce((n,item)=>n+item.quantity,0)||0;
  const value:ShopContext={handle,store,profile,profileLoading:profileQuery.isPending,cart:cartQuery.data||null,cartLoading:cartQuery.isPending,cartError:cartQuery.error,options:optionsQuery.data||null,optionsError:optionsQuery.error,refreshCart,mutateCart,login,logout};
  const home=`/s/${handle}`;
  return <Context.Provider value={value}>
    <div className="announcement">Thoughtful finds, independent brands. <span>Shop with confidence.</span></div>
    <header className="shop-header"><div className="shop-header-inner">
      <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMenuOpen(true)}><Menu/></button>
      <Link to={home} className="shop-brand">{store?.branding.logo?<img className="shop-logo" src={store.branding.logo.url} alt={brand}/>:<span className="shop-icon">{brand.slice(0,1).toUpperCase()}</span>}<span>{brand}</span><small>EST. FOR EVERYDAY</small></Link>
      <nav className="main-nav" aria-label="Store navigation"><NavLink to={home} end>Home</NavLink><NavLink to={home+'?view=all'}>Shop all</NavLink><NavLink to={home+'?view=collections'}>Collections</NavLink></nav>
      <div className="shop-actions"><Link className="icon-button" aria-label="Customer account" to={`${home}/account/${profile?'orders':'login'}`}><UserRound size={21}/></Link><Link className="icon-button cart-trigger" aria-label={`Cart with ${count} items`} to={`${home}/cart`}><ShoppingBag size={21}/>{count>0&&<b>{count}</b>}</Link></div>
    </div></header>
    {menuOpen&&<div className="mobile-nav-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false)}}><nav aria-label="Mobile store navigation"><button className="icon-button" onClick={()=>setMenuOpen(false)} aria-label="Close menu"><X/></button><Link onClick={()=>setMenuOpen(false)} to={home}>Home</Link><Link onClick={()=>setMenuOpen(false)} to={home+'?view=all'}>Shop all</Link><Link onClick={()=>setMenuOpen(false)} to={home+'?view=collections'}>Collections</Link><Link onClick={()=>setMenuOpen(false)} to={`${home}/account/orders`}>Your orders</Link></nav></div>}
    <main className="shop-main">
      {storeQuery.isPending?<Loading label="Opening storefront…"/>:<>
        {!store&&<Notice error={storeQuery.error||new Error('Shopping is currently unavailable. Existing customers can still access their receipts.')}/>}
        <Outlet/>
      </>}
    </main>
    <footer className="shop-footer"><div><Link className="footer-brand" to={home}>{brand}</Link><p>Great products. A personal shopping experience.</p></div><div><h4>Explore</h4><Link to={home}>Shop</Link><Link to={`${home}/cart`}>Your bag</Link></div><div><h4>Need help?</h4><Link to={`${home}/account/orders`}>Order history</Link><Link to={`${home}/account/login`}>Your account</Link></div><div><h4>Powered by</h4><span>Commerce Studio</span><small>Store-managed sales and fulfillment</small></div></footer>
    <div className="footer-bottom">© {new Date().getFullYear()} {brand} · Secure customer accounts and store-scoped orders</div>
  </Context.Provider>;
}

export default function App(){
  return <Routes>
    <Route path="/" element={<DiscoverStore/>}/>
    <Route path="/s/:handle" element={<StoreHandleRoot/>}>
      <Route index element={<CatalogPage/>}/>
      <Route path="products/:productHandle" element={<ProductPage/>}/>
      <Route path="cart" element={<CartPage/>}/>
      <Route path="checkout" element={<CheckoutPage/>}/>
      <Route path="checkout/:checkoutId" element={<ConfirmationPage/>}/>
      <Route path="account/:screen" element={<AccountPage/>}/>
      <Route path="account/orders" element={<OrdersPage/>}/>
      <Route path="account/orders/:orderId" element={<OrderPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
