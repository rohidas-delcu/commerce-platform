import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { decryptMail } from '../../dist/identity/infrastructure/secrets.js';

test('merchant identity HTTP lifecycle: verification, CSRF, sessions, rotation, recovery, suspension and throttling', {timeout: 60000}, async t => {
  assert.ok(process.env.DATABASE_URL);
  const key = 'a'.repeat(64); // Non-production fixture key, never used for an application deployment.
  const previous = process.env.AUTH_OUTBOX_KEY;
  process.env.AUTH_OUTBOX_KEY = key;
  const db = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
  // Clean only this harness's shared loopback limiter fixtures; use a disposable DB.
  const limiterKeys = ['browser','mutation'].map(kind => createHash('sha256').update(`${kind}:127.0.0.1:${Math.floor(Date.now()/900000)}`).digest('hex'));
  await db.identityThrottle.deleteMany({where:{key:{in:limiterKeys}}});
  const port = 17000 + Math.floor(Math.random()*1000), base = `http://127.0.0.1:${port}/v1/auth`;
  const child = spawn(process.execPath, ['dist/main.js'], {cwd: new URL('../../', import.meta.url),
    env: {...process.env, NODE_ENV: 'development', DATA_DRIVER: 'postgres', DEMO_AUTH_ENABLED: 'false', PORT: String(port), AUTH_OUTBOX_KEY: key}, stdio: ['ignore','pipe','pipe']});
  let logs = '';
  child.stdout.on('data', b => {logs += b;}); child.stderr.on('data', b => {logs += b;});
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit'), timer = setTimeout(() => child.kill('SIGKILL'), 5000); timer.unref();
      child.kill('SIGTERM'); const [,signal] = await ended; clearTimeout(timer); assert.notEqual(signal, 'SIGKILL');
    }
    await db.identityThrottle.deleteMany({where:{key:{in:limiterKeys}}});
    await db.$disconnect();
    if (previous === undefined) delete process.env.AUTH_OUTBOX_KEY; else process.env.AUTH_OUTBOX_KEY = previous;
  });
  for (let i=0; i<100; i++) {
    assert.equal(child.exitCode, null, 'API must stay running.');
    try {if ((await fetch(`http://127.0.0.1:${port}/health/ready`)).ok) break;} catch {}
    await delay(100);
  }
  const browser = () => ({cookie: '', csrf: ''});
  async function request(b, path, method='GET', body, csrf=true) {
    const response = await fetch(base+path, {method, headers: {cookie:b.cookie, origin:'http://localhost:5173', 'content-type':'application/json', ...(csrf ? {'x-csrf-token': b.csrf} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
    const cookie = response.headers.get('set-cookie'); if (cookie) b.cookie = cookie.split(';')[0];
    const result = await response.json(); if (result.csrfToken) b.csrf = result.csrfToken;
    return {status:response.status, body:result};
  }
  const email = `identity-${randomUUID()}@example.test`, password = 'a long unique merchant password 314159';
  const b = browser(); assert.equal((await request(b,'/csrf')).status,200);
  assert.equal((await request(b,'/signup','POST',{email,password,name:'Merchant'},false)).status,403);
  assert.equal((await request(b,'/signup','POST',{email,password,name:'Merchant'})).status,201);
  assert.equal((await request(b,'/signup','POST',{email,password:'another long password which must not replace',name:'Overwrite'})).status,201);
  const identity = await db.identity.findUniqueOrThrow({where:{scopeKey_email:{scopeKey:'merchant',email}}});
  assert.match(identity.passwordHash,/^\$argon2id\$/);
  assert.equal((await request(b,'/login','POST',{email,password})).status,401);
  async function challenge(purpose) {
    const mail = await db.identityMail.findFirstOrThrow({where:{recipient:email,purpose},orderBy:{createdAt:'desc'}});
    const token = decryptMail(mail.encryptedPayload).token;
    assert.ok(!mail.encryptedPayload.includes(token)); return token;
  }
  const verification = await challenge('VERIFY');
  const verificationRace=await Promise.all([request(b,'/verification/confirm','POST',{token:verification}),request({...b},'/verification/confirm','POST',{token:verification})]);
  assert.deepEqual(verificationRace.map(r=>r.status).sort(),[201,400]);
  assert.equal((await request(b,'/verification/confirm','POST',{token:verification})).status,400);
  assert.equal((await request(b,'/login','POST',{email,password:'incorrect'})).status,401);
  assert.equal((await request(b,'/login','POST',{email,password})).status,201);
  const beforeReload=b.cookie; await request(b,'/csrf'); assert.equal(b.cookie,beforeReload,'CSRF bootstrap must preserve the signed-in session.');
  const me = await request(b,'/me'); assert.equal(me.body.email,email); assert.equal('passwordHash' in me.body,false);
  assert.equal((await request(b,'/me','PATCH',{name:'Updated'},false)).status,403);
  assert.equal((await request(b,'/me','PATCH',{name:'Updated'})).body.name,'Updated');
  const stolen = {...b};
  assert.equal((await request(b,'/session/refresh','POST',{})).status,201);
  assert.notEqual(b.cookie,stolen.cookie);
  assert.equal((await request(stolen,'/session/refresh','POST',{})).status,401);
  assert.equal((await request(b,'/me')).status,401,'Replay revokes the rotated family.');
  async function login() {const next=browser(); await request(next,'/csrf'); assert.equal((await request(next,'/login','POST',{email,password})).status,201); return next;}
  const one=await login(), two=await login();
  assert.equal((await request(one,'/logout-all','POST',{})).status,201);
  assert.equal((await request(two,'/me')).status,401);
  const current = await login();
  const list = await request(current,'/sessions'); assert.equal(list.status,200); assert.ok(list.body.length>0);
  const victim=await login(); const victimSession=await db.identitySessionSecret.findUniqueOrThrow({where:{digest: (await import('node:crypto')).createHash('sha256').update(victim.cookie.split('=')[1]).digest('hex')}});
  assert.equal((await request(current,`/sessions/${victimSession.sessionId}`,'DELETE')).status,200);
  assert.equal((await request(victim,'/me')).status,401);
  await db.identity.update({where:{id:identity.id},data:{status:'SUSPENDED'}});
  assert.equal((await request(current,'/me')).status,401);
  await db.identity.update({where:{id:identity.id},data:{status:'ACTIVE'}});
  assert.equal((await request(current,'/me')).status,401,'Reactivation must not revive suspended sessions.');
  const recovery=browser(); await request(recovery,'/csrf');
  assert.equal((await request(recovery,'/password/forgot','POST',{email})).status,201);
  const expired=await challenge('RESET');
  await db.identityChallenge.updateMany({where:{identityId:identity.id,purpose:'RESET',consumedAt:null},data:{expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await request(recovery,'/password/reset','POST',{token:expired,password})).status,400);
  await request(recovery,'/password/forgot','POST',{email});
  const reset=await challenge('RESET'), newPassword='replacement long merchant password 271828';
  assert.equal((await request(recovery,'/password/reset','POST',{token:reset,password:newPassword})).status,201);
  assert.equal((await request(recovery,'/password/reset','POST',{token:reset,password:newPassword})).status,400);
  assert.equal((await request(current,'/me')).status,401);
  assert.equal((await request(recovery,'/login','POST',{email,password:newPassword})).status,201);
  assert.equal((await request(recovery,'/password/change','POST',{currentPassword:newPassword,password:password})).status,201);
  assert.equal((await request(recovery,'/me')).status,401);
  const unknown=`unknown-${randomUUID()}@example.test`, brute=browser(); await request(brute,'/csrf');
  for (let i=0;i<10;i++) assert.equal((await request(brute,'/login','POST',{email:unknown,password})).status,401);
  assert.equal((await request(brute,'/login','POST',{email:unknown,password})).status,429);
  assert.ok(!logs.includes(password)); assert.ok(!logs.includes(verification)); assert.ok(!logs.includes(reset));
  assert.ok((await db.identityAudit.count({where:{identityId:identity.id}}))>=5);
});
