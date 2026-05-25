export function ownedRootDomains(primary: string, fallback?: string | null): string[] {
  return Array.from(new Set([primary, fallback].filter((root): root is string => Boolean(root))));
}

export function storefrontSubdomainForHost(
  host: string,
  roots: string[],
  reservedHosts: ReadonlySet<string>,
): string | null {
  const cleanHost = host.split(':')[0]?.toLowerCase() ?? '';
  for (const root of roots) {
    if (!cleanHost.endsWith(`.${root}`)) continue;
    const sub = cleanHost.slice(0, -1 * (`.${root}`.length));
    if (!sub || sub.includes('.')) return null;
    if (reservedHosts.has(sub)) return null;
    return sub;
  }
  return null;
}
