'use client';

import AuroraBlur from '@/components/react-bits/aurora-blur';
import type { BlockRenderProps } from './BlockContext';
import type { AuroraRibbonProps } from '@/lib/blocks/types';

export function AuroraRibbonBlock({ block, ctx }: BlockRenderProps<AuroraRibbonProps>) {
  const { isRtl } = ctx;
  const p = block.props;
  const height = p.heightPx ?? 200;
  const fontFamily = isRtl ? 'var(--font-arabic), var(--font-sans)' : 'var(--font-sans)';
  const serif = isRtl ? 'var(--font-arabic-serif), serif' : 'var(--font-serif), serif';

  const brandLayers = [
    { color: '#8b3a3a', speed: 0.22, intensity: 0.48 },
    { color: '#c9a961', speed: 0.14, intensity: 0.36 },
    { color: '#5586bd', speed: 0.16, intensity: 0.28 },
    { color: '#3a3633', speed: 0.1, intensity: 0.18 },
  ];

  return (
    <section
      style={{
        margin: 0,
        width: '100%',
        position: 'relative',
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <AuroraBlur
        width="100%"
        height={height}
        className="rounded-2xl overflow-hidden"
        layers={brandLayers}
        brightness={p.brightness ?? 0.85}
        saturation={0.75}
        bloomIntensity={2}
        opacity={0.92}
        noiseScale={4}
        verticalFade={1.1}
      >
        {p.eyebrow || p.title || p.subtitle ? (
          <div
            style={{
              paddingInline: 'clamp(16px, 5vw, 48px)',
              paddingBlock: 'clamp(20px, 5vw, 36px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
              textAlign: 'center',
              color: 'var(--sf-ink)',
              mixBlendMode: 'normal',
              textShadow: '0 1px 18px rgba(255,255,255,0.55)',
            }}
          >
            {p.eyebrow ? (
              <span
                style={{
                  fontFamily,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  opacity: 0.88,
                }}
              >
                {p.eyebrow}
              </span>
            ) : null}
            {p.title ? (
              <h2
                style={{
                  fontFamily: serif,
                  fontSize: 'clamp(1.25rem, 3.5vw, 1.85rem)',
                  fontWeight: 500,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {p.title}
              </h2>
            ) : null}
            {p.subtitle ? (
              <p style={{ fontFamily, fontSize: 14, opacity: 0.9, margin: 0, maxWidth: 560 }}>
                {p.subtitle}
              </p>
            ) : null}
          </div>
        ) : null}
      </AuroraBlur>
    </section>
  );
}
