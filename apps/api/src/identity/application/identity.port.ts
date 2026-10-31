import type { BrowserSession, IdentityProfile } from '../domain/identity.js';
export interface IdentityRepositoryPort {
  audit(identityId: string | null, action: string): Promise<void>;
  checkHealth(): Promise<void>;
  throttle(key: string, limit: number, expiresAt: Date): Promise<void>;
  credential(email: string): Promise<(IdentityProfile & {passwordHash: string}) | null>;
  register(email: string, name: string, passwordHash: string, tokenDigest: string, mail: string): Promise<void>;
  challenge(email: string, purpose: string, tokenDigest: string, mail: string): Promise<void>;
  consume(tokenDigest: string, purpose: string, passwordHash?: string): Promise<void>;
  createSession(secretDigest: string, csrfDigest: string, identityId?: string, expectedPasswordHash?: string): Promise<BrowserSession>;
  session(secretDigest: string): Promise<BrowserSession | null>;
  renewCsrf(secretDigest: string, csrfDigest: string): Promise<boolean>;
  rotate(secretDigest: string, nextDigest: string, csrfDigest: string): Promise<BrowserSession | null>;
  revoke(id: string, identityId?: string, all?: boolean): Promise<void>;
  sessions(identityId: string): Promise<Array<{id: string; createdAt: Date; expiresAt: Date}>>;
  profile(identityId: string, name: string): Promise<IdentityProfile>;
  changePassword(identityId: string, expectedHash: string, nextHash: string): Promise<void>;
  deactivate(identityId: string): Promise<void>;
}

export interface IdentitySecretsPort { secret(): string; digest(value: string): string; encryptMail(payload: {token: string}): string }

export interface IdentityRepositoryFactoryPort {scoped(storeId:string):IdentityRepositoryPort;}
