import { describe, expect, it } from 'vitest';
import { ownedRootDomains, storefrontSubdomainForHost } from '@/lib/domainRouting';

const reserved = new Set(['www', 'api', 'clerk']);

describe('domain routing helpers', () => {
  it('deduplicates primary and fallback owned roots', () => {
    expect(ownedRootDomains('souqna.qa', 'souqna.co')).toEqual(['souqna.qa', 'souqna.co']);
    expect(ownedRootDomains('souqna.qa', 'souqna.qa')).toEqual(['souqna.qa']);
  });

  it('extracts storefront subdomains from primary and fallback roots', () => {
    const roots = ownedRootDomains('souqna.qa', 'souqna.co');

    expect(storefrontSubdomainForHost('noura.souqna.qa', roots, reserved)).toBe('noura');
    expect(storefrontSubdomainForHost('noura.souqna.co', roots, reserved)).toBe('noura');
  });

  it('leaves apex, reserved, nested, and unrelated hosts alone', () => {
    const roots = ownedRootDomains('souqna.qa', 'souqna.co');

    expect(storefrontSubdomainForHost('souqna.qa', roots, reserved)).toBeNull();
    expect(storefrontSubdomainForHost('www.souqna.qa', roots, reserved)).toBeNull();
    expect(storefrontSubdomainForHost('a.b.souqna.qa', roots, reserved)).toBeNull();
    expect(storefrontSubdomainForHost('shop.example.com', roots, reserved)).toBeNull();
  });
});
