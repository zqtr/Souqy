import type { ReactNode } from 'react';
import { palette } from '@/lib/tokens';

type Variant = 'browser' | 'phone';

type Props = {
  /** Address-bar copy (or status-bar copy on phone variant). */
  address: string;
  /** Caption rendered as a small overlay tag on the bottom-left of the frame. */
  caption?: string;
  /** Frame body — the illustrated UI. */
  children: ReactNode;
  /** Mirror traffic-light dots / chevrons for RTL. */
  isRtl?: boolean;
  /** Render as a phone shell (rounded, narrow) instead of a browser window. */
  variant?: Variant;
  /** Optional aspect ratio override; defaults differ by variant. */
  aspectRatio?: string;
};

/**
 * Mini browser chrome wrapper used by the four walkthrough step cards.
 * Sand body, hairline maroon border, three traffic-light dots, and a
 * pill-shaped address bar. Designed to read as a UI surface at a glance
 * even when scaled to ~360px wide on a phone.
 *
 * Two variants:
 *  - `browser`: tall-ish window with an address bar (Begin / Build / Tune)
 *  - `phone`:   16:9-ish portrait phone shell with a status bar (Publish)
 */
export function MockFrame({
  address,
  caption,
  children,
  isRtl = false,
  variant = 'browser',
  aspectRatio,
}: Props) {
  if (variant === 'phone') {
    return (
      <div
        className="souqna-mockframe-phone"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 280,
          marginInline: 'auto',
          aspectRatio: aspectRatio ?? '9 / 16',
          background: 'var(--color-sand)',
          border: `1px solid ${palette.maroon}33`,
          borderRadius: 26,
          padding: 8,
          boxShadow:
            '0 1px 0 rgba(232,220,196,0.6) inset, 0 18px 32px rgba(31,27,22,0.18)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: 'var(--color-sand-pale)',
            borderRadius: 18,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 14px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'rgba(31,27,22,0.5)',
              textTransform: 'uppercase',
            }}
          >
            <span>{address}</span>
            <span aria-hidden style={{ display: 'inline-flex', gap: 3 }}>
              <span
                style={{
                  width: 12,
                  height: 4,
                  borderRadius: 1,
                  background: 'rgba(31,27,22,0.35)',
                }}
              />
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 1,
                  background: palette.gold,
                }}
              />
            </span>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </div>
        </div>
        {caption ? <FrameCaption caption={caption} /> : null}
      </div>
    );
  }

  return (
    <div
      className="souqna-mockframe-browser"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspectRatio ?? '4 / 3',
        background: 'var(--color-sand-pale)',
        border: `1px solid ${palette.maroon}26`,
        borderRadius: 12,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.4) inset, 0 24px 40px rgba(31,27,22,0.14)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          height: 30,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexDirection: isRtl ? 'row-reverse' : 'row',
          background: 'rgba(31,27,22,0.04)',
          borderBottom: `1px solid ${palette.maroon}1a`,
        }}
      >
        <div
          aria-hidden
          style={{
            display: 'inline-flex',
            gap: 5,
            flex: '0 0 auto',
          }}
        >
          {[palette.maroon, palette.gold, palette.silver].map((c, i) => (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: c,
                opacity: 0.65,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            height: 16,
            background: 'rgba(31,27,22,0.06)',
            border: '1px solid rgba(31,27,22,0.08)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: 9,
            letterSpacing: '0.06em',
            color: 'rgba(31,27,22,0.55)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'lowercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span aria-hidden style={{ marginInlineEnd: 6, opacity: 0.5 }}>
            ◈
          </span>
          {address}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {children}
      </div>
      {caption ? <FrameCaption caption={caption} /> : null}
    </div>
  );
}

function FrameCaption({ caption }: { caption: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(232,220,196,0.92)',
        background: 'rgba(31,27,22,0.78)',
        backdropFilter: 'blur(4px)',
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${palette.gold}55`,
      }}
    >
      {caption}
    </span>
  );
}
