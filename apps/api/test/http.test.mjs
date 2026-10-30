import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateProductDto, CreateProductDto } from '../src/http/commerce.dto.ts';
import { LocalDemoAuthGuard } from '../src/http/commerce.controller.ts';
import { DomainErrorFilter } from '../src/http/domain-error.filter.ts';
import { DomainError } from '../src/domain/commerce.ts';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

test('PATCH validation rejects explicit nulls, wrong types and unknown fields; compare price may clear', async () => {
  for (const field of ['name', 'handle', 'description', 'collection', 'priceMinor']) {
    await assert.rejects(pipe.transform({ [field]: null }, { type: 'body', metatype: UpdateProductDto }), BadRequestException);
  }
  for (const input of [{ priceMinor: 1 }, { priceMinor: '1.5' }, { extra: true }]) {
    await assert.rejects(pipe.transform(input, { type: 'body', metatype: UpdateProductDto }), BadRequestException);
  }
  assert.equal((await pipe.transform({ compareMinor: null }, { type: 'body', metatype: UpdateProductDto })).compareMinor, null);
  await assert.rejects(pipe.transform({ name: 'Bag', handle: 'bag', priceMinor: '100', variants: [{ name: 'One', sku: 'XX', stock: -1 }] }, { type: 'body', metatype: CreateProductDto }), BadRequestException);
});

test('all error sources use a consistent envelope and hide unexpected exception details', () => {
  const filter = new DomainErrorFilter();
  for (const [error, status, code] of [[new DomainError('CONFLICT', 'Already exists.'), 409, 'CONFLICT'], [new BadRequestException(['Invalid field']), 400, 'INVALID'], [new Error('postgresql://secret:password@private/db'), 500, 'INTERNAL']]) {
    let result;
    const response = { status(value) { assert.equal(value, status); return this; }, json(value) { result = value; } };
    filter.catch(error, { switchToHttp: () => ({ getResponse: () => response }) });
    assert.equal(result.statusCode, status); assert.equal(result.code, code);
    assert.ok(!JSON.stringify(result).includes('password'));
  }
});

test('demo guard fails closed outside explicit opted-in development', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED };
  const guard = new LocalDemoAuthGuard();
  const context = subject => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-demo-subject-id': subject } }) }) });
  try {
    process.env.DEMO_AUTH_ENABLED = 'true';
    for (const mode of ['production', 'staging', 'test', '']) {
      process.env.NODE_ENV = mode;
      assert.throws(() => guard.canActivate(context('demo-merchant')));
    }
    process.env.NODE_ENV = 'development'; process.env.DEMO_AUTH_ENABLED = 'false';
    assert.throws(() => guard.canActivate(context('demo-merchant')));
    process.env.DEMO_AUTH_ENABLED = 'true';
    for (const subject of [undefined, ['demo-merchant'], '../admin']) assert.throws(() => guard.canActivate(context(subject)));
    assert.equal(guard.canActivate(context('demo-merchant')), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});


test('application logging never emits raw driver errors or secrets', async () => {
  const { ApplicationLogger } = await import('../src/config/logger.ts');
  const logger = new ApplicationLogger('Test', { json: true });
  let output = '';
  const stdout = process.stdout.write, stderr = process.stderr.write;
  try {
    process.stdout.write = process.stderr.write = chunk => { output += chunk; return true; };
    logger.error(new Error('postgresql://private:password@host/db'));
    logger.error('SQL parameters contain private-customer-data');
  } finally { process.stdout.write = stdout; process.stderr.write = stderr; }
  assert.ok(output.includes('application_error'));
  assert.ok(!output.includes('password'));
  assert.ok(!output.includes('private-customer-data'));
});
