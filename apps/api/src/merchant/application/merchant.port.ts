import type { CommerceRepository } from '../../application/commerce.port.js';
import type { BrowserSession } from '../../identity/domain/identity.js';
import type { Permission } from '../domain/access.js';
export type MerchantPrincipal = Pick<BrowserSession,'id'|'identityId'>;
export interface AccountView {id: string; name: string; status: string}
export interface StoreView {logoAssetId:string|null;id: string; merchantId: string; name: string; handle: string; status: string; settingsVersion: number; onboardingState: string; countryCode: string; currencyCode: string; timezone: string; contactEmail: string; brandingName: string; suspended: boolean; archivedAt: Date | null}
export interface StoreSettings {logoAssetId?:string|null;expectedVersion: number; name?: string; contactEmail?: string; brandingName?: string; countryCode?: string; currencyCode?: string; timezone?: string}
export interface MerchantRepositoryPort {
  checkHealth(): Promise<void>;
  invite(p: MerchantPrincipal, merchantId: string, storeId: string | null, email: string, role: string, tokenDigest: string, mail: string): Promise<{id:string;email:string;role:string;expiresAt:Date}>;
  accept(p: MerchantPrincipal, tokenDigest: string): Promise<void>;
  invitations(p: MerchantPrincipal, merchantId: string): Promise<Array<{id:string;email:string;role:string;expiresAt:Date;consumedAt:Date|null;revokedAt:Date|null}>>;
  revokeInvitation(p: MerchantPrincipal, merchantId: string, id: string): Promise<void>;
  storeMember(p: MerchantPrincipal, storeId: string, identityId: string, role: string | null): Promise<void>;

  accountStatus(p: MerchantPrincipal, merchantId: string, suspended: boolean): Promise<AccountView>;
  storeStatus(p: MerchantPrincipal, storeId: string, operation: "suspend"|"resume"|"archive"): Promise<StoreView>;
  createAccount(principal: MerchantPrincipal, name: string): Promise<AccountView>;
  accounts(principal: MerchantPrincipal): Promise<AccountView[]>;
  createStore(principal: MerchantPrincipal, merchantId: string, input: {name:string;handle:string;countryCode:string;currencyCode:string}, key: string, digest: string): Promise<StoreView>;
  stores(principal: MerchantPrincipal): Promise<StoreView[]>;
  withStore<T>(principal: MerchantPrincipal, storeId: string, permission: Permission, work: (repo: CommerceRepository, store: StoreView) => Promise<T>, availability?:import('../domain/access.js').StoreAvailability): Promise<T>;
  settings(principal: MerchantPrincipal, storeId: string, input: StoreSettings): Promise<StoreView>;
  complete(principal: MerchantPrincipal, storeId: string, version: number): Promise<StoreView>;
  publication(principal: MerchantPrincipal, storeId: string, published: boolean): Promise<StoreView>;
  members(principal: MerchantPrincipal, merchantId: string): Promise<Array<{identityId: string; role: string}>>;
  membership(principal: MerchantPrincipal, merchantId: string, identityId: string, role: 'ACCOUNT_OWNER' | 'MEMBER' | null): Promise<void>;
}
