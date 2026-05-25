'use client';

import { useState } from 'react';
import { saveAramexAction } from '@/app/actions/apps';
import type { AramexSettings as Settings } from '@/lib/apps/aramex';
import {
  AppSettingsCard,
  AppField,
  appInputStyle,
  appCodeInputStyle,
} from './AppSettingsCard';

export function AramexSettingsForm({
  storefrontSlug,
  initial,
}: {
  storefrontSlug: string;
  initial: Settings;
}) {
  // Credentials are write-only here — the saved value lives encrypted
  // in the credential vault and never round-trips through the form.
  const [password, setPassword] = useState('');
  const [accountPin, setAccountPin] = useState('');
  const [updateCreds, setUpdateCreds] = useState(false);

  const [username, setUsername] = useState(initial.username);
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber);
  const [accountEntity, setAccountEntity] = useState(initial.accountEntity);
  const [accountCountry, setAccountCountry] = useState(initial.accountCountry);
  const [productGroup, setProductGroup] = useState<Settings['productGroup']>(initial.productGroup);
  const [defaultProductType, setDefaultProductType] = useState(initial.defaultProductType);
  const [pickupAddress, setPickupAddress] = useState(initial.pickupAddress);
  const [defaultWeightKg, setDefaultWeightKg] = useState<number>(initial.defaultWeightKg);
  const [dim, setDim] = useState(initial.defaultDimensionsCm);

  function patchAddress(patch: Partial<Settings['pickupAddress']>) {
    setPickupAddress((prev) => ({ ...prev, ...patch }));
  }

  return (
    <AppSettingsCard
      eyebrow="Customise"
      title="Aramex shipping"
      description="Live shipping rates on product pages plus one-click shipment creation from each order. Souqna talks to Aramex with the credentials below — no Souqna-side Aramex contract anywhere."
      onSave={async () =>
        saveAramexAction({
          storefrontSlug,
          username: username.trim(),
          accountNumber: accountNumber.trim(),
          accountEntity: accountEntity.trim().toUpperCase(),
          accountCountry: accountCountry.trim().toUpperCase(),
          productGroup,
          defaultProductType: defaultProductType.trim().toUpperCase(),
          pickupAddress,
          defaultWeightKg,
          defaultDimensionsCm: dim,
          ...(updateCreds && password ? { password } : {}),
          ...(updateCreds && accountPin ? { accountPin } : {}),
        })
      }
    >
      <fieldset
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <legend
          style={{
            padding: '0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          Account
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <AppField label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ws.aramex@…"
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Account number">
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="20016"
              style={appCodeInputStyle}
            />
          </AppField>
          <AppField label="Entity" hint="Origin city code, e.g. DOH for Doha.">
            <input
              type="text"
              value={accountEntity}
              onChange={(e) => setAccountEntity(e.target.value.slice(0, 8))}
              placeholder="DOH"
              style={appCodeInputStyle}
            />
          </AppField>
          <AppField label="Country" hint="ISO country code of your account.">
            <input
              type="text"
              value={accountCountry}
              onChange={(e) => setAccountCountry(e.target.value.slice(0, 2).toUpperCase())}
              placeholder="QA"
              style={appCodeInputStyle}
            />
          </AppField>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-muted)' }}>
          <input
            type="checkbox"
            checked={updateCreds}
            onChange={(e) => setUpdateCreds(e.target.checked)}
          />
          Update password / PIN (leave unchecked to keep what’s already saved)
        </label>
        {updateCreds ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <AppField label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={appCodeInputStyle}
                autoComplete="new-password"
              />
            </AppField>
            <AppField label="Account PIN">
              <input
                type="password"
                value={accountPin}
                onChange={(e) => setAccountPin(e.target.value)}
                style={appCodeInputStyle}
                autoComplete="new-password"
              />
            </AppField>
          </div>
        ) : null}
      </fieldset>

      <fieldset
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <legend
          style={{
            padding: '0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          Service
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <AppField label="Product group">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['DOM', 'EXP'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setProductGroup(g)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    background: productGroup === g ? 'var(--admin-accent)' : 'transparent',
                    border: `1px solid ${productGroup === g ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'}`,
                    color: productGroup === g ? 'var(--ink-on-gold)' : 'var(--ink-strong)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {g === 'DOM' ? 'Domestic' : 'Export'}
                </button>
              ))}
            </div>
          </AppField>
          <AppField label="Default product type">
            <input
              type="text"
              value={defaultProductType}
              onChange={(e) => setDefaultProductType(e.target.value.slice(0, 8).toUpperCase())}
              placeholder="OND"
              style={appCodeInputStyle}
            />
          </AppField>
        </div>
      </fieldset>

      <fieldset
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <legend
          style={{
            padding: '0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          Pickup address
        </legend>
        <AppField label="Address line 1">
          <input
            type="text"
            value={pickupAddress.line1}
            onChange={(e) => patchAddress({ line1: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <AppField label="Address line 2 (optional)">
          <input
            type="text"
            value={pickupAddress.line2}
            onChange={(e) => patchAddress({ line2: e.target.value })}
            style={appInputStyle}
          />
        </AppField>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
          <AppField label="City">
            <input
              type="text"
              value={pickupAddress.city}
              onChange={(e) => patchAddress({ city: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Country code">
            <input
              type="text"
              value={pickupAddress.countryCode}
              onChange={(e) => patchAddress({ countryCode: e.target.value.slice(0, 2).toUpperCase() })}
              style={appCodeInputStyle}
            />
          </AppField>
          <AppField label="Postal code">
            <input
              type="text"
              value={pickupAddress.postCode}
              onChange={(e) => patchAddress({ postCode: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <AppField label="Contact name">
            <input
              type="text"
              value={pickupAddress.contactName}
              onChange={(e) => patchAddress({ contactName: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Contact phone">
            <input
              type="tel"
              value={pickupAddress.contactPhone}
              onChange={(e) => patchAddress({ contactPhone: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="Contact email">
            <input
              type="email"
              value={pickupAddress.contactEmail}
              onChange={(e) => patchAddress({ contactEmail: e.target.value })}
              style={appInputStyle}
            />
          </AppField>
        </div>
      </fieldset>

      <fieldset
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--ink-strong) 3%, transparent)',
          border: '1px solid var(--surface-rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <legend
          style={{
            padding: '0 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
          }}
        >
          Default parcel
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <AppField label="Weight (kg)">
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={defaultWeightKg}
              onChange={(e) => setDefaultWeightKg(Number(e.target.value) || 1)}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="L (cm)">
            <input
              type="number"
              min={1}
              value={dim.length}
              onChange={(e) => setDim((d) => ({ ...d, length: Number(e.target.value) || 30 }))}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="W (cm)">
            <input
              type="number"
              min={1}
              value={dim.width}
              onChange={(e) => setDim((d) => ({ ...d, width: Number(e.target.value) || 20 }))}
              style={appInputStyle}
            />
          </AppField>
          <AppField label="H (cm)">
            <input
              type="number"
              min={1}
              value={dim.height}
              onChange={(e) => setDim((d) => ({ ...d, height: Number(e.target.value) || 10 }))}
              style={appInputStyle}
            />
          </AppField>
        </div>
      </fieldset>
    </AppSettingsCard>
  );
}
