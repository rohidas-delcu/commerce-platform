import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Plus, Settings2, Shield, ShoppingBag } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { ErrorNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { minorToMoney, pageItems, type Order, type Page, type Product } from '../../lib/types';

const storePath = (id: string) => `/v1/merchant/stores/${id}`;

export function OverviewPage() {
  const { store } = useStoreContext();
  const orders = useQuery({
    queryKey: ['dashboard', 'orders', store.id],
    queryFn: () => api.get<Page<Order>>(`${storePath(store.id)}/orders?limit=50`),
  });
  const products = useQuery({
    queryKey: ['dashboard', 'products', store.id],
    queryFn: () => api.get<Page<Product>>(`${storePath(store.id)}/products?limit=100`),
  });
  const allOrders = pageItems(orders.data),
    allProducts = pageItems(products.data);
  const paid = allOrders.filter((o) =>
      ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(o.paymentStatus || ''),
    ),
    recentRevenue = paid.reduce((sum, o) => sum + BigInt(o.paidMinor || 0), 0n);
  return (
    <>
      <PageHead
        eyebrow="BUSINESS AT A GLANCE"
        title="Welcome to your workspace"
        subtitle={`Here's what has been happening at ${store.name}. Metrics cover the most recent fetched records.`}
      >
        <Link className="btn primary" to="/app/products">
          <Plus size={15} /> Add product
        </Link>
      </PageHead>
      {store.status !== 'PUBLISHED' && (
        <div className="welcome-card">
          <div>
            <p className="eyebrow">NEXT STEP</p>
            <h2>Let's get your store ready to sell.</h2>
            <p>Add products, configure shipping and checkout, then publish your storefront.</p>
          </div>
          <Link className="btn primary" to="/app/settings">
            Finish store setup <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <ErrorNotice error={orders.error || products.error} />
      <div className="stats-grid">
        <div className="stat-card">
          <span>Collected sales (sample)</span>
          <strong>{minorToMoney(recentRevenue, store.currencyCode)}</strong>
          <small>First 50 orders, not an all-time revenue report</small>
        </div>
        <div className="stat-card">
          <span>Orders (sample)</span>
          <strong>{allOrders.length}</strong>
          <small>Latest 50 max</small>
        </div>
        <div className="stat-card">
          <span>To fulfill (sample)</span>
          <strong>
            {
              allOrders.filter((o) => o.status === 'PLACED' && o.fulfillmentStatus !== 'DELIVERED')
                .length
            }
          </strong>
          <small>Awaiting completion</small>
        </div>
        <div className="stat-card">
          <span>Catalog products (sample)</span>
          <strong>{allProducts.length}</strong>
          <small>Latest 100 max</small>
        </div>
      </div>
      <div className="content-grid">
        <Panel
          title="Recent orders"
          subtitle="Manage payments and manual fulfillment."
          actions={
            <Link className="link" to="/app/orders">
              All orders →
            </Link>
          }
        >
          {orders.isPending ? (
            <Loading />
          ) : (
            <div className="item-list">
              {allOrders.slice(0, 6).map((o) => (
                <div className="list-item" key={o.id}>
                  <div>
                    <strong>{o.number || o.id.slice(0, 8)}</strong>
                    <small>
                      {o.contactName || o.contactEmail || 'Customer'} ·{' '}
                      {minorToMoney(o.totalMinor, o.currencyCode || store.currencyCode)}
                    </small>
                  </div>
                  <Status value={o.fulfillmentStatus} />
                </div>
              ))}
              {!allOrders.length && (
                <p className="empty-copy">Orders will appear after a purchase.</p>
              )}
            </div>
          )}
        </Panel>
        <Panel title="Quick actions" subtitle="Get back to work faster.">
          <div className="quick-grid">
            <Link to="/app/products">
              <Plus /> Add product <ChevronRight size={16} />
            </Link>
            <Link to="/app/orders">
              <ShoppingBag /> Manage orders <ChevronRight size={16} />
            </Link>
            <Link to="/app/pricing">
              <Settings2 /> Shipping & payments <ChevronRight size={16} />
            </Link>
            <Link to="/app/team">
              <Shield /> Team permissions <ChevronRight size={16} />
            </Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
