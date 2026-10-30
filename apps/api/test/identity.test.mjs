import assert from 'node:assert/strict';
import test from 'node:test';
import {emailAddress,passwordPolicy} from '../src/identity/domain/identity.ts';
import {FirstPartyIdentityAuthority} from '../src/identity/infrastructure/credentials.ts';
import {encryptMail,decryptMail,digest,secret} from '../src/identity/infrastructure/secrets.ts';

test('identity normalizes email and preserves strong passphrase requirements', () => {
  assert.equal(emailAddress('  Merchant@Example.test '),'merchant@example.test');
  for (const invalid of ['invalid','x y@example.test','a@localhost']) assert.throws(()=>emailAddress(invalid));
  for (const invalid of ['short','x'.repeat(129),'long passphrase\u0000value']) assert.throws(()=>passwordPolicy(invalid));
  passwordPolicy('a long merchant passphrase');
});
test('maintained Argon2id adapter salts passwords and verifies without plaintext persistence', async () => {
  const adapter=new FirstPartyIdentityAuthority(), password='a long merchant passphrase';
  const first=await adapter.hash(password), second=await adapter.hash(password);
  assert.match(first,/^\$argon2id\$/); assert.notEqual(first,second);
  assert.equal(await adapter.verify(first,password),true); assert.equal(await adapter.verify(first,'wrong'),false);
});
test('development mail is authenticated encryption and challenge persistence uses digests', () => {
  const previous=process.env.AUTH_OUTBOX_KEY; process.env.AUTH_OUTBOX_KEY='b'.repeat(64);
  try {
    const token=secret(), payload=encryptMail({token});
    assert.notEqual(digest(token),token); assert.ok(!payload.includes(token));
    assert.equal(decryptMail(payload).token,token);
    const bytes=Buffer.from(payload,'base64url'); bytes[20]^=1;
    assert.throws(()=>decryptMail(bytes.toString('base64url')));
    process.env.AUTH_OUTBOX_KEY='c'.repeat(64); assert.throws(()=>decryptMail(payload));
  } finally {if(previous===undefined)delete process.env.AUTH_OUTBOX_KEY;else process.env.AUTH_OUTBOX_KEY=previous;}
});
