'use client';

import type { CSSProperties } from 'react';
import { Portal } from '@/components/portal';

type SouqyLogoProps = {
  size?: number;
  className?: string;
};

type LogoStyle = CSSProperties & {
  '--souqy-logo-size': string;
};

export function SouqyLogo({ size = 44, className = '' }: SouqyLogoProps) {
  return (
    <>
      <span
        className={`souqy-logo${className ? ` ${className}` : ''}`}
        style={{ '--souqy-logo-size': `${size}px` } as LogoStyle}
        aria-hidden
      >
        <span className="souqy-logo-core">
          <Portal
            className="souqy-logo-portal"
            primaryColor="#F5D35E"
            secondaryColor="#FFF2A8"
            centerColor="#F5EFE3"
            speed={0.7}
            density={0.5}
            layerCount={10}
            waveAmplitude={0.3}
            waveFrequency={1.24}
            verticalDistortion={0.15}
            depthIntensity={0.75}
            brightness={2}
            brightnessThreshold={0.01}
            scale={1.95}
            ballBgColor="#050505"
          />
        </span>
      </span>
      <style jsx global>{`
        .souqy-logo {
          --souqy-logo-rim: rgba(255, 237, 167, 0.72);
          --souqy-logo-halo: rgba(212, 175, 55, 0.28);
          position: relative;
          display: inline-grid;
          width: var(--souqy-logo-size);
          height: var(--souqy-logo-size);
          flex: 0 0 auto;
          place-items: center;
          border-radius: 999px;
          isolation: isolate;
          pointer-events: none;
        }

        .souqy-logo::before,
        .souqy-logo::after {
          content: '';
          position: absolute;
          border-radius: inherit;
          pointer-events: none;
        }

        .souqy-logo::before {
          inset: -2px;
          z-index: -1;
          background: radial-gradient(circle, var(--souqy-logo-rim), rgba(212, 175, 55, 0.24) 58%, transparent 72%);
          filter: drop-shadow(0 0 8px var(--souqy-logo-halo));
          animation: souqy-logo-ring 9s linear infinite;
        }

        .souqy-logo::after {
          inset: -12px;
          z-index: -2;
          background: radial-gradient(circle, var(--souqy-logo-halo), transparent 67%);
          opacity: 0.62;
        }

        .souqy-logo-core {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--souqy-logo-rim) 70%, transparent);
          border-radius: inherit;
          background: #050505;
          box-shadow:
            inset 0 0 0 1px rgba(255, 245, 198, 0.13),
            inset 0 0 18px rgba(0, 0, 0, 0.6),
            0 10px 24px rgba(0, 0, 0, 0.2);
        }

        .souqy-logo-portal {
          inset: -1px;
          opacity: 1;
          filter: saturate(1.35) contrast(1.18);
        }

        .souqy-logo-portal canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }

        [data-theme='light'] .souqy-logo {
          --souqy-logo-rim: rgba(94, 73, 30, 0.66);
          --souqy-logo-halo: rgba(168, 137, 63, 0.22);
        }

        [data-theme='dark'] .souqy-logo {
          --souqy-logo-rim: rgba(255, 241, 184, 0.9);
          --souqy-logo-halo: rgba(245, 201, 119, 0.36);
        }

        @keyframes souqy-logo-ring {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .souqy-logo::before {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
