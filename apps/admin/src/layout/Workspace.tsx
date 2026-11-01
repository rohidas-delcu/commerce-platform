import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Gift,
  Layers,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Users,
  X,
} from 'lucide-react';
import type { MerchantAccount, Store } from '../lib/types';
import { StoreContext, type Identity, type StoreContextValue } from '../providers/StoreContext';
import { Setup } from '../setup/Setup';

const navigation = [
  { to: '/app', label: 'Overview', icon: BarChart3, end: true },
  { to: '/app/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/app/products', label: 'Products', icon: Package },
  { to: '/app/collections', label: 'Collections', icon: Layers },
  { to: '/app/inventory', label: 'Inventory', icon: Boxes },
  { to: '/app/discounts', label: 'Discounts', icon: Tag },
];
const settingsNav = [
  { to: '/app/settings', label: 'Store settings', icon: Settings2 },
  { to: '/app/pricing', label: 'Shipping & payments', icon: CreditCard },
  { to: '/app/team', label: 'Team & invites', icon: Users },
  { to: '/app/finance', label: 'Payments & refunds', icon: Gift },
];

export function Workspace({
  identity,
  stores,
  accounts,
  onReload,
  onLogout,
}: {
  identity: Identity;
  stores: Store[];
  accounts: MerchantAccount[];
  onReload: () => Promise<void>;
  onLogout: () => void;
}) {
  const [storeId, setStoreId] = useState(() => localStorage.getItem('commerce:active-store') || ''),
    [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate(),
    location = useLocation();
  const store = stores.find((s) => s.id === storeId) || stores[0];
  useEffect(() => {
    if (store?.id) {
      setStoreId(store.id);
      localStorage.setItem('commerce:active-store', store.id);
    }
  }, [store?.id]);
  if (!store) return <Setup accounts={accounts} onReload={onReload} />;
  const value: StoreContextValue = { store, stores, accounts, reload: onReload };
  const item = ({ to, label, icon: Icon, end }: (typeof navigation)[number]) => (
    <Link
      key={to}
      to={to}
      activeOptions={{ exact: end }}
      activeProps={{ className: 'nav-item active' }}
      onClick={() => setMenuOpen(false)}
      className="nav-item"
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
  return (
    <StoreContext.Provider value={value}>
      <div className="app-shell">
        <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <span className="brand-mark">c.</span>
            <div>
              <div className="logo-name">
                commerce<span>studio</span>
              </div>
              <small className="logo-sub">Merchant workspace</small>
            </div>
            <button
              aria-label="Close navigation"
              className="mobile-close"
              onClick={() => setMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <label className="store-picker">
            <span className="store-avatar">{store.name.slice(0, 2).toUpperCase()}</span>
            <span className="store-picker-copy">
              <strong>{store.name}</strong>
              <small>
                {store.status === 'PUBLISHED' ? 'Published' : 'Unpublished'} · {store.currencyCode}
              </small>
            </span>
            <ChevronDown size={16} />
            <select
              aria-label="Select active store"
              value={store.id}
              onChange={(e) => {
                setStoreId(e.target.value);
                localStorage.setItem('commerce:active-store', e.target.value);
                navigate({ to: '/app' });
              }}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Merchant navigation">
            <p className="sidebar-label">WORKSPACE</p>
            {navigation.map(item)}
            <p className="sidebar-label">MANAGEMENT</p>
            {settingsNav.map(item)}
          </nav>
          <div className="sidebar-bottom">
            <div className="help-card">
              <strong>Keep your store moving</strong>
              <p>
                Changes to your published catalog are reflected through the headless storefront API.
              </p>
              <Link to="/app/settings">Review store setup →</Link>
            </div>
          </div>
        </aside>
        {menuOpen && (
          <button
            className="mobile-scrim"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div className="main-area">
          <header className="topbar">
            <div className="top-left">
              <button
                className="mobile-menu"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <span className="breadcrumb">Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>
                {location.pathname.split('/').at(-1) === 'app'
                  ? 'Overview'
                  : location.pathname.split('/').at(-1)}
              </strong>
            </div>
            <div className="top-actions">
              <span className="top-status">
                <span className={`status-dot ${store.status === 'PUBLISHED' ? 'live' : ''}`} />
                {store.status === 'PUBLISHED' ? 'Live' : 'Draft'}
              </span>
              <Link className="btn small" to="/app/profile">
                {identity.name || identity.email}
              </Link>
              <button className="icon-button" aria-label="Sign out" onClick={onLogout}>
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <main className="app-content">
            <div className="store-status-ribbon">
              <span>
                <ShieldCheck size={16} /> <strong>{store.name}</strong> ·{' '}
                {store.status === 'PUBLISHED'
                  ? 'Published storefront'
                  : 'Store is not published yet'}
              </span>
              <div>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`/v1/storefront/${store.handle}`}
                  title="Public JSON metadata endpoint"
                >
                  Public API <ExternalLink size={13} />
                </a>
                <Link to="/app/settings">Store setup</Link>
              </div>
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </StoreContext.Provider>
  );
}
