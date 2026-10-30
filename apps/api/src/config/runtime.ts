export class ConfigurationError extends Error {}

export function readRuntimeConfig() {
  const mode = process.env.NODE_ENV;
  if (!['development', 'test', 'production'].includes(mode ?? '')) {
    throw new ConfigurationError('NODE_ENV must be development, test or production.');
  }
  if (mode === 'production') {
    throw new ConfigurationError('Production mode is disabled until backend acceptance and security review pass.');
  }
  const driver = process.env.DATA_DRIVER ?? 'memory';
  if (driver !== 'memory' && driver !== 'postgres') {
    throw new ConfigurationError('DATA_DRIVER must be memory or postgres.');
  }
  if (process.env.DEMO_AUTH_ENABLED !== undefined && !['true', 'false'].includes(process.env.DEMO_AUTH_ENABLED)) {
    throw new ConfigurationError('DEMO_AUTH_ENABLED must be true or false.');
  }
  if (driver === 'postgres') {
    try {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/') throw new Error();
    } catch {
      throw new ConfigurationError('A PostgreSQL DATABASE_URL is required for DATA_DRIVER=postgres.');
    }
  }
  const rawPort = process.env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('PORT must be an integer between 1 and 65535.');
  }
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(o => o.trim());
  if (origins.some(origin => {
    try {
      const url = new URL(origin);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
    } catch { return true; }
  })) throw new ConfigurationError('CORS_ORIGINS must contain comma-separated HTTP(S) origins.');
  return { mode, driver, port, origins };
}
