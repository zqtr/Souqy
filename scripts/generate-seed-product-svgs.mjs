#!/usr/bin/env node
/**
 * Generate stylized SVG seed-product images for every template.
 *
 * Replaces the external Unsplash dependency in `src/lib/blocks/demoProducts.ts`
 * and `src/lib/blocks/templateIndustrySeed.ts`. Each template gets five
 * 600×600 SVGs in its own palette (sand_gold, pearl_ink, etc.). The
 * compositions are deliberately abstract: a single hero silhouette
 * (vessel, stack, plate, frame, cluster) keyed to the template's
 * archetype, plus a subtle grid texture and a small accent mark — so a
 * brand-new storefront reads as "designed" out of the box without
 * pretending to be a real product photo.
 *
 * Run once from the repo root:
 *
 *     node scripts/generate-seed-product-svgs.mjs
 *
 * Idempotent — overwrites any existing files. Adds ~110 KB of assets to
 * `public/seed-products/<templateId>/{1..5}.svg`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Template → palette mapping. Mirrors src/lib/templates.ts. */
const TEMPLATE_PALETTES = {
  atrium: 'pearl_ink',
  souqline: 'sand_gold',
  kiosk: 'terracotta_kiln',
  lounge: 'bone_obsidian',
  studio: 'coral_play',
  bazaar: 'olive_brass',
  vitrine: 'pearl_lagoon',
  monoline: 'maroon_bone',
  harvest: 'sage_inlet',
  launchpad: 'dune_blush',
  frame: 'midnight_emerald',
};

/** Palette triplet (light theme) — mirrors src/lib/palettes.ts. */
const PALETTES = {
  sand_gold: { ink: '#1F1B16', ground: '#E8DCC4', accent: '#C9A961' },
  pearl_ink: { ink: '#0E0E10', ground: '#F4F1EB', accent: '#3B3B45' },
  olive_brass: { ink: '#1F2117', ground: '#EFE7CC', accent: '#A2864B' },
  maroon_bone: { ink: '#2A1212', ground: '#F2EAD8', accent: '#7A1D2A' },
  midnight_emerald: { ink: '#0B1612', ground: '#F1ECE0', accent: '#1F6B4F' },
  terracotta_kiln: { ink: '#2A1A14', ground: '#F2E2D2', accent: '#B5532A' },
  bone_obsidian: { ink: '#000000', ground: '#FFFFFF', accent: '#1A1A1A' },
  coral_play: { ink: '#321B26', ground: '#FFE9E1', accent: '#E2615C' },
  pearl_lagoon: { ink: '#102733', ground: '#E8F0EC', accent: '#4A8B92' },
  sage_inlet: { ink: '#1B2A20', ground: '#E5EFD9', accent: '#5C7A4A' },
  dune_blush: { ink: '#2D1A1A', ground: '#F5DDC8', accent: '#C26A52' },
};

/**
 * Five shape recipes. Each takes a palette triplet and returns the
 * inner SVG markup (everything between `<svg>` open and close, minus
 * the background rect — that's drawn outside the recipe).
 */
const SHAPES = {
  vessel: ({ ink, accent }) => `
    <g opacity="0.10" stroke="${ink}" stroke-width="1">
      ${gridLines(ink)}
    </g>
    <g transform="translate(300 320)">
      <path d="M -70 -130 Q -70 -150 -50 -150 L 50 -150 Q 70 -150 70 -130 L 70 -100 Q 110 -60 110 0 L 110 110 Q 110 150 70 150 L -70 150 Q -110 150 -110 110 L -110 0 Q -110 -60 -70 -100 Z"
            fill="${ink}" opacity="0.92"/>
      <path d="M -40 -110 L 40 -110" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="0" cy="40" r="22" fill="${accent}"/>
    </g>
    <circle cx="500" cy="100" r="6" fill="${accent}"/>
  `,
  stack: ({ ink, accent }) => `
    <g opacity="0.08" stroke="${ink}" stroke-width="1">
      ${gridLines(ink)}
    </g>
    <g transform="translate(120 200)">
      <rect x="0" y="0" width="360" height="40" rx="6" fill="${ink}" opacity="0.92"/>
      <rect x="20" y="56" width="320" height="40" rx="6" fill="${ink}" opacity="0.78"/>
      <rect x="40" y="112" width="280" height="40" rx="6" fill="${ink}" opacity="0.62"/>
      <rect x="60" y="168" width="240" height="40" rx="6" fill="${accent}" opacity="0.95"/>
    </g>
    <g transform="translate(300 480)" fill="${ink}" opacity="0.35">
      <circle cx="-90" cy="0" r="4"/>
      <circle cx="-30" cy="0" r="4"/>
      <circle cx="30" cy="0" r="4"/>
      <circle cx="90" cy="0" r="4"/>
    </g>
  `,
  plate: ({ ink, accent }) => `
    <g opacity="0.08" stroke="${ink}" stroke-width="1">
      ${gridLines(ink)}
    </g>
    <circle cx="300" cy="300" r="200" fill="${ink}" opacity="0.05" stroke="${ink}" stroke-width="2"/>
    <circle cx="300" cy="300" r="150" fill="${ink}" opacity="0.92"/>
    <circle cx="300" cy="300" r="70" fill="${accent}"/>
    <circle cx="300" cy="300" r="30" fill="${ink}"/>
    <g stroke="${accent}" stroke-width="2" opacity="0.6">
      <line x1="300" y1="80" x2="300" y2="100"/>
      <line x1="300" y1="500" x2="300" y2="520"/>
      <line x1="80" y1="300" x2="100" y2="300"/>
      <line x1="500" y1="300" x2="520" y2="300"/>
    </g>
  `,
  frame: ({ ink, accent }) => `
    <g opacity="0.08" stroke="${ink}" stroke-width="1">
      ${gridLines(ink)}
    </g>
    <rect x="120" y="100" width="360" height="400" rx="4" fill="${ink}" opacity="0.92"/>
    <rect x="150" y="130" width="300" height="340" rx="2" fill="${accent}" opacity="0.20"/>
    <g transform="translate(300 300)" fill="${accent}">
      <polygon points="-60,30 0,-50 60,30"/>
      <circle cx="-30" cy="-10" r="10" opacity="0.95"/>
    </g>
    <rect x="150" y="430" width="300" height="40" fill="${ink}" opacity="0.45"/>
  `,
  cluster: ({ ink, accent }) => `
    <g opacity="0.08" stroke="${ink}" stroke-width="1">
      ${gridLines(ink)}
    </g>
    <circle cx="220" cy="240" r="100" fill="${ink}" opacity="0.92"/>
    <rect x="320" y="180" width="140" height="180" rx="8" fill="${accent}" opacity="0.95"/>
    <rect x="180" y="380" width="240" height="80" rx="10" fill="${ink}" opacity="0.62"/>
    <circle cx="430" cy="420" r="20" fill="${accent}"/>
    <circle cx="160" cy="160" r="8" fill="${accent}"/>
  `,
};

function gridLines(_ink) {
  const lines = [];
  for (let i = 60; i <= 540; i += 60) {
    lines.push(`<line x1="${i}" y1="60" x2="${i}" y2="540"/>`);
    lines.push(`<line x1="60" y1="${i}" x2="540" y2="${i}"/>`);
  }
  return lines.join('');
}

/**
 * Five-shape rotation per template — kept in a fixed order so seed
 * row N always maps to the same image (re-runs of the script are
 * deterministic). Templates whose archetype favours one shape over
 * another get a custom rotation, but every template covers all five
 * shapes so the catalogue feels varied.
 */
const ROTATIONS = {
  atrium: ['stack', 'vessel', 'frame', 'cluster', 'plate'],
  souqline: ['vessel', 'stack', 'plate', 'cluster', 'frame'],
  kiosk: ['vessel', 'cluster', 'plate', 'frame', 'stack'],
  lounge: ['plate', 'vessel', 'cluster', 'stack', 'frame'],
  studio: ['frame', 'cluster', 'stack', 'vessel', 'plate'],
  bazaar: ['stack', 'cluster', 'vessel', 'frame', 'plate'],
  vitrine: ['frame', 'vessel', 'cluster', 'stack', 'plate'],
  monoline: ['plate', 'cluster', 'vessel', 'frame', 'stack'],
  harvest: ['vessel', 'cluster', 'stack', 'plate', 'frame'],
  launchpad: ['frame', 'stack', 'cluster', 'plate', 'vessel'],
  frame: ['frame', 'cluster', 'vessel', 'plate', 'stack'],
};

function svgFor(templateId, index, palette) {
  const shapeName = ROTATIONS[templateId][index];
  const recipe = SHAPES[shapeName];
  const { ink, ground, accent } = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-labelledby="title-${templateId}-${index + 1}">
  <title id="title-${templateId}-${index + 1}">Sample ${templateId} product ${index + 1}</title>
  <desc>Stylized placeholder rendered in the ${templateId} template palette.</desc>
  <rect width="600" height="600" fill="${ground}"/>
  ${recipe({ ink, ground, accent }).trim()}
  <g font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="${ink}" opacity="0.55">
    <text x="40" y="560" letter-spacing="2">SOUQNA · SAMPLE · 0${index + 1}</text>
  </g>
</svg>
`;
}

async function main() {
  let count = 0;
  for (const [templateId, paletteId] of Object.entries(TEMPLATE_PALETTES)) {
    const palette = PALETTES[paletteId];
    if (!palette) throw new Error(`Unknown palette ${paletteId} for ${templateId}`);
    const folder = resolve(ROOT, 'public/seed-products', templateId);
    await mkdir(folder, { recursive: true });
    for (let i = 0; i < 5; i++) {
      const svg = svgFor(templateId, i, palette);
      const target = resolve(folder, `${i + 1}.svg`);
      await writeFile(target, svg, 'utf8');
      count++;
    }
  }
  console.log(`generated ${count} seed-product SVGs under public/seed-products/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
