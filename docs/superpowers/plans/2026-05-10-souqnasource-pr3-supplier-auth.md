# SouqnaSource PR 3 — Supplier Auth + Claim Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Qatari supplier claim their scraped supplier row via WhatsApp OTP, get a Souqna-issued session, and land in a "Coming soon — chat next week" inbox stub. The inbox itself is built in PR 4; this PR ships the auth surface only.

**Architecture:** Two new DB tables (`souqnasource_supplier_accounts`, `souqnasource_supplier_account_links`, `souqnasource_claim_otps`). OTPs are 6 digits, scrypt-hashed, 10-min TTL, max 5 attempts. Sessions are signed JWTs in an HttpOnly cookie `sq_supplier_session` (separate from Clerk; cookie name + middleware path-scope keep the two auth realms apart). WhatsApp OTPs send via the existing Meta WhatsApp Business Cloud API integration; reuse the `whatsapp-business` plugin's env vars + helper.

**Tech Stack:** Node `crypto.scryptSync` + native `crypto.subtle.digest` for hashing; Web Crypto for HMAC-signed JWT (no JWT library needed); Meta WhatsApp Cloud API via direct `fetch`. Builds on PR 1 + PR 2.

**Spec reference:** `docs/superpowers/specs/2026-05-10-souqnasource-design.md` §1.2, §3.7 (wa.me claim line — already added in PR 2), §3.8, §3.9 (Pusher auth schema only — actual Pusher channels in PR 4), §6.4 (security: supplier auth), §6.5 (PR 3 row).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/db/migrations/033_souqnasource_supplier_auth.sql` | 3 new tables |
| `src/lib/apps/souqnasource/auth/jwt.ts` | HMAC-SHA256 signed compact JWT (no external dep) |
| `src/lib/apps/souqnasource/auth/otp.ts` | 6-digit code generation + scrypt hash + verify |
| `src/lib/apps/souqnasource/auth/session.ts` | Cookie read/write + session shape `{accountId}` |
| `src/lib/apps/souqnasource/auth/whatsapp-send.ts` | Send WhatsApp template message via Meta Cloud API |
| `src/lib/apps/souqnasource/claim.ts` | Orchestrate request-OTP / verify-OTP business rules |
| `src/lib/apps/souqnasource/accounts.ts` | DAO for `souqnasource_supplier_accounts` + links |
| `src/middleware.ts` | Add `/supplier/*` JWT check (preserve Clerk middleware order) |
| `src/app/api/apps/souqnasource/claim/otp/route.ts` | POST: request-OTP. PUT: verify-OTP. |
| `src/app/supplier/layout.tsx` | Minimal supplier shell |
| `src/app/supplier/claim/[supplierId]/page.tsx` | Claim landing (input form + OTP) |
| `src/app/supplier/inbox/page.tsx` | "Coming soon" placeholder (PR 4 fills it in) |
| `src/app/api/apps/souqnasource/supplier/sign-out/route.ts` | Clear cookie |

---

## Task 1: Migration 033 — supplier auth tables

**Files:**
- Create: `src/db/migrations/033_souqnasource_supplier_auth.sql`

- [ ] **Step 1: Write migration**

```sql
-- 033_souqnasource_supplier_auth.sql
create table souqnasource_supplier_accounts (
  id text primary key,
  whatsapp text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table souqnasource_supplier_account_links (
  account_id text not null references souqnasource_supplier_accounts(id) on delete cascade,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  primary key (account_id, supplier_id)
);

create table souqnasource_claim_otps (
  id text primary key,
  supplier_id text not null references souqnasource_suppliers(id) on delete cascade,
  whatsapp text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index on souqnasource_claim_otps (whatsapp, expires_at);
```

- [ ] **Step 2: Apply**

```bash
npm run migrate
```

Expected: applies 033.

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/033_souqnasource_supplier_auth.sql
git commit -m "feat(souqnasource): supplier auth tables migration 033"
```

---

## Task 2: HMAC JWT helper

**Files:**
- Create: `src/lib/apps/souqnasource/auth/jwt.ts`
- Create: `tests/unit/souqnasource/jwt.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/jwt.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { signJwt, verifyJwt } from '@/lib/apps/souqnasource/auth/jwt';

beforeAll(() => {
  process.env.SOUQNASOURCE_SUPPLIER_JWT_SECRET = 'a'.repeat(64);
});

describe('JWT', () => {
  it('round-trips a payload', async () => {
    const tok = await signJwt({ sub: 'acc-123', exp: Math.floor(Date.now() / 1000) + 60 });
    const out = await verifyJwt(tok);
    expect(out?.sub).toBe('acc-123');
  });

  it('rejects tampered token', async () => {
    const tok = await signJwt({ sub: 'acc-123', exp: Math.floor(Date.now() / 1000) + 60 });
    const tampered = tok.slice(0, -2) + 'aa';
    expect(await verifyJwt(tampered)).toBeNull();
  });

  it('rejects expired token', async () => {
    const tok = await signJwt({ sub: 'acc-123', exp: Math.floor(Date.now() / 1000) - 1 });
    expect(await verifyJwt(tok)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement** (using Web Crypto, no deps)

```ts
// src/lib/apps/souqnasource/auth/jwt.ts
type Payload = { sub: string; exp: number; iss?: string };

const enc = new TextEncoder();
const dec = new TextDecoder();
const ISS = 'souqna-supplier';

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SOUQNASOURCE_SUPPLIER_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SOUQNASOURCE_SUPPLIER_JWT_SECRET missing or too short');
  }
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJwt(payload: Omit<Payload, 'iss'>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body: Payload = { ...payload, iss: ISS };
  const head = b64url(enc.encode(JSON.stringify(header)));
  const pl = b64url(enc.encode(JSON.stringify(body)));
  const data = `${head}.${pl}`;
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifyJwt(token: string): Promise<Payload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, pl, sig] = parts;
  const ok = await crypto.subtle.verify(
    'HMAC',
    await key(),
    b64urlDecode(sig!),
    enc.encode(`${head}.${pl}`),
  );
  if (!ok) return null;
  try {
    const body = JSON.parse(dec.decode(b64urlDecode(pl!))) as Payload;
    if (body.iss !== ISS) return null;
    if (body.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof body.sub !== 'string' || body.sub.length === 0) return null;
    return body;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run** — Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/auth/jwt.ts tests/unit/souqnasource/jwt.test.ts
git commit -m "feat(souqnasource): add HMAC JWT helper"
```

---

## Task 3: OTP generation + scrypt hash

**Files:**
- Create: `src/lib/apps/souqnasource/auth/otp.ts`
- Create: `tests/unit/souqnasource/otp.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/unit/souqnasource/otp.test.ts
import { describe, it, expect } from 'vitest';
import { generateOtp, hashOtp, verifyOtp } from '@/lib/apps/souqnasource/auth/otp';

describe('OTP', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOtp();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('verifies a hashed code', async () => {
    const code = generateOtp();
    const h = await hashOtp(code);
    expect(await verifyOtp(code, h)).toBe(true);
    expect(await verifyOtp('000000', h)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/auth/otp.ts
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

export function generateOtp(): string {
  // 6 digits, uniform
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, '0');
}

export async function hashOtp(code: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(code, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  const derived = scryptSync(code, salt, expected.length, { N, r, p });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
```

- [ ] **Step 4: Run** — Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/auth/otp.ts tests/unit/souqnasource/otp.test.ts
git commit -m "feat(souqnasource): add OTP gen + scrypt hash"
```

---

## Task 4: Session cookie helper

**Files:**
- Create: `src/lib/apps/souqnasource/auth/session.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/auth/session.ts
import { cookies } from 'next/headers';
import { signJwt, verifyJwt } from './jwt';

const COOKIE_NAME = 'sq_supplier_session';
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function issueSupplierSession(accountId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const tok = await signJwt({ sub: accountId, exp });
  cookies().set({
    name: COOKIE_NAME,
    value: tok,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function clearSupplierSession(): Promise<void> {
  cookies().set({ name: COOKIE_NAME, value: '', maxAge: 0, path: '/' });
}

export async function readSupplierSession(): Promise<{ accountId: string } | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  const payload = await verifyJwt(c.value);
  return payload ? { accountId: payload.sub } : null;
}

/** For middleware (request context, no `cookies()`) */
export async function readSupplierSessionFromRequest(req: Request): Promise<{ accountId: string } | null> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)sq_supplier_session=([^;]+)/);
  if (!m) return null;
  const payload = await verifyJwt(decodeURIComponent(m[1]!));
  return payload ? { accountId: payload.sub } : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/auth/session.ts
git commit -m "feat(souqnasource): add supplier session helpers"
```

---

## Task 5: WhatsApp send helper

**Files:**
- Create: `src/lib/apps/souqnasource/auth/whatsapp-send.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/auth/whatsapp-send.ts
type SendTemplateInput = {
  to: string;                 // E.164, no leading '+'
  templateName: string;       // e.g. 'souqna_otp_v1'
  languageCode: string;       // e.g. 'ar' or 'en'
  bodyParams: string[];
};

export async function sendWhatsAppTemplate(input: SendTemplateInput): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_APP_SECRET; // long-lived system user token in prod
  // NOTE: Souqna's existing whatsapp-business plugin (src/lib/apps/whatsapp.ts)
  // already wires Graph API auth. Reuse that helper if it exposes a
  // `sendTemplate` function; only fall back to this code path if not.
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v22.0';
  if (!phoneNumberId || !token) throw new Error('whatsapp_not_configured');

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: [
          {
            type: 'body',
            parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`whatsapp_send_failed: ${res.status} ${body.slice(0, 200)}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/auth/whatsapp-send.ts
git commit -m "feat(souqnasource): add WhatsApp template send helper"
```

---

## Task 6: Accounts DAO

**Files:**
- Create: `src/lib/apps/souqnasource/accounts.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/apps/souqnasource/accounts.ts
import { unstable_noStore as noStore } from 'next/cache';
import { db } from '@/lib/db';

export type SupplierAccount = {
  id: string;
  whatsapp: string;
  displayName: string | null;
  createdAt: string;
  lastActiveAt: string | null;
};

type Row = {
  id: string;
  whatsapp: string;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
};

function fromRow(r: Row): SupplierAccount {
  return {
    id: r.id, whatsapp: r.whatsapp, displayName: r.display_name,
    createdAt: r.created_at, lastActiveAt: r.last_active_at,
  };
}

export async function findAccountByWhatsapp(whatsapp: string): Promise<SupplierAccount | null> {
  noStore();
  const rows = (await db()`
    select * from souqnasource_supplier_accounts where whatsapp = ${whatsapp} limit 1
  `) as unknown as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createAccount(whatsapp: string, displayName: string | null): Promise<SupplierAccount> {
  const id = `sa_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const rows = (await db()`
    insert into souqnasource_supplier_accounts (id, whatsapp, display_name)
    values (${id}, ${whatsapp}, ${displayName})
    returning *
  `) as unknown as Row[];
  return fromRow(rows[0]!);
}

export async function linkAccountToSupplier(accountId: string, supplierId: string): Promise<void> {
  await db()`
    insert into souqnasource_supplier_account_links (account_id, supplier_id)
    values (${accountId}, ${supplierId})
    on conflict do nothing
  `;
}

export async function listSuppliersForAccount(accountId: string): Promise<string[]> {
  noStore();
  const rows = (await db()`
    select supplier_id from souqnasource_supplier_account_links where account_id = ${accountId}
  `) as unknown as { supplier_id: string }[];
  return rows.map((r) => r.supplier_id);
}

export async function touchAccountActivity(accountId: string): Promise<void> {
  await db()`update souqnasource_supplier_accounts set last_active_at = now() where id = ${accountId}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/apps/souqnasource/accounts.ts
git commit -m "feat(souqnasource): add supplier accounts DAO"
```

---

## Task 7: Claim flow business logic

**Files:**
- Create: `src/lib/apps/souqnasource/claim.ts`
- Create: `tests/integration/souqnasource/claim.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/integration/souqnasource/claim.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { upsertSupplier } from '@/lib/apps/souqnasource/suppliers';

vi.mock('@/lib/apps/souqnasource/auth/whatsapp-send', () => ({
  sendWhatsAppTemplate: vi.fn().mockResolvedValue(undefined),
}));

import { requestClaimOtp, verifyClaimOtp } from '@/lib/apps/souqnasource/claim';

const sid = `claim-test-supplier-${Date.now()}`;

beforeAll(async () => {
  process.env.SOUQNASOURCE_SUPPLIER_JWT_SECRET = 'b'.repeat(64);
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
  process.env.META_APP_SECRET = 'tok';
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'souqna_otp_v1';
  await upsertSupplier({
    id: sid, displayName: 'Claim Co', crNumber: null,
    whatsapp: '+97455555555', area: 'najma',
    sourceNetwork: 'qatarliving', sourceProfileUrl: null,
  });
});

afterAll(async () => {
  await db()`delete from souqnasource_claim_otps where supplier_id = ${sid}`;
  await db()`delete from souqnasource_supplier_account_links where supplier_id = ${sid}`;
  await db()`delete from souqnasource_suppliers where id = ${sid}`;
  await db()`delete from souqnasource_supplier_accounts where whatsapp = '+97455555555'`;
});

describe('claim flow', () => {
  it('issues an OTP row and verifies it', async () => {
    const { otpId, plaintextForTest } = await requestClaimOtp({
      supplierId: sid,
      whatsapp: '+97455555555',
    });
    expect(otpId).toBeTruthy();

    const account = await verifyClaimOtp({
      otpId,
      code: plaintextForTest,
    });
    expect(account.id).toBeTruthy();

    const links = (await db()`
      select supplier_id from souqnasource_supplier_account_links where account_id = ${account.id}
    `) as unknown as { supplier_id: string }[];
    expect(links.find((l) => l.supplier_id === sid)).toBeTruthy();

    const claimed = (await db()`
      select claimed_at from souqnasource_suppliers where id = ${sid}
    `) as unknown as { claimed_at: string | null }[];
    expect(claimed[0]?.claimed_at).not.toBeNull();
  });

  it('rejects wrong OTP', async () => {
    const { otpId } = await requestClaimOtp({
      supplierId: sid,
      whatsapp: '+97455555555',
    });
    await expect(verifyClaimOtp({ otpId, code: '000000' })).rejects.toThrow('otp_invalid');
  });

  it('locks after 5 attempts', async () => {
    const { otpId } = await requestClaimOtp({
      supplierId: sid,
      whatsapp: '+97455555555',
    });
    for (let i = 0; i < 5; i++) {
      await expect(verifyClaimOtp({ otpId, code: '111111' })).rejects.toThrow();
    }
    await expect(verifyClaimOtp({ otpId, code: '111111' })).rejects.toThrow('otp_locked');
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/apps/souqnasource/claim.ts
import { db } from '@/lib/db';
import { generateOtp, hashOtp, verifyOtp } from './auth/otp';
import { sendWhatsAppTemplate } from './auth/whatsapp-send';
import {
  findAccountByWhatsapp,
  createAccount,
  linkAccountToSupplier,
  type SupplierAccount,
} from './accounts';
import { getSupplierById } from './suppliers';

export type RequestClaimOtpInput = {
  supplierId: string;
  whatsapp: string; // E.164
};

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

/**
 * Returns a fresh OTP row id. In test environments only, also returns the
 * plaintext code via `plaintextForTest`. Production callers MUST NOT log it.
 */
export async function requestClaimOtp(
  input: RequestClaimOtpInput,
): Promise<{ otpId: string; plaintextForTest?: string }> {
  const supplier = await getSupplierById(input.supplierId);
  if (!supplier) throw new Error('supplier_not_found');

  // Rate-limit: 3 per hour for the same (whatsapp, supplier_id)
  const recent = (await db()`
    select count(*)::int as n from souqnasource_claim_otps
    where supplier_id = ${input.supplierId}
      and whatsapp = ${input.whatsapp}
      and created_at > now() - interval '1 hour'
  `) as unknown as { n: number }[];
  if ((recent[0]?.n ?? 0) >= 3) throw new Error('otp_rate_limited_hour');

  const code = generateOtp();
  const codeHash = await hashOtp(code);
  const id = `otp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  await db()`
    insert into souqnasource_claim_otps
      (id, supplier_id, whatsapp, code_hash, expires_at)
    values
      (${id}, ${input.supplierId}, ${input.whatsapp}, ${codeHash},
       now() + (${OTP_TTL_MIN} * interval '1 minute'))
  `;

  // Determine language from supplier locale (default ar — Qatari supplier)
  const lang = 'ar';
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? 'souqna_otp_v1';
  await sendWhatsAppTemplate({
    to: input.whatsapp.replace(/^\+/, ''),
    templateName,
    languageCode: lang,
    bodyParams: [code],
  });

  if (process.env.NODE_ENV === 'test') return { otpId: id, plaintextForTest: code };
  return { otpId: id };
}

export async function verifyClaimOtp(input: {
  otpId: string;
  code: string;
}): Promise<SupplierAccount> {
  const rows = (await db()`
    select id, supplier_id, whatsapp, code_hash, expires_at, consumed_at, attempts
    from souqnasource_claim_otps
    where id = ${input.otpId}
    limit 1
  `) as unknown as {
    id: string;
    supplier_id: string;
    whatsapp: string;
    code_hash: string;
    expires_at: string;
    consumed_at: string | null;
    attempts: number;
  }[];
  const otp = rows[0];
  if (!otp) throw new Error('otp_not_found');
  if (otp.consumed_at) throw new Error('otp_consumed');
  if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error('otp_expired');
  if (otp.attempts >= MAX_ATTEMPTS) throw new Error('otp_locked');

  const ok = await verifyOtp(input.code, otp.code_hash);
  if (!ok) {
    await db()`update souqnasource_claim_otps set attempts = attempts + 1 where id = ${otp.id}`;
    if (otp.attempts + 1 >= MAX_ATTEMPTS) throw new Error('otp_locked');
    throw new Error('otp_invalid');
  }

  await db()`update souqnasource_claim_otps set consumed_at = now() where id = ${otp.id}`;

  // Upsert account, link, set claimed_at, backfill conversations later in PR 4.
  let account = await findAccountByWhatsapp(otp.whatsapp);
  if (!account) account = await createAccount(otp.whatsapp, null);
  await linkAccountToSupplier(account.id, otp.supplier_id);
  await db()`update souqnasource_suppliers set claimed_at = now() where id = ${otp.supplier_id}`;

  return account;
}
```

- [ ] **Step 4: Run** — Expected PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/apps/souqnasource/claim.ts tests/integration/souqnasource/claim.test.ts
git commit -m "feat(souqnasource): add claim OTP flow"
```

---

## Task 8: Claim API route

**Files:**
- Create: `src/app/api/apps/souqnasource/claim/otp/route.ts`

- [ ] **Step 1: Implement (POST = request, PUT = verify)**

```ts
// src/app/api/apps/souqnasource/claim/otp/route.ts
import { NextResponse } from 'next/server';
import { requestClaimOtp, verifyClaimOtp } from '@/lib/apps/souqnasource/claim';
import { issueSupplierSession } from '@/lib/apps/souqnasource/auth/session';

export const runtime = 'nodejs';

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: { supplierId?: string; whatsapp?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad('invalid_json');
  }
  if (typeof body.supplierId !== 'string' || typeof body.whatsapp !== 'string') {
    return bad('missing_fields');
  }
  // Normalize whatsapp to E.164 with leading '+'
  const wa = body.whatsapp.startsWith('+') ? body.whatsapp : `+${body.whatsapp.replace(/[^\d]/g, '')}`;
  try {
    const { otpId } = await requestClaimOtp({ supplierId: body.supplierId, whatsapp: wa });
    return NextResponse.json({ ok: true, otpId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'otp_rate_limited_hour') return bad('rate_limited', 429);
    if (msg === 'supplier_not_found') return bad('supplier_not_found', 404);
    return bad('send_failed', 500);
  }
}

export async function PUT(req: Request): Promise<Response> {
  let body: { otpId?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad('invalid_json');
  }
  if (typeof body.otpId !== 'string' || typeof body.code !== 'string') {
    return bad('missing_fields');
  }
  if (!/^\d{6}$/.test(body.code)) return bad('invalid_code');
  try {
    const account = await verifyClaimOtp({ otpId: body.otpId, code: body.code });
    await issueSupplierSession(account.id);
    return NextResponse.json({ ok: true, accountId: account.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'otp_invalid') return bad('invalid_code', 401);
    if (msg === 'otp_locked') return bad('locked', 423);
    if (msg === 'otp_expired') return bad('expired', 410);
    if (msg === 'otp_consumed') return bad('used', 410);
    return bad('verify_failed', 500);
  }
}
```

- [ ] **Step 2: Smoke**

```bash
curl -X POST http://localhost:3000/api/apps/souqnasource/claim/otp \
  -H 'content-type: application/json' \
  -d '{"supplierId":"qatarliving:doha-perfume-house","whatsapp":"+97455555555"}'
```

Expected: `{"ok":true,"otpId":"otp_..."}` (and a real WhatsApp message in production env, or a test stub).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/apps/souqnasource/claim/otp/route.ts
git commit -m "feat(souqnasource): add claim OTP API route"
```

---

## Task 9: Supplier middleware

**Files:**
- Modify: `src/middleware.ts`

The existing middleware is Clerk's. Add a supplier-scoped check that:
- Allows `/supplier/claim/*` and `/api/apps/souqnasource/claim/otp` to be anonymous.
- Requires a valid `sq_supplier_session` cookie for `/supplier/inbox` and any other `/supplier/*` route.
- Refuses to attach to `/dashboard/*` (Clerk owns those).

- [ ] **Step 1: Edit `src/middleware.ts`**

If the file uses `clerkMiddleware`, wrap the existing handler. Pseudocode below; adapt to whatever pattern exists:

```ts
// src/middleware.ts (illustrative — merge with the existing Clerk wrapper)
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { readSupplierSessionFromRequest } from '@/lib/apps/souqnasource/auth/session';

const SUPPLIER_PATH_RE = /^\/supplier(?:\/|$)/;
const SUPPLIER_PUBLIC_RE = /^\/supplier\/claim\//;

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);
  if (SUPPLIER_PATH_RE.test(url.pathname)) {
    if (SUPPLIER_PUBLIC_RE.test(url.pathname)) return; // anonymous claim landing
    const session = await readSupplierSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(new URL('/supplier/claim/missing', req.url));
    }
    return; // supplier-authenticated; do NOT also enforce Clerk auth on /supplier/*
  }
  // For /dashboard/*, /api/* etc., let Clerk's normal logic run.
});

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\..*).*)',
  ],
};
```

- [ ] **Step 2: Verify build**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(souqnasource): add /supplier/* JWT middleware"
```

---

## Task 10: Supplier shell + claim landing page

**Files:**
- Create: `src/app/supplier/layout.tsx`
- Create: `src/app/supplier/claim/[supplierId]/page.tsx`
- Create: `src/app/supplier/claim/missing/page.tsx`

- [ ] **Step 1: Layout**

```tsx
// src/app/supplier/layout.tsx
import './layout.css'; // optional minimal styles
export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="min-h-screen bg-zinc-50">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Souqna ◈</div>
          <nav className="text-sm text-zinc-600">
            <a href="/supplier/inbox">Inbox</a>
          </nav>
        </header>
        <main className="max-w-2xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Claim landing page**

```tsx
// src/app/supplier/claim/[supplierId]/page.tsx
import { ClaimForm } from './claim-form';
import { getSupplierById } from '@/lib/apps/souqnasource/suppliers';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: { supplierId: string } }) {
  const supplier = await getSupplierById(params.supplierId);
  if (!supplier) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Is this your business?</h1>
      <p>{supplier.displayName} {supplier.area && `· ${supplier.area}`}</p>
      <ClaimForm supplierId={supplier.id} />
    </div>
  );
}
```

```tsx
// src/app/supplier/claim/[supplierId]/claim-form.tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ClaimForm({ supplierId }: { supplierId: string }) {
  const [whatsapp, setWhatsapp] = useState('+974');
  const [stage, setStage] = useState<'request' | 'enter' | 'done'>('request');
  const [otpId, setOtpId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function request() {
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/apps/souqnasource/claim/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supplierId, whatsapp }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'failed'); return; }
      setOtpId(j.otpId);
      setStage('enter');
    });
  }

  function verify() {
    setError('');
    startTransition(async () => {
      const res = await fetch('/api/apps/souqnasource/claim/otp', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otpId, code }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'failed'); return; }
      setStage('done');
      router.push('/supplier/inbox');
    });
  }

  if (stage === 'request') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); request(); }} className="space-y-2">
        <label className="block">
          <span className="text-sm">WhatsApp number</span>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full border rounded p-2" />
        </label>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button disabled={pending} className="bg-zinc-900 text-white rounded px-3 py-2">
          Send code on WhatsApp
        </button>
      </form>
    );
  }

  if (stage === 'enter') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-2">
        <label className="block">
          <span className="text-sm">Enter the 6-digit code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            inputMode="numeric" pattern="\d{6}" className="w-full border rounded p-2 tracking-widest" />
        </label>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button disabled={pending} className="bg-zinc-900 text-white rounded px-3 py-2">Verify</button>
      </form>
    );
  }

  return <p>Done — redirecting…</p>;
}
```

- [ ] **Step 3: "Missing" landing for unauthenticated `/supplier/inbox` access**

```tsx
// src/app/supplier/claim/missing/page.tsx
export default function Page() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">No active session</h1>
      <p>You need to claim your supplier listing first. Find your link in the WhatsApp message a Souqna founder sent you.</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/supplier/
git commit -m "feat(souqnasource): add supplier claim landing pages"
```

---

## Task 11: Supplier inbox placeholder + sign-out

**Files:**
- Create: `src/app/supplier/inbox/page.tsx`
- Create: `src/app/api/apps/souqnasource/supplier/sign-out/route.ts`

- [ ] **Step 1: Inbox placeholder**

```tsx
// src/app/supplier/inbox/page.tsx
import { readSupplierSession } from '@/lib/apps/souqnasource/auth/session';
import { listSuppliersForAccount } from '@/lib/apps/souqnasource/accounts';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await readSupplierSession();
  if (!session) redirect('/supplier/claim/missing');
  const supplierIds = await listSuppliersForAccount(session.accountId);
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <p className="text-zinc-600">
        Chat is rolling out next week. You'll see all founder conversations here.
      </p>
      <p className="text-sm text-zinc-500">Claimed suppliers: {supplierIds.length}</p>
      <form action="/api/apps/souqnasource/supplier/sign-out" method="post">
        <button className="text-sm text-zinc-500 underline">Sign out</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Sign-out route**

```ts
// src/app/api/apps/souqnasource/supplier/sign-out/route.ts
import { NextResponse } from 'next/server';
import { clearSupplierSession } from '@/lib/apps/souqnasource/auth/session';

export async function POST(): Promise<Response> {
  await clearSupplierSession();
  return NextResponse.redirect(new URL('/supplier/claim/missing', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/supplier/inbox/ src/app/api/apps/souqnasource/supplier/
git commit -m "feat(souqnasource): add supplier inbox placeholder + sign-out"
```

---

## Task 12: End-to-end smoke

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Manual claim test**

1. Visit `/supplier/claim/<some-real-supplier-id>` (find one with `psql`: `select id from souqnasource_suppliers limit 1`).
2. Enter your real WhatsApp number.
3. Receive the 6-digit code on WhatsApp.
4. Enter it. Land on `/supplier/inbox`.
5. Verify cookie `sq_supplier_session` set, HttpOnly + Secure (in prod).
6. Verify `souqnasource_suppliers.claimed_at` is now non-null.
7. Verify `souqnasource_supplier_account_links` has the (account_id, supplier_id) row.
8. Sign out → redirect to `/supplier/claim/missing`.

- [ ] **Step 3: Verify Clerk routes still 200**

Visit any `/dashboard/<slug>/...` page → still shows the founder dashboard. Confirm middleware did not block.

- [ ] **Step 4: No commit (verification only)**

---

## Self-Review

1. **Spec coverage:** §1.2, §3.8, §6.4 (supplier auth + OTP) covered. ✓
2. **No placeholders.** Task 9's middleware is "illustrative — merge with existing Clerk wrapper" because we don't know the exact existing shape; engineer must Grep for the current `clerkMiddleware` invocation. Acceptable per the skill's "find via Grep" pattern in plans for established codebases.
3. **Type consistency:** `SupplierAccount.id` string everywhere; `verifyClaimOtp` returns `SupplierAccount`; session helpers always return `{accountId: string}`. ✓
4. **Each task ends with a commit.** ✓

---

## Acceptance criteria for PR 3

- All 12 tasks committed.
- `npm test` passes (3+ new tests on top of PR 2).
- A real Qatari WhatsApp number can claim a scraped supplier row end-to-end.
- `souqnasource_suppliers.claimed_at` set after successful claim.
- Cookie `sq_supplier_session` issued, HttpOnly + Secure in prod, JWT-verified on each `/supplier/*` request via middleware.
- 5-attempt lockout enforced; rate-limit (3/hour) enforced.
- `/supplier/inbox` shows the "Coming soon" banner.
- WhatsApp message arrives via the `souqna_otp_v1` template (must be pre-approved in Meta Business Manager — flag if blocked).
