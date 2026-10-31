import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {ArrowRight,ArrowUpRight,ChevronLeft,ChevronRight,Heart,Package,Search,ShoppingBag} from 'lucide-react';
import {Empty,Loading,Notice,useShop} from '../App';
import {api} from '../lib/api';
import {money,type Catalog,type Collections,type Product} from '../lib/types';

export function ProductCard({product,handle,currency}:{product:Product;handle:string;currency:string}){
  const first=product.variants.find(v=>v.available);
  return <Link className="product-card" to={`/s/${handle}/products/${product.handle}`}>
    <div className="product-image">{product.images?.[0]?.url?<img loading="lazy" src={product.images[0].url} alt={product.images[0].altText||product.name}/>:<span className="image-placeholder"><Package size={35} strokeWidth={1}/><small>Image coming soon</small></span>}
      {product.compareMinor&&BigInt(product.compareMinor)>BigInt(product.priceMinor)&&<span className="product-tag">SPECIAL PRICE</span>}
      <span className="product-image-action"><ArrowUpRight size={18}/></span>
    </div>
    <div className="product-info"><span>{product.collection||'The collection'}</span><h3>{product.name}</h3><div className="price-line"><strong>{money(product.priceMinor,currency)}</strong>{product.compareMinor&&BigInt(product.compareMinor)>BigInt(product.priceMinor)&&<del>{money(product.compareMinor,currency)}</del>}</div><small>{first?'Explore options':'Temporarily out of stock'}</small></div>
  </Link>;
}

export function CatalogPage(){
  const {handle,store}=useShop(),[params,setParams]=useSearchParams();
  const [search,setSearch]=useState(''),[offset,setOffset]=useState(0);
  const view=params.get('view')||'',collection=params.get('collection')||'';
  useEffect(()=>{setOffset(0);},[view,collection]);
  const catalog=useQuery<Catalog|{products:Product[];pagination:Catalog['pagination'];collection:{name:string;description:string}}>({queryKey:['shop',handle,'catalog',view,collection,search,offset],enabled:!!store,queryFn:()=>{
    if(collection)return api.get<{products:Product[];pagination:Catalog['pagination'];collection:{name:string;description:string}}>(handle,`/collections/${encodeURIComponent(collection)}?limit=24&offset=${offset}`);
    return api.get<Catalog>(handle,`/products?limit=24&offset=${offset}${search?`&query=${encodeURIComponent(search)}`:''}`);
  }});
  const collections=useQuery({queryKey:['shop',handle,'collections'],enabled:!!store,queryFn:()=>api.get<Collections>(handle,'/collections?limit=100')});
  const items=catalog.data?.products||[],pagination=catalog.data?.pagination;
  const featured=items.find(p=>p.images?.[0]?.url)||items[0];
  if(!store)return <Empty title="This store is not currently selling" description="The storefront may be unpublished or unavailable. Existing customers can still sign in to view their order history."/>;
  return <>
    {!view&&!collection&&!search&&<section className="hero"><div className="hero-copy"><p className="eyebrow">THE {store.branding.name.toUpperCase()} EDIT</p><span className="hero-line"/><h1>Considered pieces.<br/><em>Everyday living.</em></h1><p>Explore the latest finds from {store.branding.name}. Made for the things that matter to you.</p><a className="button primary" href="#shop-products">Shop the collection <ArrowRight size={18}/></a><div className="hero-note"><span>01 / 01</span><span>Curated by an independent merchant</span></div></div><div className="hero-visual">{featured?.images?.[0]?.url?<img src={featured.images[0].url} alt={featured.name}/>:<div className="hero-placeholder"><ShoppingBag size={70} strokeWidth={0.8}/><span>Thoughtfully selected for you</span></div>}<span className="hero-pill">DISCOVER WHAT'S NEW</span></div></section>}
    <section className="shop-section" id="shop-products"><div className="section-heading"><div><p className="eyebrow">MADE FOR YOUR DAY-TO-DAY</p><h2>{collection?(catalog.data&&'collection'in catalog.data?catalog.data.collection.name:'Collection'):view==='collections'?'Shop by collection':search?'Search results':'The collection'}</h2><p>{collection?(catalog.data&&'collection'in catalog.data?catalog.data.collection.description:''):view==='collections'?'Find what speaks to your style.':'Good things are worth finding.'}</p></div><div className="section-heading-append">{collection&&<button className="text-button" onClick={()=>{params.delete('collection');setParams(params)}}><ChevronLeft size={17}/> All products</button>}</div></div>
      {view==='collections'&&!collection?<><Notice error={collections.error}/>{collections.isPending?<Loading/>:<div className="collection-grid">{collections.data?.collections.map((c,index)=><button key={c.id} className="collection-tile" onClick={()=>setParams({view:'collections',collection:c.handle})}><span className="collection-index">COLLECTION {String(index+1).padStart(2,'0')}</span><h3>{c.name}</h3><p>{c.description||'Explore this collection'}</p><ArrowUpRight size={21}/></button>)}{!collections.data?.collections.length&&<Empty title="Collections coming soon" description="Browse the full product catalog while new collections are prepared."/>}</div>}</>:<>
      {!collection&&<form className="catalog-tools" onSubmit={e=>{e.preventDefault();setOffset(0)}}><label className="search-field"><Search size={17}/><input aria-label="Search products" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}} placeholder="Find something you'll love"/></label><span>{items.length} products shown</span></form>}
      <Notice error={catalog.error}/>{catalog.isPending?<Loading label="Finding products…"/>:<><div className="product-grid">{items.map(p=><ProductCard product={p} key={p.id} handle={handle} currency={store.currencyCode}/>)}</div>{!items.length&&<Empty title="Nothing here just yet" description="Try a different search or check back as the merchant updates this collection."/>}<div className="pager"><button className="button outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-24))}><ChevronLeft size={16}/> Previous</button><span>Showing {offset+1}–{offset+items.length}</span><button className="button outline" disabled={pagination?.nextOffset==null} onClick={()=>setOffset(pagination!.nextOffset!)}>Next <ChevronRight size={16}/></button></div></>}
      </>}
    </section>
    <section className="feature-strip"><div><Heart strokeWidth={1.6}/><strong>Curated with care</strong><p>Thoughtfully selected products from this independent store.</p></div><div><ShoppingBag strokeWidth={1.6}/><strong>Checkout with confidence</strong><p>Secure account access and a clear order history.</p></div><div><Package strokeWidth={1.6}/><strong>Know your order</strong><p>Order status and delivery updates from the merchant.</p></div></section>
  </>;
}

export function ProductPage(){
  const {productHandle=''}=useParams(),{handle,store,cart,cartLoading,mutateCart}=useShop();
  const {data:product,error,isPending}=useQuery({queryKey:['shop',handle,'product',productHandle],enabled:!!store,queryFn:()=>api.get<Product>(handle,`/products/${encodeURIComponent(productHandle)}`)});
  const [variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState(1),[busy,setBusy]=useState(false),[actionError,setActionError]=useState<unknown>(null),[notice,setNotice]=useState('');
  useEffect(()=>{setVariantId(product?.variants.find(v=>v.available)?.id||product?.variants[0]?.id||'');setQuantity(1);setActionError(null);setNotice('');},[product?.id]);
  const variant=product?.variants.find(v=>v.id===variantId);
  async function add(){if(!variant||!cart)return;setBusy(true);setActionError(null);setNotice('');try{
    const owned=cart.items.find(item=>item.variantId===variant.id)?.quantity||0;
    const next=owned+quantity;if(next>variant.stock||next>999)throw new Error('Not enough available stock for this quantity.');
    await mutateCart(`/items/${variant.id}`,'PUT',{expectedVersion:cart.version,quantity:next});setNotice('Added to your bag. Your items will be reserved only at checkout.');
  }catch(e){setActionError(e)}finally{setBusy(false)}}
  if(!store)return <Empty title="Store unavailable" description="This product is not currently available for shopping."/>;
  if(isPending)return <Loading label="Loading product…"/>;
  if(error||!product)return <Empty title="Product unavailable" description="This product may have been removed from the public catalog."><Notice error={error}/></Empty>;
  return <div className="product-detail"><div className="product-detail-gallery">{product.images?.length?product.images.map(img=><div className="detail-image" key={img.id}><img src={img.url} alt={img.altText||product.name}/></div>):<div className="detail-image no-image"><Package size={70} strokeWidth={1}/><span>Image coming soon</span></div>}</div><div className="product-detail-side"><p className="eyebrow">{product.collection||store.branding.name}</p><h1>{product.name}</h1><div className="price-line large"><strong>{money(variant?.priceMinor||product.priceMinor,store.currencyCode)}</strong>{variant?.compareMinor&&<del>{money(variant.compareMinor,store.currencyCode)}</del>}</div><p className="product-description">{product.description||'Discover this product from the collection.'}</p><div className="section-divider"/><label className="field-label">Choose a variant<select aria-label="Product variant" value={variantId} onChange={e=>{setVariantId(e.target.value);setQuantity(1)}}>{product.variants.map(v=><option value={v.id} key={v.id} disabled={!v.available}>{v.name}{!v.available?' — Out of stock':''}</option>)}</select></label><div className="stock-line"><span className={variant?.available?'in-stock':'out-stock'}/>{variant?.available?`${variant.stock} available`:'Currently unavailable'}</div><label className="field-label">Quantity<input type="number" min={1} max={Math.min(999,variant?.stock||1)} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><Notice error={actionError}/>{notice&&<Notice>{notice}</Notice>}<button className="button primary full" disabled={!variant?.available||busy||cartLoading||!cart||quantity<1||quantity>variant.stock} onClick={add}><ShoppingBag size={18}/>{busy?'Adding…':'Add to bag'}</button><Link to={`/s/${handle}/cart`} className="button outline full">View your bag <ArrowRight size={16}/></Link><p className="smallprint">The merchant confirms fulfillment after purchase. Available stock is rechecked at checkout.</p></div></div>;
}
