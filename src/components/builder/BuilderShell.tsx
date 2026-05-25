'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isVariantBlock } from '@/lib/blocks/types';
import type {
  Block,
  BLOCK_TYPES,
  BlockVariant,
  EcommerceBlockProps,
  EcommerceCategory,
  EcommerceProduct,
  Showcase1Props,
  ThemeOverrides,
} from '@/lib/blocks/types';
import type { PaletteId } from '@/lib/palettes';
import type { TemplateId } from '@/lib/brief';
import type { StorefrontPolicies } from '@/lib/storefrontSettings';
import {
  isPremiumBlockType,
  planUnlocksPremiumBlocks,
  planUnlocksSouqy,
  type Plan,
} from '@/lib/plans';
import {
  discardBuilderDraft,
  publishStorefront,
  resetBuilderToTemplate,
  saveDraftBlocks,
} from '@/app/actions/builder';
import { pollStorefrontDomain } from '@/app/actions/notifications';
import { souqyEditBlock } from '@/app/actions/souqy';
import { BlockInspector, type ProductOption } from './BlockInspector';
import { SiteInspector } from './SiteInspector';
import { SelectionToolbar, type SouqyEditResult } from './SelectionToolbar';
import { BuilderOrientationHint } from './BuilderOrientationHint';
import { OnboardingTour } from './OnboardingTour';
import { PageSwitcher } from './PageSwitcher';
import { AppsPanel } from './AppsPanel';
import { AppSettingsModal } from './AppSettingsModal';
import { PageCanvasHeader } from './PageCanvasHeader';
import { CommandPalette, type Command } from '@/components/dashboard/CommandPalette';
import type { StorefrontPage } from '@/lib/storefrontPages';
import { setStorefrontHomePage } from '@/app/actions/pages';
import type { Locale } from '@/i18n/locales';
import { direction } from '@/i18n/locales';
import { BuilderCopyProvider, useBuilderCopy } from './BuilderCopyContext';

type BlockType = (typeof BLOCK_TYPES)[number];

type Props = {
  slug: string;
  liveUrl: string;
  businessName: string;
  /** Multi-page storefront — list of every page in the storefront's
   *  `storefront_pages` table, ordered home-first. The PageSwitcher
   *  renders this; the BuilderShell uses it to look up the active
   *  page's metadata (slug, isHome, SEO). */
  pages: StorefrontPage[];
  /** Active page id. The shell threads this id into every page-aware
   *  builder action (`saveDraftBlocks`, `publishStorefront`,
   *  `switchBuilderTemplate`) so writes hit the right page row. */
  activePageId: string;
  initialBlocks: Block[];
  publishedAt: string | null;
  isPublished: boolean;
  productOptions: ProductOption[];
  categoryOptions: string[];
  /** Page-wide theme overrides for the storefront. Drives the Site
   *  inspector's initial state and the resolved chrome theme. */
  initialTheme: ThemeOverrides;
  initialPalette: PaletteId;
  /** Active template id — drives the Site inspector's template picker
   *  so the founder can swap presets without leaving the builder. */
  initialTemplate: TemplateId;
  /** Store-level policy copy edited from the Site inspector and rendered
   *  above the storefront footer. */
  initialPolicies: StorefrontPolicies;
  /** The founder's current billing tier. The Site inspector uses this
   *  to render locked tiles for templates above their plan; Souqy and
   *  business features still honor plan gates. */
  currentPlan: Plan;
  /** `light` | `dark` for the builder chrome only. Sourced from the
   *  founder's account-wide theme cookie (`getServerTheme()`), the same
   *  signal the rest of the website uses — *not* from the storefront's
   *  own `themeBehaviour`, which is a publish-time setting for how the
   *  storefront renders to visitors. Drives the [data-builder-theme]
   *  CSS vars on the editor wrapper. */
  effectiveTheme: 'light' | 'dark';
  /** Apps installed on this storefront. Drives builder integrations
   *  (e.g. enables the Giphy "Pick a GIF" button on every image
   *  picker). */
  installedAppIds?: string[];
  /** Locale for the builder *chrome* (toolbar, panels, inspector
   *  labels). Sourced from the `NEXT_LOCALE` cookie at the route
   *  layer; the rendered storefront preview inside the iframe still
   *  follows the storefront's own locale, not this one. */
  locale: Locale;
  /** One-time hint after homepage Souqy kickoff: live site shows the
   *  AI artifact while the builder canvas edits JSON draft blocks. */
  souqyLivePublishHint?: boolean;
};

type Device = 'desktop' | 'tablet' | 'mobile';
type PublishPhase = 'idle' | 'publishing' | 'checking' | 'live' | 'error';
type LibraryGroupId = 'layout' | 'products' | 'plugins' | 'contact' | 'animation' | 'spacing';

const PUBLISH_LIVE_POLL_INTERVAL_MS = 2000;
const PUBLISH_LIVE_POLL_MAX_ATTEMPTS = 90;
const PUBLISH_SOFT_READY_AFTER_MS = 6000;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isLocalPreviewHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
}

async function canReachStorefrontUrl(url: string, mode: RequestMode) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      mode,
      redirect: 'follow',
    });
    return response.ok || response.type === 'opaque';
  } catch {
    return false;
  }
}

async function isPublishedStorefrontReachable({
  slug,
  liveUrl,
}: {
  slug: string;
  liveUrl: string;
}) {
  const localPublishedUrl = `${window.location.origin}/brief/${encodeURIComponent(slug)}`;
  if (isLocalPreviewHost(window.location.hostname)) {
    return canReachStorefrontUrl(localPublishedUrl, 'same-origin');
  }

  if (await canReachStorefrontUrl(liveUrl, 'no-cors')) return true;
  return canReachStorefrontUrl(localPublishedUrl, 'same-origin');
}

const LIBRARY_GROUPS: Array<{
  id: LibraryGroupId;
  label: string;
  items: Array<{ type: BlockType; label: string; hint: string; tier?: Plan }>;
}> = [
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { type: 'hero', label: 'Hero', hint: 'Editorial title + tagline' },
      { type: 'banner', label: 'Banner', hint: 'Full-width image' },
      { type: 'text', label: 'Text', hint: 'Section copy' },
      { type: 'image', label: 'Image', hint: 'Single picture' },
      { type: 'gallery', label: 'Gallery', hint: 'Image grid' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    items: [
      { type: 'productGrid', label: 'Product grid', hint: 'Cards layout' },
      { type: 'productList', label: 'Product list', hint: 'Linear rows' },
      { type: 'featuredProduct', label: 'Featured', hint: 'Hero product' },
      {
        type: 'productCardStack',
        label: 'Card stack',
        hint: 'Layered product card · hover to fan',
        tier: 'atelier',
      },
      {
        type: 'productPromoCard',
        label: 'Promo card',
        hint: 'Single product · tags reveal · add-to-cart',
        tier: 'atelier',
      },
      {
        type: 'ecommerce1',
        label: 'Product gallery',
        hint: 'Compact gallery, sizes, add-to-bag',
        tier: 'atelier',
      },
      {
        type: 'ecommerce2',
        label: 'Shop filters',
        hint: 'Sidebar filters and product cards',
        tier: 'atelier',
      },
      {
        type: 'ecommerce3',
        label: 'Color detail',
        hint: 'Color swatches and product tabs',
        tier: 'atelier',
      },
      {
        type: 'ecommerce4',
        label: 'Drop product',
        hint: 'Limited drop with reserve/notify',
        tier: 'atelier',
      },
      {
        type: 'ecommerce5',
        label: 'Editorial shelf',
        hint: 'Hero product with compact shelf',
        tier: 'atelier',
      },
      {
        type: 'ecommerce6',
        label: 'Category shop',
        hint: 'Tabs and category product grid',
        tier: 'atelier',
      },
      {
        type: 'ecommerce7',
        label: 'Category tiles',
        hint: 'Tabbed visual category grid',
        tier: 'pro',
      },
      { type: 'menu', label: 'Menu', hint: 'Cafe-style price list' },
      { type: 'serviceList', label: 'Services', hint: 'Bordered service cards' },
      { type: 'calendar', label: 'Calendar', hint: 'Dated agenda' },
    ],
  },
  {
    id: 'plugins',
    label: 'Souqna plugins',
    items: [
      {
        type: 'taqim',
        label: 'Bundle (Taqim)',
        hint: '3 variants · product/bundle picker',
      },
      {
        type: 'mawid',
        label: 'Countdown (Mawid)',
        hint: '3 variants · product/time picker',
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    items: [
      { type: 'contactCard', label: 'Contact', hint: 'Phone/area/hours' },
      { type: 'inquireCta', label: 'Inquire CTA', hint: 'Standalone button' },
    ],
  },
  {
    id: 'animation',
    label: 'Animation',
    items: [
      {
        type: 'animatedText',
        label: 'Animated text',
        hint: 'Reveal · kinetic · wave · type · glitch',
        tier: 'pro',
      },
      {
        type: 'animatedImage',
        label: 'Animated image',
        hint: 'Parallax · magnetic · ken-burns · tilt',
        tier: 'pro',
      },
      {
        type: 'tiltImage',
        label: 'Tilt image',
        hint: 'Hover lifts + tilts left or right',
        tier: 'pro',
      },
      {
        type: 'spotlightCard',
        label: 'Spotlight card',
        hint: 'Bold card · date badge · hover rises',
        tier: 'pro',
      },
      {
        type: 'depthShowcase',
        label: 'Depth showcase',
        hint: 'React Bits parallax card · one per page',
        tier: 'pro',
      },
      {
        type: 'auroraRibbon',
        label: 'Aurora ribbon',
        hint: 'Gradient WebGL strip · use sparingly',
        tier: 'pro',
      },
      {
        type: 'showcase1',
        label: 'Case switcher',
        hint: 'Active image list and compact story',
        tier: 'pro',
      },
      {
        type: 'showcase2',
        label: 'Image marquee',
        hint: 'Draggable horizontal carousel',
        tier: 'pro',
      },
      {
        type: 'showcase3',
        label: '3D story wheel',
        hint: '3D triangular carousel',
        tier: 'pro',
      },
      {
        type: 'showcase4',
        label: 'Filter portfolio',
        hint: 'Filterable project grid',
        tier: 'pro',
      },
      {
        type: 'showcase5',
        label: 'Tabbed image rail',
        hint: 'Tabbed creator showcase',
        tier: 'pro',
      },
    ],
  },
  {
    id: 'spacing',
    label: 'Spacing',
    items: [
      { type: 'spacer', label: 'Spacer', hint: 'Vertical breather' },
      { type: 'divider', label: 'Divider', hint: 'Horizontal rule' },
    ],
  },
];

/**
 * Miniature HTML/CSS mockups of each block type, drawn at tile size
 * (~52×36) and at drag-overlay size (~140×90). Unlike the previous
 * pure-SVG glyphs, these read as small renderings of the actual block
 * — sand-toned typography, maroon accents, real layout — so the
 * library tile feels like a preview, not a key.
 *
 * The component is purely visual: no real text content, no data. All
 * dimensions are unitless and scale with the parent's `width`/`height`.
 */
function BlockMiniPreview({ type, size = 'tile' }: { type: BlockType; size?: 'tile' | 'drag' }) {
  const isDrag = size === 'drag';
  const w = isDrag ? 140 : 52;
  const h = isDrag ? 90 : 36;
  const sand = '#E8DCC4';
  const sandSoft = 'var(--bld-text-muted)';
  const sandFaint = 'rgba(232,220,196,0.22)';
  const maroon = '#E8DCC4';
  const paper = isDrag ? 'rgba(232,220,196,0.08)' : 'var(--bld-tile-bg)';

  const baseStyle: React.CSSProperties = {
    width: w,
    height: h,
    background: paper,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    color: sand,
    fontFamily: 'var(--font-serif), serif',
    flexShrink: 0,
  };

  switch (type) {
    case 'hero':
      return (
        <div style={baseStyle}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '34%',
              transform: 'translateX(-50%)',
              fontStyle: 'italic',
              fontSize: isDrag ? 18 : 7,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              color: sand,
            }}
          >
            Atelier
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '62%',
              transform: 'translateX(-50%)',
              width: '50%',
              height: 1,
              background: sandSoft,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '74%',
              transform: 'translateX(-50%)',
              width: '36%',
              height: 1,
              background: sandFaint,
            }}
          />
        </div>
      );
    case 'banner':
      return (
        <div
          style={{
            ...baseStyle,
            background: `linear-gradient(135deg, ${maroon}aa 0%, ${sand}33 100%)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 30% 60%, rgba(232,220,196,0.4) 0%, transparent 50%)',
            }}
          />
        </div>
      );
    case 'text':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? '14px 18px' : '6px 7px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isDrag ? 6 : 2,
          }}
        >
          {[100, 86, 92, 64].map((pct, i) => (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                height: isDrag ? 4 : 1.4,
                background: i === 0 ? sand : sandSoft,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      );
    case 'image':
      return (
        <div
          style={{
            ...baseStyle,
            background: 'var(--bld-tile-bg)',
            border: `1px solid ${sandFaint}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '70%',
              height: '60%',
              background:
                'linear-gradient(135deg, rgba(232,220,196,0.18) 0%, rgba(232,220,196,0.35) 100%)',
              borderRadius: 2,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: '14%',
                top: '20%',
                width: isDrag ? 8 : 3,
                height: isDrag ? 8 : 3,
                borderRadius: '50%',
                background: sand,
              }}
            />
          </div>
        </div>
      );
    case 'gallery':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 8 : 3,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: isDrag ? 4 : 1.5,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: i === 1 ? sand : sandSoft,
                opacity: i === 1 ? 0.9 : 0.45,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      );
    case 'productGrid':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: isDrag ? 6 : 2,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isDrag ? 4 : 1,
                position: 'relative',
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: 'rgba(232,220,196,0.18)',
                  borderRadius: 1,
                  minHeight: isDrag ? 38 : 14,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: isDrag ? 4 : 1.5,
                    right: isDrag ? 4 : 1.5,
                    width: isDrag ? 14 : 5,
                    height: isDrag ? 6 : 2,
                    background: maroon,
                    borderRadius: 1,
                  }}
                />
              </div>
              <div style={{ height: isDrag ? 3 : 1, width: '70%', background: sand }} />
              <div style={{ height: isDrag ? 2 : 1, width: '40%', background: sandSoft }} />
            </div>
          ))}
        </div>
      );
    case 'productList':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 4,
            display: 'flex',
            flexDirection: 'column',
            gap: isDrag ? 6 : 2,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isDrag ? 8 : 3,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: isDrag ? 22 : 8,
                  height: isDrag ? 22 : 8,
                  background: 'rgba(232,220,196,0.18)',
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isDrag ? 3 : 1 }}
              >
                <div style={{ height: isDrag ? 3 : 1, width: '80%', background: sand }} />
                <div style={{ height: isDrag ? 2 : 1, width: '50%', background: sandSoft }} />
              </div>
              <div
                style={{
                  height: isDrag ? 3 : 1,
                  width: isDrag ? 20 : 7,
                  background: maroon,
                  borderRadius: 1,
                }}
              />
            </div>
          ))}
        </div>
      );
    case 'featuredProduct':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 3,
            display: 'grid',
            gridTemplateColumns: '5fr 6fr',
            gap: isDrag ? 8 : 3,
          }}
        >
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(232,220,196,0.22) 0%, rgba(232,220,196,0.45) 100%)',
              borderRadius: 1.5,
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: isDrag ? 5 : 1.5,
            }}
          >
            <div
              style={{
                height: isDrag ? 5 : 1.6,
                width: '78%',
                background: sand,
                borderRadius: 1,
              }}
            />
            <div style={{ height: isDrag ? 2 : 1, width: '70%', background: sandSoft }} />
            <div style={{ height: isDrag ? 2 : 1, width: '60%', background: sandSoft }} />
            <div
              style={{
                marginTop: isDrag ? 4 : 1,
                width: isDrag ? 36 : 12,
                height: isDrag ? 8 : 2.5,
                background: maroon,
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      );
    case 'serviceList':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 8 : 3,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: isDrag ? 5 : 1.5,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${sandFaint}`,
                borderRadius: 1.5,
                padding: isDrag ? 5 : 1.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: isDrag ? 3 : 1,
              }}
            >
              <div style={{ height: isDrag ? 3 : 1, width: '80%', background: sand }} />
              <div style={{ height: isDrag ? 2 : 1, width: '55%', background: sandSoft }} />
            </div>
          ))}
        </div>
      );
    case 'menu':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? '10px 14px' : '4px 5px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            gap: isDrag ? 6 : 1.5,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: isDrag ? 4 : 1 }}>
              <div
                style={{
                  height: isDrag ? 3 : 1.2,
                  width: '36%',
                  background: sand,
                  borderRadius: 1,
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 1,
                  borderTop: `1px dotted ${sandFaint}`,
                }}
              />
              <div
                style={{
                  height: isDrag ? 3 : 1.2,
                  width: isDrag ? 18 : 6,
                  background: maroon,
                  borderRadius: 1,
                }}
              />
            </div>
          ))}
        </div>
      );
    case 'calendar':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 8 : 3,
            display: 'flex',
            flexDirection: 'column',
            gap: isDrag ? 4 : 1.5,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ height: isDrag ? 3 : 1.2, width: isDrag ? 32 : 12, background: sand }} />
            <div style={{ display: 'flex', gap: isDrag ? 3 : 1 }}>
              <span
                style={{
                  width: isDrag ? 4 : 1.5,
                  height: isDrag ? 4 : 1.5,
                  background: sandSoft,
                  borderRadius: '50%',
                }}
              />
              <span
                style={{
                  width: isDrag ? 4 : 1.5,
                  height: isDrag ? 4 : 1.5,
                  background: sandSoft,
                  borderRadius: '50%',
                }}
              />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: isDrag ? 2 : 0.6,
            }}
          >
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: i === 9 ? maroon : sandFaint,
                  borderRadius: 0.5,
                  opacity: i === 9 ? 1 : 0.6,
                }}
              />
            ))}
          </div>
        </div>
      );
    case 'contactCard':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 4,
            display: 'flex',
            alignItems: 'center',
            gap: isDrag ? 10 : 3,
          }}
        >
          <div
            style={{
              width: isDrag ? 36 : 12,
              height: isDrag ? 36 : 12,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, rgba(232,220,196,0.4) 0%, rgba(232,220,196,0.5) 100%)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isDrag ? 4 : 1 }}>
            <div style={{ height: isDrag ? 3 : 1.2, width: '70%', background: sand }} />
            <div style={{ height: isDrag ? 2 : 1, width: '90%', background: sandSoft }} />
            <div style={{ height: isDrag ? 2 : 1, width: '60%', background: sandSoft }} />
          </div>
        </div>
      );
    case 'inquireCta':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isDrag ? 5 : 1.5,
          }}
        >
          <div
            style={{ height: isDrag ? 4 : 1.4, width: '60%', background: sand, borderRadius: 1 }}
          />
          <div style={{ height: isDrag ? 2 : 1, width: '70%', background: sandSoft }} />
          <div
            style={{
              marginTop: isDrag ? 3 : 1,
              padding: isDrag ? '4px 16px' : '1.5px 6px',
              background: maroon,
              borderRadius: 999,
              color: sand,
              fontFamily: 'var(--font-mono)',
              fontSize: isDrag ? 8 : 0,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              lineHeight: 1,
              minHeight: isDrag ? 14 : 5,
            }}
          >
            {isDrag ? 'Inquire' : ''}
          </div>
        </div>
      );
    case 'spacer':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: `1px dashed ${sandFaint}`,
          }}
        >
          <div
            style={{
              width: isDrag ? 30 : 12,
              height: 1,
              background: sandSoft,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -3,
                top: -3,
                width: 0,
                height: 0,
                borderRight: `4px solid ${sandSoft}`,
                borderTop: '3px solid transparent',
                borderBottom: '3px solid transparent',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: -3,
                top: -3,
                width: 0,
                height: 0,
                borderLeft: `4px solid ${sandSoft}`,
                borderTop: '3px solid transparent',
                borderBottom: '3px solid transparent',
              }}
            />
          </div>
        </div>
      );
    case 'divider':
      return (
        <div
          style={{
            ...baseStyle,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ flex: 1, height: 1, background: sandSoft, marginLeft: isDrag ? 14 : 4 }} />
          <span
            style={{
              width: isDrag ? 6 : 2.4,
              height: isDrag ? 6 : 2.4,
              borderRadius: '50%',
              background: maroon,
              margin: isDrag ? '0 6px' : '0 2px',
            }}
          />
          <div style={{ flex: 1, height: 1, background: sandSoft, marginRight: isDrag ? 14 : 4 }} />
        </div>
      );
    case 'animatedText':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isDrag ? 4 : 2,
          }}
        >
          {Array.from('Aa').map((ch, i) => (
            <span
              key={i}
              style={{
                fontStyle: 'italic',
                fontSize: isDrag ? 28 : 14,
                color: i === 0 ? sand : maroon,
                lineHeight: 1,
                transform: i === 1 ? 'translateY(-2px)' : 'translateY(2px)',
              }}
            >
              {ch}
            </span>
          ))}
          <span
            aria-hidden
            style={{
              width: isDrag ? 1.6 : 1,
              height: isDrag ? 18 : 10,
              background: maroon,
              marginInlineStart: isDrag ? 4 : 2,
            }}
          />
        </div>
      );
    case 'animatedImage':
      return (
        <div
          style={{
            ...baseStyle,
            background: `linear-gradient(135deg, ${sandFaint} 0%, transparent 60%, ${maroon}33 100%)`,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: isDrag ? 12 : 4,
              border: `1px solid ${sand}`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: isDrag ? 18 : 7,
              bottom: isDrag ? 18 : 7,
              width: isDrag ? 10 : 5,
              height: isDrag ? 10 : 5,
              borderRadius: '50%',
              background: maroon,
              opacity: 0.7,
            }}
          />
        </div>
      );
    case 'spotlightCard': {
      const sq = isDrag ? 56 : 22;
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: sq,
              height: sq,
              background: maroon,
              border: `1px solid ${sand}`,
              borderRadius: 2,
              transform: `rotateZ(-${isDrag ? 4 : 2}deg)`,
              position: 'relative',
              overflow: 'visible',
              boxShadow: isDrag
                ? `0 4px 10px -2px rgba(0,0,0,0.4)`
                : `0 1.5px 3px -1px rgba(0,0,0,0.4)`,
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '60%',
                height: '36%',
                background: `repeating-linear-gradient(135deg, ${sand} 0 ${isDrag ? 3 : 1.4}px, transparent ${isDrag ? 3 : 1.4}px ${isDrag ? 6 : 2.8}px)`,
                clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)',
                borderBottom: `1px solid ${sand}`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: isDrag ? 14 : 6,
                height: isDrag ? 14 : 6,
                background: '#000',
                border: `1px solid ${maroon}`,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: isDrag ? 6 : 2,
                bottom: isDrag ? 6 : 2,
                right: isDrag ? 6 : 2,
                display: 'flex',
                flexDirection: 'column',
                gap: isDrag ? 3 : 1,
              }}
            >
              <div style={{ height: isDrag ? 3 : 1, width: '60%', background: sand }} />
              <div
                style={{
                  height: isDrag ? 1.6 : 0.8,
                  width: '80%',
                  background: 'rgba(232,220,196,0.55)',
                }}
              />
              <div
                style={{
                  marginTop: isDrag ? 3 : 1,
                  width: isDrag ? 18 : 7,
                  height: isDrag ? 5 : 2,
                  background: '#000',
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
        </div>
      );
    }
    case 'tiltImage': {
      const w2 = isDrag ? 84 : 32;
      const h2 = isDrag ? 54 : 20;
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: w2,
              height: h2,
              borderRadius: isDrag ? 4 : 1.5,
              background: `linear-gradient(135deg, ${maroon}aa 0%, ${sand}55 60%, ${sandFaint} 100%)`,
              border: `1px solid ${sandSoft}`,
              transform: `rotateZ(-${isDrag ? 6 : 4}deg) translateY(-${isDrag ? 3 : 1}px)`,
              boxShadow: isDrag ? `0 6px 12px -4px ${maroon}55` : `0 2px 4px -1px ${maroon}55`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: isDrag ? '40% 18% 18% 18%' : '40% 12% 12% 12%',
                display: 'flex',
                flexDirection: 'column',
                gap: isDrag ? 3 : 1,
              }}
            >
              <div style={{ height: isDrag ? 3 : 1, width: '70%', background: sand }} />
              <div
                style={{
                  height: isDrag ? 1.5 : 0.7,
                  width: '50%',
                  background: 'rgba(232,220,196,0.55)',
                }}
              />
            </div>
          </div>
        </div>
      );
    }
    case 'productPromoCard': {
      const cardW = isDrag ? 64 : 24;
      const cardH = isDrag ? 78 : 30;
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: cardW,
              height: cardH,
              borderRadius: isDrag ? 4 : 1.6,
              background: paper,
              border: `1px solid ${sandSoft}`,
              padding: isDrag ? 4 : 1.4,
              display: 'flex',
              flexDirection: 'column',
              gap: isDrag ? 3 : 1.2,
              boxShadow: isDrag
                ? `0 4px 8px -3px rgba(0,0,0,0.5)`
                : `0 1.5px 3px -1px rgba(0,0,0,0.4)`,
            }}
          >
            <div
              style={{
                position: 'relative',
                aspectRatio: '4 / 3',
                borderRadius: isDrag ? 3 : 1.2,
                background: `linear-gradient(135deg, ${maroon}55 0%, ${sandFaint} 70%)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: isDrag ? 3 : 1,
                  right: isDrag ? 3 : 1,
                  padding: isDrag ? '2px 6px' : '0.6px 2px',
                  fontSize: isDrag ? 6 : 2.2,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: sand,
                  background: maroon,
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                NEW
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isDrag ? 2 : 0.7 }}>
              <div style={{ height: isDrag ? 2 : 1, width: '70%', background: maroon }} />
              <div style={{ height: isDrag ? 1.4 : 0.6, width: '90%', background: sandSoft }} />
            </div>
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: isDrag ? 4 : 1.6,
              }}
            >
              <div
                style={{
                  height: isDrag ? 3 : 1.2,
                  width: '40%',
                  background: maroon,
                  borderRadius: 1,
                }}
              />
              <div
                style={{
                  width: isDrag ? 12 : 5,
                  height: isDrag ? 12 : 5,
                  borderRadius: '50%',
                  background: maroon,
                  display: 'grid',
                  placeItems: 'center',
                  color: sand,
                  fontSize: isDrag ? 9 : 4,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                +
              </div>
            </div>
          </div>
        </div>
      );
    }
    case 'productCardStack': {
      const cardW = isDrag ? 60 : 22;
      const cardH = isDrag ? 70 : 26;
      const offset = isDrag ? 6 : 2.4;
      const radius = isDrag ? 4 : 1.5;
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: cardW + offset, height: cardH + offset }}>
            <div
              style={{
                position: 'absolute',
                top: offset,
                left: offset,
                width: cardW,
                height: cardH,
                background: sandFaint,
                border: `1px solid ${sandSoft}`,
                borderRadius: radius,
                transform: `rotate(${isDrag ? 4 : 2}deg)`,
                transformOrigin: 'top left',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: cardW,
                height: cardH,
                background: paper,
                border: `1px solid ${sand}`,
                borderRadius: radius,
                display: 'flex',
                flexDirection: 'column',
                padding: isDrag ? 6 : 2,
                gap: isDrag ? 4 : 1.4,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background:
                    'linear-gradient(135deg, rgba(232,220,196,0.22) 0%, rgba(232,220,196,0.45) 100%)',
                  borderRadius: isDrag ? 2 : 1,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: isDrag ? 4 : 1.6 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isDrag ? 2 : 0.8,
                  }}
                >
                  <div style={{ height: isDrag ? 2 : 1, width: '70%', background: sand }} />
                  <div style={{ height: isDrag ? 1.6 : 0.8, width: '50%', background: sandSoft }} />
                </div>
                <div
                  style={{
                    width: isDrag ? 10 : 4,
                    height: isDrag ? 10 : 4,
                    borderRadius: '50%',
                    border: `1px solid ${maroon}`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }
    case 'mawid':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 12 : 4,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isDrag ? 8 : 3,
            border: `1px solid ${maroon}66`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span style={{ color: maroon, fontSize: isDrag ? 16 : 7, lineHeight: 1 }}>◷</span>
            <div style={{ height: isDrag ? 2 : 1, width: '48%', background: sandSoft }} />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isDrag ? 5 : 2 }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${sandFaint}`,
                  borderRadius: isDrag ? 5 : 2,
                  padding: isDrag ? '5px 2px' : '2px 1px',
                  textAlign: 'center',
                }}
              >
                <div style={{ height: isDrag ? 5 : 2, marginInline: '20%', background: sand }} />
              </div>
            ))}
          </div>
        </div>
      );
    case 'taqim':
      return (
        <div
          style={{
            ...baseStyle,
            padding: isDrag ? 10 : 3,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: isDrag ? 8 : 3,
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: isDrag ? 54 : 22,
                borderRadius: isDrag ? 6 : 2,
                border: `1px solid ${sandFaint}`,
                background: `linear-gradient(135deg, ${sandFaint}, ${maroon}33)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: isDrag ? 5 : 2,
                gap: isDrag ? 3 : 1,
              }}
            >
              <div style={{ height: isDrag ? 2 : 1, width: '70%', background: sand }} />
              <div style={{ height: isDrag ? 1.5 : 0.7, width: '45%', background: sandSoft }} />
            </div>
          ))}
          <span
            style={{
              width: isDrag ? 20 : 8,
              height: isDrag ? 20 : 8,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: maroon,
              color: sand,
              fontSize: isDrag ? 14 : 6,
              lineHeight: 1,
            }}
          >
            +
          </span>
        </div>
      );
    case 'depthShowcase': {
      const cardW = isDrag ? 44 : 18;
      const cardH = Math.round(cardW * 1.08);
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
            perspective: isDrag ? 240 : 80,
          }}
        >
          <div
            style={{
              width: cardW,
              height: cardH,
              borderRadius: isDrag ? 6 : 3,
              border: `1px solid ${sand}`,
              background: `linear-gradient(160deg, ${maroon}55 0%, ${sandFaint} 45%, #1a1410 100%)`,
              transform: `rotateY(-${isDrag ? 8 : 4}deg) rotateX(${isDrag ? 4 : 2}deg)`,
              boxShadow: isDrag ? `0 8px 20px rgba(0,0,0,0.35)` : `0 2px 6px rgba(0,0,0,0.35)`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: isDrag ? '14% 12% 28%' : '16% 14% 32%',
                borderRadius: 2,
                background: `linear-gradient(135deg, ${sand}33, transparent)`,
                border: `1px solid ${sandFaint}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: isDrag ? 8 : 3,
                right: isDrag ? 8 : 3,
                bottom: isDrag ? 8 : 3,
                display: 'flex',
                flexDirection: 'column',
                gap: isDrag ? 3 : 1,
              }}
            >
              <div style={{ height: isDrag ? 3 : 1.2, width: '55%', background: sand }} />
              <div style={{ height: isDrag ? 2 : 0.9, width: '80%', background: sandSoft }} />
            </div>
          </div>
        </div>
      );
    }
    case 'auroraRibbon':
      return (
        <div
          style={{
            ...baseStyle,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(90deg, ${maroon}88 0%, #5586bd99 40%, ${sandFaint} 100%)`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(110deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 14px)',
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isDrag ? 4 : 2,
              padding: isDrag ? '10px 12px' : '4px 6px',
            }}
          >
            <div
              style={{ height: isDrag ? 2 : 1, width: '35%', background: sand, opacity: 0.85 }}
            />
            <div style={{ height: isDrag ? 4 : 1.6, width: '62%', background: sand }} />
            <div style={{ height: isDrag ? 2 : 0.9, width: '48%', background: sandSoft }} />
          </div>
        </div>
      );
    case 'showcase1':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            gridTemplateColumns: '42% 1fr',
            gap: isDrag ? 8 : 3,
            padding: isDrag ? 12 : 4,
          }}
        >
          <div style={{ display: 'grid', gap: isDrag ? 5 : 2 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: isDrag ? 12 : 4,
                  borderRadius: 99,
                  background: i === 0 ? maroon : sandFaint,
                  border: `1px solid ${sandFaint}`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              borderRadius: isDrag ? 10 : 4,
              background: `linear-gradient(145deg, ${maroon}88, ${sandFaint})`,
              border: `1px solid ${sandFaint}`,
            }}
          />
        </div>
      );
    case 'showcase2':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'flex',
            alignItems: 'center',
            gap: isDrag ? 8 : 3,
            overflow: 'hidden',
            padding: isDrag ? '16px 10px' : '6px 4px',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: '0 0 auto',
                width: isDrag ? 24 : 10,
                height: isDrag ? 50 + i * 5 : 19 + i * 2,
                borderRadius: isDrag ? 8 : 3,
                background: `linear-gradient(160deg, ${i % 2 ? sand : maroon}66, ${sandFaint})`,
                border: `1px solid ${sandFaint}`,
              }}
            />
          ))}
        </div>
      );
    case 'showcase3':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            placeItems: 'center',
            perspective: isDrag ? 260 : 100,
          }}
        >
          <div
            style={{
              width: isDrag ? 74 : 30,
              height: isDrag ? 58 : 24,
              position: 'relative',
              transformStyle: 'preserve-3d',
              transform: 'rotateY(-18deg)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: isDrag ? 22 : 9,
                  top: isDrag ? 8 : 3,
                  width: isDrag ? 28 : 12,
                  height: isDrag ? 42 : 18,
                  borderRadius: isDrag ? 7 : 3,
                  border: `1px solid ${sand}`,
                  background: `linear-gradient(160deg, ${maroon}66, ${sandFaint})`,
                  transform: `rotateY(${i * 120}deg) translateZ(${isDrag ? 24 : 10}px)`,
                  boxShadow: i === 0 ? '0 4px 12px rgba(0,0,0,0.3)' : undefined,
                }}
              />
            ))}
          </div>
        </div>
      );
    case 'showcase4':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: isDrag ? 6 : 2,
            padding: isDrag ? 12 : 4,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'grid', gap: isDrag ? 4 : 1.5 }}>
              <div
                style={{
                  aspectRatio: '1',
                  borderRadius: isDrag ? 8 : 3,
                  background: `linear-gradient(145deg, ${sandFaint}, ${i % 2 ? maroon : '#5586bd'}55)`,
                  border: `1px solid ${sandFaint}`,
                }}
              />
              <div style={{ height: isDrag ? 3 : 1, width: '80%', background: sand }} />
              <div style={{ height: isDrag ? 2 : 0.8, width: '55%', background: sandSoft }} />
            </div>
          ))}
        </div>
      );
    case 'showcase5':
      return (
        <div
          style={{
            ...baseStyle,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: isDrag ? 8 : 3,
            padding: isDrag ? '28px 10px 12px' : '11px 4px 4px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: isDrag ? 10 : 4,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: isDrag ? 4 : 1.5,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: isDrag ? 24 : 8,
                  height: isDrag ? 8 : 3,
                  borderRadius: 99,
                  background: i === 0 ? maroon : sandFaint,
                  border: `1px solid ${sandFaint}`,
                }}
              />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: '0 0 auto',
                width: isDrag ? 34 : 14,
                height: isDrag ? 34 : 14,
                borderRadius: isDrag ? 8 : 3,
                background: `linear-gradient(145deg, ${sandFaint}, ${i === 1 ? '#5586bd' : maroon}66)`,
                border: `1px solid ${sandFaint}`,
              }}
            />
          ))}
        </div>
      );
    case 'ecommerce1':
    case 'ecommerce2':
    case 'ecommerce3':
    case 'ecommerce4':
    case 'ecommerce5':
    case 'ecommerce6':
    case 'ecommerce7':
      return (
        <div
          style={{
            ...baseStyle,
            display: 'grid',
            gridTemplateColumns:
              type === 'ecommerce1' || type === 'ecommerce3' || type === 'ecommerce4'
                ? '1fr 1fr'
                : 'repeat(3, 1fr)',
            gap: isDrag ? 6 : 2,
            padding: isDrag ? 10 : 4,
          }}
        >
          {Array.from({ length: type === 'ecommerce1' || type === 'ecommerce4' ? 2 : 6 }).map(
            (_, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gap: isDrag ? 4 : 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    aspectRatio: type === 'ecommerce7' ? '4 / 5' : '4 / 3',
                    borderRadius: isDrag ? 8 : 3,
                    background: `linear-gradient(145deg, ${sandFaint}, ${i % 2 ? maroon : '#5586bd'}55)`,
                    border: `1px solid ${sandFaint}`,
                  }}
                />
                <div style={{ height: isDrag ? 3 : 1, width: '80%', background: sand }} />
              </div>
            ),
          )}
        </div>
      );
    default:
      return <div style={baseStyle} />;
  }
}

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '820px',
  mobile: '390px',
};

const LIBRARY_PREFIX = 'lib::';
const OUTLINE_DROPZONE_ID = 'outline-dropzone';
const CANVAS_DROPZONE_ID = 'canvas-dropzone';

// How long the freshly-added outline row glows after a drop. Long enough
// that the founder's eye lands on it, short enough that the chrome
// settles before they reach for the inspector. Aligned with the
// `souqna-just-added` keyframes below.
const JUST_ADDED_GLOW_MS = 1500;

/**
 * Scoped keyframes for the builder chrome. Injected once per shell mount
 * via a `<style>` element so we don't depend on a global stylesheet for
 * the motion. Names are prefixed (`souqna-…`) to avoid collisions.
 */
const SOUQNA_KEYFRAMES = `
/* Arabic builder chrome uses the exact public-homepage Arabic stack:
   --font-arabic / --font-arabic-serif are Thmanyah Serif Display in
   globals.css. Inline builder controls set their own font-family heavily,
   so these scoped !important rules intentionally win only in AR mode. */
[data-builder-locale="ar"] .souqna-builder-topbar *,
[data-builder-locale="ar"] .souqna-builder-aside-left *,
[data-builder-locale="ar"] .souqna-builder-aside-right *,
[data-builder-locale="ar"] .souqna-canvas-status *,
[data-builder-locale="ar"] .souqna-selection-toolbar *,
[data-builder-locale="ar"] .souqna-builder-nav-sheet * {
  font-family: var(--font-arabic), var(--font-arabic-serif), ui-serif, Georgia, serif !important;
  font-weight: 700;
  letter-spacing: 0 !important;
}
[data-builder-locale="ar"] .souqna-library-tile,
[data-builder-locale="ar"] .souqna-outline-row,
[data-builder-locale="ar"] .souqna-bar-business-name,
[data-builder-locale="ar"] .souqna-selection-toolbar__pill {
  font-family: var(--font-arabic-serif), var(--font-arabic), ui-serif, Georgia, serif !important;
  font-weight: 700;
  line-height: 1.12;
}
/* ── Builder chrome theme tokens ──────────────────────────────────────
   Chrome (top bar / sidebars / canvas backplate / inspector) reads
   from these vars so the builder follows the storefront's
   themeBehaviour (auto/light/dark) — and 'auto' falls back to the
   user's account theme cookie. The accent system mirrors the homepage:
   charcoal on cream in light mode, cream on charcoal in dark mode. */
[data-builder-theme="dark"] {
  /* Dark-mode RGB triples are written with modern functional notation
     (rgb R G B / X%) so a downstream sweep that replaces legacy
     rgba(232,220,196,...) literals with var(--bld-...) does not
     accidentally rewrite these definitions into self-references. */
  --bld-canvas: #2A2A2A;
  --bld-surface: rgb(42 42 42 / 72%);
  --bld-surface-strong: rgb(31 31 31 / 88%);
  --bld-text: rgb(232 220 196 / 92%);
  --bld-text-muted: rgb(232 220 196 / 66%);
  --bld-text-faint: rgb(232 220 196 / 44%);
  --bld-divider: rgb(232 220 196 / 14%);
  --bld-iframe-border: rgb(232 220 196 / 20%);
  --bld-input-bg: rgb(0 0 0 / 18%);
  --bld-input-text: var(--color-sand-pale);
  --bld-input-border: rgb(232 220 196 / 20%);
  --bld-input-placeholder: rgb(232 220 196 / 40%);
  --bld-chip-bg: rgb(0 0 0 / 18%);
  --bld-chip-bg-active: rgb(232 220 196 / 12%);
  --bld-chip-border: rgb(232 220 196 / 20%);
  --bld-tile-bg: rgb(232 220 196 / 5%);
  --bld-tile-border: rgb(232 220 196 / 14%);
  --bld-strip-bg: rgb(0 0 0 / 18%);
  --bld-strip-text: rgb(232 220 196 / 62%);
  --bld-overlay-scrim: rgb(0 0 0 / 45%);
  --bld-grid-line: rgb(232 220 196 / 10%);
  --bld-accent: #E8DCC4;
  --bld-accent-ink: #2A2A2A;
  --bld-accent-soft: rgb(232 220 196 / 10%);
  --bld-accent-softer: rgb(232 220 196 / 6%);
  --bld-accent-line: rgb(232 220 196 / 22%);
  --bld-accent-strong: rgb(232 220 196 / 82%);
  --bld-panel-shadow: rgb(0 0 0 / 28%);
}
[data-builder-theme="light"] {
  --bld-canvas: #E8DCC4;
  --bld-surface: rgb(232 220 196 / 78%);
  --bld-surface-strong: rgb(232 220 196 / 92%);
  --bld-text: #2A2418;
  --bld-text-muted: rgba(42,36,24,0.68);
  --bld-text-faint: rgba(42,36,24,0.46);
  --bld-divider: rgba(42,36,24,0.16);
  --bld-iframe-border: rgba(42,36,24,0.22);
  --bld-input-bg: rgba(42,36,24,0.05);
  --bld-input-text: #2A2418;
  --bld-input-border: rgba(42,36,24,0.20);
  --bld-input-placeholder: rgba(42,36,24,0.4);
  --bld-chip-bg: rgba(232,220,196,0.72);
  --bld-chip-bg-active: rgba(42,42,42,0.10);
  --bld-chip-border: rgba(42,36,24,0.18);
  --bld-tile-bg: rgba(42,36,24,0.04);
  --bld-tile-border: rgba(42,36,24,0.13);
  --bld-strip-bg: rgba(232,220,196,0.70);
  --bld-strip-text: rgba(42,36,24,0.62);
  --bld-overlay-scrim: rgba(42,36,24,0.35);
  --bld-grid-line: rgba(42,42,42,0.10);
  --bld-accent: #2A2A2A;
  --bld-accent-ink: #E8DCC4;
  --bld-accent-soft: rgba(42,42,42,0.10);
  --bld-accent-softer: rgba(42,42,42,0.06);
  --bld-accent-line: rgba(42,42,42,0.20);
  --bld-accent-strong: rgba(42,42,42,0.82);
  --bld-panel-shadow: rgba(42,36,24,0.12);
}
@keyframes souqna-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.45); opacity: 0.55; }
}
@keyframes souqna-ripple {
  0%   { transform: scale(0.6); opacity: 0.7; }
  80%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes souqna-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-3px); }
  40%      { transform: translateX(3px); }
  60%      { transform: translateX(-2px); }
  80%      { transform: translateX(2px); }
}
.souqna-shake { animation: souqna-shake 220ms ease-in-out 1; }
@keyframes souqna-scrub {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes souqna-shimmer {
  0%   { background-position: 200% 0; opacity: 0.3; }
  50%  { opacity: 1; }
  100% { background-position: -200% 0; opacity: 0.3; }
}
@keyframes souqna-spin {
  to { transform: rotate(360deg); }
}
.souqna-publish-spinner {
  animation: souqna-spin 760ms linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .souqna-publish-spinner { animation: none !important; }
}
.souqna-library-tile:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 34px var(--bld-panel-shadow);
  border-color: var(--bld-input-border) !important;
}

/* Orientation hint — visible only on phones held in portrait. The
   builder is dense; landscape gives every control a fair shake. */
.souqna-builder-orientation-hint { display: none !important; }
@media (max-width: 767px) and (orientation: portrait) {
  .souqna-builder-orientation-hint { display: flex !important; }
}

/* Responsive builder grid:
   - lg+ : 3-column (library | canvas | inspector)
   - md  : 2-column (canvas | inspector) — library becomes a drawer
   - sm  : single-column canvas — both panels become drawers */
.souqna-builder-grid { grid-template-columns: minmax(220px, 280px) 1fr minmax(300px, 380px); }
@media (max-width: 1023px) {
  .souqna-builder-grid { grid-template-columns: 1fr minmax(280px, 360px); }
  .souqna-builder-aside-left { display: none !important; }
  /* Drawer backgrounds force --bld-canvas (opaque) instead of the
     translucent --bld-surface used on desktop, otherwise the iframe
     preview bleeds through the panel and reads as a layered mess. */
  .souqna-builder-aside-left.souqna-drawer-open { display: flex !important; position: fixed; inset: 0 auto 0 0; width: min(86vw, 320px); z-index: 70; background: var(--bld-canvas) !important; box-shadow: 0 0 0 100vmax var(--bld-overlay-scrim); }
  .souqna-builder-toggle-left { display: inline-flex !important; }
  .souqna-builder-drawer-backdrop { display: block !important; }
}
@media (max-width: 767px) {
  .souqna-builder-grid { grid-template-columns: 1fr; }
  .souqna-builder-aside-right { display: none !important; }
  .souqna-builder-aside-right.souqna-drawer-open { display: flex !important; position: fixed; inset: 0 0 0 auto; width: min(92vw, 380px); z-index: 70; background: var(--bld-canvas) !important; box-shadow: 0 0 0 100vmax var(--bld-overlay-scrim); }
  .souqna-builder-toggle-right { display: inline-flex !important; }
  /* Stronger scrim on phones: the 45% scrim that works at desktop
     leaves enough preview content visible around a narrow drawer that
     it competes for attention. Crank it to 80% so the open panel is
     clearly the only thing the user is meant to interact with. */
  .souqna-builder-aside-left.souqna-drawer-open,
  .souqna-builder-aside-right.souqna-drawer-open {
    box-shadow: 0 0 0 100vmax rgba(0,0,0,0.78) !important;
  }
  /* Hide the floating selection toolbar while a drawer is open — it
     pins itself to the viewport bottom on mobile and otherwise floats
     on top of the scrim, defeating the focus-the-drawer effect. The
     :has() selector lets a sibling drawer state drive the toolbar. */
  .souqna-builder-grid:has(.souqna-drawer-open) .souqna-selection-toolbar-wrap {
    display: none !important;
  }
}
/* Compact the builder top bar on tablet/phone so the row never overflows
   off-screen. We progressively hide low-priority controls (width readout,
   device toggle, account link, business name, separators) and shrink the
   primary action label so the publish button still reads clearly. */
@media (max-width: 1023px) {
  .souqna-bar-width-readout,
  .souqna-bar-device-toggle { display: none !important; }
}
@media (max-width: 767px) {
  .souqna-builder-topbar {
    height: 48px !important;
    padding-inline: 10px !important;
    justify-content: space-between !important;
  }
  .souqna-builder-topbar > div {
    gap: 6px !important;
  }
  .souqna-builder-topbar > div:first-child {
    flex: 0 0 auto !important;
    min-width: 0 !important;
  }
  .souqna-bar-account,
  .souqna-bar-business-name,
  .souqna-bar-cmdk,
  .souqna-bar-device-toggle,
  .souqna-bar-glyph,
  .souqna-bar-locale-toggle,
  .souqna-bar-nav,
  .souqna-bar-publish-glyph,
  .souqna-bar-publish-needed,
  .souqna-bar-replay,
  .souqna-bar-separator,
  .souqna-bar-save-chip,
  .souqna-bar-undo,
  .souqna-bar-redo,
  .souqna-bar-overflow,
  .souqna-bar-userbutton,
  .souqna-bar-width-readout { display: none !important; }
  .souqna-bar-publish {
    min-height: 34px !important;
    padding: 7px 16px !important;
    font-size: 11px !important;
  }
  .souqna-builder-toggle-left,
  .souqna-builder-toggle-right {
    width: 36px !important;
    height: 36px !important;
  }
  .souqna-builder-mobile-drawer-tools {
    display: flex !important;
  }
}
@media (max-width: 479px) {
  .souqna-builder-topbar { height: 46px !important; padding-inline: 10px !important; }
  .souqna-bar-publish { padding: 6px 14px !important; font-size: 10.5px !important; }
}
@media (max-width: 767px) {
  .souqna-builder-canvas { padding: 4px !important; }
}
/* ── Mobile density pass ────────────────────────────────────────────
   Below 768px the builder lives inside a 360–430px viewport. Every
   pixel of chrome eats into the canvas, so we shrink the toolbar,
   inspector padding, library tiles, and outline rows. Targets stay
   ≥36px tall to remain tap-friendly. */
@media (max-width: 767px) {
  .souqna-builder-aside-right.souqna-drawer-open {
    width: min(96vw, 420px) !important;
    padding: 12px 14px !important;
  }
  .souqna-builder-aside-left.souqna-drawer-open {
    width: min(90vw, 320px) !important;
  }
  .souqna-builder-mobile-drawer-tools {
    display: flex !important;
  }
  .souqna-library-tile {
    padding: 6px 8px !important;
    grid-template-columns: 44px 1fr !important;
    gap: 8px !important;
  }
  .souqna-library-tile > div:first-child {
    width: 44px !important;
    height: 30px !important;
  }
  .souqna-outline-row > div {
    padding: 5px 6px 5px 4px !important;
  }
  .souqna-canvas-status {
    padding: 6px 10px !important;
    font-size: 9px !important;
  }
  /* On phones the floating selection toolbar lives above the viewport,
     not inside the scrolling canvas — sticky-inside-overflow doesn't
     pin to the visible region when the canvas itself is the scroller. */
  .souqna-selection-toolbar-wrap {
    position: fixed !important;
    left: 12px !important;
    right: 12px !important;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
    margin-top: 0 !important;
    display: flex !important;
    justify-content: center !important;
    align-self: auto !important;
    z-index: 30 !important;
  }
  .souqna-selection-toolbar-wrap > [role='toolbar'] {
    width: 100% !important;
    justify-content: space-between !important;
  }
  /* Status strip is gold-on-ink chrome; on phones the toolbar steals the
     bottom edge so the strip retreats to the top of the canvas (where
     it already lives) and shrinks. The label inside the toolbar pill
     surfaces the same "saved" state — the strip is a redundant safety
     net at this width. */
  .souqna-canvas-status {
    margin-bottom: 0 !important;
  }
}
/* Inspector form fields read large on phones (the global iOS-zoom guard
   lifts inputs to 16px below 768px); the builder is a power-user surface
   so we override that floor with a compact 14px and tighter padding so
   more form fits in the 380px drawer without forcing horizontal scroll. */
@media (max-width: 767px) {
  .souqna-builder-aside-right input,
  .souqna-builder-aside-right textarea,
  .souqna-builder-aside-right select {
    font-size: 14px !important;
    padding: 7px 9px !important;
  }
}
@media (max-width: 479px) {
  .souqna-builder-aside-right.souqna-drawer-open {
    width: 100vw !important;
    padding: 10px 12px !important;
  }
  .souqna-builder-aside-left.souqna-drawer-open {
    width: 100vw !important;
  }
}
.souqna-outline-list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.souqna-outline-list::before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 11px;
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, var(--bld-accent-line) 8%, var(--bld-accent-line) 92%, transparent 100%);
  pointer-events: none;
}
.souqna-outline-row {
  position: relative;
  list-style: none;
  border-radius: 10px;
}
.souqna-outline-row__bg {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: transparent;
  transition: background 140ms ease;
  pointer-events: none;
}
.souqna-outline-row:hover .souqna-outline-row__bg {
  background: var(--bld-accent-softer);
}
.souqna-outline-row.is-selected .souqna-outline-row__bg {
  background: var(--bld-accent-soft);
}
.souqna-outline-row__actions {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transform: translateX(4px);
  transition: opacity 160ms ease, transform 160ms ease;
}
.souqna-outline-row:hover .souqna-outline-row__actions,
.souqna-outline-row:focus-within .souqna-outline-row__actions,
.souqna-outline-row.is-selected .souqna-outline-row__actions {
  opacity: 1;
  transform: translateX(0);
}
.souqna-outline-row__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--bld-surface-strong);
  border: 1px solid var(--bld-accent-line);
  cursor: grab;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, box-shadow 240ms ease;
  position: relative;
  z-index: 1;
}
.souqna-outline-row:hover .souqna-outline-row__dot {
  transform: scale(1.18);
  border-color: var(--bld-accent-strong);
}
.souqna-outline-row.is-selected .souqna-outline-row__dot {
  background: var(--bld-accent);
  border-color: var(--bld-accent);
  box-shadow: 0 0 0 4px var(--bld-accent-soft);
}
.souqna-outline-row.is-dragging .souqna-outline-row__dot {
  cursor: grabbing;
}
/* Library-drag drop indicator. The maroon insertion bar sits *above*
   the hovered row to telegraph "your block lands here, before this
   one" — the standard editor pattern. The bar sits at top:-3px so
   it spans the 2px gap between rows with room for the glow. The
   end-cap circles flag the insertion point at both ends so it reads
   as a discrete control, not just a coloured underline. */
.souqna-outline-row.is-drop-target::before {
  content: '';
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--bld-accent);
  box-shadow: 0 0 0 2px var(--bld-accent-soft), 0 0 18px var(--bld-accent-line);
  pointer-events: none;
  z-index: 3;
  animation: souqna-drop-bar 720ms ease-in-out infinite;
}
.souqna-outline-row.is-drop-target::after {
  content: '';
  position: absolute;
  top: -6px;
  left: -3px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--bld-accent);
  box-shadow: 0 0 0 2px var(--bld-accent-soft);
  pointer-events: none;
  z-index: 4;
}
.souqna-outline-row.is-drop-target .souqna-outline-row__bg {
  background: var(--bld-accent-soft);
}
@keyframes souqna-drop-bar {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
/* End-of-list insertion indicator — appears under the last row when
   the library drag isn't aimed at any specific row (canvas hover,
   empty area, etc). Mirrors the per-row bar so the founder reads
   them as the same affordance: a maroon line wherever the new
   block will land. */
.souqna-outline-end-indicator {
  position: relative;
  list-style: none;
  margin: 6px 0 0;
  padding: 8px 8px 6px 22px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.souqna-outline-end-indicator__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--bld-accent);
  box-shadow: 0 0 0 2px var(--bld-accent-soft), 0 0 18px var(--bld-accent-line);
  pointer-events: none;
  animation: souqna-drop-bar 720ms ease-in-out infinite;
}
.souqna-outline-end-indicator__bar::before {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--bld-accent);
  box-shadow: 0 0 0 2px var(--bld-accent-soft);
}
.souqna-outline-end-indicator__label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--bld-accent);
  font-weight: 600;
}
/* "Just added" pulse — runs once after a library drop so the founder's
   eye lands on the new row instead of having to hunt for it. We
   animate the bg layer (not the row itself) so the row's transform
   from useSortable is left alone. */
@keyframes souqna-just-added {
  0%   { background: var(--bld-accent-soft); box-shadow: 0 0 0 0 var(--bld-accent-line); }
  60%  { background: var(--bld-accent-softer); box-shadow: 0 0 0 8px transparent; }
  100% { background: var(--bld-accent-soft); box-shadow: 0 0 0 0 transparent; }
}
.souqna-outline-row.is-just-added .souqna-outline-row__bg {
  animation: souqna-just-added 1500ms ease-out;
}
.souqna-library-tile:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px var(--bld-panel-shadow);
}
.souqna-row-icon:hover {
  color: var(--bld-text) !important;
  border-color: var(--bld-input-border) !important;
  background: var(--bld-tile-bg) !important;
}
.souqna-row-icon-danger:hover {
  color: #E68A8A !important;
  border-color: #E68A8A55 !important;
  background: rgba(230,138,138,0.06) !important;
}
/* Inspector header circular ghost icons. Resting = colour-only glyph,
   hover = soft sand fill, active press = scale-down nudge. The danger
   variant warms to red and gains a subtle red wash on hover. */
.souqna-inspector-icon:hover {
  background: rgba(232,220,196,0.08) !important;
  color: var(--bld-text) !important;
}
.souqna-inspector-icon:active {
  transform: scale(0.92);
}
.souqna-inspector-icon:focus-visible {
  outline: 1px solid var(--bld-accent);
  outline-offset: 1px;
}
.souqna-inspector-icon--danger:hover {
  background: rgba(230,138,138,0.10) !important;
  color: #E68A8A !important;
}
@keyframes souqna-icon-warn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(230,138,138,0); }
  50%      { box-shadow: 0 0 0 4px rgba(230,138,138,0.18); }
}
.souqna-inspector-icon--danger:hover {
  animation: souqna-icon-warn 1.4s ease-in-out infinite;
}
`;

/**
 * Phase 2 builder shell.
 *
 * Three panes wrapped in a single DndContext:
 *   - Left  : Library (drag-source for new blocks) + Outline (sortable list).
 *   - Center: Sandboxed iframe pointing at /account/{slug}/preview, which
 *             renders the current `draft_blocks` via the BlockRenderer.
 *             Selection is synced via postMessage in both directions.
 *   - Right : Inspector (schema-driven form per block) + per-block style
 *             overrides + theme panel when nothing is selected.
 *
 * Drag-and-drop semantics:
 *   - Dragging a library tile onto the outline appends a new block.
 *   - Dragging an outline item over another outline item reorders.
 *
 * Saves are debounced (300ms): each edit posts the new `blocks` array to
 * `saveDraftBlocks`, which validates and writes JSONB. After a save the
 * iframe receives a `souqna:reload` postMessage so it pulls the new draft
 * without a full reload.
 */
export function BuilderShell(props: Props) {
  return (
    <BuilderCopyProvider locale={props.locale}>
      <div
        dir={direction[props.locale]}
        data-builder-locale={props.locale}
        style={{ display: 'contents' }}
      >
        <BuilderShellInner {...props} />
      </div>
    </BuilderCopyProvider>
  );
}

function BuilderShellInner({
  locale,
  slug,
  liveUrl,
  businessName,
  pages,
  activePageId,
  initialBlocks,
  publishedAt,
  isPublished,
  productOptions,
  categoryOptions,
  initialTheme,
  initialPalette,
  initialTemplate,
  initialPolicies,
  currentPlan,
  effectiveTheme,
  installedAppIds = [],
  souqyLivePublishHint = false,
}: Props) {
  const { builder: copy } = useBuilderCopy();
  const blockLabels = copy.blockLabels as Record<BlockType, string>;
  const chromeDir = direction[locale];
  const giphyStorefrontSlug = installedAppIds.includes('giphy') ? slug : undefined;
  const router = useRouter();
  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId],
  );
  const isHomePage = activePage ? activePage.isHome : true;
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [iframeKey, setIframeKey] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishPhase, setPublishPhase] = useState<PublishPhase>('idle');
  const [publishedAtState, setPublishedAtState] = useState<string | null>(publishedAt);
  const [isPublishedState, setIsPublishedState] = useState<boolean>(isPublished);
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<'pages' | 'library' | 'outline' | 'apps'>('library');
  const [showSouqyPublishHint, setShowSouqyPublishHint] = useState(souqyLivePublishHint);
  const [openAppId, setOpenAppId] = useState<string | null>(null);
  // Right rail mode: editing the selected block (default) or the
  // page-wide site theme. Selecting any block snaps back to 'block' so
  // founders never have to remember to flip back.
  const [inspectorMode, setInspectorMode] = useState<'block' | 'site'>('block');
  // Snap back to Block mode whenever something becomes selected. Lives
  // here (not at every setSelectedId call site) because there are six
  // call sites — undo/redo, duplicate, drag-drop, palette commands —
  // and forgetting one would silently leave the rail on Site.
  // Drawer toggles for tablet/phone widths. The CSS keeps the aside
  // hidden by default below lg/md respectively; flipping these flips
  // the aside's class to `souqna-drawer-open` which slides it in over
  // the canvas.
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [activeDrag, setActiveDrag] = useState<
    { kind: 'library'; type: BlockType } | { kind: 'block'; id: string; label: string } | null
  >(null);
  // Tracks what the dragged library item is currently hovering over so
  // outline rows / canvas / empty dropzone can render an insertion
  // indicator. Only updated for *library* drags — outline-to-outline
  // reorders rely on dnd-kit's built-in transform animation for
  // feedback, so we don't pollute the highlight state with those.
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Id of a block that was just inserted via drop or library click. The
  // matching outline row pulses for `JUST_ADDED_GLOW_MS` and scrolls
  // itself into view, so the founder sees *where* their new block
  // landed without hunting through the outline.
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const justAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShowSouqyPublishHint(souqyLivePublishHint);
  }, [souqyLivePublishHint, slug]);

  const dismissSouqyPublishHint = useCallback(() => {
    setShowSouqyPublishHint(false);
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    if (u.searchParams.get('generated') === '1') {
      u.searchParams.delete('generated');
      startTransition(() => router.replace(u.pathname + u.search, { scroll: false }));
    }
  }, [router, startTransition]);

  useEffect(() => {
    if (selectedId) setInspectorMode('block');
  }, [selectedId]);

  useEffect(
    () => () => {
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
      if (publishResetTimerRef.current) clearTimeout(publishResetTimerRef.current);
    },
    [],
  );

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  // Undo/redo. We push the *previous* state onto `past` whenever an edit
  // mutates `blocks`, then clear `future`. Undo pops `past` → current →
  // `future`; redo pops `future`. Capped at 60 states to bound memory.
  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const skipHistoryRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  // ------- persistence (debounced) ----------------------------------------

  const persist = useCallback(
    async (next: Block[]) => {
      setSaveState('saving');
      const cleaned = sanitizeBlocksForSave(next);
      const res = await saveDraftBlocks({
        slug,
        pageId: activePageId,
        blocks: cleaned as unknown as Parameters<typeof saveDraftBlocks>[0]['blocks'],
        theme: null,
      });
      if (res.status === 'success') {
        setSaveState('saved');
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'souqna:reload' },
          window.location.origin,
        );
      } else {
        // Log the server's reason so it's visible in the browser console even
        // when the chip can only flash a generic error state.
        console.error('[BuilderShell] save failed:', 'message' in res ? res.message : res);
        setSaveState('error');
      }
    },
    [activePageId, slug],
  );

  const queuePersist = useCallback(
    (next: Block[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(next);
      }, 300);
    },
    [persist],
  );

  // Force-flush any pending debounced save and wait for it to land. Used
  // before page-switch navigations so the founder never loses unsaved
  // edits when they jump from one page to another in the PageSwitcher.
  const flushPendingSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await persist(blocksRef.current);
    }
  }, [persist]);

  const changeBuilderLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      await flushPendingSave();
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = direction[next];
      window.location.reload();
    },
    [flushPendingSave, locale],
  );

  const update = useCallback(
    (next: Block[]) => {
      if (!skipHistoryRef.current) {
        past.current.push(blocksRef.current);
        if (past.current.length > 60) past.current.shift();
        future.current = [];
      }
      skipHistoryRef.current = false;
      setBlocks(next);
      queuePersist(next);
    },
    [queuePersist],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(blocksRef.current);
    skipHistoryRef.current = true;
    setBlocks(prev);
    queuePersist(prev);
  }, [queuePersist]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(blocksRef.current);
    skipHistoryRef.current = true;
    setBlocks(next);
    queuePersist(next);
  }, [queuePersist]);

  // ------- block ops ------------------------------------------------------

  const addBlock = useCallback(
    (type: BlockType, atIndex?: number) => {
      if (isPremiumBlockType(type) && !planUnlocksPremiumBlocks(currentPlan)) {
        router.push('/account/settings/plan?feature=premium-blocks');
        return;
      }
      const block = createBlock(type, productOptions);
      const next = [...blocks];
      const idx = typeof atIndex === 'number' ? atIndex : next.length;
      next.splice(idx, 0, block);
      update(next);
      setSelectedId(block.id);
      setTab('outline');
      // Flag the new row so it pulses + scrolls into view in the
      // outline. Replaces any in-flight glow timer so two quick adds
      // don't leave the older one stuck in the highlighted state.
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
      setJustAddedId(block.id);
      justAddedTimerRef.current = setTimeout(() => {
        setJustAddedId(null);
        justAddedTimerRef.current = null;
      }, JUST_ADDED_GLOW_MS);
    },
    [blocks, currentPlan, productOptions, router, update],
  );

  const removeBlock = useCallback(
    (id: string) => {
      const next = blocks.filter((b) => b.id !== id);
      update(next);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    },
    [blocks, selectedId, update],
  );

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const target = idx + dir;
      if (target < 0 || target >= blocks.length) return;
      const next = blocks.slice();
      const [item] = next.splice(idx, 1);
      if (!item) return;
      next.splice(target, 0, item);
      update(next);
    },
    [blocks, update],
  );

  const updateBlockProps = useCallback(
    (id: string, nextProps: Record<string, unknown>) => {
      const next = blocks.map((b) => (b.id === id ? ({ ...b, props: nextProps } as Block) : b));
      update(next);
    },
    [blocks, update],
  );

  const updateBlockStyle = useCallback(
    (id: string, nextStyle: Block['style']) => {
      const next = blocks.map((b) => (b.id === id ? ({ ...b, style: nextStyle } as Block) : b));
      update(next);
    },
    [blocks, update],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const original = blocks[idx];
      if (!original) return;
      const copy: Block = JSON.parse(JSON.stringify(original));
      copy.id = newId();
      const next = [...blocks];
      next.splice(idx + 1, 0, copy);
      update(next);
      setSelectedId(copy.id);
    },
    [blocks, update],
  );

  // ------- DnD ------------------------------------------------------------

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);
      setDropTargetId(null);
      if (id.startsWith(LIBRARY_PREFIX)) {
        setActiveDrag({ kind: 'library', type: id.slice(LIBRARY_PREFIX.length) as BlockType });
        // Surface the outline tab the moment a library drag starts so the
        // insertion indicator between rows is actually visible. dnd-kit
        // keeps the drag active via DragOverlay even though the source
        // LibraryPanel unmounts when the tab swaps — the founder grabbed
        // a tile, and now they see *where* it will land.
        setTab('outline');
        return;
      }
      const current = blocksRef.current.find((b) => b.id === id);
      if (current) {
        setActiveDrag({ kind: 'block', id, label: blockLabels[current.type] });
      }
    },
    [blockLabels],
  );

  const onDragOver = useCallback((e: DragOverEvent) => {
    const activeId = String(e.active.id);
    // Only library drags need the highlight — outline reorders use the
    // sortable transform animation for feedback.
    if (!activeId.startsWith(LIBRARY_PREFIX)) {
      if (dropTargetIdRef.current !== null) setDropTargetId(null);
      return;
    }
    const overId = e.over ? String(e.over.id) : null;
    if (dropTargetIdRef.current !== overId) setDropTargetId(overId);
  }, []);

  // Mirror dropTargetId in a ref so the onDragOver callback can read
  // the latest value without taking it as a dep (which would re-create
  // the callback on every hover frame and rebind dnd-kit listeners).
  const dropTargetIdRef = useRef<string | null>(null);
  dropTargetIdRef.current = dropTargetId;

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDrag(null);
      setDropTargetId(null);
      const activeId = String(e.active.id);
      const overId = e.over ? String(e.over.id) : null;

      // Library → Outline drop: append (or insert before the over row).
      if (activeId.startsWith(LIBRARY_PREFIX)) {
        const type = activeId.slice(LIBRARY_PREFIX.length) as BlockType;
        if (!overId || overId === OUTLINE_DROPZONE_ID || overId === CANVAS_DROPZONE_ID) {
          addBlock(type);
          return;
        }
        const idx = blocksRef.current.findIndex((b) => b.id === overId);
        addBlock(type, idx === -1 ? undefined : idx);
        return;
      }

      // Outline reorder.
      if (!overId || overId === activeId) return;
      const from = blocksRef.current.findIndex((b) => b.id === activeId);
      const to = blocksRef.current.findIndex((b) => b.id === overId);
      if (from === -1 || to === -1) return;
      const next = arrayMove(blocksRef.current, from, to);
      update(next);
    },
    [addBlock, update],
  );

  // ------- iframe selection sync ------------------------------------------

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; blockId?: string } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'souqna:select' && typeof data.blockId === 'string') {
        setSelectedId(data.blockId);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Push the current selection to the iframe when it changes.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'souqna:highlight', blockId: selectedId },
      window.location.origin,
    );
  }, [selectedId]);

  // ------- publish / discard ----------------------------------------------

  const waitForLiveStorefront = useCallback(async (): Promise<boolean> => {
    const startedAt = Date.now();
    for (let attempt = 0; attempt < PUBLISH_LIVE_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (await isPublishedStorefrontReachable({ slug, liveUrl })) return true;

      try {
        const snapshot = await pollStorefrontDomain({ slug });
        if (snapshot.status === 'live') return true;
        if (snapshot.status === 'failed') {
          console.warn('[BuilderShell] live domain check is still failing; retrying.');
        }
      } catch (err) {
        console.error('[BuilderShell] live publish check failed:', err);
      }

      // Publishing has already succeeded by the time we reach this loop:
      // the public page rows are written and revalidated. Domain/cert
      // provisioning can lag or be unavailable in local dev, so keep the
      // founder in the loading state briefly, then let the publish complete
      // instead of surfacing a false failure.
      if (Date.now() - startedAt >= PUBLISH_SOFT_READY_AFTER_MS) return true;

      await wait(PUBLISH_LIVE_POLL_INTERVAL_MS);
    }
    return false;
  }, [liveUrl, slug]);

  const handlePublish = useCallback(async () => {
    if (publishPhase === 'publishing' || publishPhase === 'checking') return;
    if (publishResetTimerRef.current) {
      clearTimeout(publishResetTimerRef.current);
      publishResetTimerRef.current = null;
    }

    setPublishPhase('publishing');
    setSaveState('saving');
    try {
      // Flush pending debounced edits first so a fast publish-after-edit
      // doesn't ship the previous draft. The publish action only reads
      // `published_blocks` from the page row (mirrored from the latest
      // `draft_blocks`); without the flush the in-memory edit could be
      // lost in the gap between the typing burst and the autosave timer.
      await flushPendingSave();
      const res = await publishStorefront({ slug, pageId: activePageId });
      if (res.status !== 'success') {
        setSaveState('error');
        setPublishPhase('error');
        publishResetTimerRef.current = setTimeout(() => {
          setPublishPhase('idle');
          publishResetTimerRef.current = null;
        }, 5000);
        return;
      }

      setPublishPhase('checking');
      const isLive = await waitForLiveStorefront();
      if (!isLive) {
        setSaveState('error');
        setPublishPhase('error');
        publishResetTimerRef.current = setTimeout(() => {
          setPublishPhase('idle');
          publishResetTimerRef.current = null;
        }, 5000);
        return;
      }

      setSaveState('saved');
      setIsPublishedState(true);
      if ('publishedAt' in res && res.publishedAt) setPublishedAtState(res.publishedAt);
      setPublishPhase('live');
      startTransition(() => router.refresh());
      publishResetTimerRef.current = setTimeout(() => {
        setPublishPhase('idle');
        publishResetTimerRef.current = null;
      }, 2500);
    } catch (err) {
      console.error('[BuilderShell] publish failed:', err);
      setSaveState('error');
      setPublishPhase('error');
      publishResetTimerRef.current = setTimeout(() => {
        setPublishPhase('idle');
        publishResetTimerRef.current = null;
      }, 5000);
    }
  }, [activePageId, flushPendingSave, publishPhase, router, slug, waitForLiveStorefront]);

  const handleDiscard = useCallback(async () => {
    if (!window.confirm(copy.publish.discardConfirm)) return;
    const res = await discardBuilderDraft({ slug });
    if (res.status === 'success' && res.blocks) {
      setBlocks(res.blocks);
      setSelectedId(res.blocks[0]?.id ?? null);
      setIframeKey((k) => k + 1);
      setSaveState('saved');
      startTransition(() => router.refresh());
    } else {
      setSaveState('error');
    }
  }, [copy.publish.discardConfirm, router, slug]);

  const handleResetTemplate = useCallback(async () => {
    if (
      !window.confirm(
        'Reset the canvas to your template defaults? This replaces every block with the template you picked at /begin and re-applies its palette and typography. Your custom edits will be lost.',
      )
    )
      return;
    setSaveState('saving');
    const res = await resetBuilderToTemplate({ slug });
    if (res.status === 'success' && res.blocks) {
      setBlocks(res.blocks);
      setSelectedId(res.blocks[0]?.id ?? null);
      setIframeKey((k) => k + 1);
      setSaveState('saved');
      startTransition(() => router.refresh());
    } else {
      setSaveState('error');
    }
  }, [router, slug]);

  // Called by `SiteInspector` after `switchBuilderTemplate` lands. The
  // server has already persisted + published the freshly seeded blocks
  // — the inspector just hands them back so we can swap the canvas
  // synchronously, drop selection on the first new block and snap the
  // right rail to the BlockInspector tab so the founder can edit
  // immediately. We also bump `iframeKey` to force a fresh preview load
  // (the new `published_blocks` are what the iframe needs to render).
  const handleTemplateConfirmed = useCallback(
    ({ blocks: nextBlocks }: { blocks: Block[] }) => {
      if (!nextBlocks.length) {
        startTransition(() => router.refresh());
        return;
      }
      // Reset history — pre-template edits don't make sense to undo
      // back into now that the canvas has been wholesale replaced.
      past.current = [];
      future.current = [];
      skipHistoryRef.current = true;
      setBlocks(nextBlocks);
      setSelectedId(nextBlocks[0]?.id ?? null);
      setInspectorMode('block');
      setIframeKey((k) => k + 1);
      setSaveState('saved');
      startTransition(() => router.refresh());
    },
    [router],
  );

  // ------- keyboard shortcuts ---------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) ||
        Boolean(target?.isContentEditable);

      // Undo/redo work everywhere except inside a focused input.
      const mod = e.metaKey || e.ctrlKey;
      if (!inField && mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (!inField && mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (inField) return;
      const id = selectedId;
      if (!id) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        removeBlock(id);
      } else if ((e.key === 'd' || e.key === 'D') && mod) {
        e.preventDefault();
        duplicateBlock(id);
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        moveBlock(id, -1);
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        moveBlock(id, 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duplicateBlock, moveBlock, redo, removeBlock, selectedId, undo]);

  const selected = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const selectedIndex = selected ? blocks.findIndex((b) => b.id === selected.id) : -1;
  const isLibraryDragging = activeDrag?.kind === 'library';

  // Souqy is paid-tier, same as the existing full-store generator. The
  // toolbar shows an upgrade affordance when this is false.
  const souqyEnabled = planUnlocksSouqy(currentPlan);

  /**
   * Bridge between the SelectionToolbar's prompt input and the server
   * action. The action returns the patched block; we splice it back
   * into local state in a SINGLE update call so props + style land
   * atomically. Calling `updateBlockProps` then `updateBlockStyle`
   * back-to-back across the `await` would race on the closed-over
   * `blocks` snapshot and clobber one of the two patches — the symptom
   * being a successful action followed by an unchanged iframe.
   *
   * Reads from `blocksRef.current` so the splice always sees the
   * latest committed state, not the snapshot captured at callback
   * creation time. Goes through `update()` so undo history + the
   * debounced persist hook fire exactly as they would for any other
   * inspector edit, and PreviewBridge picks the change up via its
   * existing block-state subscription.
   */
  const handleSouqyEdit = useCallback(
    async (request: string): Promise<SouqyEditResult> => {
      if (!selected) {
        return { ok: false, message: 'No block selected.' };
      }
      try {
        const res = await souqyEditBlock({
          slug,
          pageId: activePageId,
          blockId: selected.id,
          request,
        });
        if (res.status === 'ok') {
          const patched = res.block;
          const next = blocksRef.current.map((b) => (b.id === patched.id ? patched : b));
          update(next);
          // The server action already persisted the patched block to
          // the page row, so the public preview route will see the new
          // draft on its next render. Tell the iframe to refresh now —
          // without this, the founder waits for the debounced
          // `queuePersist` (~300ms + a redundant DB write + the
          // iframe's `router.refresh()`) before the change becomes
          // visible, which reads as "nothing happened".
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'souqna:reload' },
            window.location.origin,
          );
          return { ok: true };
        }
        return {
          ok: false,
          message: res.message,
          refused: res.status === 'refused',
        };
      } catch (err) {
        console.error('[BuilderShell] souqyEditBlock failed', err);
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Souqy edit failed.',
        };
      }
    },
    [activePageId, selected, slug, update],
  );

  // Block-jump commands surfaced in the cmd-K palette so the user can
  // navigate a long outline by name instead of scrolling. Each block
  // contributes one entry; selecting it makes the block the inspector
  // target and also scrolls the iframe to the matching anchor.
  const blockCommands = useMemo<Command[]>(
    () =>
      blocks.map((b, i) => ({
        id: `block-${b.id}`,
        group: copy.outline.aria,
        label: `${blockLabels[b.type]}${
          (b.props as { title?: string; heading?: string; overlayTitle?: string }).title
            ? ` · ${(b.props as { title?: string }).title}`
            : (b.props as { heading?: string }).heading
              ? ` · ${(b.props as { heading?: string }).heading}`
              : (b.props as { overlayTitle?: string }).overlayTitle
                ? ` · ${(b.props as { overlayTitle?: string }).overlayTitle}`
                : ''
        }`,
        hint: `#${i + 1}`,
        onSelect: () => {
          setSelectedId(b.id);
          // Best-effort scroll inside the preview iframe via existing bridge.
          const iframe = document.querySelector(
            'iframe[data-preview-frame]',
          ) as HTMLIFrameElement | null;
          iframe?.contentWindow?.postMessage({ kind: 'scrollToBlock', id: b.id }, '*');
        },
      })),
    [blockLabels, blocks, copy.outline.aria],
  );

  return (
    <DndContext
      sensors={sensors}
      // closestCenter picks the row whose vertical centre is nearest
      // the cursor, so dragging into the gap between two rows resolves
      // to the row immediately *below* the gap (which we then insert
      // *before*) instead of the wrapping list. Without this the
      // <ul> rect won every middle hover and every drop landed at
      // either the top or the end.
      collisionDetection={closestCenter}
      // Re-measure droppables on every drag frame. Required because
      // the outline panel mounts its rows mid-drag (we auto-switch
      // tabs on library drag start), so they don't exist when dnd-kit
      // would normally measure with the BeforeDragging default.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <style dangerouslySetInnerHTML={{ __html: SOUQNA_KEYFRAMES }} />
      <div
        data-builder-theme={effectiveTheme}
        className="grid souqna-builder-shell"
        style={{
          height: '100dvh',
          // Three rows: portrait-only orientation hint, topbar, workspace.
          // The hint row collapses to 0 on landscape/desktop because the
          // component renders display:none outside its media-query window,
          // so on those breakpoints the layout reads as the original 2-row
          // grid (the empty `auto` track contributes no height).
          gridTemplateRows: 'auto auto auto 1fr',
          background:
            'linear-gradient(var(--bld-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--bld-grid-line) 1px, transparent 1px), var(--bld-canvas)',
          backgroundSize: '44px 44px',
          color: 'var(--bld-text)',
        }}
      >
        <BuilderOrientationHint />
        {showSouqyPublishHint ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-start"
            style={{
              borderColor: 'var(--bld-divider)',
              background: 'var(--bld-surface-strong)',
              color: 'var(--bld-text)',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <span className="min-w-0 flex-1">{copy.souqyLiveHint.message}</span>
            <Link
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full px-4 py-2 text-sm font-medium no-underline transition hover:opacity-90"
              style={{ background: 'var(--bld-accent)', color: 'var(--bld-accent-ink)' }}
            >
              {copy.souqyLiveHint.openLive}
            </Link>
            <button
              type="button"
              onClick={dismissSouqyPublishHint}
              className="shrink-0 cursor-pointer rounded-full border-none bg-transparent px-3 py-1.5 text-sm font-medium underline decoration-dotted"
              style={{ color: 'var(--bld-text-muted)' }}
            >
              {copy.souqyLiveHint.dismiss}
            </button>
          </div>
        ) : null}
        <BuilderTopBar
          locale={locale}
          slug={slug}
          businessName={businessName}
          liveUrl={liveUrl}
          device={device}
          onDeviceChange={setDevice}
          saveState={saveState}
          publishPhase={publishPhase}
          publishedAt={publishedAtState}
          isPublished={isPublishedState}
          onUndo={undo}
          onRedo={redo}
          onDiscard={handleDiscard}
          onPublish={handlePublish}
          onResetTemplate={handleResetTemplate}
          onBeforeLocaleChange={flushPendingSave}
          onToggleLeftPanel={() => setLeftDrawerOpen((v) => !v)}
          onToggleRightPanel={() => setRightDrawerOpen((v) => !v)}
          onOpenNavMenu={() => setNavMenuOpen(true)}
        />

        <BuilderNavSheet
          open={navMenuOpen}
          onClose={() => setNavMenuOpen(false)}
          slug={slug}
          businessName={businessName}
          liveUrl={liveUrl}
          onDiscard={handleDiscard}
          onResetTemplate={handleResetTemplate}
        />

        <div
          className="grid souqna-builder-grid"
          style={{
            minHeight: 0,
            position: 'relative',
            gap: 12,
            padding: '12px 12px 14px',
            direction: 'ltr',
          }}
        >
          {leftDrawerOpen || rightDrawerOpen ? (
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => {
                setLeftDrawerOpen(false);
                setRightDrawerOpen(false);
              }}
              className="souqna-builder-drawer-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 65,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'none',
              }}
            />
          ) : null}
          <aside
            className={`souqna-builder-aside-left${leftDrawerOpen ? ' souqna-drawer-open' : ''}`}
            style={{
              border: '1px solid var(--bld-divider)',
              background: 'color-mix(in srgb, var(--bld-surface) 88%, transparent)',
              borderRadius: 18,
              boxShadow: '0 18px 60px var(--bld-panel-shadow)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              direction: chromeDir,
            }}
          >
            <div
              className="souqna-builder-mobile-drawer-tools"
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 10px 0',
              }}
            >
              <button
                type="button"
                aria-label={copy.topbar.openNavigation}
                title={copy.topbar.navigate}
                onClick={() => {
                  setLeftDrawerOpen(false);
                  setNavMenuOpen(true);
                }}
                style={{
                  minHeight: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--bld-tile-bg)',
                  color: 'var(--bld-text)',
                  border: '1px solid var(--bld-input-border)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
                  <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
                  <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
                  <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
                </svg>
                {copy.topbar.navigate}
              </button>
              <LocaleToggle locale={locale} onChange={changeBuilderLocale} />
            </div>
            <nav
              className="flex"
              style={{
                gap: 6,
                padding: 8,
                borderBottom: '1px solid var(--bld-divider)',
              }}
            >
              {(['pages', 'library', 'outline', 'apps'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  data-tour={`${t}-tab`}
                  style={{
                    flex: 1,
                    padding: '9px 8px',
                    background: tab === t ? 'var(--bld-chip-bg-active)' : 'transparent',
                    border: 'none',
                    color: tab === t ? 'var(--bld-text)' : 'var(--bld-text-muted)',
                    boxShadow: tab === t ? 'inset 0 0 0 1px var(--bld-input-border)' : undefined,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: 999,
                    transition: 'background 160ms ease, color 160ms ease',
                  }}
                >
                  {copy.rail[t]}
                </button>
              ))}
            </nav>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
              {tab === 'pages' ? (
                <PageSwitcher
                  slug={slug}
                  pages={pages}
                  activePageId={activePageId}
                  onBeforeSwitch={flushPendingSave}
                  giphyStorefrontSlug={giphyStorefrontSlug}
                />
              ) : tab === 'library' ? (
                <LibraryPanel
                  groups={LIBRARY_GROUPS}
                  onAdd={(t) => addBlock(t)}
                  currentPlan={currentPlan}
                />
              ) : tab === 'apps' ? (
                <AppsPanel
                  installedAppIds={installedAppIds}
                  storeSlug={slug}
                  onOpen={(id) => setOpenAppId(id)}
                />
              ) : (
                <OutlinePanel
                  blocks={blocks}
                  blockLabels={blockLabels}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMove={moveBlock}
                  onDelete={removeBlock}
                  onDuplicate={duplicateBlock}
                  dropTargetId={dropTargetId}
                  justAddedId={justAddedId}
                  isLibraryDragging={isLibraryDragging}
                />
              )}
            </div>
          </aside>

          <main
            style={{
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              position: 'relative',
              direction: chromeDir,
            }}
          >
            <div
              className="souqna-canvas-status"
              style={{
                padding: '10px 14px',
                border: '1px solid var(--bld-divider)',
                borderRadius: 16,
                background: 'color-mix(in srgb, var(--bld-surface) 80%, transparent)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--bld-text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: saveState === 'error' ? '#E68A8A' : 'var(--bld-accent)',
                    animation:
                      saveState === 'saving' ? 'souqna-pulse 1.1s ease-in-out infinite' : undefined,
                    display: 'inline-block',
                  }}
                />
                {activePage
                  ? `${copy.canvas.editing} · ${activePage.title}${
                      activePage.isHome ? ` (${copy.canvas.home})` : ''
                    }`
                  : copy.publish.livePreviewDraft}
              </span>
              <span>
                {device === 'desktop'
                  ? `— ${copy.canvas.responsive}`
                  : `${DEVICE_WIDTHS[device]} ${copy.canvas.frame}`}
              </span>
            </div>
            {activePage && !isHomePage ? (
              <PageCanvasHeader
                slug={slug}
                page={activePage}
                onlyPage={pages.length === 1}
                onSetHome={async () => {
                  await flushPendingSave();
                  const res = await setStorefrontHomePage({
                    slug,
                    pageId: activePage.id,
                  });
                  if (res.status === 'success' || res.status === 'success-noop') {
                    startTransition(() => router.refresh());
                  }
                }}
                giphyStorefrontSlug={giphyStorefrontSlug}
              />
            ) : null}
            <CanvasDropZone isLibraryDragging={isLibraryDragging}>
              <div
                className="souqna-device-stage"
                style={{
                  position: 'relative',
                  width: '100%',
                  minWidth: device === 'desktop' ? 0 : DEVICE_WIDTHS[device],
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  transition: 'width 200ms ease',
                }}
              >
                <div
                  className="souqna-device-frame"
                  style={{
                    position: 'relative',
                    width: device === 'desktop' ? '100%' : DEVICE_WIDTHS[device],
                    maxWidth: device === 'desktop' ? '100%' : 'none',
                    flex: device === 'desktop' ? '1 1 auto' : '0 0 auto',
                    display: 'flex',
                    direction: 'ltr',
                  }}
                >
                  {selected ? (
                    // Outer frame ring (was an inset 1px shadow that
                    // got clipped by the iframe). Sits *outside* the device
                    // frame so it reads at any zoom level on phones.
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: -3,
                        pointerEvents: 'none',
                        border: '2px solid var(--bld-accent-strong)',
                        borderRadius: 18,
                        transition: 'opacity 200ms ease',
                        zIndex: 1,
                      }}
                    />
                  ) : null}
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={
                      activePage && !activePage.isHome
                        ? `/account/${slug}/preview?page=${encodeURIComponent(activePage.slug)}`
                        : `/account/${slug}/preview`
                    }
                    title="storefront preview"
                    data-preview-frame
                    className="souqna-builder-iframe"
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      height: '100%',
                      minHeight: 'calc(100dvh - 160px)',
                      border: '1px solid var(--bld-iframe-border)',
                      borderRadius: 16,
                      background: '#fff',
                      boxShadow: '0 22px 70px var(--bld-panel-shadow)',
                      // Iframes swallow pointer events from the parent
                      // document, which would defeat the canvas drop
                      // target. While dragging from the library we let
                      // the events fall through to the dropzone wrapper
                      // so dnd-kit's pointer sensor can register the
                      // hover and we can fire the "drop here" overlay.
                      pointerEvents: isLibraryDragging ? 'none' : undefined,
                    }}
                  />
                </div>
              </div>

              {selected ? (
                <div
                  className="souqna-selection-toolbar-wrap"
                  data-tour="selection-toolbar"
                  style={{
                    position: 'sticky',
                    bottom: 16,
                    alignSelf: 'center',
                    marginTop: 16,
                    pointerEvents: 'auto',
                    zIndex: 5,
                  }}
                >
                  <SelectionToolbar
                    blockLabel={blockLabels[selected.type]}
                    blockIndex={selectedIndex >= 0 ? selectedIndex + 1 : 1}
                    canMoveUp={selectedIndex > 0}
                    canMoveDown={selectedIndex >= 0 && selectedIndex < blocks.length - 1}
                    onMoveUp={() => moveBlock(selected.id, -1)}
                    onMoveDown={() => moveBlock(selected.id, 1)}
                    onDuplicate={() => duplicateBlock(selected.id)}
                    onEdit={() => setRightDrawerOpen(true)}
                    onDelete={() => removeBlock(selected.id)}
                    souqyEnabled={souqyEnabled}
                    souqyUpgradeHref="/account/settings/plan?feature=souqy&from=builder"
                    onSouqyEdit={handleSouqyEdit}
                  />
                </div>
              ) : null}
            </CanvasDropZone>
          </main>

          <aside
            className={`souqna-builder-aside-right${rightDrawerOpen ? ' souqna-drawer-open' : ''}`}
            style={{
              border: '1px solid var(--bld-divider)',
              background: 'color-mix(in srgb, var(--bld-surface) 88%, transparent)',
              borderRadius: 18,
              boxShadow: '0 18px 60px var(--bld-panel-shadow)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              overflow: 'auto',
              padding: '16px',
              minHeight: 0,
              flexDirection: 'column',
              gap: 14,
              direction: chromeDir,
            }}
          >
            <InspectorModeToggle
              value={inspectorMode}
              onChange={(v) => {
                setInspectorMode(v);
                if (v === 'site') setSelectedId(null);
              }}
            />
            <BuilderRecommendations
              blocks={blocks}
              selected={selected}
              currentPlan={currentPlan}
              templateId={initialTemplate}
              productCount={productOptions.length}
              onApplyVariant={(variant) => {
                if (!selected) return;
                updateBlockStyle(selected.id, { ...(selected.style ?? {}), variant });
              }}
              onAddBlock={(type) => addBlock(type)}
              onOpenSite={() => {
                setInspectorMode('site');
                setSelectedId(null);
              }}
              onPremiumRefresh={handleResetTemplate}
            />
            {inspectorMode === 'block' ? (
              <BlockInspector
                block={selected}
                onChange={(p) => selected && updateBlockProps(selected.id, p)}
                onChangeStyle={(s) => selected && updateBlockStyle(selected.id, s)}
                onMoveUp={() => selected && moveBlock(selected.id, -1)}
                onMoveDown={() => selected && moveBlock(selected.id, 1)}
                onDuplicate={() => selected && duplicateBlock(selected.id)}
                onDelete={() => selected && removeBlock(selected.id)}
                productOptions={productOptions}
                categoryOptions={categoryOptions}
                storefrontSlug={slug}
                blockOutline={blocks.map((b, index) => ({
                  id: b.id,
                  index,
                  label: blockLabels[b.type],
                }))}
                giphyStorefrontSlug={giphyStorefrontSlug}
                currentPlan={currentPlan}
              />
            ) : (
              <SiteInspector
                slug={slug}
                initialTheme={initialTheme}
                initialPalette={initialPalette}
                initialTemplate={initialTemplate}
                currentPlan={currentPlan}
                activePageId={activePageId}
                businessName={businessName}
                locale={locale}
                initialPolicies={initialPolicies}
                onSiteSaved={() => {
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'souqna:reload' },
                    window.location.origin,
                  );
                }}
                onTemplateConfirmed={handleTemplateConfirmed}
              />
            )}
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag?.kind === 'library' ? (
          <div style={dragGhostStyle()}>
            <BlockMiniPreview type={activeDrag.type} size="drag" />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--bld-text-muted)',
                paddingTop: 2,
              }}
            >
              {blockLabels[activeDrag.type]}
            </span>
          </div>
        ) : activeDrag?.kind === 'block' ? (
          <div
            style={{
              ...dragGhostStyle(),
              flexDirection: 'row',
              alignItems: 'center',
              padding: '8px 14px',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--bld-accent)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{activeDrag.label}</span>
          </div>
        ) : null}
      </DragOverlay>

      <OnboardingTour />
      <CommandPalette slug={slug} extraCommands={blockCommands} />
      {openAppId ? (
        <AppSettingsModal appId={openAppId} storeSlug={slug} onClose={() => setOpenAppId(null)} />
      ) : null}
    </DndContext>
  );
}

function SaveStateChip({
  state,
  publishedAt,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  publishedAt: string | null;
}) {
  // Format the timestamp only after mount — `toLocaleString()` resolves to
  // the user's locale on the client but to the server's locale during SSR,
  // which guarantees a hydration mismatch on the published label.
  const [publishedLabel, setPublishedLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!publishedAt) {
      setPublishedLabel(null);
      return;
    }
    setPublishedLabel(new Date(publishedAt).toLocaleString());
  }, [publishedAt]);

  const { builder: copy } = useBuilderCopy();
  const label =
    state === 'saving'
      ? copy.publish.saving
      : state === 'error'
        ? copy.publish.saveFailed
        : state === 'saved'
          ? copy.publish.saved
          : publishedAt
            ? publishedLabel
              ? `${copy.publish.published} · ${publishedLabel}`
              : copy.publish.published
            : copy.publish.draft;
  // Repainted per Stage 1 spec: sand pulse while saving, flat sand when
  // idle/saved, maroon only on error so the eye doesn't get pulled there
  // every time the autosave kicks in.
  const color =
    state === 'error'
      ? '#E68A8A'
      : state === 'saving'
        ? 'var(--bld-text)'
        : 'var(--bld-text-muted)';
  const dotColor =
    state === 'error'
      ? '#E68A8A'
      : state === 'saving' || state === 'saved'
        ? 'var(--bld-text)'
        : 'var(--bld-text-faint)';
  // Re-run ripple animation on each transition into "saved" by remounting.
  const rippleKey = state === 'saved' ? 'saved' : state === 'error' ? 'error' : 'idle';
  return (
    <span
      key={rippleKey}
      className={state === 'error' ? 'souqna-shake' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        position: 'relative',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 7,
          height: 7,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            animation: state === 'saving' ? 'souqna-pulse 1.1s ease-in-out infinite' : undefined,
            display: 'inline-block',
          }}
        />
        {state === 'saved' ? (
          <span
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius: '50%',
              border: '1px solid var(--bld-accent-line)',
              animation: 'souqna-ripple 700ms ease-out 1',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </span>
      <span>{label}</span>
    </span>
  );
}

function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  const { builder: copy } = useBuilderCopy();
  const order: Device[] = ['desktop', 'tablet', 'mobile'];
  const idx = order.indexOf(device);
  return (
    <div
      role="tablist"
      aria-label={copy.topbar.device.label}
      dir="ltr"
      style={{
        position: 'relative',
        display: 'inline-flex',
        border: '1px solid var(--bld-divider)',
        borderRadius: 999,
        padding: 2,
        background: 'var(--bld-tile-bg)',
        gap: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          bottom: 2,
          left: 2,
          width: 'calc((100% - 4px) / 3)',
          borderRadius: 999,
          background: 'var(--bld-chip-bg-active)',
          transform: `translateX(${idx * 100}%)`,
          transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0.32, 1)',
        }}
      />
      {order.map((d) => {
        const active = device === d;
        const widthLabel =
          d === 'desktop'
            ? copy.topbar.device.desktop
            : d === 'tablet'
              ? copy.topbar.device.tablet
              : copy.topbar.device.mobile;
        return (
          <button
            key={d}
            role="tab"
            aria-selected={active}
            aria-label={widthLabel}
            title={widthLabel}
            onClick={() => onChange(d)}
            style={{
              position: 'relative',
              width: 36,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 999,
              background: 'transparent',
              color: active ? 'var(--bld-accent-ink)' : 'var(--bld-text-muted)',
              cursor: 'pointer',
              transition: 'color 180ms',
              padding: 0,
            }}
          >
            <DeviceGlyph device={d} />
          </button>
        );
      })}
    </div>
  );
}

function DeviceGlyph({ device }: { device: Device }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (device === 'desktop') {
    return (
      <svg {...common}>
        <rect x="2.5" y="4" width="19" height="13" rx="2" />
        <path d="M9 21h6M12 17v4" />
      </svg>
    );
  }
  if (device === 'tablet') {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

/**
 * Stage 1 compact top bar (Option C).
 *
 * Layout (left → right):
 *   • Account ←
 *   • Glyph + business name
 *   • Icon device toggle + width readout
 *   • Save chip · undo / redo · Publish · overflow (⋯) · avatar
 *
 * The overflow menu absorbs the lower-frequency actions (View live,
 * Discard, Theme, Products, Plugins, Theme toggle) so the bar stays
 * dense even at narrow widths.
 */
function BuilderTopBar({
  locale,
  slug,
  businessName,
  liveUrl,
  device,
  onDeviceChange,
  saveState,
  publishPhase,
  publishedAt,
  isPublished,
  onUndo,
  onRedo,
  onDiscard,
  onPublish,
  onResetTemplate,
  onBeforeLocaleChange,
  onToggleLeftPanel,
  onToggleRightPanel,
  onOpenNavMenu,
}: {
  locale: Locale;
  slug: string;
  businessName: string;
  liveUrl: string;
  device: Device;
  onDeviceChange: (d: Device) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  publishPhase: PublishPhase;
  publishedAt: string | null;
  isPublished: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onResetTemplate: () => void;
  onBeforeLocaleChange: () => Promise<void> | void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onOpenNavMenu: () => void;
}) {
  const { builder: copy } = useBuilderCopy();
  const widthReadout =
    device === 'desktop'
      ? copy.topbar.device.responsive
      : device === 'tablet'
        ? '820 px'
        : '390 px';
  const publishBusy = publishPhase === 'publishing' || publishPhase === 'checking';
  const publishLabel =
    publishPhase === 'publishing'
      ? copy.topbar.publishing
      : publishPhase === 'checking'
        ? copy.topbar.checkingLive
        : publishPhase === 'live'
          ? copy.topbar.live
          : publishPhase === 'error'
            ? copy.topbar.liveFailed
            : copy.topbar.publish;
  const onLocaleChange = useCallback(
    async (next: Locale) => {
      if (next === locale || typeof window === 'undefined') return;
      await onBeforeLocaleChange();
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = direction[next];
      window.location.reload();
    },
    [locale, onBeforeLocaleChange],
  );
  return (
    <header
      className="flex items-center justify-between gap-3 souqna-builder-topbar"
      style={{
        height: 52,
        paddingInline: 14,
        borderBottom: '1px solid var(--bld-divider)',
        background: 'color-mix(in srgb, var(--bld-surface) 90%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 1px 0 var(--bld-divider), 0 20px 80px var(--bld-panel-shadow)',
        position: 'relative',
        zIndex: 80,
        flexWrap: 'nowrap',
        minWidth: 0,
        color: 'var(--bld-text)',
      }}
    >
      <div className="flex items-center gap-3" style={{ minWidth: 0, flex: '1 1 auto' }}>
        <button
          type="button"
          aria-label={copy.topbar.toggleLibrary}
          title={copy.topbar.toggleLibrary}
          onClick={onToggleLeftPanel}
          className="souqna-builder-toggle-left"
          style={{
            display: 'none',
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bld-tile-bg)',
            color: 'var(--bld-text)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 999,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </button>
        <Link
          href="/account"
          aria-label={copy.topbar.backToAccount}
          title={copy.topbar.account}
          className="souqna-bar-account"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            background: 'var(--bld-tile-bg)',
            color: 'var(--bld-text-muted)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 999,
            textDecoration: 'none',
            flex: '0 0 auto',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <button
          type="button"
          aria-label={copy.topbar.openNavigation}
          title={copy.topbar.navigate}
          onClick={onOpenNavMenu}
          className="souqna-bar-nav"
          style={{
            display: 'none',
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bld-tile-bg)',
            color: 'var(--bld-text)',
            border: '1px solid var(--bld-input-border)',
            borderRadius: 999,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
          </svg>
        </button>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            aria-hidden
            className="souqna-bar-glyph"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--bld-accent)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            ◈
          </span>
          <span
            className="souqna-bar-business-name"
            style={{
              fontFamily: 'var(--font-serif), serif',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.1,
              color: 'var(--bld-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 220,
            }}
            title={businessName}
          >
            {businessName}
          </span>
        </div>
        <span
          aria-hidden
          className="souqna-bar-separator"
          style={{
            width: 1,
            height: 22,
            background: 'var(--bld-divider)',
            flex: '0 0 auto',
          }}
        />
        <span
          className="souqna-bar-locale-toggle"
          style={{ display: 'inline-flex', flex: '0 0 auto' }}
        >
          <LocaleToggle locale={locale} onChange={onLocaleChange} />
        </span>
        <span
          className="souqna-bar-device-toggle"
          data-tour="device-toggle"
          style={{ display: 'inline-flex' }}
        >
          <DeviceToggle device={device} onChange={onDeviceChange} />
        </span>
        <span
          className="souqna-bar-width-readout"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--bld-text-faint)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {widthReadout}
        </span>
      </div>

      <div className="flex items-center gap-2" style={{ flex: '0 0 auto' }}>
        <span
          className="souqna-bar-save-chip"
          data-tour="save-chip"
          style={{ display: 'inline-flex' }}
        >
          <SaveStateChip state={saveState} publishedAt={publishedAt} />
        </span>
        {!isPublished && publishPhase === 'idle' ? <PublishNeededChip /> : null}
        <button
          type="button"
          aria-label={copy.topbar.replayTour}
          title={copy.topbar.replayTour}
          className="souqna-bar-replay"
          data-tour="replay"
          onClick={() => {
            try {
              window.localStorage.removeItem('souqna:builder:tour-seen');
            } catch {
              // best-effort
            }
            window.dispatchEvent(new CustomEvent('souqna:tour:replay'));
          }}
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bld-tile-bg)',
            color: 'var(--bld-text-muted)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1,
            flex: '0 0 auto',
          }}
        >
          ?
        </button>
        <span
          aria-hidden
          className="souqna-bar-cmdk"
          data-tour="cmdk-hint"
          title={copy.topbar.commandPalette}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            border: '1px solid var(--bld-divider)',
            borderRadius: 999,
            background: 'var(--bld-tile-bg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            letterSpacing: '0.12em',
            color: 'var(--bld-text-faint)',
            textTransform: 'uppercase',
            flex: '0 0 auto',
          }}
        >
          ⌘K
        </span>
        <span
          aria-hidden
          className="souqna-bar-separator"
          style={{ width: 1, height: 22, background: 'var(--bld-divider)' }}
        />
        <span className="souqna-bar-undo" style={{ display: 'inline-flex' }}>
          <IconButton title={copy.topbar.undo} onClick={onUndo}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 14l-4-4 4-4" />
              <path d="M5 10h9a5 5 0 0 1 0 10h-2" />
            </svg>
          </IconButton>
        </span>
        <span className="souqna-bar-redo" style={{ display: 'inline-flex' }}>
          <IconButton title={copy.topbar.redo} onClick={onRedo}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 14l4-4-4-4" />
              <path d="M19 10h-9a5 5 0 0 0 0 10h2" />
            </svg>
          </IconButton>
        </span>
        <button
          type="button"
          className="souqna-bar-publish"
          data-tour="publish"
          onClick={onPublish}
          disabled={publishBusy}
          aria-busy={publishBusy}
          style={primaryBtnStyle(publishBusy)}
        >
          {publishBusy ? <PublishSpinner /> : null}
          {publishLabel}{' '}
          <span
            className="souqna-bar-publish-glyph"
            aria-hidden
            style={{ display: publishBusy ? 'none' : undefined }}
          >
            ◈
          </span>
        </button>
        <button
          type="button"
          aria-label={copy.topbar.toggleInspector}
          title={copy.topbar.toggleInspector}
          onClick={onToggleRightPanel}
          className="souqna-builder-toggle-right"
          style={{
            display: 'none',
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bld-tile-bg)',
            color: 'var(--bld-text)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 999,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M14 5v14" />
          </svg>
        </button>
        <span className="souqna-bar-overflow" style={{ display: 'inline-flex' }}>
          <OverflowMenu
            items={[
              {
                label: copy.topbar.viewLive,
                onSelect: () => window.open(liveUrl, '_blank', 'noreferrer'),
              },
              {
                label: copy.topbar.products,
                onSelect: () =>
                  (window.location.href = `/account?tab=products&store=${encodeURIComponent(slug)}`),
              },
              {
                label: copy.topbar.storefrontProfile,
                onSelect: () =>
                  (window.location.href = `/account?tab=overview&store=${encodeURIComponent(slug)}`),
              },
              { divider: true },
              { label: copy.topbar.resetTemplate, onSelect: onResetTemplate, danger: true },
              { label: copy.topbar.discardDraft, onSelect: onDiscard, danger: true },
            ]}
          />
        </span>
        <span className="souqna-bar-userbutton" style={{ display: 'inline-flex' }}>
          <UserButton afterSignOutUrl="/" />
        </span>
      </div>
    </header>
  );
}

function LocaleToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => Promise<void> | void;
}) {
  const { builder: copy } = useBuilderCopy();
  return (
    <div
      role="group"
      aria-label={copy.topbar.language}
      dir="ltr"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        border: '1px solid var(--bld-divider)',
        borderRadius: 999,
        background: 'var(--bld-tile-bg)',
      }}
    >
      {(['en', 'ar'] as const).map((next) => {
        const active = locale === next;
        return (
          <button
            key={next}
            type="button"
            aria-pressed={active}
            onClick={() => {
              void onChange(next);
            }}
            style={{
              minWidth: 34,
              height: 26,
              padding: '0 9px',
              border: 'none',
              borderRadius: 999,
              background: active ? 'var(--bld-accent)' : 'transparent',
              color: active ? 'var(--bld-accent-ink)' : 'var(--bld-text-muted)',
              cursor: active ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              lineHeight: 1,
              transition: 'background 160ms ease, color 160ms ease',
            }}
          >
            {next.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function PublishSpinner() {
  return (
    <span
      aria-hidden
      className="souqna-publish-spinner"
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        border: '2px solid color-mix(in srgb, currentColor 30%, transparent)',
        borderTopColor: 'currentColor',
        flex: '0 0 auto',
      }}
    />
  );
}

function PublishNeededChip() {
  const { builder: copy } = useBuilderCopy();
  return (
    <span
      role="status"
      className="souqna-bar-publish-needed"
      aria-label={copy.topbar.needsPublish}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minHeight: 28,
        padding: '5px 10px',
        borderRadius: 999,
        border: '1px solid var(--bld-accent-line)',
        background: 'var(--bld-accent-soft)',
        boxShadow:
          'inset 0 1px 0 color-mix(in srgb, var(--bld-accent) 18%, transparent), 0 10px 30px var(--bld-panel-shadow)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: 'var(--bld-text)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: 'var(--bld-chip-bg-active)',
          boxShadow: '0 0 0 3px var(--bld-accent-soft)',
        }}
      />
      {copy.topbar.needsPublish}
    </span>
  );
}

/**
 * Mobile-first navigation drawer for the builder. The desktop toolbar
 * exposes back-to-account, the OverflowMenu (⋯), and the Clerk user
 * button — all of which we hide below 768px to fit the bar on a phone.
 * This sheet replaces them with a single, obvious entry point so the
 * founder can always reach Account, the dashboard sub-pages, the live
 * site, and sign-out from inside the builder on mobile.
 */
function BuilderNavSheet({
  open,
  onClose,
  slug,
  businessName,
  liveUrl,
  onDiscard,
  onResetTemplate,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  businessName: string;
  liveUrl: string;
  onDiscard: () => void;
  onResetTemplate: () => void;
}) {
  const { builder: copy } = useBuilderCopy();
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sections: Array<
    | { kind: 'link'; label: string; href: string; description?: string; external?: boolean }
    | {
        kind: 'action';
        label: string;
        onSelect: () => void;
        description?: string;
        danger?: boolean;
      }
    | { kind: 'divider' }
  > = [
    {
      kind: 'link',
      label: copy.nav.builder,
      href: `/account/builder?store=${encodeURIComponent(slug)}`,
      description: copy.nav.builderDesc,
    },
    {
      kind: 'link',
      label: copy.nav.products,
      href: `/account?tab=products&store=${encodeURIComponent(slug)}`,
      description: copy.nav.productsDesc,
    },
    {
      kind: 'link',
      label: copy.nav.profile,
      href: `/account?tab=overview&store=${encodeURIComponent(slug)}`,
      description: copy.nav.profileDesc,
    },
    { kind: 'divider' },
    {
      kind: 'link',
      label: copy.nav.live,
      href: liveUrl,
      description: copy.nav.liveDesc,
      external: true,
    },
    {
      kind: 'link',
      label: copy.nav.allStores,
      href: '/account',
      description: copy.nav.allStoresDesc,
    },
    { kind: 'divider' },
    {
      kind: 'action',
      label: copy.nav.reset,
      description: copy.nav.resetDesc,
      danger: true,
      onSelect: () => {
        onClose();
        onResetTemplate();
      },
    },
    {
      kind: 'action',
      label: copy.nav.discard,
      onSelect: () => {
        onClose();
        onDiscard();
      },
      description: copy.nav.discardDesc,
      danger: true,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={copy.nav.aria}
      className="souqna-builder-nav-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          width: 'min(86vw, 360px)',
          height: '100%',
          background: 'var(--bld-surface-strong)',
          borderRight: '1px solid var(--bld-divider)',
          boxShadow: '0 0 60px var(--bld-panel-shadow)',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--bld-text)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid var(--bld-divider)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                color: 'var(--bld-accent)',
                textTransform: 'uppercase',
              }}
            >
              {copy.nav.brand}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif), serif',
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 1.2,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={businessName}
            >
              {businessName}
            </div>
          </div>
          <button
            type="button"
            aria-label={copy.nav.close}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--bld-input-border)',
              borderRadius: 8,
              color: 'var(--bld-text)',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <nav
          aria-label={copy.outline.aria}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {sections.map((s, i) => {
            if (s.kind === 'divider') {
              return (
                <div
                  key={`divider-${i}`}
                  role="separator"
                  style={{
                    height: 1,
                    background: 'var(--bld-chip-bg-active)',
                    margin: '8px 8px',
                  }}
                />
              );
            }
            const inner = (
              <>
                <span
                  style={{
                    display: 'block',
                    fontSize: 15,
                    fontWeight: 500,
                    color: s.kind === 'action' && s.danger ? '#E68A8A' : 'var(--bld-text)',
                  }}
                >
                  {s.label}
                </span>
                {s.description ? (
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--bld-text-faint)',
                      letterSpacing: '0.02em',
                      marginTop: 2,
                    }}
                  >
                    {s.description}
                  </span>
                ) : null}
              </>
            );
            const tileStyle: React.CSSProperties = {
              display: 'block',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid transparent',
              background: 'transparent',
              textAlign: 'left',
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
              width: '100%',
              transition: 'background 140ms ease, border-color 140ms ease',
            };
            if (s.kind === 'link') {
              return (
                <Link
                  key={s.label}
                  href={s.href}
                  prefetch={false}
                  onClick={onClose}
                  target={s.external ? '_blank' : undefined}
                  rel={s.external ? 'noreferrer' : undefined}
                  style={tileStyle}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button key={s.label} type="button" onClick={s.onSelect} style={tileStyle}>
                {inner}
              </button>
            );
          })}
        </nav>

        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--bld-divider)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--bld-text-faint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Account
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bld-tile-bg)',
        color: 'var(--bld-text)',
        border: '1px solid var(--bld-divider)',
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'color 160ms ease, border-color 160ms ease, background 160ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--bld-text)';
        e.currentTarget.style.borderColor = 'var(--bld-input-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--bld-text)';
        e.currentTarget.style.borderColor = 'var(--bld-divider)';
      }}
    >
      {children}
    </button>
  );
}

type OverflowItem =
  | { label: string; onSelect: () => void; danger?: boolean; divider?: never }
  | { divider: true; label?: never; onSelect?: never; danger?: never };

function OverflowMenu({ items }: { items: OverflowItem[] }) {
  const { builder: copy, dir } = useBuilderCopy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton title={copy.topbar.moreActions} onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </IconButton>
      {open ? (
        <div
          role="menu"
          dir={dir}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(dir === 'rtl' ? { left: 0 } : { right: 0 }),
            minWidth: 220,
            maxWidth: 'calc(100vw - 16px)',
            background: 'var(--bld-surface-strong)',
            border: '1px solid var(--bld-divider)',
            borderRadius: 12,
            boxShadow: '0 18px 48px var(--bld-panel-shadow)',
            padding: 4,
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {items.map((it, i) =>
            it.divider ? (
              <div
                key={`divider-${i}`}
                role="separator"
                style={{
                  height: 1,
                  // Hardcoded sand-on-dark divider: the menu chrome is
                  // always dark (independent of the builder's effective
                  // theme), so binding the divider to --bld-chip-bg-active
                  // — which collapses to near-black in light mode —
                  // makes it disappear. Lock it to a low-alpha sand.
                  background: 'var(--bld-divider)',
                  margin: '4px 6px',
                }}
              />
            ) : (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  // The dropdown surface is always dark (#1f1c19), so the
                  // text colour must NOT track --bld-text — that variable
                  // resolves to a near-black in the builder's light theme
                  // and renders invisible against the dark menu (the user
                  // hit this exact bug on 2026-04-30). Hardcode a
                  // sand-on-dark pair so the menu reads clearly in both
                  // builder themes; danger items keep their muted-red.
                  color: it.danger ? '#E68A8A' : 'rgba(232,220,196,0.92)',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  lineHeight: 1.35,
                  textAlign: dir === 'rtl' ? 'right' : 'left',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  cursor: 'pointer',
                  transition: 'background 140ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = it.danger
                    ? 'rgba(230,138,138,0.10)'
                    : 'rgba(232,220,196,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wraps the iframe + selection-toolbar area so dnd-kit can recognise the
 * canvas itself as a drop target. Dropping anywhere on the canvas
 * appends to the end of the page — matching the founder's intuition
 * that the preview *is* the page. While a library item is over us we
 * render a dashed maroon scrim and a "Drop to add" pill so the drop
 * intent is visible. The wrapping div takes the className/data-tour
 * the inline JSX used to set, and the inner ref is what dnd-kit
 * registers as the droppable rectangle.
 */
/**
 * Wraps the iframe + selection toolbar so the canvas itself counts as
 * a drop target — releasing a library drag anywhere on the preview
 * appends the block to the end of the page. Visual feedback for the
 * insertion point lives in the outline panel (which auto-opens on
 * library drag), so this wrapper deliberately stays chromeless.
 */
function CanvasDropZone({
  isLibraryDragging,
  children,
}: {
  isLibraryDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: CANVAS_DROPZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className="souqna-builder-canvas"
      data-tour="canvas"
      data-library-dragging={isLibraryDragging || undefined}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: 'clamp(12px, 2vw, 24px)',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}

function LibraryPanel({
  groups,
  onAdd,
  currentPlan,
}: {
  groups: typeof LIBRARY_GROUPS;
  onAdd: (type: BlockType) => void;
  currentPlan: Plan;
}) {
  const { builder: copy } = useBuilderCopy();
  const itemCopy = copy.library.items as Record<BlockType, { label: string; hint: string }>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map((group) => (
        <div key={group.label}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--bld-text-faint)',
              marginBottom: 8,
            }}
          >
            {copy.library.groups[group.id]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.items.map((item) => {
              const locked =
                isPremiumBlockType(item.type) && !planUnlocksPremiumBlocks(currentPlan);
              return (
                <LibraryTile
                  key={item.type}
                  type={item.type}
                  label={itemCopy[item.type]?.label ?? item.label}
                  hint={itemCopy[item.type]?.hint ?? item.hint}
                  locked={locked}
                  badge={locked ? 'Max +' : undefined}
                  onAdd={() => onAdd(item.type)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LibraryTile({
  type,
  label,
  hint,
  locked,
  badge,
  onAdd,
}: {
  type: BlockType;
  label: string;
  hint: string;
  locked?: boolean;
  badge?: string;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${LIBRARY_PREFIX}${type}`,
    data: { kind: 'library', type },
    disabled: locked,
  });
  const dragAttributes = locked ? {} : attributes;
  const dragListeners = locked ? {} : listeners;
  return (
    <div
      ref={setNodeRef}
      {...dragAttributes}
      {...dragListeners}
      onDoubleClick={locked ? undefined : onAdd}
      onClick={(e) => {
        if (locked) return;
        if (e.detail === 1) onAdd();
      }}
      className="souqna-library-tile"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '52px 1fr',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: isDragging
          ? 'var(--bld-accent-soft)'
          : locked
            ? 'color-mix(in srgb, var(--bld-tile-bg) 72%, var(--bld-surface))'
            : 'var(--bld-tile-bg)',
        border: `1px solid ${isDragging ? 'var(--bld-accent-strong)' : 'var(--bld-divider)'}`,
        color: 'var(--bld-text)',
        borderRadius: 12,
        cursor: locked ? 'not-allowed' : 'grab',
        fontFamily: 'var(--font-sans)',
        opacity: isDragging ? 0.4 : locked ? 0.7 : 1,
        userSelect: 'none',
        transition:
          'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
        willChange: 'transform',
      }}
    >
      <BlockMiniPreview type={type} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          {badge ? (
            <span
              style={{
                flex: '0 0 auto',
                borderRadius: 999,
                border: '1px solid var(--bld-divider)',
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--bld-text-muted)',
              }}
            >
              {badge}
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--bld-text-faint)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {hint}
        </span>
      </span>
    </div>
  );
}

function OutlinePanel({
  blocks,
  blockLabels,
  selectedId,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
  dropTargetId,
  justAddedId,
  isLibraryDragging,
}: {
  blocks: Block[];
  blockLabels: Record<BlockType, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  dropTargetId: string | null;
  justAddedId: string | null;
  isLibraryDragging: boolean;
}) {
  const { builder: copy } = useBuilderCopy();
  if (blocks.length === 0) {
    return (
      <EmptyOutlineDropzone isLibraryDragging={isLibraryDragging} dropTargetId={dropTargetId} />
    );
  }
  // End-of-list bar — appears under the last row when the cursor isn't
  // aimed at a specific block. With closestCenter collision detection
  // a cursor over the canvas / blank space resolves to either no
  // target or the canvas dropzone, so we show "drops at the end"
  // there. Hovering a specific row instead resolves to that row's
  // id and the per-row insertion bar takes over.
  const showEndIndicator =
    isLibraryDragging &&
    (dropTargetId === null ||
      dropTargetId === CANVAS_DROPZONE_ID ||
      dropTargetId === OUTLINE_DROPZONE_ID);
  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <ul className="souqna-outline-list">
        {blocks.map((b, idx) => (
          <OutlineRow
            key={b.id}
            block={b}
            blockLabels={blockLabels}
            index={idx}
            selected={b.id === selectedId}
            isDropTarget={isLibraryDragging && dropTargetId === b.id}
            justAdded={justAddedId === b.id}
            onSelect={onSelect}
            onMove={onMove}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        ))}
        {showEndIndicator ? (
          <li aria-hidden className="souqna-outline-end-indicator">
            <span className="souqna-outline-end-indicator__bar" />
            <span className="souqna-outline-end-indicator__label">{copy.outline.dropsAtEnd}</span>
          </li>
        ) : null}
      </ul>
    </SortableContext>
  );
}

/**
 * Stand-alone droppable for the no-blocks-yet empty state. Lives in
 * its own component so the populated outline can skip registering the
 * wrapping <ul> as a droppable (which used to win every collision and
 * hide the per-row insertion target).
 */
function EmptyOutlineDropzone({
  isLibraryDragging,
  dropTargetId,
}: {
  isLibraryDragging: boolean;
  dropTargetId: string | null;
}) {
  const { builder: copy } = useBuilderCopy();
  const { setNodeRef, isOver } = useDroppable({ id: OUTLINE_DROPZONE_ID });
  const dropzoneHot = isLibraryDragging && (isOver || dropTargetId === OUTLINE_DROPZONE_ID);
  return (
    <div
      ref={setNodeRef}
      style={{
        fontSize: 12,
        color: dropzoneHot ? 'var(--bld-accent)' : 'var(--bld-text-faint)',
        fontFamily: 'var(--font-mono)',
        padding: 24,
        border: `1px dashed ${dropzoneHot ? 'var(--bld-accent)' : 'var(--bld-input-border)'}`,
        background: dropzoneHot ? 'var(--bld-accent-soft)' : 'transparent',
        borderRadius: 14,
        textAlign: 'center',
        transition: 'border-color 160ms ease, background 160ms ease, color 160ms ease',
        animation: dropzoneHot ? 'souqna-pulse 1.1s ease-in-out infinite' : undefined,
      }}
    >
      {dropzoneHot ? copy.outline.dropFirst : copy.outline.dropFromLibrary}
    </div>
  );
}

function OutlineRow({
  block,
  blockLabels,
  index,
  selected,
  isDropTarget,
  justAdded,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
}: {
  block: Block;
  blockLabels: Record<BlockType, string>;
  index: number;
  selected: boolean;
  isDropTarget: boolean;
  justAdded: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { builder: outlineCopy } = useBuilderCopy();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  // Local ref so we can scroll the row into view the moment it's
  // flagged as just-added. setNodeRef is dnd-kit's; we tee it through
  // mergeRefs so both dnd-kit and our scroll logic see the element.
  const rowElRef = useRef<HTMLLIElement | null>(null);
  const setMergedRef = useCallback(
    (el: HTMLLIElement | null) => {
      rowElRef.current = el;
      setNodeRef(el);
    },
    [setNodeRef],
  );
  useEffect(() => {
    if (!justAdded || !rowElRef.current) return;
    // rAF so the scroll waits for the row to actually paint after the
    // outline list re-renders with the new item.
    const id = window.requestAnimationFrame(() => {
      rowElRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [justAdded]);
  const liStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const cls = [
    'souqna-outline-row',
    selected ? 'is-selected' : '',
    isDragging ? 'is-dragging' : '',
    isDropTarget ? 'is-drop-target' : '',
    justAdded ? 'is-just-added' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <li ref={setMergedRef} className={cls} style={liStyle}>
      <span aria-hidden className="souqna-outline-row__bg" />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px 6px 6px',
        }}
      >
        <span
          {...attributes}
          {...listeners}
          role="button"
          aria-label={outlineCopy.outline.dragHandle}
          tabIndex={0}
          className="souqna-outline-row__dot"
        />
        <button
          onClick={() => onSelect(block.id)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
            background: 'transparent',
            border: 'none',
            color: 'var(--bld-text)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: selected ? 'var(--bld-accent)' : 'var(--bld-text-faint)',
                letterSpacing: '0.08em',
                width: 18,
                display: 'inline-block',
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: 13,
                fontFamily: 'var(--font-serif), serif',
                fontStyle: selected ? 'italic' : 'normal',
                fontWeight: selected ? 500 : 400,
                color: selected ? 'var(--bld-text)' : 'var(--bld-text)',
                letterSpacing: '-0.005em',
              }}
            >
              {blockLabels[block.type]}
            </span>
          </span>
        </button>
        <span className="souqna-outline-row__actions">
          <RowIconBtn ariaLabel={outlineCopy.outline.moveUp} onClick={() => onMove(block.id, -1)}>
            <ArrowUpIcon />
          </RowIconBtn>
          <RowIconBtn ariaLabel={outlineCopy.outline.moveDown} onClick={() => onMove(block.id, 1)}>
            <ArrowDownIcon />
          </RowIconBtn>
          <RowIconBtn
            ariaLabel={outlineCopy.outline.duplicate}
            onClick={() => onDuplicate(block.id)}
          >
            <DuplicateIcon />
          </RowIconBtn>
          <RowIconBtn
            ariaLabel={outlineCopy.outline.delete}
            onClick={() => onDelete(block.id)}
            danger
          >
            <TrashIcon />
          </RowIconBtn>
        </span>
      </div>
    </li>
  );
}

function RowIconBtn({
  ariaLabel,
  onClick,
  children,
  danger,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={`souqna-row-icon${danger ? ' souqna-row-icon-danger' : ''}`}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--bld-text-muted)',
        border: '1px solid var(--bld-divider)',
        borderRadius: 999,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'color 160ms, border-color 160ms, background 160ms',
      }}
    >
      {children}
    </button>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9.5 V 2.5" />
      <path d="M3 5.5 L 6 2.5 L 9 5.5" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2.5 V 9.5" />
      <path d="M3 6.5 L 6 9.5 L 9 6.5" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={2} y={2} width={6} height={6} rx={1} />
      <rect x={4.5} y={4.5} width={6} height={6} rx={1} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 3.5 H 9.5" />
      <path d="M5 3.5 V 2.5 H 7 V 3.5" />
      <path d="M3.5 3.5 L 4 10 H 8 L 8.5 3.5" />
    </svg>
  );
}

function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Pre-save sanitiser. The server runs `.strict()` Zod schemas, so any drift
 * between the inspector form and the schema will reject the entire payload.
 * Until each form is fully audited, this hardens the boundary by:
 *   - dropping unknown legacy keys we never persist intentionally,
 *   - dropping CTAs whose label is empty (the schema requires min(1)),
 *   - dropping `cta` from blocks whose schema doesn't allow it,
 *   - trimming string CTAs to the schema's max length.
 *
 * This is defensive: a clean inspector should already produce valid blocks,
 * but sanitising means a single legacy field doesn't break "Save".
 */
function sanitizeBlocksForSave(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    const props = { ...(b.props as Record<string, unknown>) };

    // Schema disallows `cta` on these blocks but the inspector historically
    // wrote one anyway. Strip it so the strict validator passes.
    const ctaForbiddenTypes: BlockType[] = ['inquireCta'];
    if (ctaForbiddenTypes.includes(b.type)) {
      delete props.cta;
    }

    if (props.cta && typeof props.cta === 'object') {
      const cta = props.cta as { label?: string; href?: string; scrollTo?: string };
      const label = (cta.label ?? '').trim();
      const href = (cta.href ?? '').trim();
      const scrollTo = (cta.scrollTo ?? '').trim();
      if (!label) {
        // Schema requires label.min(1). An empty label = no CTA at all.
        delete props.cta;
      } else {
        props.cta = scrollTo ? { label, href, scrollTo } : { label, href };
      }
    }

    // Per-block legacy migrations. Older drafts may have keys that the strict
    // schema now rejects — rename or drop them so existing storefronts can
    // still save without forcing a manual migration.
    if (b.type === 'banner') {
      // Legacy banner inspector wrote { eyebrow, title, body, aspect, overlayTextColor }.
      // The schema/renderer use { overlayTitle, overlaySubtitle, ... }.
      if ('title' in props && !('overlayTitle' in props)) {
        props.overlayTitle = props.title;
      }
      if ('body' in props && !('overlaySubtitle' in props)) {
        props.overlaySubtitle = props.body;
      }
      delete props.title;
      delete props.body;
      delete props.eyebrow;
      delete props.aspect;
      delete props.overlayTextColor;
    } else if (b.type === 'featuredProduct') {
      delete props.eyebrow;
    } else if (b.type === 'serviceList') {
      delete props.showPrices;
    } else if (b.type === 'gallery') {
      // Legacy gallery items used { url, caption }. Schema/renderer use
      // { imageUrl, alt?, caption? }. Empty `imageUrl` is allowed (the
      // schema accepts ''); we keep empty slots so users don't lose a row
      // they just added but haven't uploaded into yet.
      const items = props.items;
      if (Array.isArray(items)) {
        props.items = items
          .map((it) => {
            if (!it || typeof it !== 'object') return null;
            const item = it as Record<string, unknown>;
            const imageUrl =
              typeof item.imageUrl === 'string'
                ? item.imageUrl
                : typeof item.url === 'string'
                  ? item.url
                  : '';
            const next: Record<string, unknown> = { imageUrl };
            if (typeof item.alt === 'string' && item.alt.trim()) next.alt = item.alt;
            if (typeof item.caption === 'string' && item.caption.trim()) {
              next.caption = item.caption;
            }
            return next;
          })
          .filter((x): x is Record<string, unknown> => x !== null);
      }
    }

    return { ...b, props } as Block;
  });
}

function createBlock(type: BlockType, productOptions: ProductOption[] = []): Block {
  const id = newId();
  switch (type) {
    case 'hero':
      return { id, type, props: { title: 'New section', layout: 'centered' } };
    case 'banner':
      return { id, type, props: { imageUrl: '' } };
    case 'text':
      return { id, type, props: { body: 'New paragraph.' } };
    case 'image':
      return { id, type, props: { imageUrl: '', aspect: '4/3' } };
    case 'gallery':
      return { id, type, props: { items: [], columns: 3, aspect: '1/1' } };
    case 'productGrid':
      return { id, type, props: { layout: 'cards', columns: 3 } };
    case 'productList':
      return { id, type, props: {} };
    case 'featuredProduct':
      return { id, type, props: { layout: 'split' } };
    case 'serviceList':
      return { id, type, props: {} };
    case 'menu':
      return { id, type, props: {} };
    case 'calendar':
      return { id, type, props: {} };
    case 'contactCard':
      return { id, type, props: {} };
    case 'inquireCta':
      return { id, type, props: {} };
    case 'spacer':
      return { id, type, props: { size: 'md' } };
    case 'divider':
      return { id, type, props: {} };
    case 'drop':
      return {
        id,
        type,
        props: {
          dropId: '',
          showCountdown: true,
          showWaitlist: true,
        },
      };
    case 'animatedText':
      return {
        id,
        type,
        props: { text: 'A line that moves.', effect: 'reveal', emphasis: 'display' },
      };
    case 'animatedImage':
      return {
        id,
        type,
        props: { imageUrl: '', effect: 'parallax', intensity: 'medium', aspect: '16/9' },
      };
    case 'productCardStack':
      return {
        id,
        type,
        props: { backCards: 1 },
      };
    case 'tiltImage':
      return {
        id,
        type,
        props: {
          imageUrl: '',
          tiltDirection: 'right',
          intensity: 'medium',
          aspect: '16/9',
          width: 'wide',
        },
      };
    case 'spotlightCard':
      return {
        id,
        type,
        props: {
          title: 'A moment worth marking.',
          body: 'Drop in a date, write a couple of lines, and the card lifts when visitors hover.',
          dateMonth: 'JUNE',
          dateDay: '29',
          showDate: true,
          pattern: 'stripes',
          tiltDirection: 'right',
          intensity: 'medium',
          width: 'wide',
        },
      };
    case 'productPromoCard':
      return {
        id,
        type,
        props: {
          tags: [
            {
              id: newId().slice(0, 8),
              label: 'NEW',
            },
          ],
          tagPosition: 'top-end',
          tagReveal: 'on-hover',
          showAddToCart: true,
          intensity: 'medium',
          width: 'wide',
        },
      };
    case 'mawid':
      return {
        id,
        type,
        props: {
          eventId: '',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          variant: 'boxed',
        },
      };
    case 'taqim':
      return { id, type, props: { variant: 'cards' } };
    case 'depthShowcase':
      return {
        id,
        type,
        props: {
          imageUrl:
            'https://images.unsplash.com/photo-1549887552-261bcdf8d5f5?auto=format&fit=crop&w=900&q=70',
          title: 'Portfolio highlight',
          description: 'Parallax depth — swap the image and copy in the inspector.',
          imageAlt: '',
          width: 'wide',
        },
      };
    case 'auroraRibbon':
      return {
        id,
        type,
        props: {
          eyebrow: 'Studio',
          title: 'Editorial ribbon',
          subtitle: 'Aurora WebGL — use one short strip per page.',
          heightPx: 200,
          brightness: 0.85,
        },
      };
    case 'showcase1':
      return {
        id,
        type,
        props: createShowcase1Props(),
      };
    case 'showcase2':
      return {
        id,
        type,
        props: {
          eyebrow: 'Featured Work',
          title: 'Crafting digital experiences that inspire and engage.',
          cta: { label: 'View projects', href: '#' },
          items: [
            {
              id: newId().slice(0, 8),
              imageUrl:
                'https://cdn.dribbble.com/userupload/46030284/file/8dfdc9a8b09fdbd99b010c1dcb279841.jpg?resize=1024x1693&vertical=center',
              alt: 'Editorial product showcase',
              height: 'md',
            },
            {
              id: newId().slice(0, 8),
              imageUrl:
                'https://cdn.dribbble.com/userupload/46029941/file/f3b0e906d38980bf48e008f5542a58b5.jpg?resize=1024x1693&vertical=center',
              alt: 'Campaign visual',
              height: 'lg',
            },
            {
              id: newId().slice(0, 8),
              imageUrl:
                'https://cdn.dribbble.com/userupload/45777759/file/acf14657b38cd25e64bb16b4f201bef8.jpg?resize=1024x1529&vertical=center',
              alt: 'Brand case study',
              height: 'md',
            },
            {
              id: newId().slice(0, 8),
              imageUrl:
                'https://cdn.dribbble.com/userupload/46068721/file/3910087a60fe6f781ddae7c14daf1804.jpg?resize=1024x1589&vertical=center',
              alt: 'Portfolio card',
              height: 'sm',
            },
          ],
        },
      };
    case 'showcase3':
      return {
        id,
        type,
        props: {
          title: 'Case Studies',
          subtitle: "See others we've helped with this program",
          items: [
            {
              id: newId().slice(0, 8),
              title: 'Nothing Great Comes Alive Alone',
              category: 'Brand Identity',
              imageUrl:
                'https://cdn.dribbble.com/userupload/46030284/file/8dfdc9a8b09fdbd99b010c1dcb279841.jpg?resize=1024x1693&vertical=center',
            },
            {
              id: newId().slice(0, 8),
              title: 'Lost in the Abstract',
              category: 'Art Direction',
              imageUrl:
                'https://cdn.dribbble.com/userupload/46029941/file/f3b0e906d38980bf48e008f5542a58b5.jpg?resize=1024x1693&vertical=center',
            },
            {
              id: newId().slice(0, 8),
              title: 'Geometric Perspectives',
              category: 'Digital Art',
              imageUrl:
                'https://cdn.dribbble.com/userupload/45777759/file/acf14657b38cd25e64bb16b4f201bef8.jpg?resize=1024x1529&vertical=center',
            },
          ],
        },
      };
    case 'showcase4':
      return {
        id,
        type,
        props: {
          eyebrow: 'Selected Work / 2023-2025',
          title: 'Quiet craft, shipped for brands you probably already use.',
          projects: [
            {
              id: newId().slice(0, 8),
              title: 'Halcyon Type Foundry',
              client: 'Halcyon',
              year: '2025',
              tags: ['Identity'],
              imageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80',
              href: '#',
            },
            {
              id: newId().slice(0, 8),
              title: 'Bloom Cold Brew',
              client: 'Bloom Coffee',
              year: '2025',
              tags: ['Campaign'],
              imageUrl: 'https://images.unsplash.com/photo-1605902711622-cfb43c4437b5?w=800&q=80',
              href: '#',
            },
            {
              id: newId().slice(0, 8),
              title: 'Polaris Navigation Kit',
              client: 'Polaris',
              year: '2024',
              tags: ['Identity', 'Product'],
              imageUrl: 'https://images.unsplash.com/photo-1618004652321-13a63e576b80?w=800&q=80',
              href: '#',
            },
            {
              id: newId().slice(0, 8),
              title: 'Northwind Commerce',
              client: 'Northwind',
              year: '2024',
              tags: ['Identity', 'Campaign'],
              imageUrl: 'https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?w=800&q=80',
              href: '#',
            },
          ],
        },
      };
    case 'showcase5':
      return {
        id,
        type,
        props: {
          eyebrow: 'In the wild',
          title: 'Work that left the canvas and made it to market',
          description:
            'A rolling feed of campaigns, launches, and side projects shipped by people building on our tools every day.',
          tabs: [
            {
              id: 'studios',
              label: 'Studios',
              images: [
                'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=600&q=80',
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
                'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&q=80',
                'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&q=80',
              ],
            },
            {
              id: 'creators',
              label: 'Creators',
              images: [
                'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
                'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80',
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
                'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80',
              ],
            },
            {
              id: 'teams',
              label: 'Teams',
              images: [
                'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80',
                'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80',
                'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&q=80',
                'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80',
              ],
            },
          ],
        },
      };
    case 'ecommerce1':
    case 'ecommerce2':
    case 'ecommerce3':
    case 'ecommerce4':
    case 'ecommerce5':
    case 'ecommerce6':
    case 'ecommerce7':
      return {
        id,
        type,
        props: createEcommerceBlockProps(type, productOptions),
      };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown block type: ${String(_exhaustive)}`);
    }
  }
}

function createShowcase1Props(): Showcase1Props {
  return {
    eyebrow: 'Featured paths',
    title: 'Pick a story and let the visuals carry the next step.',
    description: 'A compact switcher for launches, gift guides, services, or founder notes.',
    items: [
      {
        id: newId().slice(0, 8),
        title: 'Launch edit',
        subtitle: 'A short visual story for new arrivals and seasonal drops.',
        kicker: 'Products',
        imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80',
        href: '#',
      },
      {
        id: newId().slice(0, 8),
        title: 'Gift guide',
        subtitle: 'Group a few hero picks into one compact buying moment.',
        kicker: 'Gifting',
        imageUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=1000&q=80',
        href: '#',
      },
      {
        id: newId().slice(0, 8),
        title: 'Studio notes',
        subtitle: 'Show process, mood, or founder story without a full landing page.',
        kicker: 'Editorial',
        imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1000&q=80',
        href: '#',
      },
    ],
  };
}

function createDefaultEcommerceProducts(): EcommerceProduct[] {
  return [
    {
      id: newId().slice(0, 8),
      name: 'Linen travel set',
      brand: 'Souqna Studio',
      category: 'Travel',
      price: 'QAR 240',
      tag: 'New',
      imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80',
      images: [
        'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=80',
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&q=80',
      ],
      description: 'A compact edit for everyday errands, travel days, and giftable bundles.',
      details: ['Organic cotton blend', 'Ships from Qatar', 'Gift wrap available'],
      colors: [
        { name: 'Oat', value: '#d9c7a7' },
        { name: 'Ink', value: '#202020' },
        { name: 'Palm', value: '#55715f' },
      ],
      sizes: [
        { label: 'S', available: true },
        { label: 'M', available: true },
        { label: 'L', available: true },
        { label: 'XL', available: false },
      ],
      href: '#',
      available: true,
    },
    {
      id: newId().slice(0, 8),
      name: 'Ceramic cup pair',
      brand: 'Dohat Clay',
      category: 'Home',
      price: 'QAR 180',
      tag: 'Handmade',
      imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&q=80',
      description: 'Hand-thrown pair with a soft matte glaze and boxed presentation.',
      details: ['Made in small batches', 'Dishwasher safe', 'Two-piece set'],
      href: '#',
      available: true,
    },
    {
      id: newId().slice(0, 8),
      name: 'Date gift box',
      brand: 'Majlis Pantry',
      category: 'Gifts',
      price: 'QAR 135',
      tag: 'Bestseller',
      imageUrl: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=900&q=80',
      description: 'A premium date assortment with Arabic coffee notes and reusable packaging.',
      details: ['12 pieces', 'Custom note included', 'Same-day Doha delivery'],
      href: '#',
      available: true,
    },
    {
      id: newId().slice(0, 8),
      name: 'Amber fragrance oil',
      brand: 'Bayt Oud',
      category: 'Beauty',
      price: 'QAR 290',
      tag: 'Limited',
      imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80',
      description: 'A warm amber blend designed for a slow, lasting dry down.',
      details: ['15ml roll-on', 'Alcohol free', 'Limited seasonal blend'],
      href: '#',
      available: false,
    },
  ];
}

function createDefaultEcommerceCategories(): EcommerceCategory[] {
  return [
    {
      id: newId().slice(0, 8),
      label: 'New arrivals',
      tag: 'Fresh edit',
      imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80',
      href: '#',
    },
    {
      id: newId().slice(0, 8),
      label: 'Gifts',
      tag: 'Ready to wrap',
      imageUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=900&q=80',
      href: '#',
    },
    {
      id: newId().slice(0, 8),
      label: 'Home',
      tag: 'For the table',
      imageUrl: 'https://images.unsplash.com/photo-1513161455079-7dc1de15ef3e?w=900&q=80',
      href: '#',
    },
    {
      id: newId().slice(0, 8),
      label: 'Beauty',
      tag: 'Daily rituals',
      imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80',
      href: '#',
    },
  ];
}

function createEcommerceBlockProps(
  type: BlockType,
  productOptions: ProductOption[] = [],
): EcommerceBlockProps {
  const productTitles: Record<string, string> = {
    ecommerce1: 'Featured product gallery',
    ecommerce2: 'Filtered shop edit',
    ecommerce3: 'Product color story',
    ecommerce4: 'Limited drop',
    ecommerce5: 'Editorial product shelf',
    ecommerce6: 'Category shop',
    ecommerce7: 'Shop by category',
  };

  const activeProductIds = productOptions
    .filter((product) => product.status === 'active')
    .slice(0, 8)
    .map((product) => product.id);

  return {
    eyebrow: 'Shop',
    title: productTitles[type] ?? 'Curated products',
    subtitle: 'Swap in your own products, images, categories, and links from the inspector.',
    cta: { label: 'View all', href: '#' },
    productIds: activeProductIds.length ? activeProductIds : undefined,
    products: createDefaultEcommerceProducts(),
    categories: createDefaultEcommerceCategories(),
    tabs: ['All', 'Travel', 'Home', 'Gifts', 'Beauty'],
  };
}

function primaryBtnStyle(disabled = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    background: 'var(--bld-accent)',
    color: 'var(--bld-accent-ink)',
    border: '1px solid var(--bld-accent-line)',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.78 : 1,
    boxShadow: '0 14px 40px var(--bld-panel-shadow)',
    transition: 'transform 140ms ease, box-shadow 140ms ease',
  };
}

function dragGhostStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 6,
    padding: 10,
    background: 'var(--bld-surface-strong)',
    color: 'var(--bld-text)',
    border: '1px solid var(--bld-accent-line)',
    borderRadius: 14,
    fontFamily: 'var(--font-sans)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
    boxShadow: '0 18px 48px var(--bld-panel-shadow)',
  };
}

function BuilderRecommendations({
  blocks,
  selected,
  templateId,
  productCount,
  onApplyVariant,
  onAddBlock,
  onOpenSite,
  onPremiumRefresh,
}: {
  blocks: Block[];
  selected: Block | null;
  currentPlan: Plan;
  templateId: TemplateId;
  productCount: number;
  onApplyVariant: (variant: BlockVariant) => void;
  onAddBlock: (type: BlockType) => void;
  onOpenSite: () => void;
  onPremiumRefresh: () => void;
}) {
  const { builder: copy } = useBuilderCopy();
  const blockLabels = copy.blockLabels as Record<BlockType, string>;
  const rec = copy.recommendations;
  const canUsePremiumVisuals = true;
  const hasContact = blocks.some((b) => b.type === 'contactCard' || b.type === 'inquireCta');
  const hasProducts = blocks.some((b) =>
    [
      'productGrid',
      'productList',
      'featuredProduct',
      'productCardStack',
      'productPromoCard',
      'ecommerce1',
      'ecommerce2',
      'ecommerce3',
      'ecommerce4',
      'ecommerce5',
      'ecommerce6',
      'ecommerce7',
    ].includes(b.type),
  );
  const hasMotion = blocks.some(
    (b) =>
      b.type === 'animatedText' ||
      b.type === 'animatedImage' ||
      b.type === 'tiltImage' ||
      b.type === 'spotlightCard' ||
      b.type === 'depthShowcase' ||
      b.type === 'auroraRibbon' ||
      b.type === 'showcase1' ||
      b.type === 'showcase2' ||
      b.type === 'showcase3' ||
      b.type === 'showcase4' ||
      b.type === 'showcase5' ||
      (b.style?.variant && b.style.variant !== 'classic'),
  );
  const templateVariant = premiumVariantForTemplate(templateId);
  const selectedCanTakeVariant = selected ? isVariantBlock(selected.type) : false;

  const items = [
    !hasMotion
      ? {
          title: rec.premiumRefreshTitle,
          body: rec.premiumRefreshBody,
          action: rec.refresh,
          onClick: onPremiumRefresh,
        }
      : null,
    selected && selectedCanTakeVariant && selected.style?.variant !== templateVariant
      ? {
          title: rec.applyMotionTitle,
          body: canUsePremiumVisuals
            ? `${blockLabels[selected.type]} · ${templateVariant.replace('pro-', '')}`
            : rec.premiumIncluded,
          action: rec.apply,
          onClick: () => onApplyVariant(templateVariant),
        }
      : null,
    !hasMotion
      ? {
          title: rec.addMotionTitle,
          body: canUsePremiumVisuals ? rec.addMotionBody : rec.premiumIncluded,
          action: rec.addAnimatedText,
          onClick: () => onAddBlock('animatedText'),
        }
      : null,
    productCount > 0 && !hasProducts
      ? {
          title: rec.showCatalogueTitle,
          body: rec.showCatalogueBody,
          action: rec.addGrid,
          onClick: () => onAddBlock('productGrid'),
        }
      : null,
    !hasContact
      ? {
          title: rec.addCtaTitle,
          body: rec.addCtaBody,
          action: rec.addCta,
          onClick: () => onAddBlock('inquireCta'),
        }
      : null,
    {
      title: rec.tuneSystemTitle,
      body: rec.tuneSystemBody,
      action: rec.openSite,
      onClick: onOpenSite,
    },
  ]
    .filter(Boolean)
    .slice(0, 3) as Array<{
    title: string;
    body: string;
    action: string;
    onClick: () => void;
  }>;

  if (!items.length) return null;

  return (
    <section
      aria-label={rec.aria}
      style={{
        display: 'grid',
        gap: 8,
        padding: 10,
        border: '1px solid var(--bld-divider)',
        borderRadius: 8,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--bld-input-bg) 92%, transparent), color-mix(in srgb, var(--bld-surface) 94%, transparent))',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--bld-accent)',
          }}
        >
          {rec.heading}
        </span>
        <span style={{ fontSize: 11, color: 'var(--bld-text-faint)' }}>
          {blocks.length} {rec.sections}
        </span>
      </div>
      {items.map((item) => (
        <article
          key={item.title}
          style={{
            display: 'grid',
            gap: 6,
            padding: '9px 10px',
            borderRadius: 6,
            background: 'var(--bld-input-bg)',
            border: '1px solid var(--bld-divider)',
          }}
        >
          <strong style={{ fontSize: 12, color: 'var(--bld-text)' }}>{item.title}</strong>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--bld-text-muted)' }}>
            {item.body}
          </p>
          <button
            type="button"
            onClick={item.onClick}
            style={{
              justifySelf: 'start',
              border: '1px solid color-mix(in srgb, var(--bld-text) 16%, transparent)',
              background: 'transparent',
              color: 'var(--bld-accent)',
              borderRadius: 999,
              padding: '5px 9px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {item.action}
          </button>
        </article>
      ))}
    </section>
  );
}

function premiumVariantForTemplate(templateId: TemplateId): BlockVariant {
  const map: Partial<Record<TemplateId, BlockVariant>> = {
    atrium: 'pro-silk',
    souqline: 'pro-bars',
    kiosk: 'pro-metallic',
    lounge: 'pro-chroma',
    studio: 'pro-halftone',
    bazaar: 'pro-silk',
    vitrine: 'pro-silk',
    monoline: 'pro-chroma',
    harvest: 'pro-grain',
    launchpad: 'pro-bars',
    frame: 'pro-metallic',
  };
  return map[templateId] ?? 'pro-aurora';
}

/**
 * Block / Site segmented control sitting at the very top of the right
 * inspector aside. Site mode shows page-wide theme controls; Block mode
 * shows the per-block content + style editor. The wrapping aside is
 * shared so vertical scroll, drawer toggle, and width all stay in lockstep.
 */
function InspectorModeToggle({
  value,
  onChange,
}: {
  value: 'block' | 'site';
  onChange: (v: 'block' | 'site') => void;
}) {
  const { builder: copy } = useBuilderCopy();
  const opts: Array<{ id: 'block' | 'site'; label: string }> = [
    { id: 'block', label: copy.rail.block },
    { id: 'site', label: copy.rail.site },
  ];
  const activeIndex = value === 'block' ? 0 : 1;
  return (
    <div
      role="tablist"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        padding: 3,
        background: 'var(--bld-input-bg)',
        border: '1px solid var(--bld-divider)',
        borderRadius: 999,
        height: 32,
        overflow: 'hidden',
      }}
    >
      {/* Sliding thumb. Animates left/right on toggle instead of two
          static buttons swapping fills — reads as one moving control,
          not two competing ones. The maroon glow under the thumb
          subtly anchors the active mode. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: 3,
          width: 'calc(50% - 3px)',
          background: 'var(--bld-accent)',
          borderRadius: 999,
          transform: `translateX(${activeIndex === 0 ? '0%' : '100%'})`,
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0.0, 1.0), box-shadow 280ms ease',
          boxShadow:
            '0 4px 14px -4px var(--bld-panel-shadow), inset 0 0 0 1px var(--bld-input-border)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            data-tour={o.id === 'block' ? 'inspector-block' : 'inspector-site'}
            style={{
              position: 'relative',
              zIndex: 2,
              padding: '0',
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--bld-text)' : 'var(--bld-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 240ms ease, font-weight 240ms ease',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
