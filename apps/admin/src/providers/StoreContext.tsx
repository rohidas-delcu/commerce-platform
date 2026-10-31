import { createContext, useContext } from 'react';
import type { MerchantAccount, Store } from '../lib/types';

export type Identity = { id: string; name: string; email: string; status?: string };
export type StoreContextValue = {
  store: Store;
  stores: Store[];
  accounts: MerchantAccount[];
  reload: () => Promise<void>;
};
export const StoreContext = createContext<StoreContextValue | null>(null);
export function useStoreContext() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store context missing');
  return value;
}
