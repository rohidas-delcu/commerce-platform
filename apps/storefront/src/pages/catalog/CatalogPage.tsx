import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Package,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { money, type Catalog, type Collections, type Product } from '../../lib/types';

export function ProductCard({
  product,
  handle,
  currency,
}: {
  product: Product;
  handle: string;
  currency: string;
}) {
  const first = product.variants.find((v) => v.available);
  return (
    <Link className="product-card" to={`/s/${handle}/products/${product.handle}`}>
      <div className="product-image">
        {product.images?.[0]?.url ? (
          <img
            loading="lazy"
            src={product.images[0].url}
            alt={product.images[0].altText || product.name}
          />
        ) : (
          <span className="image-placeholder">
            <Package size={35} strokeWidth={1} />
            <small>Image coming soon</small>
          </span>
        )}
        {product.compareMinor && BigInt(product.compareMinor) > BigInt(product.priceMinor) && (
          <span className="product-tag">SPECIAL PRICE</span>
        )}
        <span className="product-image-action">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="product-info">
        <span>{product.collection || 'The collection'}</span>
        <h3>{product.name}</h3>
        <div className="price-line">
          <strong>{money(product.priceMinor, currency)}</strong>
          {product.compareMinor && BigInt(product.compareMinor) > BigInt(product.priceMinor) && (
            <del>{money(product.compareMinor, currency)}</del>
          )}
        </div>
        <small>{first ? 'Explore options' : 'Temporarily out of stock'}</small>
      </div>
    </Link>
  );
}

export function CatalogPage() {
  const { handle, store } = useShop(),
    location = useLocation(),
    navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  function setParams(next: URLSearchParams | Record<string, string>) {
    const values = next instanceof URLSearchParams ? next : new URLSearchParams(next);
    void navigate({ to: location.pathname, search: Object.fromEntries(values.entries()) });
  }
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0);
  const view = params.get('view') || '',
    collection = params.get('collection') || '';
  useEffect(() => {
    setOffset(0);
  }, [view, collection]);
  const catalog = useQuery<
    | Catalog
    | {
        products: Product[];
        pagination: Catalog['pagination'];
        collection: { name: string; description: string };
      }
  >({
    queryKey: ['shop', handle, 'catalog', view, collection, search, offset],
    enabled: !!store,
    queryFn: () => {
      if (collection)
        return api.get<{
          products: Product[];
          pagination: Catalog['pagination'];
          collection: { name: string; description: string };
        }>(handle, `/collections/${encodeURIComponent(collection)}?limit=24&offset=${offset}`);
      return api.get<Catalog>(
        handle,
        `/products?limit=24&offset=${offset}${search ? `&query=${encodeURIComponent(search)}` : ''}`,
      );
    },
  });
  const collections = useQuery({
    queryKey: ['shop', handle, 'collections'],
    enabled: !!store,
    queryFn: () => api.get<Collections>(handle, '/collections?limit=100'),
  });
  const items = catalog.data?.products || [],
    pagination = catalog.data?.pagination;
  const featured = items.find((p) => p.images?.[0]?.url) || items[0];
  if (!store)
    return (
      <Empty
        title="This store is not currently selling"
        description="The storefront may be unpublished or unavailable. Existing customers can still sign in to view their order history."
      />
    );
  return (
    <>
      {!view && !collection && !search && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">THE {store.branding.name.toUpperCase()} EDIT</p>
            <span className="hero-line" />
            <h1>
              Considered pieces.
              <br />
              <em>Everyday living.</em>
            </h1>
            <p>
              Explore the latest finds from {store.branding.name}. Made for the things that matter
              to you.
            </p>
            <a className="button primary" href="#shop-products">
              Shop the collection <ArrowRight size={18} />
            </a>
            <div className="hero-note">
              <span>01 / 01</span>
              <span>Curated by an independent merchant</span>
            </div>
          </div>
          <div className="hero-visual">
            {featured?.images?.[0]?.url ? (
              <img src={featured.images[0].url} alt={featured.name} />
            ) : (
              <div className="hero-placeholder">
                <ShoppingBag size={70} strokeWidth={0.8} />
                <span>Thoughtfully selected for you</span>
              </div>
            )}
            <span className="hero-pill">DISCOVER WHAT'S NEW</span>
          </div>
        </section>
      )}
      <section className="shop-section" id="shop-products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MADE FOR YOUR DAY-TO-DAY</p>
            <h2>
              {collection
                ? catalog.data && 'collection' in catalog.data
                  ? catalog.data.collection.name
                  : 'Collection'
                : view === 'collections'
                  ? 'Shop by collection'
                  : search
                    ? 'Search results'
                    : 'The collection'}
            </h2>
            <p>
              {collection
                ? catalog.data && 'collection' in catalog.data
                  ? catalog.data.collection.description
                  : ''
                : view === 'collections'
                  ? 'Find what speaks to your style.'
                  : 'Good things are worth finding.'}
            </p>
          </div>
          <div className="section-heading-append">
            {collection && (
              <button
                className="text-button"
                onClick={() => {
                  params.delete('collection');
                  setParams(params);
                }}
              >
                <ChevronLeft size={17} /> All products
              </button>
            )}
          </div>
        </div>
        {view === 'collections' && !collection ? (
          <>
            <Notice error={collections.error} />
            {collections.isPending ? (
              <Loading />
            ) : (
              <div className="collection-grid">
                {collections.data?.collections.map((c, index) => (
                  <button
                    key={c.id}
                    className="collection-tile"
                    onClick={() => setParams({ view: 'collections', collection: c.handle })}
                  >
                    <span className="collection-index">
                      COLLECTION {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3>{c.name}</h3>
                    <p>{c.description || 'Explore this collection'}</p>
                    <ArrowUpRight size={21} />
                  </button>
                ))}
                {!collections.data?.collections.length && (
                  <Empty
                    title="Collections coming soon"
                    description="Browse the full product catalog while new collections are prepared."
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {!collection && (
              <form
                className="catalog-tools"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOffset(0);
                }}
              >
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search products"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setOffset(0);
                    }}
                    placeholder="Find something you'll love"
                  />
                </label>
                <span>{items.length} products shown</span>
              </form>
            )}
            <Notice error={catalog.error} />
            {catalog.isPending ? (
              <Loading label="Finding products…" />
            ) : (
              <>
                <div className="product-grid">
                  {items.map((p) => (
                    <ProductCard
                      product={p}
                      key={p.id}
                      handle={handle}
                      currency={store.currencyCode}
                    />
                  ))}
                </div>
                {!items.length && (
                  <Empty
                    title="Nothing here just yet"
                    description="Try a different search or check back as the merchant updates this collection."
                  />
                )}
                <div className="pager">
                  <button
                    className="button outline"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 24))}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span>
                    Showing {offset + 1}–{offset + items.length}
                  </span>
                  <button
                    className="button outline"
                    disabled={pagination?.nextOffset == null}
                    onClick={() => setOffset(pagination!.nextOffset!)}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
      <section className="feature-strip">
        <div>
          <Heart strokeWidth={1.6} />
          <strong>Curated with care</strong>
          <p>Thoughtfully selected products from this independent store.</p>
        </div>
        <div>
          <ShoppingBag strokeWidth={1.6} />
          <strong>Checkout with confidence</strong>
          <p>Secure account access and a clear order history.</p>
        </div>
        <div>
          <Package strokeWidth={1.6} />
          <strong>Know your order</strong>
          <p>Order status and delivery updates from the merchant.</p>
        </div>
      </section>
    </>
  );
}
