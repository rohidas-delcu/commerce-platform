type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
let bootstrapPromise: Promise<void> | null = null;

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.message)) return o.message.map(String).join('; ');
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
  }
  return `Request failed (${status})`;
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const raw = await res.text();
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { throw new ApiError(res.status, 'Unexpected server response.'); }
}

async function bootstrap() {
  if (csrfToken) return;
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const response = await fetch('/v1/auth/csrf', { credentials: 'include', cache: 'no-store' });
      const payload = await readBody(response);
      if (!response.ok) throw new ApiError(response.status, errorMessage(payload, response.status), payload);
      const token = (payload as { csrfToken?: unknown } | null)?.csrfToken;
      if (typeof token !== 'string' || !token) throw new ApiError(502, 'CSRF bootstrap unavailable.');
      csrfToken = token;
    })().finally(() => { bootstrapPromise = null; });
  }
  await bootstrapPromise;
}

export async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!path.startsWith('/v1/')) throw new Error('Requests must use the /v1 API.');
  if (method !== 'GET') await bootstrap();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await readBody(res);
  if (res.status === 401 && (path.startsWith('/v1/merchant/') || path === '/v1/auth/me' || path === '/v1/auth/sessions')) {
    csrfToken = null;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('commerce:session-expired'));
  }
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status), data);
  if (data && typeof data === 'object' && 'csrfToken' in data && typeof (data as {csrfToken?: unknown}).csrfToken === 'string') {
    csrfToken = (data as {csrfToken: string}).csrfToken;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>(path, 'POST', body, idempotencyKey),
  patch: <T>(path: string, body: unknown) => request<T>(path, 'PATCH', body),
  put: <T>(path: string, body: unknown) => request<T>(path, 'PUT', body),
  delete: <T>(path: string, body?: unknown) => request<T>(path, 'DELETE', body),
  csrf: bootstrap,
  clearSession: () => { csrfToken = null; },
  refresh: async () => { await request('/v1/auth/session/refresh', 'POST'); },
};

export function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export async function uploadAsset(url: string, bytes: Blob, headers: Record<string, string>) {
  // URLs/headers are returned by the server's private reservation; never add merchant cookies.
  const target = new URL(url, window.location.origin);
  const res = await fetch(target.toString(), { method: 'PUT', headers, body: bytes });
  if (!res.ok) throw new ApiError(res.status, 'Image upload failed.');
}
