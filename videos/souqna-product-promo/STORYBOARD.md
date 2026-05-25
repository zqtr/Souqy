# Storyboard

**Format:** 1920x1080
**Audio:** TTS voiceover, warm minimal electronic underscore implied by motion
**VO direction:** calm founder-to-founder delivery, measured and practical, with short pauses between claims
**Style basis:** DESIGN.md, captured Souqna page, app logo marquee, and scroll screenshots

## Asset Audit

| Asset | Type | Assign to Beat | Role |
| --- | --- | --- | --- |
| `capture/screenshots/scroll-000.png` | Hero screenshot | Beat 1 | Halftone hero and brand promise |
| `capture/screenshots/scroll-014.png` | Section screenshot | Beat 2 | App logo marquee and onboarding grid |
| `capture/screenshots/scroll-028.png` | Section screenshot | Beat 3 | Dark process ledger |
| `capture/screenshots/scroll-056.png` | Section screenshot | Beat 4 | Unified workspace proof |
| `capture/screenshots/scroll-084.png` | Section screenshot | Beat 5 | Pricing table and plan CTA |
| `capture/assets/svgs/max-w-min100200px.svg` | Brand lockup | Beats 1 and 5 | Souqna logo signal |
| `capture/assets/svgs/logo-5.svg` to `logo-29.svg` | App/payment logos | Beats 1-3 | Marketplace ecosystem chips |

## BEAT 1 - HOOK (0.00-3.80s)

**VO cue:** "Home businesses don't need another pile of tools."

**Concept:** The video opens inside the website's own halftone hero, already moving, as if the surface is waking up. The brand lockup and app chips drift across the frame while the line rejects tool sprawl.

**Visual description:** Dark halftone field fills the frame. A large cream headline "Not another pile of tools." enters in two weights, with "tools" italicized by motion rather than styling. Souqna's logo sits in a pale capsule. App chips orbit along the lower third in two rows, echoing the captured marquee.

**Animation choreography:** Halftone field slowly pushes in. Logo capsule drops and settles. Headline rises word by word. App chips glide horizontally with alternating speeds. A cream wipe prepares the next beat.

**Transition:** Cream vertical wipe upward into the onboarding grid.

## BEAT 2 - ONE PLACE (3.80-8.00s)

**VO cue:** "They need one calm place to open a store, write the pages, take orders, and answer customers in Arabic and English."

**Concept:** The cream grid becomes a working table. The four operating needs appear as calm rows, and Arabic/English snippets balance the frame.

**Visual description:** Cream background with thin grid lines. Four rows appear: Open, Write, Orders, Customers. A captured onboarding screenshot floats at an angle on the right with a subtle crop. Arabic text runs as a quiet companion line.

**Animation choreography:** Grid draws on. Rows cascade in with dividers. Screenshot panel tilts in and slowly pans. Arabic line types on. A charcoal block slides in to carry the viewer into the process beat.

**Transition:** Charcoal slide from bottom, velocity matched.

## BEAT 3 - BUILT AROUND YOU (8.00-13.20s)

**VO cue:** "Souqna starts with four small questions, then builds the storefront, the back office, and the AI assistant around your voice."

**Concept:** Four questions become a system. The process ledger unfolds into three connected work surfaces: storefront, back office, AI.

**Visual description:** Charcoal canvas with cream ledger rows. The words Open, Write, Operate, Improve appear in sequence. Three large outlined panels connect with thin animated paths: Storefront, Back Office, AI Assistant. App icons pulse around the network.

**Animation choreography:** Roman numerals stamp in. Ledger rows sweep left to right. Connector paths draw with SVG strokes. Three panels count up from one to three. Icons float in slow parallax.

**Transition:** Blur-through into pricing/CTA.

## BEAT 4 - START TODAY (13.20-20.00s)

**VO cue:** "Start free for two weeks. Open your store today."

**Concept:** The product resolves into the final offer. The pricing highlight and footer wordmark become a confident end card.

**Visual description:** Cream pricing surface slides into view with Free, Pro QR 49, Pro+ QR 145, and Max+ QR 235. The Pro+ charcoal panel expands behind the CTA. Final frame returns to dark charcoal with the Souqna lockup, "Open your store today.", and a cream button reading "Start free for two weeks".

**Animation choreography:** Pricing columns fan into place. Pro+ column glows quietly. CTA button fills from left to right. Souqna wordmark outlines sweep behind the final title. Final elements hold long enough to read.

**Transition:** Final fade to charcoal only.

## Production Architecture

```
souqna-product-promo/
├── index.html
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md
├── narration.txt
├── narration.wav
├── transcript.json
├── capture/
└── snapshots/
```
