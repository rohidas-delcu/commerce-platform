import assert from 'node:assert/strict';
import test from 'node:test';
import { readRuntimeConfig } from '../src/config/runtime.ts';

test('runtime config fails closed and validates ports, origins, flags and database URLs', () => {
  const keys = ['NODE_ENV', 'DATA_DRIVER', 'DEMO_AUTH_ENABLED', 'DATABASE_URL', 'PORT', 'CORS_ORIGINS'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const valid = { NODE_ENV: 'development', DATA_DRIVER: 'memory', DEMO_AUTH_ENABLED: 'true', PORT: '3000', CORS_ORIGINS: 'http://localhost:5173' };
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, valid);
    assert.equal(readRuntimeConfig().driver, 'memory');
    for (const invalid of [ { NODE_ENV: 'production' }, { NODE_ENV: 'staging' }, { NODE_ENV: '' },
      { DATA_DRIVER: 'typo' }, { DEMO_AUTH_ENABLED: 'yes' }, { PORT: '0' }, { PORT: '1.5' },
      { PORT: '65536' }, { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'https://example.com/path' },
      { DATA_DRIVER: 'postgres', DATABASE_URL: 'https://example.com/db' } ]) {
      Object.assign(process.env, valid, invalid);
      assert.throws(readRuntimeConfig);
    }
    Object.assign(process.env, valid, { DATA_DRIVER: 'postgres', DATABASE_URL: 'postgresql://localhost/commerce' });
    assert.equal(readRuntimeConfig().driver, 'postgres');
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
