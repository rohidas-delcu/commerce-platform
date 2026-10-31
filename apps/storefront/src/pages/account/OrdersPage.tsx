import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { money, type Order } from '../../lib/types';

function OrderStatus({ order }: { order: Order }) {
  return (
    <div className="order-statuses">
      <span className="status-chip">
        <ClipboardList size={14} /> {order.status}
      </span>
      <span className="status-chip">
        <Package size={14} /> {order.fulfillmentStatus}
      </span>
      <span className="status-chip">
        <ShieldCheck size={14} /> Payment {order.paymentStatus}
      </span>
    </div>
  );
}
export function OrdersPage() {
  const { handle, profile, profileLoading } = useShop(),
    [offset, setOffset] = useState(0);
  const { data, error, isPending } = useQuery({
    queryKey: ['shop', handle, 'orders', profile?.id, offset],
    enabled: !!profile,
    queryFn: () =>
      api.get<{ items: Order[]; nextOffset: number | null }>(
        handle,
        `/customer/orders?limit=20&offset=${offset}`,
      ),
    retry: false,
  });
  if (profileLoading) return <Loading />;
  if (!profile)
    return (
      <Empty
        title="Sign in for order history"
        description="Only the customer who placed an order can view its details."
      >
        <Link className="button primary" to={`/s/${handle}/account/login`}>
          Sign in
        </Link>
      </Empty>
    );
  return (
    <section className="account-content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Order history</h1>
          <p>Welcome, {profile.name}. View your purchases and fulfillment updates.</p>
        </div>
        <Link className="text-button" to={`/s/${handle}/account/profile`}>
          Manage profile <ArrowRight size={17} />
        </Link>
      </div>
      <Notice error={error} />
      {isPending ? (
        <Loading />
      ) : (
        <>
          <div className="order-list">
            {data?.items.map((order) => (
              <Link
                className="order-tile"
                key={order.id}
                to={`/s/${handle}/account/orders/${order.id}`}
              >
                <div>
                  <p className="eyebrow">ORDER #{order.number}</p>
                  <h3>{new Date(order.createdAt).toLocaleDateString()}</h3>
                  <OrderStatus order={order} />
                </div>
                <div className="order-amount">
                  <strong>{money(order.totalMinor, order.currencyCode)}</strong>
                  <ArrowRight size={19} />
                </div>
              </Link>
            ))}
          </div>
          {!data?.items.length && (
            <Empty
              title="No orders yet"
              description="Your purchase history will appear here after checkout."
            >
              <Link className="button primary" to={`/s/${handle}`}>
                Start shopping
              </Link>
            </Empty>
          )}
          <div className="pager">
            <button
              className="button outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Previous
            </button>
            <span>Page {Math.floor(offset / 20) + 1}</span>
            <button
              className="button outline"
              disabled={data?.nextOffset == null}
              onClick={() => setOffset(data!.nextOffset!)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function OrderPage() {
  const { orderId = '' } = useParams({ strict: false }),
    { handle, profile, profileLoading } = useShop();
  const {
    data: order,
    error,
    isPending,
  } = useQuery({
    queryKey: ['shop', handle, 'order', profile?.id, orderId],
    enabled: !!profile,
    queryFn: () => api.get<Order>(handle, `/customer/orders/${orderId}`),
    retry: false,
  });
  const refunds = useQuery({
    queryKey: ['shop', handle, 'refunds', orderId],
    enabled: !!order,
    queryFn: () =>
      api.get<{
        items: Array<{ id: string; status: string; amountMinor: string; createdAt: string }>;
      }>(handle, `/customer/orders/${orderId}/refunds?limit=50`),
    retry: false,
  });
  if (profileLoading) return <Loading />;
  if (!profile)
    return (
      <Empty
        title="Sign in to view this order"
        description="Orders are visible only to their verified customer."
      >
        <Link className="button primary" to={`/s/${handle}/account/login`}>
          Sign in
        </Link>
      </Empty>
    );
  if (isPending) return <Loading label="Loading order…" />;
  if (error || !order)
    return (
      <Empty title="Order not found" description="This order may not belong to your account.">
        <Notice error={error} />
      </Empty>
    );
  return (
    <section className="account-content order-detail">
      <Link className="text-button" to={`/s/${handle}/account/orders`}>
        <ArrowLeft size={17} /> All orders
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ORDER DETAILS</p>
          <h1>Order #{order.number}</h1>
          <p>Placed {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <strong className="order-total-head">{money(order.totalMinor, order.currencyCode)}</strong>
      </div>
      <OrderStatus order={order} />
      <div className="order-detail-grid">
        <div className="checkout-panel">
          <h2>Items</h2>
          {order.items.map((item) => (
            <div className="order-item" key={item.id}>
              <span>
                <strong>{item.productName}</strong>
                <small>
                  {item.variantName} × {item.quantity}
                </small>
              </span>
              <b>{money(item.subtotalMinor, order.currencyCode)}</b>
            </div>
          ))}
          <div className="price-breakdown">
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{money(order.subtotalMinor || '0', order.currencyCode)}</strong>
            </div>
            <div className="summary-line">
              <span>Shipping</span>
              <strong>{money(order.shippingMinor || '0', order.currencyCode)}</strong>
            </div>
            <div className="summary-line">
              <span>Tax</span>
              <strong>{money(order.taxMinor || '0', order.currencyCode)}</strong>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>{money(order.totalMinor, order.currencyCode)}</strong>
            </div>
          </div>
        </div>
        <div className="checkout-panel">
          <h2>Delivery and payment</h2>
          <strong>{order.shippingAddress.name}</strong>
          <p>
            {order.shippingAddress.line1}
            <br />
            {order.shippingAddress.line2 && (
              <>
                {order.shippingAddress.line2}
                <br />
              </>
            )}
            {order.shippingAddress.city}, {order.shippingAddress.region}{' '}
            {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.countryCode}
            <br />
            {order.shippingAddress.phone}
          </p>
          <div className="section-divider" />
          <p>
            Method: <strong>{order.paymentMethod}</strong>
          </p>
          <p>
            Paid: <strong>{money(order.paidMinor, order.currencyCode)}</strong>
          </p>
          <p>
            Due: <strong>{money(order.amountDueMinor, order.currencyCode)}</strong>
          </p>
          <p>
            Refunded: <strong>{money(order.refundedMinor, order.currencyCode)}</strong>
          </p>
        </div>
        <div className="checkout-panel">
          <h2>Order timeline</h2>
          {order.events.length ? (
            order.events.map((event) => (
              <div className="timeline-entry" key={event.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{event.kind.replaceAll('_', ' ')}</strong>
                  <small>{new Date(event.createdAt).toLocaleString()}</small>
                  {event.carrier && (
                    <p>
                      {event.carrier} · {event.reference || 'No tracking reference'}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>No public events yet.</p>
          )}
        </div>
        <div className="checkout-panel">
          <h2>Refunds</h2>
          <Notice error={refunds.error} />
          {refunds.isPending ? (
            <Loading />
          ) : refunds.data?.items.length ? (
            refunds.data.items.map((refund) => (
              <div key={refund.id} className="summary-line">
                <span>
                  {refund.status} · {new Date(refund.createdAt).toLocaleDateString()}
                </span>
                <strong>{money(refund.amountMinor, order.currencyCode)}</strong>
              </div>
            ))
          ) : (
            <p>No refunds recorded.</p>
          )}
        </div>
      </div>
      <div className="order-thanks">
        <CheckCircle2 size={25} /> Thank you for shopping with this independent merchant.
      </div>
    </section>
  );
}
