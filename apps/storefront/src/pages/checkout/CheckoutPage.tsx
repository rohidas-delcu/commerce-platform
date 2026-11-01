import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { key, money, type Address, type Checkout } from '../../lib/types';

type Quote = {
  subtotalMinor: string;
  discountMinor: string;
  shippingMinor: string;
  taxMinor: string;
  totalMinor: string;
  currencyCode: string;
  estimate: boolean;
};
const countries = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
];
export function PriceBreakdown({
  totals,
  currency,
}: {
  totals: Pick<
    Quote,
    'subtotalMinor' | 'discountMinor' | 'shippingMinor' | 'taxMinor' | 'totalMinor'
  >;
  currency: string;
}) {
  return (
    <div className="price-breakdown">
      <div className="summary-line">
        <span>Subtotal</span>
        <strong>{money(totals.subtotalMinor, currency)}</strong>
      </div>
      <div className="summary-line">
        <span>Discount</span>
        <strong>−{money(totals.discountMinor, currency)}</strong>
      </div>
      <div className="summary-line">
        <span>Shipping</span>
        <strong>{money(totals.shippingMinor, currency)}</strong>
      </div>
      <div className="summary-line">
        <span>Tax</span>
        <strong>{money(totals.taxMinor, currency)}</strong>
      </div>
      <div className="summary-line total">
        <span>Total</span>
        <strong>{money(totals.totalMinor, currency)}</strong>
      </div>
    </div>
  );
}
function initialAddress(countryCode: string, name: string): Address {
  return {
    name,
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode,
    phone: '',
  };
}
function AddressFields({
  address,
  onChange,
}: {
  address: Address;
  onChange: (a: Address) => void;
}) {
  function set(field: keyof Address, value: string) {
    onChange({ ...address, [field]: value });
  }
  return (
    <div className="address-fields">
      <label>
        Full name
        <input
          required
          autoComplete="name"
          maxLength={100}
          value={address.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </label>
      <label>
        Address line 1
        <input
          required
          autoComplete="address-line1"
          maxLength={200}
          value={address.line1}
          onChange={(e) => set('line1', e.target.value)}
        />
      </label>
      <label>
        Address line 2 (optional)
        <input
          autoComplete="address-line2"
          maxLength={200}
          value={address.line2 || ''}
          onChange={(e) => set('line2', e.target.value)}
        />
      </label>
      <div className="field-row">
        <label>
          City
          <input
            required
            autoComplete="address-level2"
            maxLength={100}
            value={address.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </label>
        <label>
          State / region
          <input
            required
            autoComplete="address-level1"
            maxLength={100}
            value={address.region}
            onChange={(e) => set('region', e.target.value)}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Postal code
          <input
            required
            autoComplete="postal-code"
            maxLength={100}
            value={address.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
          />
        </label>
        <label>
          Country
          <select
            value={address.countryCode}
            autoComplete="country"
            onChange={(e) => set('countryCode', e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Contact phone
        <input
          required
          type="tel"
          autoComplete="tel"
          pattern="[+0-9 ()-]{7,30}"
          value={address.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+91 98765 43210"
        />
      </label>
    </div>
  );
}

export function CheckoutPage() {
  const { handle, store, profile, profileLoading, cart, cartLoading, options, optionsError } =
    useShop();
  const navigate = useNavigate(),
    qc = useQueryClient();
  const [address, setAddress] = useState<Address>(() =>
    initialAddress(store?.countryCode || 'IN', profile?.name || ''),
  );
  const [email, setEmail] = useState(profile?.email || ''),
    [methodId, setMethodId] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const attempt = useRef<{ cart: string; version: number; id: string } | null>(null);
  useEffect(() => {
    if (profile) {
      setEmail(profile.email);
      setAddress((a) => ({ ...a, name: a.name || profile.name }));
    }
  }, [profile]);
  useEffect(() => {
    if (store?.countryCode) setAddress((a) => ({ ...a, countryCode: store.countryCode }));
  }, [store?.countryCode]);
  useEffect(() => {
    if (options) {
      setMethodId((current) =>
        options.shipping.some((m) => m.id === current) ? current : options.shipping[0]?.id || '',
      );
    }
  }, [options]);
  useEffect(() => {
    setQuote(null);
  }, [address, methodId, cart?.version]);
  const permitted =
    options?.shipping.filter((m) => m.countries.includes(address.countryCode)) || [];
  const shippingMethod = permitted.find((m) => m.id === methodId);
  async function review(e: FormEvent) {
    e.preventDefault();
    if (!profile || !cart || !shippingMethod || !email) return;
    setError(null);
    setBusy(true);
    try {
      // The estimate is informational. A separate server-side READY snapshot
      // and stock hold is required before the customer can place an order.
      const estimate = await api.post<Quote>(handle, '/cart/quote', {
        expectedVersion: cart.version,
        shippingMethodId: methodId,
        shippingAddress: address,
      });
      setQuote(estimate);
      if (
        !attempt.current ||
        attempt.current.cart !== cart.id ||
        attempt.current.version !== cart.version
      )
        attempt.current = { cart: cart.id, version: cart.version, id: key('checkout') };
      const draft = await api.post<Checkout>(
        handle,
        '/customer/checkouts',
        { cartId: cart.id, expectedCartVersion: cart.version },
        attempt.current.id,
      );
      if (draft.status === 'COMPLETED' && draft.orderId) {
        navigate({ to: `/s/${handle}/account/orders/${draft.orderId}` });
        return;
      }
      if (!['DRAFT', 'READY'].includes(draft.status))
        throw new Error('This checkout has closed. Please review the bag and try again.');
      const configured = await api.patch<Checkout>(handle, `/customer/checkouts/${draft.id}`, {
        expectedVersion: draft.version,
        contactEmail: email.trim(),
        contactName: address.name.trim(),
        shippingMethodId: methodId,
        shippingAddress: address,
        billingSameAsShipping: true,
      });
      const ready = await api.post<Checkout>(handle, `/customer/checkouts/${draft.id}/reserve`, {
        expectedVersion: configured.version,
      });
      if (ready.status !== 'READY' || !ready.snapshot)
        throw new Error('The server could not reserve this checkout.');
      qc.setQueryData(['shop', handle, 'checkout', ready.id], ready);
      navigate({ to: `/s/${handle}/checkout/${ready.id}` });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  if (!store)
    return (
      <Empty
        title="Checkout unavailable"
        description="This store cannot accept new orders at the moment."
      />
    );
  if (profileLoading || cartLoading) return <Loading label="Preparing checkout…" />;
  if (!profile)
    return (
      <Empty
        title="Sign in to continue"
        description="A verified customer account is required to reserve inventory and complete your purchase."
      >
        <Link
          className="button primary"
          to={`/s/${handle}/account/login`}
          search={{ next: 'checkout' }}
        >
          Customer sign in <ArrowRight size={17} />
        </Link>
        <Link
          className="text-button"
          to={`/s/${handle}/account/signup`}
          search={{ next: 'checkout' }}
        >
          Create an account
        </Link>
      </Empty>
    );
  if (!cart || !cart.items.length || !cart.valid)
    return (
      <Empty
        title="Review your bag"
        description="Add valid products and resolve any stock or price changes before checkout."
      >
        <Link className="button primary" to={`/s/${handle}/cart`}>
          Back to bag
        </Link>
      </Empty>
    );
  return (
    <section className="checkout-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SECURE CHECKOUT</p>
          <h1>Delivery details</h1>
          <p>Verify your address and review the full amount before placing your order.</p>
        </div>
        <Link to={`/s/${handle}/cart`} className="text-button">
          <ArrowLeft size={17} /> Back to bag
        </Link>
      </div>
      <div className="checkout-layout">
        <form onSubmit={review} className="checkout-form">
          <div className="checkout-panel">
            <div className="checkout-panel-title">
              <span className="number-disc">01</span>
              <h2>Contact</h2>
            </div>
            <label>
              Email address
              <input
                type="email"
                maxLength={254}
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <div className="checkout-panel">
            <div className="checkout-panel-title">
              <span className="number-disc">02</span>
              <h2>Delivery address</h2>
            </div>
            <AddressFields address={address} onChange={setAddress} />
          </div>
          <div className="checkout-panel">
            <div className="checkout-panel-title">
              <span className="number-disc">03</span>
              <h2>Shipping method</h2>
            </div>
            <Notice error={optionsError} />
            {!permitted.length ? (
              <Notice
                error={
                  new Error(
                    'No delivery method is available for this country. Choose an eligible destination or contact the merchant.',
                  )
                }
              />
            ) : (
              <div className="shipping-options">
                {permitted.map((m) => (
                  <label
                    key={m.id}
                    className={`shipping-option ${methodId === m.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={methodId === m.id}
                      onChange={() => setMethodId(m.id)}
                    />
                    <span>
                      <strong>{m.name}</strong>
                      <small>Shipping rate is confirmed at review</small>
                    </span>
                    <b>{money(m.rateMinor, store.currencyCode)}</b>
                  </label>
                ))}
              </div>
            )}
          </div>
          <Notice error={error} />
          {quote && (
            <Notice>
              Estimated total: {money(quote.totalMinor, quote.currencyCode)}. Your reserved, final
              quote will appear on the next screen.
            </Notice>
          )}
          <button className="button primary full big" disabled={busy || !shippingMethod}>
            {busy ? 'Reserving your order…' : 'Review final order'} <ArrowRight size={17} />
          </button>
          <p className="checkout-security">
            <LockKeyhole size={16} /> Nothing is charged at this step. Stock is reserved for a
            limited time.
          </p>
        </form>
        <aside className="checkout-summary">
          <p className="eyebrow">YOUR ORDER</p>
          <h2>
            {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}
          </h2>
          {cart.items.map((item) => (
            <div key={item.variantId} className="checkout-mini-item">
              <div className="cart-thumb">
                {item.images?.[0]?.url ? (
                  <img src={item.images[0].url} alt={item.name} />
                ) : (
                  <span>No image</span>
                )}
              </div>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.variantName} · Qty {item.quantity}
                </small>
              </span>
              <b>{money(item.subtotalMinor, store.currencyCode)}</b>
            </div>
          ))}
          <div className="summary-line total">
            <span>Before shipping and tax</span>
            <strong>{money(cart.discountedSubtotalMinor, store.currencyCode)}</strong>
          </div>
          {quote && <PriceBreakdown totals={quote} currency={store.currencyCode} />}
          <p className="checkout-security">
            <ShieldCheck size={16} /> Exact amounts and inventory come from the store server.
          </p>
        </aside>
      </div>
    </section>
  );
}
