import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * AES-256-GCM at-rest encryption for plugin credentials.
 *
 * Format: base64(iv|authTag|ciphertext) where iv = 12 bytes,
 * authTag = 16 bytes. Ciphertext is the raw plaintext bytes.
 *
 * Key derivation: APPS_ENCRYPTION_KEY (any length ≥ 16 chars) is fed
 * through SHA-256 to produce the 32-byte key. This lets operators
 * either supply a real 32-byte base64 string or any sufficiently long
 * passphrase. Local dev falls back to a deterministic key derived
 * from CLERK_SECRET_KEY + a static salt so seeded data is decryptable
 * across restarts.
 */

function deriveKey(): Buffer {
  const raw = env.APPS_ENCRYPTION_KEY;
  if (raw) return createHash('sha256').update(raw, 'utf8').digest();
  const fallback = env.CLERK_SECRET_KEY ?? 'souqna-apps-fallback-secret-DEV-ONLY';
  return createHash('sha256').update(`souqna:apps:${fallback}`, 'utf8').digest();
}

const KEY = (() => {
  try {
    return deriveKey();
  } catch {
    return null;
  }
})();

export function encryptToken(plaintext: string | null | undefined): string {
  if (!plaintext) return '';
  if (!KEY) {
    console.warn('[apps/crypto] no key available, refusing to encrypt');
    throw new Error('Apps encryption is not configured.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(ciphertext: string | null | undefined): string {
  if (!ciphertext) return '';
  if (!KEY) {
    console.warn('[apps/crypto] no key available, refusing to decrypt');
    return '';
  }
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < 28) return '';
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('[apps/crypto] decrypt failed', err);
    return '';
  }
}

/**
 * Random opaque string used as the OAuth `state` param. Pinned to the
 * `oauth_state` table so the callback can verify the round-trip.
 */
export function newOAuthStateToken(): string {
  return randomBytes(32).toString('base64url');
}
