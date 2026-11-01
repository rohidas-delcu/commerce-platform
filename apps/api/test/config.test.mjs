import assert from 'node:assert/strict';
import test from 'node:test';
import { readRuntimeConfig } from '../src/config/runtime.ts';

test('runtime config fails closed and validates ports, origins, flags and database URLs', () => {
  const keys = ['NODE_ENV', 'DATA_DRIVER', 'DEMO_AUTH_ENABLED', 'DATABASE_URL', 'PORT', 'CORS_ORIGINS', 'AUTH_OUTBOX_KEY', 'HOST', 'OBJECT_STORAGE', 'NOTIFICATION_PROVIDER'];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const valid = { NODE_ENV: 'development', DATA_DRIVER: 'memory', DEMO_AUTH_ENABLED: 'true', PORT: '3000', CORS_ORIGINS: 'http://localhost:5173' };
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, valid);
    assert.equal(readRuntimeConfig().driver, 'memory');
    for (const invalid of [ { NODE_ENV: 'production' }, { NODE_ENV: '' },
      { DATA_DRIVER: 'typo' }, { DEMO_AUTH_ENABLED: 'yes' }, { PORT: '0' }, { PORT: '1.5' },
      { PORT: '65536' }, { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'https://example.com/path' },
      { DATA_DRIVER: 'postgres', DATABASE_URL: 'https://example.com/db' } ]) {
      Object.assign(process.env, valid, invalid);
      assert.throws(readRuntimeConfig);
    }
    Object.assign(process.env, valid, { DATA_DRIVER: 'postgres', DATABASE_URL: 'postgresql://localhost/commerce',AUTH_OUTBOX_KEY:'a'.repeat(64) });
    assert.equal(readRuntimeConfig().driver, 'postgres');
    for(const key of ['', 'not-hex', 'a'.repeat(63)]){process.env.AUTH_OUTBOX_KEY=key;assert.throws(readRuntimeConfig,/AUTH_OUTBOX_KEY/);}
    process.env.AUTH_OUTBOX_KEY='a'.repeat(64);
    for(const schema of ['other','']){process.env.DATABASE_URL='postgresql://localhost/commerce?schema='+schema;assert.throws(readRuntimeConfig,/public schema/);}
    Object.assign(process.env, valid, {
      NODE_ENV: 'staging',
      DATA_DRIVER: 'postgres',
      DEMO_AUTH_ENABLED: 'false',
      DATABASE_URL: 'postgresql://localhost/commerce?schema=public',
      AUTH_OUTBOX_KEY: 'a'.repeat(64),
      OBJECT_STORAGE: 's3',
      NOTIFICATION_PROVIDER: 'ses',
      CORS_ORIGINS: 'https://admin.staging.example.test,https://shop.staging.example.test',
      HOST: '0.0.0.0',
    });
    assert.equal(readRuntimeConfig().mode, 'staging');
    for (const invalid of [
      { DATA_DRIVER: 'memory' },
      { DEMO_AUTH_ENABLED: 'true' },
      { OBJECT_STORAGE: 'local' },
      { NOTIFICATION_PROVIDER: 'development' },
      { CORS_ORIGINS: 'http://admin.staging.example.test' },
      { HOST: '127.0.0.1' },
    ]) {
      Object.assign(process.env, valid, {
        NODE_ENV: 'staging', DATA_DRIVER: 'postgres', DEMO_AUTH_ENABLED: 'false',
        DATABASE_URL: 'postgresql://localhost/commerce?schema=public', AUTH_OUTBOX_KEY: 'a'.repeat(64),
        OBJECT_STORAGE: 's3', NOTIFICATION_PROVIDER: 'ses', CORS_ORIGINS: 'https://admin.staging.example.test', HOST: '0.0.0.0',
      }, invalid);
      assert.throws(readRuntimeConfig);
    }
  } finally {
    for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
