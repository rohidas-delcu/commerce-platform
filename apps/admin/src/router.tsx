import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router';
import App from './App';
import {
  OverviewPage,
  ProductsPage,
  CollectionsPage,
  InventoryPage,
  OrdersPage,
  CouponsPage,
  PricingPage,
  TeamPage,
  StoreSettingsPage,
  FinancePage,
  ProfilePage,
} from './pages';

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: () => <Navigate to="/app" replace />,
});

const authRoutes = ['login', 'signup', 'verify', 'forgot', 'reset', 'setup'].map((path) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
);

const appRoute = createRoute({ getParentRoute: () => rootRoute, path: 'app', component: Outlet });
const dashboard = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: OverviewPage,
});
const pages = [
  ['orders', OrdersPage],
  ['products', ProductsPage],
  ['collections', CollectionsPage],
  ['inventory', InventoryPage],
  ['discounts', CouponsPage],
  ['settings', StoreSettingsPage],
  ['pricing', PricingPage],
  ['team', TeamPage],
  ['finance', FinancePage],
  ['profile', ProfilePage],
] as const;

const routeTree = rootRoute.addChildren([
  ...authRoutes,
  appRoute.addChildren([
    dashboard,
    ...pages.map(([path, component]) =>
      createRoute({ getParentRoute: () => appRoute, path, component }),
    ),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });
