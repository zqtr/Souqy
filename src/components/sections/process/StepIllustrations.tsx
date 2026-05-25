import { palette } from '@/lib/tokens';

type StepProps = {
  isRtl: boolean;
};

/**
 * Four small illustrations — drawn purely from existing palette tokens —
 * that sit inside the MockFrame chrome on each WalkthroughCard. Every
 * illustration is sized off the parent's height so the framed UIs stay
 * proportional whether the card is 320px wide or 540px.
 */

/** I — Begin: stylized intake card with tagline input + slug suffix + archetype chips. */
export function BeginStep({ isRtl }: StepProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <FieldLabel text="Step 03 / Name" />
      <FieldInput placeholder="Al Sadd Kitchen" />

      <FieldLabel text="Web address" mt={6} />
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flexDirection: isRtl ? 'row-reverse' : 'row',
          gap: 6,
        }}
      >
        <div style={{ flex: 1 }}>
          <FieldInput placeholder="al-sadd-kitchen" mono accent />
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 10px',
            background: 'rgba(31,27,22,0.06)',
            border: '1px solid rgba(31,27,22,0.08)',
            borderRadius: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'rgba(31,27,22,0.6)',
            letterSpacing: '0.04em',
          }}
        >
          .souqna.qa
        </span>
      </div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          gap: 6,
          flexDirection: isRtl ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
        }}
      >
        {['Atelier', 'Souq', 'Pavilion'].map((label, i) => (
          <span
            key={label}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '8px 10px',
              borderRadius: 8,
              background: i === 0 ? 'rgba(139,58,58,0.10)' : 'rgba(31,27,22,0.04)',
              border:
                i === 0
                  ? `1px solid ${palette.maroon}66`
                  : '1px solid rgba(31,27,22,0.10)',
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: 500,
              color: i === 0 ? palette.maroon : 'rgba(31,27,22,0.7)',
              letterSpacing: '0.02em',
              textAlign: 'center',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** II — Build: 3-pane builder mock (library · canvas · inspector). */
export function BuildStep({ isRtl }: StepProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '20% 1fr 26%',
        gap: 6,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        style={{
          background: 'rgba(31,27,22,0.04)',
          border: '1px solid rgba(31,27,22,0.08)',
          borderRadius: 6,
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 4,
              background: i === 1 ? 'rgba(139,58,58,0.18)' : 'rgba(31,27,22,0.06)',
              border:
                i === 1
                  ? `1px solid ${palette.maroon}66`
                  : '1px solid rgba(31,27,22,0.08)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          background: 'var(--color-sand)',
          border: '1px solid rgba(31,27,22,0.10)',
          borderRadius: 6,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            height: '38%',
            borderRadius: 4,
            background:
              'linear-gradient(135deg, rgba(139,58,58,0.20), rgba(201,169,97,0.18))',
            border: `1px solid ${palette.maroon}33`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              fontFamily: 'var(--font-serif), serif',
              fontStyle: 'italic',
              fontSize: 11,
              color: palette.ink,
            }}
          >
            Hero
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 3,
            height: '32%',
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: 3,
                background: 'rgba(31,27,22,0.04)',
                border: '1px solid rgba(31,27,22,0.08)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: 3,
            background: 'rgba(31,27,22,0.04)',
            border: '1px solid rgba(31,27,22,0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            padding: '4px 6px',
          }}
        >
          {[0.7, 0.5, 0.4].map((w, i) => (
            <span
              key={i}
              style={{
                height: 2,
                width: `${w * 100}%`,
                background: 'rgba(31,27,22,0.18)',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(31,27,22,0.04)',
          border: '1px solid rgba(31,27,22,0.08)',
          borderRadius: 6,
          padding: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 7,
            letterSpacing: '0.1em',
            color: palette.maroon,
            textTransform: 'uppercase',
          }}
        >
          Hero
        </span>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                height: 2,
                width: '40%',
                background: 'rgba(31,27,22,0.25)',
                borderRadius: 1,
              }}
            />
            <span
              style={{
                height: 6,
                background: 'rgba(31,27,22,0.06)',
                border: '1px solid rgba(31,27,22,0.08)',
                borderRadius: 2,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** III — Tune: palette swatches above 3 product cards. */
export function TuneStep({ isRtl }: StepProps) {
  const swatches = [
    palette.sand,
    palette.sandDeep,
    palette.maroon,
    palette.gold,
    palette.ink,
  ];
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div>
        <FieldLabel text="Palette" />
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 6,
            flexDirection: isRtl ? 'row-reverse' : 'row',
          }}
        >
          {swatches.map((c, i) => (
            <span
              key={c}
              style={{
                flex: 1,
                aspectRatio: '1 / 1',
                borderRadius: 6,
                background: c,
                border: '1px solid rgba(31,27,22,0.10)',
                boxShadow:
                  i === 3 ? `0 0 0 2px ${palette.gold}44, 0 0 0 3px ${palette.gold}` : undefined,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
        }}
      >
        {['Saffron rice', 'Lamb ouzi', 'Knafeh'].map((title, i) => (
          <div
            key={title}
            style={{
              background: 'var(--color-sand)',
              border: '1px solid rgba(31,27,22,0.10)',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                aspectRatio: '4 / 3',
                background: `linear-gradient(${135 + i * 30}deg, rgba(139,58,58,0.14), rgba(201,169,97,0.18))`,
                borderBottom: '1px solid rgba(31,27,22,0.06)',
              }}
            />
            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 8,
                  fontWeight: 500,
                  color: palette.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 7,
                  color: palette.maroon,
                  letterSpacing: '0.04em',
                }}
              >
                {`${45 + i * 12} QAR`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** IV — Publish: phone preview with the storefront live at slug.souqna.qa. */
export function PublishStep({ isRtl }: StepProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 12px 14px',
        gap: 8,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          flexDirection: isRtl ? 'row-reverse' : 'row',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif), serif',
            fontStyle: 'italic',
            fontSize: 11,
            color: palette.ink,
          }}
        >
          Al Sadd
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 999,
            background: palette.maroon,
            color: 'var(--color-sand-pale)',
            fontFamily: 'var(--font-mono)',
            fontSize: 7,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: palette.gold,
            }}
          />
          Live
        </span>
      </div>

      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 8,
          background:
            'linear-gradient(135deg, rgba(139,58,58,0.22), rgba(201,169,97,0.20))',
          border: `1px solid ${palette.maroon}40`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            insetInlineStart: 8,
            top: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 6.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: palette.maroon,
          }}
        >
          The kitchen
        </span>
        <span
          style={{
            position: 'absolute',
            insetInlineStart: 8,
            bottom: 8,
            fontFamily: 'var(--font-serif), serif',
            fontStyle: 'italic',
            fontSize: 9,
            color: palette.ink,
            maxWidth: '70%',
            lineHeight: 1.1,
          }}
        >
          A serious kitchen, run from home.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(31,27,22,0.04)',
              border: '1px solid rgba(31,27,22,0.08)',
              flexDirection: isRtl ? 'row-reverse' : 'row',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 8,
                fontWeight: 500,
                color: palette.ink,
              }}
            >
              {i === 0 ? 'Saffron rice' : 'Lamb ouzi'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: palette.maroon,
                letterSpacing: '0.04em',
              }}
            >
              {i === 0 ? '45 QAR' : '120 QAR'}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 7,
          letterSpacing: '0.1em',
          textTransform: 'lowercase',
          color: 'rgba(31,27,22,0.6)',
          textAlign: 'center',
        }}
      >
        al-sadd-kitchen.souqna.qa
      </div>
    </div>
  );
}

/* ----------------------- shared field primitives ------------------------ */

function FieldLabel({ text, mt }: { text: string; mt?: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 8,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(31,27,22,0.55)',
        marginTop: mt,
      }}
    >
      {text}
    </span>
  );
}

function FieldInput({
  placeholder,
  mono,
  accent,
}: {
  placeholder: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        height: 22,
        background: 'rgba(31,27,22,0.04)',
        border: `1px solid ${accent ? palette.maroon : 'rgba(31,27,22,0.10)'}`,
        borderRadius: 8,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 10,
        color: accent ? palette.ink : 'rgba(31,27,22,0.6)',
        letterSpacing: mono ? '0.02em' : 'normal',
      }}
    >
      {placeholder}
      <span
        aria-hidden
        style={{
          marginInlineStart: 4,
          width: 1,
          height: 10,
          background: palette.maroon,
          opacity: 0.6,
        }}
      />
    </div>
  );
}
