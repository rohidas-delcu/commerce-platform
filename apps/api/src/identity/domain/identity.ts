export function emailAddress(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  return email;
}
export function passwordPolicy(value: string) {
  // Long passphrases are supported; do not silently truncate or normalize passwords.
  if (value.length < 15 || value.length > 128 || /[\u0000]/.test(value)) throw new Error('Password must contain 15–128 characters.');
}
export interface IdentityProfile { id: string; email: string; name: string; verifiedAt: Date | null; status: string }
export interface IdentityAuthorityPort {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}
export class IdentityError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export interface BrowserSession {
  id: string; identityId: string | null; csrfDigest: string; expiresAt: Date;
  absoluteExpiresAt: Date; revokedAt: Date | null; usedAt: Date | null;
  profile: IdentityProfile | null;
}
