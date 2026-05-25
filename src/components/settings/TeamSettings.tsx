'use client';

import { useMemo, useState, useTransition } from 'react';
import { Surface, StatusBadge } from '@/components/admin/primitives';
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLE_LABELS,
  ROLE_PRESETS,
  hasCapability,
  type Capability,
  type Role,
} from '@/lib/team/capabilities';
import {
  inviteMember,
  removeMember,
  revokeInvite,
  updateMember,
} from '@/app/actions/team';

type ServerMember = {
  storefrontSlug: string;
  clerkUserId: string;
  clerkOrgId: string;
  role: Role;
  capabilities: Partial<Record<Capability, boolean>>;
  createdAt: Date | string;
};

type Profile = {
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

type Invitation = {
  id: string;
  emailAddress: string;
  role: string;
  status: string;
  createdAt: number;
};

type Props = {
  slug: string;
  currentUserId: string;
  ownerUserId: string;
  members: ServerMember[];
  invitations: Invitation[];
  profiles: Record<string, Profile>;
};

const INVITABLE_ROLES: Role[] = ['admin', 'editor', 'viewer'];

export function TeamSettings({
  slug,
  currentUserId,
  ownerUserId,
  members,
  invitations,
  profiles,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Compose the visible roster: synthetic owner row + members (excluding
  // any duplicate row in case the owner was also written into the table).
  const roster = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      kind: 'owner' | 'member';
      clerkUserId: string;
      role: Role;
      capabilities: Partial<Record<Capability, boolean>>;
    }> = [
      {
        kind: 'owner',
        clerkUserId: ownerUserId,
        role: 'owner',
        capabilities: {},
      },
    ];
    seen.add(ownerUserId);
    for (const m of members) {
      if (seen.has(m.clerkUserId)) continue;
      seen.add(m.clerkUserId);
      rows.push({
        kind: 'member',
        clerkUserId: m.clerkUserId,
        role: m.role,
        capabilities: m.capabilities,
      });
    }
    return rows;
  }, [members, ownerUserId]);

  function flash(state: { status: string; message?: string }, okMessage: string) {
    if (state.status === 'success') {
      setSuccess(okMessage);
      setError(null);
    } else if (state.status === 'error') {
      setError(state.message ?? 'Something went wrong.');
      setSuccess(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(error || success) && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            background: error
              ? 'color-mix(in srgb, #8b3a3a 14%, transparent)'
              : 'color-mix(in srgb, var(--admin-accent) 14%, transparent)',
            color: error ? '#8b3a3a' : 'var(--admin-accent)',
          }}
        >
          {error ?? success}
        </div>
      )}

      <InviteForm
        slug={slug}
        disabled={isPending}
        onSubmit={(payload) =>
          startTransition(async () => {
            const res = await inviteMember(payload);
            flash(res, `Invitation sent to ${payload.email}.`);
          })
        }
      />

      <Surface padding={0}>
        <header
          style={{
            padding: '16px 20px',
            borderBlockEnd:
              '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Members</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-muted)' }}>
            Owners always have full access. Admins, editors, and viewers can be
            customised per capability.
          </p>
        </header>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {roster.map((row, idx) => {
            const profile = profiles[row.clerkUserId] ?? {
              email: null,
              name: null,
              imageUrl: null,
            };
            const isSelf = row.clerkUserId === currentUserId;
            return (
              <li
                key={row.clerkUserId}
                style={{
                  padding: '14px 20px',
                  borderBlockStart:
                    idx === 0
                      ? 'none'
                      : '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
                }}
              >
                <MemberRow
                  slug={slug}
                  kind={row.kind}
                  isSelf={isSelf}
                  clerkUserId={row.clerkUserId}
                  role={row.role}
                  capabilities={row.capabilities}
                  profile={profile}
                  disabled={isPending}
                  onUpdate={(role, capabilities) =>
                    startTransition(async () => {
                      const res = await updateMember({
                        storefrontSlug: slug,
                        clerkUserId: row.clerkUserId,
                        role,
                        capabilities,
                      });
                      flash(res, 'Member updated.');
                    })
                  }
                  onRemove={() =>
                    startTransition(async () => {
                      const res = await removeMember({
                        storefrontSlug: slug,
                        clerkUserId: row.clerkUserId,
                      });
                      flash(res, 'Member removed.');
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </Surface>

      {invitations.length > 0 && (
        <Surface padding={0}>
          <header
            style={{
              padding: '16px 20px',
              borderBlockEnd:
                '1px solid color-mix(in srgb, var(--ink-strong) 10%, transparent)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
              Pending invitations
            </h2>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {invitations.map((inv, idx) => (
              <li
                key={inv.id}
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBlockStart:
                    idx === 0
                      ? 'none'
                      : '1px solid color-mix(in srgb, var(--ink-strong) 8%, transparent)',
                }}
              >
                <div style={{ flex: 1, minInlineSize: 0 }}>
                  <div style={{ fontSize: 13.5 }}>{inv.emailAddress}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {inv.role.replace(/^org:/, '')} · sent{' '}
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge tone="warning">{inv.status}</StatusBadge>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeInvite({
                        storefrontSlug: slug,
                        invitationId: inv.id,
                      });
                      flash(res, 'Invitation revoked.');
                    })
                  }
                  style={ghostButton}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}

function InviteForm({
  slug,
  disabled,
  onSubmit,
}: {
  slug: string;
  disabled: boolean;
  onSubmit: (p: { storefrontSlug: string; email: string; role: Role }) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  return (
    <Surface padding={20}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Invite a teammate</h2>
      <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: 'var(--ink-muted)' }}>
        Clerk emails the invitation. They&apos;ll join your storefront once they
        accept.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          onSubmit({ storefrontSlug: slug, email: email.trim(), role });
          setEmail('');
        }}
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <label style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@brand.com"
            required
            style={inputStyle}
          />
        </label>
        <label style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={inputStyle}
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={disabled} style={primaryButton}>
          Send invitation
        </button>
      </form>
    </Surface>
  );
}

function MemberRow({
  kind,
  isSelf,
  clerkUserId,
  role: initialRole,
  capabilities: initialCaps,
  profile,
  disabled,
  onUpdate,
  onRemove,
}: {
  slug: string;
  kind: 'owner' | 'member';
  isSelf: boolean;
  clerkUserId: string;
  role: Role;
  capabilities: Partial<Record<Capability, boolean>>;
  profile: Profile;
  disabled: boolean;
  onUpdate: (role: Role, capabilities: Partial<Record<Capability, boolean>>) => void;
  onRemove: () => void;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [caps, setCaps] = useState<Partial<Record<Capability, boolean>>>(initialCaps);
  const [open, setOpen] = useState(false);
  const isOwner = kind === 'owner';

  const dirty =
    role !== initialRole ||
    JSON.stringify(caps) !== JSON.stringify(initialCaps);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Avatar profile={profile} />
      <div style={{ flex: '1 1 220px', minInlineSize: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {profile.name ?? profile.email ?? clerkUserId.slice(0, 12)}
          {isSelf ? (
            <span style={{ marginInlineStart: 8, fontSize: 11.5, color: 'var(--ink-muted)' }}>
              (you)
            </span>
          ) : null}
        </div>
        {profile.email ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>{profile.email}</div>
        ) : null}
      </div>

      {isOwner ? (
        <StatusBadge tone="success">Owner</StatusBadge>
      ) : (
        <select
          value={role}
          disabled={disabled}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{ ...inputStyle, inlineSize: 130 }}
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      )}

      {!isOwner && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} style={ghostButton}>
            {open ? 'Hide' : 'Capabilities'}
          </button>
          {dirty && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdate(role, caps)}
              style={primaryButton}
            >
              Save
            </button>
          )}
          {!isSelf && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (confirm('Remove this member from the team?')) onRemove();
              }}
              style={dangerButton}
            >
              Remove
            </button>
          )}
        </>
      )}

      {open && !isOwner && (
        <div
          style={{
            flexBasis: '100%',
            marginBlockStart: 10,
            padding: 12,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--ink-strong) 4%, transparent)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBlockEnd: 8,
            }}
          >
            Capability overrides
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {CAPABILITIES.map((cap) => {
              const preset = Boolean(ROLE_PRESETS[role][cap]);
              const override = caps[cap];
              const effective = hasCapability({ role, capabilities: caps }, cap);
              return (
                <label
                  key={cap}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={effective}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setCaps((prev) => {
                        const out = { ...prev };
                        if (next === preset) delete out[cap];
                        else out[cap] = next;
                        return out;
                      });
                    }}
                  />
                  <span style={{ flex: 1 }}>{CAPABILITY_LABELS[cap]}</span>
                  {override !== undefined && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-muted)',
                      }}
                    >
                      override
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ profile }: { profile: Profile }) {
  const initial =
    profile.name?.charAt(0).toUpperCase() ??
    profile.email?.charAt(0).toUpperCase() ??
    '?';
  if (profile.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.imageUrl}
        alt=""
        width={36}
        height={36}
        style={{ borderRadius: 999, objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        background: 'color-mix(in srgb, var(--admin-accent) 18%, transparent)',
        color: 'var(--admin-accent)',
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {initial}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--ink-strong) 16%, transparent)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13.5,
  background: 'var(--paper, #fff)',
  color: 'var(--ink-strong)',
};

const primaryButton: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--admin-accent)',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--ink-strong) 16%, transparent)',
  background: 'transparent',
  color: 'var(--ink-strong)',
  fontSize: 12.5,
  cursor: 'pointer',
};

const dangerButton: React.CSSProperties = {
  ...ghostButton,
  color: '#8b3a3a',
  borderColor: 'color-mix(in srgb, #8b3a3a 30%, transparent)',
};
