import { IdentityError, emailAddress, passwordPolicy, type BrowserSession, type IdentityAuthorityPort } from '../domain/identity.js';
import type { IdentityRepositoryPort, IdentitySecretsPort } from './identity.port.js';

export interface IdentityRequest { headers: Record<string, string | string[] | undefined>; ip?: string; identitySession?: BrowserSession }
export class IdentityService {
  private dummy: Promise<string>;
  constructor(readonly repository: IdentityRepositoryPort, private authority: IdentityAuthorityPort, private secrets: IdentitySecretsPort) {
    this.dummy = authority.hash(this.secrets.secret());
  }
  async checkHealth() { if (process.env.DATA_DRIVER === 'postgres') await this.repository.checkHealth(); }
  private available() {
    if (process.env.DATA_DRIVER !== 'postgres') throw new IdentityError(503, 'Identity requires PostgreSQL.');
  }
  async rate(kind: string, key: string, limit: number, window = 900000) {
    const bucket = Math.floor(Date.now()/window);
    await this.repository.throttle(this.secrets.digest(`${kind}:${key}:${bucket}`), limit, new Date((bucket+1)*window));
  }
  token(request: IdentityRequest) {
    const cookie = request.headers.cookie;
    if (typeof cookie !== 'string') throw new IdentityError(401, 'Authentication required.');
    const name = process.env.NODE_ENV === 'production' ? '__Host-delcu_session' : 'delcu_session';
    const values = cookie.split(';').map(c => c.trim()).filter(c => c.startsWith(`${name}=`));
    const value = values[0]?.slice(name.length+1);
    if (values.length !== 1 || !value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new IdentityError(401, 'Authentication required.');
    return value;
  }
  async bootstrap(request: IdentityRequest) {
    this.available();
    const origin = request.headers.origin;
    const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(v => v.trim());
    if (!(typeof origin === 'string' && origins.includes(origin)) && request.headers['sec-fetch-site'] !== 'same-origin') throw new IdentityError(403, 'Invalid request origin.');
    await this.rate('browser', request.ip ?? 'unknown', 100);
    const csrf = this.secrets.secret();
    let previous: string | undefined;
    try { previous = this.token(request); } catch (error) { if (!(error instanceof IdentityError)) throw error; }
    if (previous && await this.repository.renewCsrf(this.secrets.digest(previous), this.secrets.digest(csrf))) return {value: previous, csrf};
    const value = this.secrets.secret();
    await this.repository.createSession(this.secrets.digest(value), this.secrets.digest(csrf));
    return {value, csrf};
  }
  async context(request: IdentityRequest, authenticated: boolean, mutation: boolean, replay = false) {
    this.available();
    const session = await this.repository.session(this.secrets.digest(this.token(request)));
    if (!session || session.revokedAt || (!replay && session.usedAt) || session.expiresAt <= new Date() || session.absoluteExpiresAt <= new Date()) throw new IdentityError(401, 'Authentication required.');
    if (session.profile && (session.profile.status !== 'ACTIVE' || !session.profile.verifiedAt)) throw new IdentityError(401, 'Authentication required.');
    if (authenticated && !session.profile) throw new IdentityError(401, 'Authentication required.');
    if (mutation) {
      const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(v => v.trim());
      const csrf = request.headers['x-csrf-token'];
      if (typeof request.headers.origin !== 'string' || !origins.includes(request.headers.origin) || typeof csrf !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(csrf) || this.secrets.digest(csrf) !== session.csrfDigest) throw new IdentityError(403, 'Invalid request origin or CSRF token.');
      await this.rate('mutation', request.ip ?? 'unknown', 100);
    }
    request.identitySession = session;
    return session;
  }
  private email(value: string) {
    try { return emailAddress(value); } catch { throw new IdentityError(400, 'Invalid email.'); }
  }
  private password(value: string) {
    try { passwordPolicy(value); } catch { throw new IdentityError(400, 'Password must contain 15–128 characters.'); }
  }
  async register(emailValue: string, password: string, name: string) {
    const email = this.email(emailValue); this.password(password);
    if (!name.trim()) throw new IdentityError(400, 'Name is required.');
    await this.rate('register', email, 5, 3600000);
    const passwordHash = await this.authority.hash(password), token = this.secrets.secret();
    await this.repository.register(email, name.trim(), passwordHash, this.secrets.digest(token), this.secrets.encryptMail({token}));
    return {message: 'If eligible, verification instructions will be sent.'};
  }
  async challenge(emailValue: string, purpose: 'VERIFY' | 'RESET') {
    const email = this.email(emailValue); await this.rate(purpose, email, 3, 3600000);
    const token = this.secrets.secret();
    await this.repository.challenge(email, purpose, this.secrets.digest(token), this.secrets.encryptMail({token}));
    return {message: 'If eligible, instructions will be sent.'};
  }
  async consume(token: string, purpose: 'VERIFY' | 'RESET', password?: string) {
    if (password !== undefined) this.password(password);
    await this.rate('consume', this.secrets.digest(token), 5);
    await this.repository.consume(this.secrets.digest(token), purpose, password === undefined ? undefined : await this.authority.hash(password));
  }
  async login(emailValue: string, password: string, previous: BrowserSession) {
    const email = this.email(emailValue); await this.rate('login', email, 10);
    const identity = await this.repository.credential(email);
    const correct = await this.authority.verify(identity?.passwordHash ?? await this.dummy, password);
    if (!correct || !identity || identity.status !== 'ACTIVE' || !identity.verifiedAt) {
      await this.repository.audit(identity?.id ?? null, 'LOGIN_REJECTED');
      throw new IdentityError(401, 'Authentication failed.');
    }
    const value = this.secrets.secret(), csrf = this.secrets.secret();
    await this.repository.createSession(this.secrets.digest(value), this.secrets.digest(csrf), identity.id, identity.passwordHash);
    await this.repository.revoke(previous.id);
    return {value, csrf};
  }
  async refresh(request: IdentityRequest) {
    const value = this.secrets.secret(), csrf = this.secrets.secret();
    const session = await this.repository.rotate(this.secrets.digest(this.token(request)), this.secrets.digest(value), this.secrets.digest(csrf));
    if (!session) throw new IdentityError(401, 'Authentication required.');
    return {value, csrf};
  }
  async changePassword(session: BrowserSession, current: string, next: string) {
    this.password(next);
    const identity = await this.repository.credential(session.profile!.email);
    if (!identity || !await this.authority.verify(identity.passwordHash, current)) throw new IdentityError(401, 'Authentication failed.');
    await this.repository.changePassword(identity.id, identity.passwordHash, await this.authority.hash(next));
  }
  updateProfile(session: BrowserSession, name: string) {
    if (!name.trim()) throw new IdentityError(400, 'Name is required.');
    return this.repository.profile(session.identityId!, name.trim());
  }
  listSessions(session: BrowserSession) { return this.repository.sessions(session.identityId!); }
  revokeSession(session: BrowserSession, id: string) { return this.repository.revoke(id, session.identityId!); }
  logout(session: BrowserSession, all = false) { return this.repository.revoke(session.id, session.identityId!, all); }
  deactivate(session: BrowserSession) { return this.repository.deactivate(session.identityId!); }

}
