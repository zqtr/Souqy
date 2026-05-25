'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveOnboarding, type PosActionState } from '@/app/actions/pos';
import { CheckGlyph, ChevronRight } from '../glyphs';

type Props = {
  storefrontSlug: string;
  businessName: string;
};

type Step = 0 | 1 | 2 | 3;

/**
 * Three-step POS onboarding wizard. Built as a single client component
 * because the inputs need to live across step transitions without
 * round-tripping the server. The final step calls `saveOnboarding`
 * which persists the register settings + flips `configured`.
 *
 * Steps:
 *   0. What is POS? (explainer + two-line feature list)
 *   1. Name your register (location + cash float + optional PIN)
 *   2. Receipt + finish
 *   3. Done — links to the till
 *
 * The wizard never blocks the founder: every step has a "Skip for now"
 * and the final step succeeds even with empty optional fields.
 */
export function PosOnboardingWizard({ storefrontSlug, businessName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [locationName, setLocationName] = useState('');
  const [cashFloat, setCashFloat] = useState('500');
  const [pin, setPin] = useState('');
  const [receiptFooter, setReceiptFooter] = useState(
    `${businessName} · Shukran ◈`,
  );
  const [state, setState] = useState<PosActionState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  function complete() {
    startTransition(async () => {
      const cashFloatNum = Number(cashFloat);
      const result = await saveOnboarding({
        storefrontSlug,
        locationName: locationName.trim() || `${businessName} register`,
        cashFloat: Number.isFinite(cashFloatNum) ? cashFloatNum : 0,
        pin: pin.trim(),
        receiptFooter: receiptFooter.trim(),
      });
      setState(result);
      if (result.status === 'success') {
        setStep(3);
        router.refresh();
      }
    });
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '24px 0 20px',
          marginBottom: 24,
          borderBottom: '1px solid var(--surface-rule)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--admin-accent)',
          }}
        >
          ◈ Point of sale · setup
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, var(--font-sans))',
            fontWeight: 400,
            fontSize: 'clamp(24px, 3vw, 32px)',
            color: 'var(--ink-strong)',
            letterSpacing: '-0.01em',
          }}
        >
          Open your cash register
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            color: 'var(--ink-muted)',
            fontSize: 14,
            maxWidth: 640,
            lineHeight: 1.55,
          }}
        >
          A short walk-through, then your laptop or iPad is a ready
          cash terminal — perfect for souq pop-ups, market days, and
          customers who want to pay on the spot.
        </p>
      </header>

      <Stepper step={step} />

      <section
        style={{
          marginTop: 24,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--surface-rule)',
          borderRadius: 14,
          padding: 'clamp(20px, 3vw, 32px)',
          color: 'var(--ink-strong)',
          minHeight: 320,
        }}
      >
        {step === 0 ? (
          <Step0 onContinue={() => setStep(1)} />
        ) : step === 1 ? (
          <Step1
            locationName={locationName}
            setLocationName={setLocationName}
            cashFloat={cashFloat}
            setCashFloat={setCashFloat}
            pin={pin}
            setPin={setPin}
            onBack={() => setStep(0)}
            onContinue={() => setStep(2)}
          />
        ) : step === 2 ? (
          <Step2
            receiptFooter={receiptFooter}
            setReceiptFooter={setReceiptFooter}
            onBack={() => setStep(1)}
            onFinish={complete}
            pending={pending}
            error={state.status === 'error' ? state.message : null}
          />
        ) : (
          <Step3
            storefrontSlug={storefrontSlug}
            locationName={locationName.trim() || `${businessName} register`}
          />
        )}
      </section>
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ['What is POS?', 'Set up register', 'Receipts', 'Open till'];
  return (
    <ol
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${labels.length}, 1fr)`,
        gap: 8,
      }}
    >
      {labels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: active
                ? 'color-mix(in srgb, var(--admin-accent) 45%, transparent)'
                : done
                  ? 'color-mix(in srgb, var(--admin-accent) 22%, transparent)'
                  : 'var(--surface-rule)',
              background: active
                ? 'color-mix(in srgb, var(--admin-accent) 10%, transparent)'
                : done
                  ? 'color-mix(in srgb, var(--admin-accent) 4%, transparent)'
                  : 'transparent',
              color: 'var(--ink-strong)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                flex: '0 0 22px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done
                  ? 'var(--admin-accent)'
                  : active
                    ? 'color-mix(in srgb, var(--admin-accent) 22%, transparent)'
                    : 'transparent',
                color: done ? '#fff' : 'var(--ink-strong)',
                border: done
                  ? 'none'
                  : '1px solid color-mix(in srgb, var(--ink-strong) 18%, transparent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              {done ? <CheckGlyph size={12} /> : i + 1}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: active ? 'var(--ink-strong)' : 'var(--ink-muted)',
              }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Step0({ onContinue }: { onContinue: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Eyebrow>Step 1 of 3</Eyebrow>
      <Heading>A till that lives in the same place as your shop.</Heading>
      <Body>
        Souqna POS is a cash-first register designed for the way Doha
        actually sells: at souq stalls, weekend pop-ups, market days,
        and trunk shows. Open it on a laptop or iPad next to the
        counter — visitors pay in cash, you tap the items, and Souqna
        records the sale next to your online orders so your books stay
        in one place.
      </Body>

      <ul
        style={{
          listStyle: 'none',
          margin: '8px 0 0',
          padding: 0,
          display: 'grid',
          gap: 10,
        }}
      >
        <Bullet
          title="Tap → ring → done"
          body="Your existing products show up as a touchable grid. No SKUs to type."
        />
        <Bullet
          title="Cash math, automated"
          body="We calculate change due as you enter cash tendered. No mental arithmetic in front of the customer."
        />
        <Bullet
          title="One ledger, two channels"
          body="POS sales appear in Orders + Analytics alongside your online orders, tagged with the POS channel."
        />
        <Bullet
          title="No card reader needed"
          body="Souqna POS focuses on cash today. Card reader integrations are on the roadmap."
        />
      </ul>

      <Footer>
        <span aria-hidden style={{ flex: 1 }} />
        <PrimaryButton onClick={onContinue}>
          Continue <ChevronRight size={14} />
        </PrimaryButton>
      </Footer>
    </div>
  );
}

function Step1({
  locationName,
  setLocationName,
  cashFloat,
  setCashFloat,
  pin,
  setPin,
  onBack,
  onContinue,
}: {
  locationName: string;
  setLocationName: (v: string) => void;
  cashFloat: string;
  setCashFloat: (v: string) => void;
  pin: string;
  setPin: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Eyebrow>Step 2 of 3</Eyebrow>
      <Heading>Where will the till sit?</Heading>
      <Body>
        These details show up on receipts and on the cash drawer
        screen. You can change them any time from POS settings.
      </Body>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginTop: 4,
        }}
      >
        <Field
          id="pos-location"
          label="Location"
          placeholder="Souq Waqif kiosk"
          value={locationName}
          onChange={setLocationName}
          helper="Shows on the till header and on receipts."
        />
        <Field
          id="pos-cash"
          label="Opening cash float (QAR)"
          type="number"
          placeholder="500"
          value={cashFloat}
          onChange={setCashFloat}
          helper="Cash already in the drawer at the start of the shift."
        />
        <Field
          id="pos-pin"
          label="Staff PIN (optional)"
          type="password"
          inputMode="numeric"
          placeholder="4-digit PIN"
          value={pin}
          onChange={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 8))}
          helper="Required to open the till. Leave blank for no PIN."
        />
      </div>

      <Footer>
        <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        <PrimaryButton onClick={onContinue}>
          Continue <ChevronRight size={14} />
        </PrimaryButton>
      </Footer>
    </div>
  );
}

function Step2({
  receiptFooter,
  setReceiptFooter,
  onBack,
  onFinish,
  pending,
  error,
}: {
  receiptFooter: string;
  setReceiptFooter: (v: string) => void;
  onBack: () => void;
  onFinish: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Eyebrow>Step 3 of 3</Eyebrow>
      <Heading>One last thing — your receipt sign-off.</Heading>
      <Body>
        Printed at the foot of every cash receipt. Keep it short:
        thank-you, social handle, return policy line.
      </Body>

      <Field
        id="pos-receipt"
        label="Receipt footer"
        placeholder="Souqna · Shukran ◈"
        value={receiptFooter}
        onChange={setReceiptFooter}
        helper="Appears under the totals on every printed/PDF receipt."
      />

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: '#a4521b',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            background: 'color-mix(in srgb, #a4521b 10%, transparent)',
            border: '1px solid color-mix(in srgb, #a4521b 35%, transparent)',
            padding: '10px 12px',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      ) : null}

      <Footer>
        <SecondaryButton onClick={onBack} disabled={pending}>
          ← Back
        </SecondaryButton>
        <PrimaryButton onClick={onFinish} disabled={pending}>
          {pending ? 'Opening…' : 'Open the till'}
          <span aria-hidden>◈</span>
        </PrimaryButton>
      </Footer>
    </div>
  );
}

function Step3({
  storefrontSlug,
  locationName,
}: {
  storefrontSlug: string;
  locationName: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 18,
      }}
    >
      <Eyebrow>All set</Eyebrow>
      <Heading>Your register is open at {locationName}.</Heading>
      <Body>
        The till is ready. The next visit to Point of sale lands you
        straight on the cash drawer — no setup again.
      </Body>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        <a
          href={`/account/pos?store=${encodeURIComponent(storefrontSlug)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 18px',
            borderRadius: 8,
            background: 'var(--admin-accent)',
            color: 'var(--ink-on-gold)',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Open the till →
        </a>
        <a
          href={`/account/products?store=${encodeURIComponent(storefrontSlug)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 18px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--surface-rule-strong)',
            color: 'var(--ink-strong)',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Add more products
        </a>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--admin-accent)',
      }}
    >
      ◈ {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-serif, var(--font-sans))',
        fontWeight: 400,
        fontSize: 'clamp(20px, 2.4vw, 26px)',
        color: 'var(--ink-strong)',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14.5,
        lineHeight: 1.65,
        color: 'var(--ink-muted)',
        maxWidth: 620,
      }}
    >
      {children}
    </p>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid var(--surface-rule)',
        background: 'transparent',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in srgb, var(--admin-accent) 18%, transparent)',
          color: 'var(--admin-accent)',
        }}
      >
        ◈
      </span>
      <div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--ink-strong)',
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </li>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  helper,
  type = 'text',
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  type?: 'text' | 'number' | 'password';
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--surface-rule-strong)',
          background: 'var(--surface-bg)',
          color: 'var(--ink-strong)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          outline: 'none',
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = 'var(--admin-accent)')
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = 'var(--surface-rule-strong)')
        }
      />
      {helper ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-faint)',
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        borderRadius: 8,
        background: disabled
          ? 'color-mix(in srgb, var(--admin-accent) 35%, transparent)'
          : 'var(--admin-accent)',
        color: 'var(--ink-on-gold)',
        border: 'none',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        marginLeft: 'auto',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--ink-strong)',
        border: '1px solid var(--surface-rule-strong)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
