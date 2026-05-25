import type { TemplateId } from '@/lib/brief';
import { palettes, type PaletteId } from '@/lib/palettes';
import type { Locale } from '@/i18n/locales';
import { PREVIEW_RECIPES, type PreviewRecipe } from './recipes';

/**
 * Stylized parametric SVG preview of every Souqna template. Replaces
 * the missing `public/templates/<id>/preview.webp` files with a single
 * server component that renders a 16:10 SVG from the template's
 * palette + recipe.
 *
 * Three variants ship with the component:
 *   - `thumb` (240 × 150) — left-rail row inside `TemplateBrowserModal`.
 *   - `card` (480 × 300) — picker tile inside `BeginIntake`.
 *   - `detail` (960 × 600) — large compare view (future use).
 *
 * The SVG is built from layered shapes that take their colours from the
 * palette triplet (ink / ground / accent). For Arabic locales we
 * compute horizontal coordinates from the right edge rather than wrap
 * the whole tree in `transform="scale(-1, 1)"` — that keeps `<title>`
 * and `<desc>` accessibility text upright for screen readers.
 *
 * `dimmed` is true for locked templates so the SVG renders at ~55%
 * opacity with a lock glyph in the corner; clicking still opens the
 * upsell flow inside the parent.
 */
export type TemplatePreviewVariant = 'rail' | 'thumb' | 'card' | 'detail';

type Props = {
  templateId: TemplateId;
  paletteId: PaletteId;
  variant?: TemplatePreviewVariant;
  locale?: Locale;
  dimmed?: boolean;
  ariaLabel?: string;
};

const VARIANT_SIZES: Record<TemplatePreviewVariant, { w: number; h: number }> = {
  rail: { w: 80, h: 50 },
  thumb: { w: 240, h: 150 },
  card: { w: 480, h: 300 },
  detail: { w: 960, h: 600 },
};

// Coordinate flip for RTL — every `x` we pass through gets mirrored
// around the centre line, so the layout reads right-to-left without
// reversing internal text.
function maybeFlip(x: number, viewW: number, rtl: boolean): number {
  return rtl ? viewW - x : x;
}

export function TemplatePreview({
  templateId,
  paletteId,
  variant = 'card',
  locale = 'en',
  dimmed = false,
  ariaLabel,
}: Props) {
  const recipe = PREVIEW_RECIPES[templateId];
  const palette = palettes[paletteId];
  const theme = recipe.themeBehaviour === 'dark' ? 'dark' : 'light';
  const triplet = theme === 'dark' ? palette.dark : palette.light;
  const { w, h } = VARIANT_SIZES[variant];
  const viewW = 480;
  const viewH = 300;
  const rtl = locale === 'ar';
  const titleId = `tpl-preview-${templateId}-${variant}`;
  const label =
    ariaLabel ??
    (rtl ? `معاينة قالب ${templateId}` : `${templateId} template preview`);

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={w}
      height={h}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', borderRadius: 8, opacity: dimmed ? 0.55 : 1 }}
    >
      <title id={titleId}>{label}</title>
      <desc>
        Live representation of the {templateId} template using its palette.
      </desc>
      <rect width={viewW} height={viewH} fill={triplet.ground} />
      <HeroLayer recipe={recipe} triplet={triplet} viewW={viewW} rtl={rtl} />
      <AccentLayer recipe={recipe} triplet={triplet} viewW={viewW} rtl={rtl} />
      <ProductRow recipe={recipe} triplet={triplet} viewW={viewW} rtl={rtl} />
      <FooterStrip triplet={triplet} viewW={viewW} />
      {dimmed ? <LockBadge triplet={triplet} viewW={viewW} rtl={rtl} /> : null}
    </svg>
  );
}

type LayerProps = {
  recipe: PreviewRecipe;
  triplet: { ink: string; ground: string; accent: string };
  viewW: number;
  rtl: boolean;
};

function HeroLayer({ recipe, triplet, viewW, rtl }: LayerProps) {
  const { ink, accent } = triplet;
  const lineColour = ink;
  switch (recipe.hero) {
    case 'cinematic':
      return (
        <g>
          <rect x={20} y={20} width={viewW - 40} height={100} fill={ink} opacity={0.92} rx={4} />
          <rect
            x={maybeFlip(40, viewW, rtl) - (rtl ? 90 : 0)}
            y={40}
            width={90}
            height={6}
            fill={accent}
            rx={2}
          />
          <rect
            x={maybeFlip(40, viewW, rtl) - (rtl ? 200 : 0)}
            y={58}
            width={200}
            height={10}
            fill={triplet.ground}
            opacity={0.85}
            rx={2}
          />
          <rect
            x={maybeFlip(40, viewW, rtl) - (rtl ? 140 : 0)}
            y={78}
            width={140}
            height={6}
            fill={triplet.ground}
            opacity={0.55}
            rx={2}
          />
        </g>
      );
    case 'editorial':
      return (
        <g>
          <rect x={20} y={20} width={viewW - 40} height={2} fill={lineColour} opacity={0.4} />
          <rect
            x={(viewW - 220) / 2}
            y={40}
            width={220}
            height={12}
            fill={ink}
            opacity={0.85}
            rx={2}
          />
          <rect
            x={(viewW - 160) / 2}
            y={62}
            width={160}
            height={6}
            fill={ink}
            opacity={0.55}
            rx={2}
          />
          <rect
            x={(viewW - 60) / 2}
            y={82}
            width={60}
            height={6}
            fill={accent}
            rx={2}
          />
          <rect x={20} y={108} width={viewW - 40} height={2} fill={lineColour} opacity={0.4} />
        </g>
      );
    case 'split':
      return (
        <g>
          <rect x={maybeFlip(20, viewW, rtl) - (rtl ? 200 : 0)} y={20} width={200} height={100} fill={ink} opacity={0.92} rx={4} />
          <rect x={maybeFlip(240, viewW, rtl) - (rtl ? 180 : 0)} y={36} width={180} height={10} fill={ink} opacity={0.75} rx={2} />
          <rect x={maybeFlip(240, viewW, rtl) - (rtl ? 120 : 0)} y={56} width={120} height={6} fill={ink} opacity={0.45} rx={2} />
          <rect x={maybeFlip(240, viewW, rtl) - (rtl ? 70 : 0)} y={86} width={70} height={20} fill={accent} rx={3} />
        </g>
      );
    case 'dense': {
      const tiles = [0, 1, 2, 3, 4, 5];
      return (
        <g>
          <rect x={20} y={20} width={viewW - 40} height={28} fill={ink} opacity={0.08} rx={3} />
          {tiles.map((i) => (
            <rect
              key={i}
              x={maybeFlip(28 + i * 72, viewW, rtl) - (rtl ? 60 : 0)}
              y={26}
              width={60}
              height={16}
              fill={ink}
              opacity={0.55}
              rx={2}
            />
          ))}
          <rect x={20} y={60} width={viewW - 40} height={56} fill={accent} opacity={0.18} rx={3} />
          <rect x={maybeFlip(40, viewW, rtl) - (rtl ? 140 : 0)} y={76} width={140} height={10} fill={ink} opacity={0.85} rx={2} />
          <rect x={maybeFlip(40, viewW, rtl) - (rtl ? 90 : 0)} y={94} width={90} height={6} fill={ink} opacity={0.55} rx={2} />
        </g>
      );
    }
    case 'menu':
      return (
        <g>
          {[40, 62, 84].map((y, i) => (
            <g key={i}>
              <rect x={maybeFlip(20, viewW, rtl) - (rtl ? 160 : 0)} y={y} width={160} height={6} fill={ink} opacity={0.78} rx={2} />
              <rect x={maybeFlip(viewW - 60, viewW, rtl) - (rtl ? 36 : 0)} y={y} width={36} height={6} fill={accent} rx={2} />
              <rect x={20} y={y + 14} width={viewW - 40} height={1} fill={ink} opacity={0.18} />
            </g>
          ))}
        </g>
      );
    case 'gallery':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={maybeFlip(20 + i * 150, viewW, rtl) - (rtl ? 130 : 0)}
              y={20}
              width={130}
              height={100}
              fill={ink}
              opacity={0.92 - i * 0.12}
              rx={3}
            />
          ))}
          <rect
            x={maybeFlip(20, viewW, rtl) - (rtl ? 60 : 0)}
            y={94}
            width={60}
            height={20}
            fill={accent}
            rx={3}
          />
        </g>
      );
    default:
      return null;
  }
}

function AccentLayer({ recipe, triplet, viewW, rtl }: LayerProps) {
  const { accent } = triplet;
  switch (recipe.accentShape) {
    case 'dot':
      return (
        <circle
          cx={maybeFlip(viewW - 40, viewW, rtl)}
          cy={140}
          r={5}
          fill={accent}
        />
      );
    case 'bar':
      return (
        <rect
          x={20}
          y={130}
          width={viewW - 40}
          height={2}
          fill={accent}
          opacity={0.85}
        />
      );
    case 'frame':
      return (
        <rect
          x={12}
          y={12}
          width={viewW - 24}
          height={116}
          fill="none"
          stroke={accent}
          strokeWidth={1}
          opacity={0.85}
        />
      );
    default:
      return null;
  }
}

function ProductRow({ recipe, triplet, viewW, rtl }: LayerProps) {
  const { ink, accent } = triplet;
  const baseY = 150;
  const rowH = 110;
  const cols = recipe.gridCols;
  const gap = 12;
  const totalGap = gap * (cols - 1);
  const available = viewW - 40 - totalGap;
  const tileW = available / cols;
  const slots = Array.from({ length: cols }, (_, i) => i);
  return (
    <g>
      {slots.map((i) => {
        const xLeft = 20 + i * (tileW + gap);
        const x = maybeFlip(xLeft, viewW, rtl) - (rtl ? tileW : 0);
        return (
          <g key={i}>
            <rect x={x} y={baseY} width={tileW} height={rowH - 30} fill={ink} opacity={0.08} rx={3} />
            <rect
              x={x + 10}
              y={baseY + 12}
              width={tileW - 20}
              height={rowH - 60}
              fill={ink}
              opacity={0.55 - i * 0.08}
              rx={2}
            />
            <rect
              x={x + 10}
              y={baseY + rowH - 30 + 6}
              width={tileW - 36}
              height={6}
              fill={ink}
              opacity={0.65}
              rx={2}
            />
            <rect
              x={x + 10}
              y={baseY + rowH - 30 + 16}
              width={28}
              height={6}
              fill={accent}
              rx={2}
            />
          </g>
        );
      })}
    </g>
  );
}

function FooterStrip({ triplet, viewW }: { triplet: LayerProps['triplet']; viewW: number }) {
  return (
    <g>
      <rect x={0} y={272} width={viewW} height={28} fill={triplet.ink} opacity={0.06} />
      <rect x={20} y={282} width={80} height={4} fill={triplet.ink} opacity={0.4} rx={2} />
      <rect x={108} y={282} width={60} height={4} fill={triplet.ink} opacity={0.4} rx={2} />
      <rect x={viewW - 84} y={282} width={64} height={4} fill={triplet.accent} rx={2} />
    </g>
  );
}

function LockBadge({ triplet, viewW, rtl }: { triplet: LayerProps['triplet']; viewW: number; rtl: boolean }) {
  const x = maybeFlip(viewW - 50, viewW, rtl) - (rtl ? 30 : 0);
  return (
    <g transform={`translate(${x} 30)`}>
      <rect width={30} height={30} rx={6} fill={triplet.ink} opacity={0.85} />
      <rect x={9} y={13} width={12} height={10} rx={2} fill={triplet.ground} />
      <path
        d="M 11 13 L 11 10 a 4 4 0 0 1 8 0 L 19 13"
        fill="none"
        stroke={triplet.ground}
        strokeWidth={1.5}
      />
    </g>
  );
}
