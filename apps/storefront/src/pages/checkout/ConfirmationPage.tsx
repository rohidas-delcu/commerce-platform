import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { key, money, type Checkout, type Order, type Payment } from '../../lib/types';

import { PriceBreakdown } from './CheckoutPage';

export function ConfirmationPage() {
  const { handle, options } = useShop(),
    { checkoutId = '' } = useParams({ strict: false }),
    navigate = useNavigate(),
    qc = useQueryClient();
  const {
    data: checkout,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ['shop', handle, 'checkout', checkoutId],
    queryFn: () => api.get<Checkout>(handle, `/customer/checkouts/${checkoutId}`),
    retry: false,
  });
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<unknown>(null),
    [payment, setPayment] = useState<Payment | null>(null);
  const codKey = useRef(key('place')),
    simKey = useRef(key('payment'));
  async function placeCod() {
    if (!checkout || checkout.status !== 'READY') return;
    setBusy(true);
    setActionError(null);
    try {
      const order = await api.post<Order>(
        handle,
        `/customer/checkouts/${checkout.id}/place`,
        { expectedVersion: checkout.version, paymentMethod: 'COD' },
        codKey.current,
      );
      await qc.invalidateQueries({ queryKey: ['shop', handle, 'cart'] });
      navigate({ to: `/s/${handle}/account/orders/${order.id}`, replace: true });
    } catch (e) {
      setActionError(e);
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  async function simulate() {
    if (!checkout || checkout.status !== 'READY') return;
    setBusy(true);
    setActionError(null);
    try {
      const p = await api.post<Payment>(
        handle,
        `/customer/checkouts/${checkout.id}/payments`,
        { expectedVersion: checkout.version, method: 'SIMULATOR', scenario: 'SUCCESS' },
        simKey.current,
      );
      setPayment(p);
      if (p.orderId) {
        navigate({ to: `/s/${handle}/account/orders/${p.orderId}`, replace: true });
        return;
      }
      await refetch();
    } catch (e) {
      setActionError(e);
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  async function reconcile() {
    if (!payment) return;
    setBusy(true);
    setActionError(null);
    try {
      const p = await api.post<Payment>(handle, `/customer/payments/${payment.id}/reconcile`);
      setPayment(p);
      if (p.orderId) navigate({ to: `/s/${handle}/account/orders/${p.orderId}`, replace: true });
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!checkout || !['DRAFT', 'READY'].includes(checkout.status)) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(handle, `/customer/checkouts/${checkout.id}/cancel`, {
        expectedVersion: checkout.version,
      });
      await qc.invalidateQueries({ queryKey: ['shop', handle, 'cart'] });
      navigate({ to: `/s/${handle}/cart` });
    } catch (e) {
      setActionError(e);
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <Loading label="Loading reserved order…" />;
  if (error || !checkout)
    return (
      <Empty
        title="Unable to open checkout"
        description="The reservation may have expired or belongs to another customer."
      >
        <Notice error={error} />
      </Empty>
    );
  if (checkout.status === 'COMPLETED' && checkout.orderId)
    return (
      <Empty title="Order created" description="Your order has been recorded by the merchant.">
        <Link className="button primary" to={`/s/${handle}/account/orders/${checkout.orderId}`}>
          View order <ArrowRight size={16} />
        </Link>
      </Empty>
    );
  if (checkout.status !== 'READY' || !checkout.snapshot)
    return (
      <Empty
        title="Reservation not active"
        description={`Checkout is ${checkout.status.toLowerCase()}. Return to the bag to create a new checkout.`}
      >
        <Link className="button primary" to={`/s/${handle}/cart`}>
          Back to bag
        </Link>
      </Empty>
    );
  const totals = checkout.snapshot.totals,
    currency = checkout.snapshot.currencyCode;
  return (
    <section className="checkout-page confirmation">
      <div className="section-heading">
        <div>
          <p className="eyebrow">FINAL REVIEW</p>
          <h1>Almost yours.</h1>
          <p>Check the confirmed amount and delivery details before placing this order.</p>
        </div>
        <span className="reserve-chip">
          <Clock3 size={16} /> Reserved until {new Date(checkout.expiresAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="checkout-layout">
        <div className="checkout-form">
          <div className="checkout-panel">
            <div className="checkout-panel-title">
              <CheckCircle2 color="var(--green)" />
              <h2>Reserved order</h2>
            </div>
            {checkout.snapshot.items.map((item, i) => (
              <div className="summary-line" key={i}>
                <span>
                  {item.productName} · {item.variantName} × {item.quantity}
                </span>
                <strong>{money(item.subtotalMinor, currency)}</strong>
              </div>
            ))}
            <PriceBreakdown totals={totals} currency={currency} />
            <p className="form-hint">
              Tax is {totals.taxInclusive ? 'included in' : 'added to'} item pricing. No payment has
              been collected.
            </p>
          </div>
          <div className="checkout-panel">
            <h2>Delivery information</h2>
            <strong>{checkout.contactName}</strong>
            <p>{checkout.contactEmail}</p>
            <p>
              {checkout.shippingAddress?.line1}, {checkout.shippingAddress?.line2}{' '}
              {checkout.shippingAddress?.city}, {checkout.shippingAddress?.region}{' '}
              {checkout.shippingAddress?.postalCode}
            </p>
            <p>{checkout.snapshot.shippingMethodName}</p>
          </div>
          <Notice error={actionError} />
          <button className="text-button danger" disabled={busy} onClick={cancel}>
            Cancel reservation
          </button>
        </div>
        <aside className="checkout-summary">
          <p className="eyebrow">CONFIRM PAYMENT</p>
          <h2>{money(totals.totalMinor, currency)}</h2>
          <p className="form-hint">Only payment methods enabled by this store can be used.</p>
          {options?.payments.cod && (
            <div className="payment-choice">
              <h3>Cash on delivery</h3>
              <p>Order now. Payment is due on delivery; the merchant records collection later.</p>
              <button className="button primary full" disabled={busy} onClick={placeCod}>
                {busy ? 'Processing…' : 'Place COD order'} <ArrowRight size={16} />
              </button>
            </div>
          )}
          {options?.payments.simulator && (
            <div className="payment-choice">
              <h3>Development simulator</h3>
              <p>Test-only. No funds move and no real card is charged.</p>
              <button className="button outline full" disabled={busy} onClick={simulate}>
                Run simulated payment
              </button>
            </div>
          )}
          {payment && (
            <div className="payment-choice">
              <p>
                Status: <strong>{payment.status}</strong>
                {payment.requiresReview ? ' · Needs review' : ''}
              </p>
              <button
                className="button outline full"
                disabled={busy || !!payment.orderId}
                onClick={reconcile}
              >
                Recheck authoritative payment status
              </button>
            </div>
          )}
          {!options?.payments.cod && !options?.payments.simulator && (
            <Notice
              error={
                new Error(
                  'No payment methods are currently available. Contact the merchant before continuing.',
                )
              }
            />
          )}
          <p className="checkout-security">
            <LockKeyhole size={16} /> Order confirmation is created only by the backend after
            successful placement.
          </p>
        </aside>
      </div>
    </section>
  );
}
