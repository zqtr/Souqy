# Template preview thumbnails

Drop a 1280×800 webp preview here per template id, named exactly:

```
public/templates/<id>/preview.webp
```

Template ids are defined in [`src/lib/brief.ts`](../../src/lib/brief.ts) as `TEMPLATE_IDS` (picker order):

`atrium`, `souqline`, `kiosk`, `lounge`, `studio`, `bazaar`, `vitrine`, `monoline`, `harvest`, `launchpad`, `frame`

Path metadata lives in [`src/lib/templates.ts`](../../src/lib/templates.ts) under `templatePresets[id].previewImage`.

If a thumbnail is missing the `/begin` picker (and the Site inspector)
gracefully renders a CSS-only gradient swatch derived from the
template's palette — so it is safe to ship a new template before its
preview asset is ready.

For Souqna-native template previews, keep the capture close to the homepage
system: cream `#E8DCC4`, charcoal `#2A2A2A`, black `#0A0A0A`, quiet borders,
Exo 2 English text, Thmanyah Arabic headings, and monochrome brand marks.
Avoid orange, purple, blue SaaS gradients, or glossy mockup styling in preview
art.

The legacy `salon/plate-*.svg` files in this folder are pre-rebuild
boutique placeholder plates. They are not referenced by the current
seed code; safe to delete once no published storefront still points at
them.
