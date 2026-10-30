import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { IdentityError, type BrowserSession } from '../domain/identity.js';
import type { IdentityRepositoryPort } from '../application/identity.port.js';

const profileSelect = { id: true, email: true, name: true, status: true, verifiedAt: true } as const;
export class PrismaIdentityRepository implements IdentityRepositoryPort {
  private client?: PrismaClient;
  private get db() {
    if (this.client) return this.client;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required.');
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max: 10 }, {schema: new URL(connectionString).searchParams.get('schema') ?? 'public'}) });
    return this.client;
  }
  async onModuleDestroy() { await this.client?.$disconnect(); }
  async audit(identityId: string | null, action: string) { await this.db.identityAudit.create({data:{identityId,action}}); }
  async checkHealth() {
    await Promise.all([this.db.identity.findFirst({select:{id:true}}), this.db.identitySession.findFirst({select:{id:true}}), this.db.identityChallenge.findFirst({select:{digest:true}}), this.db.identityMail.findFirst({select:{id:true}}), this.db.identityAudit.findFirst({select:{id:true}}), this.db.identityThrottle.findFirst({select:{key:true}})]);
  }
  async throttle(key: string, limit: number, expiresAt: Date) {
    const result = await this.db.identityThrottle.upsert({where: {key}, create: {key, attempts: 1, expiresAt}, update: {attempts: {increment: 1}}});
    if (result.attempts > limit) throw new IdentityError(429, 'Too many attempts. Try again later.');
  }
  credential(email: string) { return this.db.identity.findUnique({where: {email}}); }
  async register(email: string, name: string, passwordHash: string, tokenDigest: string, mail: string) {
    await this.db.$transaction(async tx => {
      // An existing registration is never overwritten by a later unauthenticated signup.
      const result = await tx.identity.createMany({data: [{email, name, passwordHash}], skipDuplicates: true});
      if (!result.count) return;
      const identity = await tx.identity.findUniqueOrThrow({where: {email}});
      await tx.identityChallenge.create({data: {digest: tokenDigest, identityId: identity.id, purpose: 'VERIFY', expiresAt: new Date(Date.now()+86400000)}});
      await tx.identityMail.create({data: {recipient: email, purpose: 'VERIFY', encryptedPayload: mail}});
      await tx.identityAudit.create({data: {identityId: identity.id, action: 'REGISTERED'}});
    });
  }
  async challenge(email: string, purpose: string, tokenDigest: string, mail: string) {
    await this.db.$transaction(async tx => {
      const identity = await tx.identity.findUnique({where: {email}});
      if (!identity || identity.status !== 'ACTIVE' || (purpose === 'VERIFY' && identity.verifiedAt)) return;
      await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${identity.id}::uuid FOR UPDATE`;
      await tx.identityChallenge.updateMany({where: {identityId: identity.id, purpose, consumedAt: null}, data: {consumedAt: new Date()}});
      await tx.identityChallenge.create({data: {digest: tokenDigest, identityId: identity.id, purpose, expiresAt: new Date(Date.now()+(purpose === 'VERIFY' ? 86400000 : 1800000))}});
      await tx.identityMail.create({data: {recipient: email, purpose, encryptedPayload: mail}});
    });
  }
  async consume(tokenDigest: string, purpose: string, passwordHash?: string) {
    await this.db.$transaction(async tx => {
      const challenge = await tx.identityChallenge.findUnique({where: {digest: tokenDigest}});
      if (!challenge || challenge.purpose !== purpose) throw new IdentityError(400, 'Invalid or expired challenge.');
      await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${challenge.identityId}::uuid FOR UPDATE`;
      const identity = await tx.identity.findUniqueOrThrow({where: {id: challenge.identityId}});
      if (identity.status !== 'ACTIVE') throw new IdentityError(400, 'Invalid or expired challenge.');
      const used = await tx.identityChallenge.updateMany({where: {digest: tokenDigest, purpose, consumedAt: null, expiresAt: {gt: new Date()}}, data: {consumedAt: new Date()}});
      if (used.count !== 1) throw new IdentityError(400, 'Invalid or expired challenge.');
      await tx.identity.update({where: {id: identity.id}, data: purpose === 'VERIFY' ? {verifiedAt: new Date()} : {passwordHash}});
      if (purpose === 'RESET') {
        await tx.identitySession.updateMany({where: {identityId: identity.id, revokedAt: null}, data: {revokedAt: new Date()}});
        await tx.identityChallenge.updateMany({where: {identityId: identity.id, purpose, consumedAt: null}, data: {consumedAt: new Date()}});
      }
      await tx.identityAudit.create({data: {identityId: identity.id, action: purpose === 'VERIFY' ? 'EMAIL_VERIFIED' : 'PASSWORD_RESET'}});
    });
  }
  async createSession(secretDigest: string, csrfDigest: string, identityId?: string, expectedPasswordHash?: string): Promise<BrowserSession> {
    return this.db.$transaction(async tx => {
      if (identityId) {
        await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${identityId}::uuid FOR UPDATE`;
        const identity = await tx.identity.findUniqueOrThrow({where: {id: identityId}});
        if (identity.status !== 'ACTIVE' || !identity.verifiedAt || identity.passwordHash !== expectedPasswordHash) throw new IdentityError(401, 'Authentication failed.');
      }
      const now = Date.now(), absoluteExpiresAt = new Date(now+(identityId ? 7*86400000 : 900000));
      const session = await tx.identitySession.create({data: {identityId, csrfDigest, expiresAt: new Date(now+(identityId ? 1800000 : 900000)), absoluteExpiresAt, secrets: {create: {digest: secretDigest, csrfDigest}}}, include: {identity: {select: profileSelect}}});
      if (identityId) await tx.identityAudit.create({data: {identityId, action: 'LOGIN'}});
      return {...session, usedAt: null, profile: session.identity};
    });
  }
  async session(secretDigest: string): Promise<BrowserSession | null> {
    const result = await this.db.identitySessionSecret.findUnique({where: {digest: secretDigest}, include: {session: {include: {identity: {select: profileSelect}}}}});
    return result ? {...result.session, usedAt: result.usedAt, csrfDigest: result.csrfDigest, profile: result.session.identity} : null;
  }
  async renewCsrf(secretDigest: string, csrfDigest: string) {
    return this.db.$transaction(async tx => {
      const token = await tx.identitySessionSecret.findUnique({where: {digest: secretDigest}});
      if (!token) return false;
      await tx.$queryRaw`SELECT id FROM "IdentitySession" WHERE id=${token.sessionId}::uuid FOR UPDATE`;
      const session = await tx.identitySession.findUniqueOrThrow({where: {id: token.sessionId}});
      if (session.revokedAt || session.expiresAt <= new Date() || session.absoluteExpiresAt <= new Date()) return false;
      const result = await tx.identitySessionSecret.updateMany({where: {digest: secretDigest, usedAt: null}, data: {csrfDigest}});
      if (!result.count) return false;
      await tx.identitySession.update({where: {id: session.id}, data: {csrfDigest}});
      return true;
    });
  }
  async rotate(secretDigest: string, nextDigest: string, csrfDigest: string): Promise<BrowserSession | null> {
    return this.db.$transaction(async tx => {
      const old = await tx.identitySessionSecret.findUnique({where: {digest: secretDigest}});
      if (!old) return null;
      const owner = await tx.identitySession.findUniqueOrThrow({where: {id: old.sessionId}, select: {identityId: true}});
      if (owner.identityId) await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${owner.identityId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "IdentitySession" WHERE id=${old.sessionId}::uuid FOR UPDATE`;
      const session = await tx.identitySession.findUniqueOrThrow({where: {id: old.sessionId}, include: {identity: {select: profileSelect}}});
      const used = await tx.identitySessionSecret.updateMany({where: {digest: secretDigest, usedAt: null}, data: {usedAt: new Date()}});
      if (!used.count) {
        await tx.identitySession.update({where: {id: session.id}, data: {revokedAt: new Date()}});
        if (session.identityId) await tx.identityAudit.create({data: {identityId: session.identityId, action: 'SESSION_REPLAY_REVOKED'}});
        return null; // Commit replay revocation before the application returns 401.
      }
      if (session.revokedAt || session.expiresAt <= new Date() || session.absoluteExpiresAt <= new Date() || session.identity?.status !== 'ACTIVE') return null;
      const updated = await tx.identitySession.update({where: {id: session.id}, data: {csrfDigest, expiresAt: new Date(Math.min(Date.now()+1800000, session.absoluteExpiresAt.getTime())), secrets: {create: {digest: nextDigest, csrfDigest}}}});
      return {...updated, usedAt: null, profile: session.identity};
    });
  }
  async revoke(id: string, identityId?: string, all = false) {
    await this.db.$transaction(async tx => {
      if (identityId) await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${identityId}::uuid FOR UPDATE`;
      await tx.identitySession.updateMany({where: all ? {identityId} : {id, ...(identityId ? {identityId} : {})}, data: {revokedAt: new Date()}});
      if (identityId) await tx.identityAudit.create({data: {identityId, action: all ? 'LOGOUT_ALL' : 'SESSION_REVOKED'}});
    });
  }
  sessions(identityId: string) {
    return this.db.identitySession.findMany({where: {identityId, revokedAt: null, expiresAt: {gt: new Date()}, absoluteExpiresAt: {gt: new Date()}}, select: {id: true, createdAt: true, expiresAt: true}, take: 100, orderBy: {createdAt: 'desc'}});
  }
  async profile(identityId: string, name: string) {
    return this.db.identity.update({where: {id: identityId}, data: {name}, select: profileSelect});
  }
  async changePassword(identityId: string, expectedHash: string, nextHash: string) {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${identityId}::uuid FOR UPDATE`;
      const updated = await tx.identity.updateMany({where: {id: identityId, passwordHash: expectedHash, status: 'ACTIVE'}, data: {passwordHash: nextHash}});
      if (!updated.count) throw new IdentityError(401, 'Authentication failed.');
      await tx.identitySession.updateMany({where: {identityId}, data: {revokedAt: new Date()}});
      await tx.identityChallenge.updateMany({where: {identityId, consumedAt: null}, data: {consumedAt: new Date()}});
      await tx.identityAudit.create({data: {identityId, action: 'PASSWORD_CHANGED'}});
    });
  }
  async deactivate(identityId: string) {
    // Ownership-aware deactivation is intentionally disabled until MerchantAccess is integrated.
    throw new IdentityError(409, 'Deactivation requires ownership reconciliation. Contact support.');
  }
}
