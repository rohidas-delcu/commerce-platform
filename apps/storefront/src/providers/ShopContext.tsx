import { createContext, useContext } from 'react';
import type { Cart, CheckoutOptions, Profile, Store } from '../lib/types';

export interface ShopContext {
  handle: string;
  store: Store | null;
  profile: Profile | null;
  profileLoading: boolean;
  cart: Cart | null;
  cartLoading: boolean;
  cartError: unknown;
  options: CheckoutOptions | null;
  optionsError: unknown;
  refreshCart: () => Promise<void>;
  mutateCart: (path: string, method: 'POST' | 'PUT' | 'DELETE', data?: unknown) => Promise<Cart>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
export const Context = createContext<ShopContext | null>(null);
export function useShop() {
  const shop = useContext(Context);
  if (!shop) throw new Error('Store context unavailable');
  return shop;
}
