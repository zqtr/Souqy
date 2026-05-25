# Souqy Studio

Souqy Studio is a separate creative workspace for brand assets: logos,
promotional photos, posters, and branding kits. It should live beside the
builder, not inside it.

## Brand surface

Studio UI, generated previews, and brand-kit docs should feel connected to the current homepage:

- Palette: black `#0A0A0A`, charcoal `#2A2A2A`, cream `#E8DCC4`, quiet border `#D1C7B2`, pale text `#F7F7F3`, and white `#FFFFFF`.
- English typography: Exo 2.
- Arabic typography: Thmanyah Serif Display Bold for headlines; Thmanyah Sans or Thmanyah Serif Text for supporting copy.
- Motion: calm text reveals, halftone/grid depth, and monochrome logo treatments. Avoid orange accents, neon gradients, and generic blue SaaS panels.

## Product Shape

- Route: `/account/souqy-studio?store=<slug>`.
- Layout: full-bleed account route, similar to `/account/builder`, with no
  dashboard chrome.
- Canvas: infinite grid workspace for generated assets, references, palettes,
  Thmanyah typography samples, and poster drafts.
- Action bar: compact creative controls for `Logo`, `Poster`, `Promo photo`,
  `Brand kit`, `Edit selected`, `Export`, and `Send to builder`.
- Reference images: the `+` control attaches product photos, existing logos,
  palette references, packaging, or mood images. These are not just UI
  attachments; generation requests must pass them into a model that supports
  image references.
- Persistence: store generated assets in Vercel Blob and metadata in Neon.
  Keep it separate from the existing `src/lib/souqy/*` storefront-generation
  pipeline.
- Naming: current Souqy remains the AI storefront/code builder. This workspace
  can be user-facing as "Souqy Studio" to avoid confusing revision dashboards
  with creative asset generation.

## First Version

1. Pick storefront context: business name, category, locale, current palette,
   current logo, selected products.
2. Generate four logo directions with transparent PNG preview and, where
   available, SVG/vector export.
3. Generate a brand kit: colors, Thmanyah-first typography direction, tone words, social
   avatar, cover image, and sample storefront hero treatment.
4. Generate promotional posters in Souqna-native sizes, not arbitrary model
   defaults. Every generation request should carry a target asset contract and
   every response should be normalized into that contract before it is saved.
5. Save every output as an asset card on the infinite grid.
6. Let founders send a chosen logo or poster image into storefront settings,
   builder image blocks, or marketing/download flows.

## Souqna Asset Contracts

The Studio should not expose raw model dimensions as finished assets. Models
can draft, but Souqna owns the final sizes.

| Asset | Final size | Format | Blob namespace | Use |
| --- | ---: | --- | --- | --- |
| Primary logo | 1024x1024 safe canvas | SVG preferred, PNG fallback | `logos/<slug>/` | Storefront header, email receipts, brand settings |
| Logo mark/avatar | 512x512 | PNG/WebP transparent | `logos/<slug>/` | Discover cards, compact headers, app icons |
| Wide logo lockup | 1600x600 | SVG preferred, PNG fallback | `logos/<slug>/` | Hero/header lockups and exports |
| Storefront banner | 2400x1200 | WebP/PNG | `banners/<slug>/` | Builder banner and hero image blocks |
| Social share image | 1200x630 | PNG/WebP | `og-images/<slug>/` | Page/site Open Graph image |
| Square promo poster | 1080x1080 | PNG/WebP | `brand/<slug>/` | Instagram/feed, WhatsApp catalog, product promos |
| Story promo poster | 1080x1920 | PNG/WebP | `brand/<slug>/` | Stories/reels covers |
| Landscape promo poster | 1200x630 | PNG/WebP | `brand/<slug>/` | Link previews, web ads, announcement cards |
| Print-ish poster draft | 2480x3508 | PNG/PDF later | `brand/<slug>/` | A4 flyer export, not first-class until print flow exists |

Generation should happen in or above the final aspect ratio, then pass through
a deterministic normalization step:

1. Crop/pad to the target aspect ratio.
2. Resize to the exact final dimensions.
3. Preserve transparent backgrounds for logo assets.
4. Reject or rerun outputs with unreadable text, clipped logos, unsafe margins,
   or wrong language direction.
5. Store model, prompt, seed/options, original dimensions, final dimensions,
   and asset contract in metadata.

For logos, enforce a safe area of roughly 12 percent on all sides so generated
marks do not touch the edge when rendered in circular avatars, square cards, or
small storefront headers. For posters, keep text and key product imagery inside
an 8 percent safe area, with an optional stricter 14 percent safe area for story
assets where app UI can cover the top and bottom.

## Model Shortlist

### Logos and Vector-Like Brand Marks

- Recraft V3 SVG, exposed on Replicate as `recraft-ai/recraft-v3-svg`, is the
  strongest fit for logotypes, icons, and SVG-style outputs because it is
  explicitly design/vector oriented. It should be the default for logo marks
  when API access and commercial terms are acceptable.
- Shakker Labs `FLUX.1-dev-LoRA-Logo-Design` on Hugging Face is useful for
  open experimentation, but its FLUX.1-dev base is non-commercial by default,
  so it is not the safest production default unless licensing is resolved.
- Ideogram 3.0 is a strong API fallback when the logo/poster depends on
  readable text or wordmark exploration.

### Posters and Text-Heavy Promotions

- Ideogram 3.0 should be evaluated first for posters, flyers, and social
  graphics because its API focuses on generation, remix, edit, reframe,
  background replacement, style presets, and text rendering. It should receive
  the exact target aspect ratio and poster contract in the prompt/options.
- GPT Image models are a strong general option for prompt-following,
  multi-turn edits, reference images, and product-friendly image generation.
  They are a good fallback when a poster needs product-photo realism or careful
  iterative correction.
- FLUX.2 from Black Forest Labs is worth testing for premium generation/editing
  and multi-reference brand consistency.

### Routing Rule

- Logo mark or vector-style icon: Recraft first, Ideogram second.
- Wordmark or poster with important text: Ideogram first, GPT Image second.
- Product promo photo with uploaded product references: GPT Image or FLUX.2
  first, Qwen Image Edit as an open-model experiment.
- Any request with reference images must use a multimodal/reference-aware image
  model. Do not route reference-image generations to text-only prompt expansion.
- Any output that cannot hit a Souqna asset contract exactly is a draft only,
  not an applyable asset.

### Promotional Product Photos

- GPT Image models and FLUX.2 are the best general candidates for product
  lifestyle scenes, because they can use reference images and support editing.
- Qwen Image Edit 2511 on Hugging Face is worth tracking for open image-editing
  workflows, especially where product/reference consistency matters.
- Niche Hugging Face LoRAs for product photography exist, but most are too
  narrow or low-usage to be a primary production backend.

## Recommended Architecture

- `src/app/account/souqy-studio/layout.tsx`: full-bleed document shell copied
  from the builder layout pattern.
- `src/app/account/souqy-studio/page.tsx`: auth, locale, storefront resolver,
  plan gate, and studio boot props.
- `src/components/souqy-studio/SouqyStudioShell.tsx`: client canvas, action bar,
  selection state, generation status, and asset grid.
- `src/app/actions/souqyStudio.ts`: zod-validated server actions with Clerk
  auth and storefront ownership checks.
- `src/lib/souqy-studio/models.ts`: provider routing and prompt builders.
- `src/lib/souqy-studio/assets.ts`: Blob persistence, DB metadata, export
  helpers.
- `src/lib/souqy-studio/contracts.ts`: canonical asset contracts, safe areas,
  output formats, and model routing hints.
- `src/lib/souqy-studio/normalize.ts`: deterministic resize/crop/pad pipeline
  so final assets always match Souqna surfaces exactly.

Generation action shape should include `{ template, prompt, references,
contract }`. References should be uploaded to Blob first, then forwarded to the
provider as image inputs. Store reference metadata and generated output metadata
together so later edits can preserve product/logo consistency.

Keep environment keys in `src/lib/env.ts` and `.env.local.example`, for example
`RECRAFT_API_KEY`, `IDEOGRAM_API_KEY`, or provider-specific settings once the
backend choice is final.

## Guardrails

- Never overwrite existing storefront logo/theme automatically. Save generated
  assets first; applying them should be a deliberate action.
- Store prompts and model metadata for auditability, but do not log uploaded
  product images, customer data, or full request bodies.
- Arabic/RTL must be first-class: poster prompt builders should explicitly
  include Arabic text direction and layout requirements when locale is `ar`.
- Avoid using non-commercial open weights in production unless a commercial
  license is in place.

## Source Notes

- Recraft V3 SVG: https://replicate.com/recraft-ai/recraft-v3-svg
- Ideogram API: https://developer.ideogram.ai/
- Black Forest Labs FLUX docs: https://docs.bfl.ml/kontext/kontext_overview
- OpenAI image generation docs: https://platform.openai.com/docs/guides/image-generation
- Qwen Image Edit 2511: https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- Shakker Labs logo LoRA: https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-Logo-Design
