import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router';
import App from './App';
import { DiscoverStore } from './pages/DiscoverStore';
import { StoreHandleRoot } from './StorefrontLayout';
import {
  CatalogPage,
  ProductPage,
  CartPage,
  CheckoutPage,
  ConfirmationPage,
  AccountPage,
  OrdersPage,
  OrderPage,
} from './pages';

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: () => <Navigate to="/" replace />,
});
const index = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DiscoverStore });
const store = createRoute({
  getParentRoute: () => rootRoute,
  path: 's/$handle',
  component: StoreHandleRoot,
});
const catalog = createRoute({ getParentRoute: () => store, path: '/', component: CatalogPage });
const product = createRoute({
  getParentRoute: () => store,
  path: 'products/$productHandle',
  component: ProductPage,
});
const cart = createRoute({ getParentRoute: () => store, path: 'cart', component: CartPage });
const checkout = createRoute({
  getParentRoute: () => store,
  path: 'checkout',
  component: CheckoutPage,
});
const confirmation = createRoute({
  getParentRoute: () => store,
  path: 'checkout/$checkoutId',
  component: ConfirmationPage,
});
const account = createRoute({
  getParentRoute: () => store,
  path: 'account/$screen',
  component: AccountPage,
});
const orders = createRoute({
  getParentRoute: () => store,
  path: 'account/orders',
  component: OrdersPage,
});
const order = createRoute({
  getParentRoute: () => store,
  path: 'account/orders/$orderId',
  component: OrderPage,
});

const routeTree = rootRoute.addChildren([
  index,
  store.addChildren([catalog, product, cart, checkout, confirmation, account, orders, order]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });
