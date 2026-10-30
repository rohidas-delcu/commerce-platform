import { hash, verify, Algorithm } from '@node-rs/argon2';
import type { IdentityAuthorityPort } from '../domain/identity.js';

export class FirstPartyIdentityAuthority implements IdentityAuthorityPort {
  hash(password: string) {
    return hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  }
  verify(encoded: string, password: string) { return verify(encoded, password); }
}
