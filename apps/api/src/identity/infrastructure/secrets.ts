import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export const secret = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function key() {
  const value = process.env.AUTH_OUTBOX_KEY;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new Error('AUTH_OUTBOX_KEY must be a securely provisioned 32-byte hex key.');
  return Buffer.from(value, 'hex');
}
export function encryptMail(payload: { token: string }) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
// For the trusted delivery adapter/test harness only; never a public HTTP endpoint.
export function decryptMail(value: string): { token: string } {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
