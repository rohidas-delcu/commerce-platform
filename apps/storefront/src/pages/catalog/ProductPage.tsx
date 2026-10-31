import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowRight, Package, ShoppingBag } from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { money, type Product } from '../../lib/types';

export function ProductPage() {
  const { productHandle = '' } = useParams({ strict: false }),
    { handle, store, cart, cartLoading, mutateCart } = useShop();
  const {
    data: product,
    error,
    isPending,
  } = useQuery({
    queryKey: ['shop', handle, 'product', productHandle],
    enabled: !!store,
    queryFn: () => api.get<Product>(handle, `/products/${encodeURIComponent(productHandle)}`),
  });
  const [variantId, setVariantId] = useState(''),
    [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setVariantId(product?.variants.find((v) => v.available)?.id || product?.variants[0]?.id || '');
    setQuantity(1);
    setActionError(null);
    setNotice('');
  }, [product?.id, product?.variants]);
  const variant = product?.variants.find((v) => v.id === variantId);
  async function add() {
    if (!variant || !cart) return;
    setBusy(true);
    setActionError(null);
    setNotice('');
    try {
      const owned = cart.items.find((item) => item.variantId === variant.id)?.quantity || 0;
      const next = owned + quantity;
      if (next > variant.stock || next > 999)
        throw new Error('Not enough available stock for this quantity.');
      await mutateCart(`/items/${variant.id}`, 'PUT', {
        expectedVersion: cart.version,
        quantity: next,
      });
      setNotice('Added to your bag. Your items will be reserved only at checkout.');
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!store)
    return (
      <Empty
        title="Store unavailable"
        description="This product is not currently available for shopping."
      />
    );
  if (isPending) return <Loading label="Loading product…" />;
  if (error || !product)
    return (
      <Empty
        title="Product unavailable"
        description="This product may have been removed from the public catalog."
      >
        <Notice error={error} />
      </Empty>
    );
  return (
    <div className="product-detail">
      <div className="product-detail-gallery">
        {product.images?.length ? (
          product.images.map((img) => (
            <div className="detail-image" key={img.id}>
              <img src={img.url} alt={img.altText || product.name} />
            </div>
          ))
        ) : (
          <div className="detail-image no-image">
            <Package size={70} strokeWidth={1} />
            <span>Image coming soon</span>
          </div>
        )}
      </div>
      <div className="product-detail-side">
        <p className="eyebrow">{product.collection || store.branding.name}</p>
        <h1>{product.name}</h1>
        <div className="price-line large">
          <strong>{money(variant?.priceMinor || product.priceMinor, store.currencyCode)}</strong>
          {variant?.compareMinor && <del>{money(variant.compareMinor, store.currencyCode)}</del>}
        </div>
        <p className="product-description">
          {product.description || 'Discover this product from the collection.'}
        </p>
        <div className="section-divider" />
        <label className="field-label">
          Choose a variant
          <select
            aria-label="Product variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setQuantity(1);
            }}
          >
            {product.variants.map((v) => (
              <option value={v.id} key={v.id} disabled={!v.available}>
                {v.name}
                {!v.available ? ' — Out of stock' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="stock-line">
          <span className={variant?.available ? 'in-stock' : 'out-stock'} />
          {variant?.available ? `${variant.stock} available` : 'Currently unavailable'}
        </div>
        <label className="field-label">
          Quantity
          <input
            type="number"
            min={1}
            max={Math.min(999, variant?.stock || 1)}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <Notice error={actionError} />
        {notice && <Notice>{notice}</Notice>}
        <button
          className="button primary full"
          disabled={
            !variant?.available ||
            busy ||
            cartLoading ||
            !cart ||
            quantity < 1 ||
            quantity > variant.stock
          }
          onClick={add}
        >
          <ShoppingBag size={18} />
          {busy ? 'Adding…' : 'Add to bag'}
        </button>
        <Link to={`/s/${handle}/cart`} className="button outline full">
          View your bag <ArrowRight size={16} />
        </Link>
        <p className="smallprint">
          The merchant confirms fulfillment after purchase. Available stock is rechecked at
          checkout.
        </p>
      </div>
    </div>
  );
}
