import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from '@tanstack/react-router';
import { api, ApiError } from './lib/api';
import { type MerchantAccount, type Page, type Store, pageItems } from './lib/types';
import { ErrorNotice, Loading, Panel } from './components/Ui';
import { Authentication } from './auth/Authentication';
import { Setup } from './setup/Setup';
import { Workspace } from './layout/Workspace';
import type { Identity } from './providers/StoreContext';

export { ErrorNotice, InfoNotice, Loading, PageHead, Panel, Status } from './components/Ui';
export { useStoreContext } from './providers/StoreContext';

export default function App() {
  const queryClient = useQueryClient(),
    navigate = useNavigate(),
    location = useLocation();
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    const expired = () => {
      api.clearSession();
      queryClient.clear();
      setSignedOut(true);
      // A first-time visitor has no session by design. The initial /auth/me
      // 401 must not eject them from signup/verification/password recovery.
      if (!/^\/(login|signup|verify|forgot|reset)$/.test(location.pathname))
        navigate({ to: '/login' });
    };
    window.addEventListener('commerce:session-expired', expired);
    return () => window.removeEventListener('commerce:session-expired', expired);
  }, [queryClient, navigate, location.pathname]);
  const me = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: () => api.get<Identity>('/v1/auth/me'),
    enabled: !signedOut,
    retry: false,
  });
  const authenticated = !signedOut && !!me.data;
  const accounts = useQuery({
    queryKey: ['merchant', 'accounts'],
    queryFn: () => api.get<Page<MerchantAccount>>('/v1/merchant/accounts?limit=100'),
    enabled: authenticated,
    retry: false,
  });
  const stores = useQuery({
    queryKey: ['merchant', 'stores'],
    queryFn: () => api.get<Page<Store>>('/v1/merchant/stores?limit=100'),
    enabled: authenticated,
    retry: false,
  });
  const loading =
    (!signedOut && me.isPending) || (authenticated && (accounts.isPending || stores.isPending));
  const onReload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['merchant', 'accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['merchant', 'stores'] }),
    ]);
  };
  const onAuthenticated = () => {
    setSignedOut(false);
    void queryClient.invalidateQueries({ queryKey: ['merchant'] });
  };
  const onLogout = async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        console.warn('Logout failed', e);
        return;
      }
    }
    api.clearSession();
    setSignedOut(true);
    queryClient.clear();
    queryClient.setQueryData(['merchant', 'me'], null);
    navigate({ to: '/login' });
  };
  if (loading) return <Loading />;
  if (!authenticated) return <Authentication onAuthenticated={onAuthenticated} />;
  if (accounts.error || stores.error)
    return (
      <div className="setup-layout">
        <Panel title="Unable to open your workspace">
          <ErrorNotice error={accounts.error || stores.error} />
          <button className="btn" onClick={onReload}>
            Try again
          </button>
        </Panel>
      </div>
    );
  if (/^\/(login|signup|verify|forgot|reset)$/.test(location.pathname))
    return <Navigate to="/app" replace />;
  if (location.pathname === '/setup' || !pageItems(stores.data).length)
    return <Setup accounts={pageItems(accounts.data)} onReload={onReload} />;
  return (
    <Workspace
      identity={me.data}
      accounts={pageItems(accounts.data)}
      stores={pageItems(stores.data)}
      onReload={onReload}
      onLogout={onLogout}
    />
  );
}
