/**
 * Team capability model.
 *
 * Two layers:
 *   1. Role presets (owner/admin/editor/viewer) map to a fixed set of
 *      enabled capabilities. Source of truth lives here so the UI and
 *      the access gate can never disagree.
 *   2. Per-member overrides stored as a sparse jsonb blob on
 *      `storefront_members.capabilities` — a key is only present when
 *      it diverges from the role preset (true grants, false revokes).
 *
 * Owners always have every capability and are not represented in the
 * `storefront_members` table — they are the `briefs.clerk_user_id`.
 */

export const CAPABILITIES = [
  'builder.edit',
  'products.manage',
  'orders.manage',
  'analytics.view',
  'settings.manage',
  'billing.manage',
  'apps.manage',
  'domains.manage',
  'team.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const ALL: Record<Capability, true> = Object.fromEntries(
  CAPABILITIES.map((c) => [c, true]),
) as Record<Capability, true>;

export const ROLE_PRESETS: Record<Role, Partial<Record<Capability, boolean>>> = {
  owner: ALL,
  admin: {
    'builder.edit': true,
    'products.manage': true,
    'orders.manage': true,
    'analytics.view': true,
    'settings.manage': true,
    'apps.manage': true,
    'domains.manage': true,
    'team.manage': true,
  },
  editor: {
    'builder.edit': true,
    'products.manage': true,
    'orders.manage': true,
    'analytics.view': true,
  },
  viewer: {
    'analytics.view': true,
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  'builder.edit': 'Edit storefront pages',
  'products.manage': 'Manage products & inventory',
  'orders.manage': 'Manage orders & fulfilment',
  'analytics.view': 'View analytics',
  'settings.manage': 'Edit storefront settings',
  'billing.manage': 'Manage billing & plan',
  'apps.manage': 'Install & configure apps',
  'domains.manage': 'Manage custom domains',
  'team.manage': 'Invite & manage team',
};

export type MemberLike = {
  role: Role;
  capabilities?: Partial<Record<Capability, boolean>> | null;
};

export function hasCapability(member: MemberLike, cap: Capability): boolean {
  if (member.role === 'owner') return true;
  const override = member.capabilities?.[cap];
  if (typeof override === 'boolean') return override;
  return Boolean(ROLE_PRESETS[member.role][cap]);
}

export function resolveCapabilities(member: MemberLike): Record<Capability, boolean> {
  const out = {} as Record<Capability, boolean>;
  for (const c of CAPABILITIES) out[c] = hasCapability(member, c);
  return out;
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function sanitizeCapabilities(
  input: unknown,
): Partial<Record<Capability, boolean>> {
  if (!input || typeof input !== 'object') return {};
  const out: Partial<Record<Capability, boolean>> = {};
  for (const c of CAPABILITIES) {
    const v = (input as Record<string, unknown>)[c];
    if (typeof v === 'boolean') out[c] = v;
  }
  return out;
}
