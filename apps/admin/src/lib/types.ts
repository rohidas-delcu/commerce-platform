export interface Page<T> { items: T[]; limit: number; offset: number; nextOffset: number | null }
export interface MerchantAccount { id: string; name: string; status?: string }
export interface Store { id: string; merchantId: string; name: string; handle: string; status: string; settingsVersion: number; onboardingState?: string; suspended?: boolean; archivedAt?: string | null; countryCode: string; currencyCode: string; timezone?: string; contactEmail?: string; brandingName?: string; logoAssetId?: string | null }
export interface Variant { id: string; productId?: string; name: string; sku: string; stock?: number; onHand?: number; available?: number; reserved?: number; active?: boolean; priceMinor?: string | null; compareMinor?: string | null; options?: Record<string, string> }
export interface Product { id: string; storeId?: string; name: string; handle: string; status: string; priceMinor: string; compareMinor?: string | null; description?: string; collection?: string; seoTitle?: string; seoDescription?: string; variants: Variant[]; images?: Array<{ id: string; url: string; altText?: string; primary?: boolean }>; version?: number }
export interface Collection { id: string; name: string; handle: string; description?: string; featured?: boolean; status?: string; version: number; position?: number }
export interface Order { id: string; number?: string; orderNumber?: string; status?: string; fulfillmentStatus?: string; paymentStatus?: string; paymentMethod?: 'COD'|'SIMULATOR'|'RAZORPAY'; totalMinor: string; currencyCode?: string; paidMinor?: string; amountDueMinor?: string; refundedMinor?: string; version: number; customer?: { name?: string; email?: string }; contactName?: string; contactEmail?: string; createdAt?: string; items?: Array<{productName?:string;variantName?:string;subtotalMinor?:string;name?: string; quantity: number; unitPriceMinor?: string; totalMinor?: string; sku?: string}>; timeline?: Array<{ type?: string; createdAt?: string; description?: string }>; events?: Array<{kind:string;createdAt?:string;internalNote?:string|null}> }
export interface Coupon { id: string; code: string; kind: 'FIXED'|'PERCENTAGE'; value: string|number; active: boolean; version: number; consumedUses?: number; heldUses?: number; maxUses?: number|null }
export interface Pricing { version: number; shipping: Array<{id: string; name: string; countries: string[]; rateMinor: string; freeAboveMinor: string|null; active: boolean}>; tax: {mode: 'NONE'|'EXCLUSIVE'|'INCLUSIVE'; shippingTaxable: boolean; rates: Array<{countryCode:string;basisPoints:number}>}; payments: {cod:boolean;simulator:boolean} }

export function pageItems<T>(page: Page<T> | T[] | null | undefined): T[] { return Array.isArray(page) ? page : page?.items || []; }
export function minorToMoney(minor: string | number | bigint | null | undefined, currency = 'INR'): string {
  const amount = BigInt(String(minor ?? '0'));
  const abs = amount < 0n ? -amount : amount;
  const prefix = ({ INR: '₹', USD: '$', GBP: '£', CAD: 'CA$', AUD: 'A$' } as Record<string, string>)[currency] || `${currency} `;
  return `${amount < 0n ? '-' : ''}${prefix}${new Intl.NumberFormat('en-IN').format(abs / 100n)}.${(abs % 100n).toString().padStart(2, '0')}`;
}
export function majorToMinor(major: string): string {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(major)) throw new Error('Enter a non-negative amount with at most 2 decimals.');
  const [whole, decimal = ''] = major.split('.');
  return (BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0') || '0')).toString();
}
export function minorToMajor(minor: string | number | null | undefined): string {
  const value = BigInt(String(minor ?? '0'));
  return `${value / 100n}.${(value % 100n).toString().padStart(2,'0')}`;
}
