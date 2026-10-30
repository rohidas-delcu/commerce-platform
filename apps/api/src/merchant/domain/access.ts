import { IdentityError } from '../../identity/domain/identity.js';
export type StoreRole = 'ACCOUNT_OWNER' | 'STORE_ADMIN' | 'STORE_EDITOR' | 'STORE_VIEWER';
export type Permission = 'store.read' | 'store.settings' | 'store.publish' | 'catalog.write' | 'inventory.write' | 'members.manage' | 'orders.read' | 'orders.manage';
const permissions: Record<StoreRole, readonly Permission[]> = {
  ACCOUNT_OWNER: ['store.read','store.settings','store.publish','catalog.write','inventory.write','members.manage','orders.read','orders.manage'],
  STORE_ADMIN: ['store.read','store.settings','store.publish','catalog.write','inventory.write','orders.read','orders.manage'],
  STORE_EDITOR: ['store.read','catalog.write','inventory.write'],
  STORE_VIEWER: ['store.read']
};
export function assertPermission(role: string | null, permission: Permission) {
  if (!role) throw new IdentityError(404, 'Store not found.');
  if (!Object.hasOwn(permissions,role) || !permissions[role as StoreRole].includes(permission)) throw new IdentityError(403, 'Insufficient permission.');
}
export function assertOwner(role: string | null) {
  if (role !== 'ACCOUNT_OWNER') throw new IdentityError(403, 'Account owner permission required.');
}
export function assertRemainingOwner(remaining: number) {
  if (remaining < 1) throw new IdentityError(409, 'Cannot remove the last account owner.');
}
export function locale(country: string, currency: string) {
  // Explicit supported markets; no claim of tax compliance.
  const allowed: Record<string, readonly string[]> = {IN:['INR'], US:['USD'], GB:['GBP'], CA:['CAD'], AU:['AUD']};
  if (!allowed[country]?.includes(currency)) throw new IdentityError(400, 'Unsupported country/currency pair.');
}
