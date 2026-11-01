import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { ErrorNotice, InfoNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api, key } from '../../lib/api';
import { majorToMinor, minorToMoney, pageItems, type Order, type Page } from '../../lib/types';

const merchant = (id: string) => `/v1/merchant/stores/${id}`;

export function OrdersPage() {
  const { store } = useStoreContext(),
    [status, setStatus] = useState(''),
    [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setSelected(null);
    setStatus('');
    setQuery('');
    setOffset(0);
  }, [store.id]);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['orders', store.id, status, query, offset],
    queryFn: () =>
      api.get<Page<Order>>(
        `${merchant(store.id)}/orders?limit=25&offset=${offset}${status ? `&status=${status}` : ''}${query ? `&query=${encodeURIComponent(query)}` : ''}`,
      ),
  });
  return (
    <>
      <PageHead
        eyebrow="SALES OPERATIONS"
        title="Orders"
        subtitle="Follow each order from payment to dispatch and delivery. Financial history is preserved."
      >
        <button className="btn" onClick={() => refetch()}>
          Refresh orders
        </button>
      </PageHead>
      <Panel>
        <div className="table-tools">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search orders"
              placeholder="Search order number or customer"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <select
            aria-label="Filter orders"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All orders</option>
            <option>PLACED</option>
            <option>COMPLETED</option>
            <option>CANCELLED</option>
          </select>
        </div>
        <ErrorNotice error={error} />
        {isPending ? (
          <Loading text="Loading orders…" />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>TOTAL</th>
                    <th>PAYMENT</th>
                    <th>FULFILLMENT</th>
                    <th>PLACED</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems(data).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.number || o.id.slice(0, 8)}</strong>
                      </td>
                      <td>
                        <strong>{o.contactName || 'Customer'}</strong>
                        <small>{o.contactEmail || ''}</small>
                      </td>
                      <td>{minorToMoney(o.totalMinor, o.currencyCode || store.currencyCode)}</td>
                      <td>
                        <Status value={o.paymentStatus} />
                      </td>
                      <td>
                        <Status value={o.fulfillmentStatus} />
                      </td>
                      <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <button className="link" onClick={() => setSelected(o.id)}>
                          View order
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!pageItems(data).length && (
                    <tr>
                      <td colSpan={7} className="empty-table">
                        No orders match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {pageItems(data).length} orders (offset {offset})
              </span>
              <button
                className="btn small"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </button>
              <button
                className="btn small"
                disabled={data?.nextOffset == null}
                onClick={() => setOffset(data!.nextOffset!)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Panel>
      {selected && (
        <OrderDetails
          orderId={selected}
          storeId={store.id}
          currency={store.currencyCode}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}

function OrderDetails({
  orderId,
  storeId,
  currency,
  close,
}: {
  orderId: string;
  storeId: string;
  currency: string;
  close: () => void;
}) {
  const qc = useQueryClient(),
    {
      data: order,
      isPending,
      error,
    } = useQuery({
      queryKey: ['order', storeId, orderId],
      queryFn: () => api.get<Order>(`${merchant(storeId)}/orders/${orderId}`),
    });
  const [busy, setBusy] = useState(false),
    [commandError, setCommandError] = useState<unknown>(null),
    [carrier, setCarrier] = useState(''),
    [reference, setReference] = useState(''),
    [cancelReason, setCancelReason] = useState(''),
    [note, setNote] = useState(''),
    [refundAmount, setRefundAmount] = useState(''),
    [refundReference, setRefundReference] = useState('');
  const stableKeys = useRef<Record<string, string>>({});
  function commandKey(action: string, version: number) {
    const id = `${action}:${version}`;
    return (stableKeys.current[id] ||= key(`order-${action.toLowerCase()}`));
  }
  async function action(
    action:
      | 'ready'
      | 'dispatch'
      | 'deliver'
      | 'collect-cod'
      | 'cancel'
      | 'notes'
      | 'refunds/manual-cod'
      | 'refunds/provider',
    extra: Record<string, unknown> = {},
  ) {
    if (!order) return;
    setBusy(true);
    setCommandError(null);
    try {
      const command = commandKey(action, order.version);
      await api.post(`${merchant(storeId)}/orders/${order.id}/${action}`, {
        expectedVersion: order.version,
        key: command,
        ...extra,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['order', storeId, orderId] }),
        qc.invalidateQueries({ queryKey: ['orders', storeId] }),
      ]);
      delete stableKeys.current[`${action}:${order.version}`];
      setNote('');
    } catch (e) {
      setCommandError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="drawer wide" role="dialog" aria-modal="true" aria-label="Order details">
        <header>
          <h2>Order {order?.number || orderId.slice(0, 8)}</h2>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        {isPending ? (
          <Loading />
        ) : (
          <div className="drawer-form">
            <ErrorNotice error={error || commandError} />
            {order && (
              <>
                <div className="button-row">
                  <Status value={order.status} />
                  <Status value={order.paymentStatus} />
                  <Status value={order.fulfillmentStatus} />
                </div>
                <div className="summary-grid">
                  <div>
                    <small>Total</small>
                    <strong>
                      {minorToMoney(order.totalMinor, order.currencyCode || currency)}
                    </strong>
                  </div>
                  <div>
                    <small>Collected</small>
                    <strong>{minorToMoney(order.paidMinor, order.currencyCode || currency)}</strong>
                  </div>
                  <div>
                    <small>Outstanding</small>
                    <strong>
                      {minorToMoney(order.amountDueMinor, order.currencyCode || currency)}
                    </strong>
                  </div>
                  <div>
                    <small>Refunded</small>
                    <strong>
                      {minorToMoney(order.refundedMinor, order.currencyCode || currency)}
                    </strong>
                  </div>
                </div>
                <h3>Customer</h3>
                <p className="detail-copy">
                  {order.contactName || '—'} · {order.contactEmail || '—'}
                </p>
                <h3>Items</h3>
                {(order.items || []).map((i, index) => (
                  <div className="list-item" key={index}>
                    <div>
                      <strong>{i.productName || i.name || 'Product'}</strong>
                      <small>
                        {i.variantName || ''} · {i.sku || ''} · Qty {i.quantity}
                      </small>
                    </div>
                    <strong>
                      {minorToMoney(
                        i.subtotalMinor || i.totalMinor || '0',
                        order.currencyCode || currency,
                      )}
                    </strong>
                  </div>
                ))}
                <h3>Fulfillment</h3>
                {order.status === 'PLACED' && (
                  <>
                    <div className="button-row">
                      {order.fulfillmentStatus === 'UNFULFILLED' && (
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() => action('ready')}
                        >
                          Mark ready
                        </button>
                      )}
                      {order.fulfillmentStatus === 'READY' && (
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() => action('dispatch', { carrier, reference })}
                        >
                          Dispatch order
                        </button>
                      )}
                      {order.fulfillmentStatus === 'DISPATCHED' && (
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() => action('deliver')}
                        >
                          Mark delivered
                        </button>
                      )}
                    </div>
                    {order.fulfillmentStatus === 'READY' && (
                      <div className="two-col">
                        <label>
                          Carrier (optional)
                          <input
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Tracking reference (optional)
                          <input
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            maxLength={100}
                          />
                        </label>
                      </div>
                    )}
                  </>
                )}
                {order.paymentStatus === 'DUE' && order.fulfillmentStatus === 'DELIVERED' && (
                  <div className="notice warning">
                    <p>
                      Cash on delivery is still outstanding. Record receipt only after collecting
                      the exact amount.
                    </p>
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => {
                        if (confirm('Confirm you physically received the full COD amount?'))
                          void action('collect-cod', { amountMinor: order.amountDueMinor });
                      }}
                    >
                      Confirm cash received
                    </button>
                  </div>
                )}
                {order.status === 'PLACED' &&
                  ['UNFULFILLED', 'READY'].includes(order.fulfillmentStatus || '') &&
                  ['DUE', 'NOT_REQUIRED', 'REFUNDED'].includes(order.paymentStatus || '') && (
                    <div className="form-stack">
                      <label>
                        Cancellation reason
                        <input
                          value={cancelReason}
                          maxLength={500}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                      </label>
                      <button
                        className="btn danger"
                        disabled={busy || !cancelReason.trim()}
                        onClick={() => {
                          if (confirm('Cancel order and restore stock?'))
                            void action('cancel', { reason: cancelReason });
                        }}
                      >
                        Cancel order
                      </button>
                    </div>
                  )}
                <div className="section-divider" />
                <h3>Refunds</h3>
                <InfoNotice>
                  Refund records are irreversible financial actions. The simulator is not a real
                  payment gateway.
                </InfoNotice>
                <div className="two-col">
                  <label>
                    Amount to refund
                    <input
                      value={refundAmount}
                      placeholder="0.00"
                      onChange={(e) => setRefundAmount(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    Internal reference
                    <input
                      value={refundReference}
                      onChange={(e) => setRefundReference(e.target.value)}
                      placeholder="Receipt / refund reference"
                      maxLength={150}
                    />
                  </label>
                </div>
                <div className="button-row">
                  {order.paymentMethod === 'COD' &&
                    order.paymentStatus &&
                    ['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus) && (
                      <button
                        className="btn danger"
                        disabled={busy || !refundAmount || !refundReference}
                        onClick={() => {
                          try {
                            const amountMinor = majorToMinor(refundAmount);
                            if (confirm(`Record a ${refundAmount} cash refund already returned?`))
                              void action('refunds/manual-cod', {
                                amountMinor,
                                confirmation: 'CASH_RETURNED',
                                reference: refundReference,
                              });
                          } catch (e) {
                            setCommandError(e);
                          }
                        }}
                      >
                        Record returned COD cash
                      </button>
                    )}
                  {order.paymentMethod === 'SIMULATOR' &&
                    order.paymentStatus &&
                    ['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus) && (
                      <button
                        className="btn"
                        disabled={busy || !refundAmount}
                        onClick={() => {
                          try {
                            const amountMinor = majorToMinor(refundAmount);
                            if (confirm('Start a simulated-provider refund?'))
                              void action('refunds/provider', {
                                amountMinor,
                                simulationScenario: 'SUCCESS',
                                reference: refundReference,
                              });
                          } catch (e) {
                            setCommandError(e);
                          }
                        }}
                      >
                        Simulator refund
                      </button>
                    )}
                </div>
                <div className="section-divider" />
                <h3>Private order note</h3>
                <label>
                  Only merchant staff can see this note
                  <textarea
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </label>
                <button
                  className="btn"
                  disabled={busy || !note.trim()}
                  onClick={() => action('notes', { note })}
                >
                  Add note
                </button>
                <h3>Timeline</h3>
                <div className="timeline">
                  {(order.events || order.timeline || []).map((event, index) => (
                    <div className="timeline-event" key={index}>
                      <strong>{'kind' in event ? event.kind : event.type || 'Event'}</strong>
                      <span>
                        {event.createdAt ? new Date(event.createdAt).toLocaleString() : ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
