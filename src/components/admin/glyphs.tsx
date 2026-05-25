/**
 * Single-stroke admin glyphs. Tuned to match Shopify's visual weight
 * (1.5 stroke) without the fashion-forward serifs of the rest of the
 * Souqna iconography. Inherit `currentColor` so the active-state ink
 * just works in light + dark.
 */
type Props = { size?: number; className?: string };

const common = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function HomeGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function OrdersGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M5 7h14l-1.4 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 7z" />
      <path d="M9 7V5a3 3 0 1 1 6 0v2" />
    </svg>
  );
}

export function ProductsGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
      <path d="M3 7l9 4 9-4M12 21V11" />
    </svg>
  );
}

export function CustomersGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5c1.5-3.6 4.4-5.5 7.5-5.5s6 1.9 7.5 5.5" />
    </svg>
  );
}

export function InquiriesGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

export function MarketingGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M3 11l14-6v14L3 13z" />
      <path d="M7 13v4a2 2 0 0 0 4 0v-3" />
    </svg>
  );
}

export function MessagesGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M4 5.5h16v9.5H9l-5 4V5.5z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}

export function DiscountsGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M20.5 12.5L12.5 20.5a2 2 0 0 1-2.83 0L3 13.83V5.5A2.5 2.5 0 0 1 5.5 3h8.33L20.5 9.67a2 2 0 0 1 0 2.83z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function AnalyticsGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function StorageGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}

export function AppsGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </svg>
  );
}

export function BuilderGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="6" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function SettingsGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2.1-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2.1 1.2l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2.1 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2.1-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  );
}

export function SearchGlyph({ size = 16, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function BellGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M5 17h14l-1.5-2V11a5.5 5.5 0 1 0-11 0v4L5 17z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function HelpGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 1.5-2.5 3.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ChevronDown({ size = 14, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronRight({ size = 14, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CheckGlyph({ size = 14, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

export function ExternalGlyph({ size = 14, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <path d="M14 5h5v5" />
      <path d="M19 5L10 14" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

export function PosGlyph({ size = 18, className }: Props) {
  return (
    <svg {...common(size)} className={className}>
      <rect x="3.5" y="4" width="17" height="13" rx="1.5" />
      <path d="M7.5 17v3M16.5 17v3M5 20h14" />
      <path d="M7.5 8h9M7.5 11h6" />
    </svg>
  );
}
