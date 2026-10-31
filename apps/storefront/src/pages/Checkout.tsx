import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,LockKeyhole,ShieldCheck} from 'lucide-react';
import {Empty,Loading,Notice,useShop} from '../App';
import {api} from '../lib/api';
import {key,money,type Address,type Checkout,type Order,type Payment} from '../lib/types';

type Quote={subtotalMinor:string;discountMinor:string;shippingMinor:string;taxMinor:string;totalMinor:string;currencyCode:string;estimate:boolean};
const countries=[{code:'IN',name:'India'},{code:'US',name:'United States'},{code:'GB',name:'United Kingdom'},{code:'CA',name:'Canada'},{code:'AU',name:'Australia'}];
export function PriceBreakdown({totals,currency}:{totals:Pick<Quote,'subtotalMinor'|'discountMinor'|'shippingMinor'|'taxMinor'|'totalMinor'>;currency:string}){
  return <div className="price-breakdown"><div className="summary-line"><span>Subtotal</span><strong>{money(totals.subtotalMinor,currency)}</strong></div><div className="summary-line"><span>Discount</span><strong>−{money(totals.discountMinor,currency)}</strong></div><div className="summary-line"><span>Shipping</span><strong>{money(totals.shippingMinor,currency)}</strong></div><div className="summary-line"><span>Tax</span><strong>{money(totals.taxMinor,currency)}</strong></div><div className="summary-line total"><span>Total</span><strong>{money(totals.totalMinor,currency)}</strong></div></div>;
}
function initialAddress(countryCode:string,name:string):Address{return{name,line1:'',line2:'',city:'',region:'',postalCode:'',countryCode,phone:''};}
function AddressFields({address,onChange}:{address:Address;onChange:(a:Address)=>void}){
  function set(field:keyof Address,value:string){onChange({...address,[field]:value});}
  return <div className="address-fields">
    <label>Full name<input required autoComplete="name" maxLength={100} value={address.name} onChange={e=>set('name',e.target.value)}/></label>
    <label>Address line 1<input required autoComplete="address-line1" maxLength={200} value={address.line1} onChange={e=>set('line1',e.target.value)}/></label>
    <label>Address line 2 (optional)<input autoComplete="address-line2" maxLength={200} value={address.line2||''} onChange={e=>set('line2',e.target.value)}/></label>
    <div className="field-row"><label>City<input required autoComplete="address-level2" maxLength={100} value={address.city} onChange={e=>set('city',e.target.value)}/></label><label>State / region<input required autoComplete="address-level1" maxLength={100} value={address.region} onChange={e=>set('region',e.target.value)}/></label></div>
    <div className="field-row"><label>Postal code<input required autoComplete="postal-code" maxLength={100} value={address.postalCode} onChange={e=>set('postalCode',e.target.value)}/></label><label>Country<select value={address.countryCode} autoComplete="country" onChange={e=>set('countryCode',e.target.value)}>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label></div>
    <label>Contact phone<input required type="tel" autoComplete="tel" pattern="[+0-9 ()-]{7,30}" value={address.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 98765 43210"/></label>
  </div>;
}

export function CheckoutPage(){
  const {handle,store,profile,profileLoading,cart,cartLoading,options,optionsError}=useShop();
  const navigate=useNavigate(),qc=useQueryClient();
  const [address,setAddress]=useState<Address>(()=>initialAddress(store?.countryCode||'IN',profile?.name||''));
  const [email,setEmail]=useState(profile?.email||''),[methodId,setMethodId]=useState('');
  const [quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
  const attempt=useRef<{cart:string;version:number;id:string}|null>(null);
  useEffect(()=>{if(profile){setEmail(profile.email);setAddress(a=>({...a,name:a.name||profile.name}));}},[profile?.id]);
  useEffect(()=>{if(store)setAddress(a=>({...a,countryCode:store.countryCode}));},[store?.countryCode]);
  useEffect(()=>{if(options){setMethodId(current=>options.shipping.some(m=>m.id===current)?current:options.shipping[0]?.id||'');}},[options]);
  useEffect(()=>{setQuote(null);},[address,methodId,cart?.version]);
  const permitted=options?.shipping.filter(m=>m.countries.includes(address.countryCode))||[];
  const shippingMethod=permitted.find(m=>m.id===methodId);
  async function review(e:FormEvent){
    e.preventDefault();if(!profile||!cart||!shippingMethod||!email)return;
    setError(null);setBusy(true);
    try{
      // The estimate is informational. A separate server-side READY snapshot
      // and stock hold is required before the customer can place an order.
      const estimate=await api.post<Quote>(handle,'/cart/quote',{expectedVersion:cart.version,shippingMethodId:methodId,shippingAddress:address});
      setQuote(estimate);
      if(!attempt.current||attempt.current.cart!==cart.id||attempt.current.version!==cart.version)attempt.current={cart:cart.id,version:cart.version,id:key('checkout')};
      const draft=await api.post<Checkout>(handle,'/customer/checkouts',{cartId:cart.id,expectedCartVersion:cart.version},attempt.current.id);
      if(draft.status==='COMPLETED'&&draft.orderId){navigate(`/s/${handle}/account/orders/${draft.orderId}`);return;}
      if(!['DRAFT','READY'].includes(draft.status))throw new Error('This checkout has closed. Please review the bag and try again.');
      const configured=await api.patch<Checkout>(handle,`/customer/checkouts/${draft.id}`,{expectedVersion:draft.version,contactEmail:email.trim(),contactName:address.name.trim(),shippingMethodId:methodId,shippingAddress:address,billingSameAsShipping:true});
      const ready=await api.post<Checkout>(handle,`/customer/checkouts/${draft.id}/reserve`,{expectedVersion:configured.version});
      if(ready.status!=='READY'||!ready.snapshot)throw new Error('The server could not reserve this checkout.');
      qc.setQueryData(['shop',handle,'checkout',ready.id],ready);
      navigate(`/s/${handle}/checkout/${ready.id}`);
    }catch(err){setError(err)}finally{setBusy(false)}
  }
  if(!store)return <Empty title="Checkout unavailable" description="This store cannot accept new orders at the moment."/>;
  if(profileLoading||cartLoading)return <Loading label="Preparing checkout…"/>;
  if(!profile)return <Empty title="Sign in to continue" description="A verified customer account is required to reserve inventory and complete your purchase."><Link className="button primary" to={`/s/${handle}/account/login?next=checkout`}>Customer sign in <ArrowRight size={17}/></Link><Link className="text-button" to={`/s/${handle}/account/signup?next=checkout`}>Create an account</Link></Empty>;
  if(!cart||!cart.items.length||!cart.valid)return <Empty title="Review your bag" description="Add valid products and resolve any stock or price changes before checkout."><Link className="button primary" to={`/s/${handle}/cart`}>Back to bag</Link></Empty>;
  return <section className="checkout-page"><div className="section-heading"><div><p className="eyebrow">SECURE CHECKOUT</p><h1>Delivery details</h1><p>Verify your address and review the full amount before placing your order.</p></div><Link to={`/s/${handle}/cart`} className="text-button"><ArrowLeft size={17}/> Back to bag</Link></div>
    <div className="checkout-layout"><form onSubmit={review} className="checkout-form"><div className="checkout-panel"><div className="checkout-panel-title"><span className="number-disc">01</span><h2>Contact</h2></div><label>Email address<input type="email" maxLength={254} required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label></div>
      <div className="checkout-panel"><div className="checkout-panel-title"><span className="number-disc">02</span><h2>Delivery address</h2></div><AddressFields address={address} onChange={setAddress}/></div>
      <div className="checkout-panel"><div className="checkout-panel-title"><span className="number-disc">03</span><h2>Shipping method</h2></div><Notice error={optionsError}/>{!permitted.length?<Notice error={new Error('No delivery method is available for this country. Choose an eligible destination or contact the merchant.')}/>:<div className="shipping-options">{permitted.map(m=><label key={m.id} className={`shipping-option ${methodId===m.id?'selected':''}`}><input type="radio" name="shipping" checked={methodId===m.id} onChange={()=>setMethodId(m.id)}/><span><strong>{m.name}</strong><small>Shipping rate is confirmed at review</small></span><b>{money(m.rateMinor,store.currencyCode)}</b></label>)}</div>}</div>
      <Notice error={error}/>{quote&&<Notice>Estimated total: {money(quote.totalMinor,quote.currencyCode)}. Your reserved, final quote will appear on the next screen.</Notice>}
      <button className="button primary full big" disabled={busy||!shippingMethod}>{busy?'Reserving your order…':'Review final order'} <ArrowRight size={17}/></button><p className="checkout-security"><LockKeyhole size={16}/> Nothing is charged at this step. Stock is reserved for a limited time.</p></form>
    <aside className="checkout-summary"><p className="eyebrow">YOUR ORDER</p><h2>{cart.items.length} {cart.items.length===1?'item':'items'}</h2>{cart.items.map(item=><div key={item.variantId} className="checkout-mini-item"><div className="cart-thumb">{item.images?.[0]?.url?<img src={item.images[0].url} alt={item.name}/>:<span>No image</span>}</div><span><strong>{item.name}</strong><small>{item.variantName} · Qty {item.quantity}</small></span><b>{money(item.subtotalMinor,store.currencyCode)}</b></div>)}<div className="summary-line total"><span>Before shipping and tax</span><strong>{money(cart.discountedSubtotalMinor,store.currencyCode)}</strong></div>{quote&&<PriceBreakdown totals={quote} currency={store.currencyCode}/>}<p className="checkout-security"><ShieldCheck size={16}/> Exact amounts and inventory come from the store server.</p></aside></div>
  </section>;
}

export function ConfirmationPage(){
  const {handle,options}=useShop(),{checkoutId=''}=useParams(),navigate=useNavigate(),qc=useQueryClient();
  const {data:checkout,error,isPending,refetch}=useQuery({queryKey:['shop',handle,'checkout',checkoutId],queryFn:()=>api.get<Checkout>(handle,`/customer/checkouts/${checkoutId}`),retry:false});
  const [busy,setBusy]=useState(false),[actionError,setActionError]=useState<unknown>(null),[payment,setPayment]=useState<Payment|null>(null);
  const codKey=useRef(key('place')),simKey=useRef(key('payment'));
  async function placeCod(){if(!checkout||checkout.status!=='READY')return;setBusy(true);setActionError(null);try{
    const order=await api.post<Order>(handle,`/customer/checkouts/${checkout.id}/place`,{expectedVersion:checkout.version,paymentMethod:'COD'},codKey.current);
    await qc.invalidateQueries({queryKey:['shop',handle,'cart']});navigate(`/s/${handle}/account/orders/${order.id}`,{replace:true});
  }catch(e){setActionError(e);await refetch()}finally{setBusy(false)}}
  async function simulate(){if(!checkout||checkout.status!=='READY')return;setBusy(true);setActionError(null);try{
    const p=await api.post<Payment>(handle,`/customer/checkouts/${checkout.id}/payments`,{expectedVersion:checkout.version,method:'SIMULATOR',scenario:'SUCCESS'},simKey.current);
    setPayment(p);if(p.orderId){navigate(`/s/${handle}/account/orders/${p.orderId}`,{replace:true});return;}await refetch();
  }catch(e){setActionError(e);await refetch()}finally{setBusy(false)}}
  async function reconcile(){if(!payment)return;setBusy(true);setActionError(null);try{
    const p=await api.post<Payment>(handle,`/customer/payments/${payment.id}/reconcile`);setPayment(p);
    if(p.orderId)navigate(`/s/${handle}/account/orders/${p.orderId}`,{replace:true});
  }catch(e){setActionError(e)}finally{setBusy(false)}}
  async function cancel(){if(!checkout||!['DRAFT','READY'].includes(checkout.status))return;setBusy(true);setActionError(null);try{await api.post(handle,`/customer/checkouts/${checkout.id}/cancel`,{expectedVersion:checkout.version});await qc.invalidateQueries({queryKey:['shop',handle,'cart']});navigate(`/s/${handle}/cart`);}catch(e){setActionError(e);await refetch()}finally{setBusy(false)}}
  if(isPending)return <Loading label="Loading reserved order…"/>;
  if(error||!checkout)return <Empty title="Unable to open checkout" description="The reservation may have expired or belongs to another customer."><Notice error={error}/></Empty>;
  if(checkout.status==='COMPLETED'&&checkout.orderId)return <Empty title="Order created" description="Your order has been recorded by the merchant."><Link className="button primary" to={`/s/${handle}/account/orders/${checkout.orderId}`}>View order <ArrowRight size={16}/></Link></Empty>;
  if(checkout.status!=='READY'||!checkout.snapshot)return <Empty title="Reservation not active" description={`Checkout is ${checkout.status.toLowerCase()}. Return to the bag to create a new checkout.`}><Link className="button primary" to={`/s/${handle}/cart`}>Back to bag</Link></Empty>;
  const totals=checkout.snapshot.totals,currency=checkout.snapshot.currencyCode;
  return <section className="checkout-page confirmation"><div className="section-heading"><div><p className="eyebrow">FINAL REVIEW</p><h1>Almost yours.</h1><p>Check the confirmed amount and delivery details before placing this order.</p></div><span className="reserve-chip"><Clock3 size={16}/> Reserved until {new Date(checkout.expiresAt).toLocaleTimeString()}</span></div>
    <div className="checkout-layout"><div className="checkout-form"><div className="checkout-panel"><div className="checkout-panel-title"><CheckCircle2 color="var(--green)"/><h2>Reserved order</h2></div>{checkout.snapshot.items.map((item,i)=><div className="summary-line" key={i}><span>{item.productName} · {item.variantName} × {item.quantity}</span><strong>{money(item.subtotalMinor,currency)}</strong></div>)}<PriceBreakdown totals={totals} currency={currency}/><p className="form-hint">Tax is {totals.taxInclusive?'included in':'added to'} item pricing. No payment has been collected.</p></div>
      <div className="checkout-panel"><h2>Delivery information</h2><strong>{checkout.contactName}</strong><p>{checkout.contactEmail}</p><p>{checkout.shippingAddress?.line1}, {checkout.shippingAddress?.line2} {checkout.shippingAddress?.city}, {checkout.shippingAddress?.region} {checkout.shippingAddress?.postalCode}</p><p>{checkout.snapshot.shippingMethodName}</p></div><Notice error={actionError}/><button className="text-button danger" disabled={busy} onClick={cancel}>Cancel reservation</button></div>
    <aside className="checkout-summary"><p className="eyebrow">CONFIRM PAYMENT</p><h2>{money(totals.totalMinor,currency)}</h2><p className="form-hint">Only payment methods enabled by this store can be used.</p>
      {options?.payments.cod&&<div className="payment-choice"><h3>Cash on delivery</h3><p>Order now. Payment is due on delivery; the merchant records collection later.</p><button className="button primary full" disabled={busy} onClick={placeCod}>{busy?'Processing…':'Place COD order'} <ArrowRight size={16}/></button></div>}
      {options?.payments.simulator&&<div className="payment-choice"><h3>Development simulator</h3><p>Test-only. No funds move and no real card is charged.</p><button className="button outline full" disabled={busy} onClick={simulate}>Run simulated payment</button></div>}
      {payment&&<div className="payment-choice"><p>Status: <strong>{payment.status}</strong>{payment.requiresReview?' · Needs review':''}</p><button className="button outline full" disabled={busy||!!payment.orderId} onClick={reconcile}>Recheck authoritative payment status</button></div>}
      {!options?.payments.cod&&!options?.payments.simulator&&<Notice error={new Error('No payment methods are currently available. Contact the merchant before continuing.')}/>}
      <p className="checkout-security"><LockKeyhole size={16}/> Order confirmation is created only by the backend after successful placement.</p>
    </aside></div>
  </section>;
}
