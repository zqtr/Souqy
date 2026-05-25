// Dev-only mock product seeder. Populates every storefront in `briefs`
// with a small, business-type-appropriate catalogue + categories so the
// builder, template browser, and storefront chrome all have something
// real to render.
//
// Usage:
//   node scripts/seed-mock-products.mjs                # seed every storefront
//   node scripts/seed-mock-products.mjs --slug=souqy   # one storefront
//   node scripts/seed-mock-products.mjs --force        # re-seed even if products exist
//
// Idempotent by default: skips storefronts that already have >= 5
// products. Categories use ON CONFLICT DO NOTHING so re-runs are safe.

import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

try {
  const env = await readFile('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local optional
}

const url = (process.env.DATABASE_URL ?? '').trim();
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const argv = process.argv.slice(2);
const slugArg = argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length) ?? null;
const force = argv.includes('--force');

const sql = neon(url);

// ----- Mock catalogues per business_type ----------------------------------

const PICSUM = (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/640`;

/**
 * Each entry returns:
 *   { categories: [{name,slug,description}], products: [{title,description,price,categorySlug,status?}] }
 * Prices are whole QAR.
 */
const CATALOG = {
  perfume_oud: {
    categories: [
      { name: 'Oud', slug: 'oud', description: 'Aged oud chips & oils.' },
      { name: 'Attar', slug: 'attar', description: 'Concentrated attars.' },
      { name: 'Mukhamariya', slug: 'mukhamariya', description: 'Bakhoor blends.' },
      { name: 'Eau de Parfum', slug: 'edp', description: 'Modern compositions.' },
    ],
    products: [
      { title: 'Royal Cambodi Oud · 3g', description: 'Aged Cambodi chips, sweet & resinous.', price: 480, cat: 'oud' },
      { title: 'Hindi Maroke Oud · 3g', description: 'Bold barnyard Hindi profile.', price: 540, cat: 'oud' },
      { title: 'Burmese Sinking Oud · 1.5g', description: 'Rare sinking-grade chips.', price: 1200, cat: 'oud' },
      { title: 'Attar Mukhalat Sharqi · 6ml', description: 'Smooth oriental mukhalat.', price: 220, cat: 'attar' },
      { title: 'Attar Rose Taifi · 6ml', description: 'Pure Taif rose absolute.', price: 320, cat: 'attar' },
      { title: 'Bakhoor Maliki · 40g', description: 'Classic palace bakhoor.', price: 95, cat: 'mukhamariya' },
      { title: 'Bakhoor Al Layl · 40g', description: 'Smoky night bakhoor with amber.', price: 110, cat: 'mukhamariya' },
      { title: 'Najdi EDP · 50ml', description: 'Saffron, rose, oud, sandalwood.', price: 380, cat: 'edp' },
      { title: 'Doha Nights EDP · 50ml', description: 'Modern oriental for late evenings.', price: 420, cat: 'edp', status: 'sold_out' },
      { title: 'Hijazi Musk · 30ml', description: 'Pure white musk roll-on.', price: 180, cat: 'attar' },
    ],
  },
  fnb_brand: {
    categories: [
      { name: 'Matcha', slug: 'matcha', description: 'Ceremonial & culinary grades.' },
      { name: 'Tools', slug: 'tools', description: 'Bamboo whisks, scoops, sifters.' },
      { name: 'Sweets', slug: 'sweets', description: 'Matcha-infused treats.' },
    ],
    products: [
      { title: 'Ceremonial Matcha · 30g', description: 'Stone-milled Uji ceremonial matcha.', price: 145, cat: 'matcha' },
      { title: 'Daily Matcha · 100g', description: 'Vibrant culinary grade for lattes.', price: 95, cat: 'matcha' },
      { title: 'Hojicha · 80g', description: 'Roasted green tea, low caffeine.', price: 65, cat: 'matcha' },
      { title: 'Bamboo Whisk (Chasen)', description: 'Hand-cut 80-prong chasen.', price: 80, cat: 'tools' },
      { title: 'Bamboo Scoop (Chashaku)', description: 'Single-piece bamboo scoop.', price: 25, cat: 'tools' },
      { title: 'Ceramic Matcha Bowl (Chawan)', description: 'Hand-glazed deep blue chawan.', price: 110, cat: 'tools' },
      { title: 'Matcha Cookies · Pack of 6', description: 'White-chocolate matcha sablés.', price: 45, cat: 'sweets' },
      { title: 'Matcha Mochi · Pack of 8', description: 'Soft mochi with matcha cream.', price: 55, cat: 'sweets', status: 'draft' },
    ],
  },
  ecommerce: {
    categories: [
      { name: 'New Arrivals', slug: 'new', description: 'Fresh drops this week.' },
      { name: 'Best Sellers', slug: 'best-sellers', description: 'What everyone is buying.' },
      { name: 'Accessories', slug: 'accessories', description: 'Finishing touches.' },
      { name: 'Sale', slug: 'sale', description: 'Limited price drops.' },
    ],
    products: [
      { title: 'Linen Tote · Sand', description: 'Heavy linen tote, leather handles.', price: 165, cat: 'new' },
      { title: 'Ceramic Mug Set · 2', description: 'Hand-thrown stoneware, matte.', price: 90, cat: 'new' },
      { title: 'Brass Letter Opener', description: 'Solid brass, weighty in hand.', price: 75, cat: 'accessories' },
      { title: 'Leather Card Holder', description: 'Vegetable-tanned, four slots.', price: 120, cat: 'accessories' },
      { title: 'Wool Throw · Olive', description: 'Soft merino-wool throw.', price: 240, cat: 'best-sellers' },
      { title: 'Linen Apron', description: 'Cross-back kitchen apron.', price: 145, cat: 'best-sellers' },
      { title: 'Brass Candle Holder', description: 'Three-arm tabletop holder.', price: 95, cat: 'sale' },
      { title: 'Sale · Cotton Throw', description: 'Last-season throw, 30% off.', price: 110, cat: 'sale' },
      { title: 'Walnut Tray', description: 'Hand-oiled walnut serving tray.', price: 185, cat: 'best-sellers', status: 'sold_out' },
    ],
  },
  art_gallery: {
    categories: [
      { name: 'Paintings', slug: 'paintings', description: 'Original works on canvas & paper.' },
      { name: 'Prints', slug: 'prints', description: 'Limited-edition giclée prints.' },
      { name: 'Sculpture', slug: 'sculpture', description: 'Small-format sculpture.' },
    ],
    products: [
      { title: 'Untitled · Oil on Canvas', description: '90×120cm. 2025.', price: 4200, cat: 'paintings' },
      { title: 'Coastline IV · Acrylic', description: '60×80cm. 2024.', price: 2400, cat: 'paintings' },
      { title: 'Reverie · Print Edition of 25', description: 'Giclée on cotton rag, signed.', price: 380, cat: 'prints' },
      { title: 'Studies I-III · Print Set', description: 'Three giclée studies, framed.', price: 540, cat: 'prints' },
      { title: 'Cast Bronze · Form #2', description: 'Lost-wax bronze, 18cm tall.', price: 1800, cat: 'sculpture' },
      { title: 'Marble Fragment · Series A', description: 'Hand-carved Carrara marble.', price: 2600, cat: 'sculpture', status: 'sold_out' },
    ],
  },
  salon: {
    categories: [
      { name: 'Hair', slug: 'hair', description: 'Cuts, color, treatments.' },
      { name: 'Skin', slug: 'skin', description: 'Facials & skincare rituals.' },
      { name: 'Nails', slug: 'nails', description: 'Manicure & pedicure services.' },
      { name: 'Bridal', slug: 'bridal', description: 'Bridal packages & trials.' },
    ],
    products: [
      { title: 'Signature Cut & Style', description: '60-minute consultation, cut, blow-out.', price: 220, cat: 'hair' },
      { title: 'Full Color & Gloss', description: 'Custom color with shine treatment.', price: 480, cat: 'hair' },
      { title: 'Keratin Treatment', description: '90-minute smoothing treatment.', price: 850, cat: 'hair' },
      { title: 'Glow Facial', description: '60-minute brightening facial.', price: 320, cat: 'skin' },
      { title: 'Hydrating Ritual', description: '90-minute deep hydration.', price: 420, cat: 'skin' },
      { title: 'Classic Manicure', description: 'File, shape, polish.', price: 95, cat: 'nails' },
      { title: 'Gel Pedicure', description: 'Spa pedicure with gel finish.', price: 145, cat: 'nails' },
      { title: 'Bridal Trial Package', description: 'Hair + makeup trial, 2 hours.', price: 650, cat: 'bridal' },
    ],
  },
  clothing_store: {
    categories: [
      { name: 'Tops', slug: 'tops', description: 'Shirts, knits, blouses.' },
      { name: 'Bottoms', slug: 'bottoms', description: 'Trousers, skirts, denim.' },
      { name: 'Outerwear', slug: 'outerwear', description: 'Jackets & coats.' },
      { name: 'Accessories', slug: 'accessories', description: 'Bags, belts, scarves.' },
    ],
    products: [
      { title: 'Linen Shirt · Bone', description: 'Relaxed cut, mother-of-pearl buttons.', price: 320, cat: 'tops' },
      { title: 'Merino Crewneck · Charcoal', description: 'Fine-gauge merino sweater.', price: 480, cat: 'tops' },
      { title: 'Wide-Leg Trousers · Stone', description: 'Heavy linen, side-pocket detail.', price: 380, cat: 'bottoms' },
      { title: 'Pleated Midi Skirt', description: 'Sunray pleats, A-line silhouette.', price: 290, cat: 'bottoms' },
      { title: 'Wool Overcoat · Camel', description: 'Italian wool, double-breasted.', price: 1450, cat: 'outerwear' },
      { title: 'Quilted Liner Jacket', description: 'Lightweight diamond-quilt jacket.', price: 620, cat: 'outerwear' },
      { title: 'Leather Belt · Chestnut', description: 'Vegetable-tanned, brass buckle.', price: 220, cat: 'accessories' },
      { title: 'Silk Scarf · Hand-rolled', description: '90×90cm twill, hand-rolled hems.', price: 280, cat: 'accessories' },
    ],
  },
  photography: {
    categories: [
      { name: 'Portrait', slug: 'portrait', description: 'Studio + on-location portraits.' },
      { name: 'Wedding', slug: 'wedding', description: 'Half-day + full-day coverage.' },
      { name: 'Editorial', slug: 'editorial', description: 'Brand & editorial sessions.' },
      { name: 'Prints', slug: 'prints', description: 'Archival fine-art prints.' },
    ],
    products: [
      { title: 'Portrait Session · 1hr', description: 'Studio session + 8 retouched files.', price: 650, cat: 'portrait' },
      { title: 'Family Portrait · 2hr', description: 'On-location family session.', price: 1200, cat: 'portrait' },
      { title: 'Wedding · Half Day', description: '5 hours coverage + gallery.', price: 4800, cat: 'wedding' },
      { title: 'Wedding · Full Day', description: '10 hours, two photographers, album.', price: 9500, cat: 'wedding' },
      { title: 'Editorial Session · Half Day', description: 'Brand or magazine commission.', price: 2400, cat: 'editorial' },
      { title: 'A3 Archival Print', description: 'Hahnemühle photo rag, signed.', price: 220, cat: 'prints' },
      { title: 'A2 Archival Print', description: 'Hahnemühle photo rag, signed.', price: 380, cat: 'prints' },
    ],
  },
  graphic_design: {
    categories: [
      { name: 'Identity', slug: 'identity', description: 'Logos & brand systems.' },
      { name: 'Print', slug: 'print', description: 'Editorial & packaging.' },
      { name: 'Digital', slug: 'digital', description: 'Sites, decks, social.' },
    ],
    products: [
      { title: 'Logo Design · Starter', description: 'Wordmark + 2 revisions.', price: 1800, cat: 'identity' },
      { title: 'Brand Identity System', description: 'Logo, color, type, guidelines.', price: 5400, cat: 'identity' },
      { title: 'Editorial Layout · 16pp', description: 'Magazine or zine layout.', price: 2400, cat: 'print' },
      { title: 'Packaging Design · Single SKU', description: 'Front + back panels, dielines.', price: 1900, cat: 'print' },
      { title: 'Pitch Deck · 20 slides', description: 'Custom slide system + master.', price: 2800, cat: 'digital' },
      { title: 'Social Templates · Pack of 10', description: 'Editable Figma templates.', price: 950, cat: 'digital' },
    ],
  },
  auto_detailing: {
    categories: [
      { name: 'Exterior', slug: 'exterior', description: 'Wash & paint care.' },
      { name: 'Interior', slug: 'interior', description: 'Deep clean & protection.' },
      { name: 'Protection', slug: 'protection', description: 'Coatings & PPF.' },
    ],
    products: [
      { title: 'Express Wash', description: 'Hand wash, wheels, dry.', price: 75, cat: 'exterior' },
      { title: 'Full Detail · Exterior', description: 'Decontamination + machine polish.', price: 480, cat: 'exterior' },
      { title: 'Interior Deep Clean', description: 'Steam + leather conditioning.', price: 380, cat: 'interior' },
      { title: 'Pet-hair Removal Add-on', description: 'Targeted seat & carpet treatment.', price: 95, cat: 'interior' },
      { title: '2-Year Ceramic Coating', description: 'Single-stage prep + coating.', price: 1850, cat: 'protection' },
      { title: '5-Year Ceramic Coating', description: 'Two-stage paint correction + coating.', price: 3400, cat: 'protection' },
      { title: 'Paint Protection Film · Front', description: 'PPF on front bumper, hood, fenders.', price: 4800, cat: 'protection' },
    ],
  },
  real_estate: {
    categories: [
      { name: 'For Sale', slug: 'for-sale', description: 'Currently listed for sale.' },
      { name: 'For Rent', slug: 'for-rent', description: 'Available rentals.' },
      { name: 'Off-plan', slug: 'off-plan', description: 'New developments.' },
    ],
    products: [
      { title: '2BR Apartment · Lusail Marina', description: 'Sea-view 2BR, fully furnished.', price: 1850000, cat: 'for-sale' },
      { title: 'Townhouse · The Pearl', description: '3BR townhouse, private garage.', price: 4200000, cat: 'for-sale' },
      { title: 'Studio · West Bay (Monthly)', description: 'Furnished studio with city view.', price: 6500, cat: 'for-rent' },
      { title: '3BR Villa · Al Waab (Monthly)', description: 'Private villa, garden, pool.', price: 18000, cat: 'for-rent' },
      { title: 'Off-plan Apartment · Msheireb', description: '1BR launch units, Q4 handover.', price: 1450000, cat: 'off-plan' },
    ],
  },
  events_weddings: {
    categories: [
      { name: 'Packages', slug: 'packages', description: 'Curated event packages.' },
      { name: 'Florals', slug: 'florals', description: 'Floral installations.' },
      { name: 'Stationery', slug: 'stationery', description: 'Invites & signage.' },
    ],
    products: [
      { title: 'Petite Wedding Package', description: 'Up to 50 guests, half-day setup.', price: 18000, cat: 'packages' },
      { title: 'Signature Wedding Package', description: 'Full design, planning, day-of.', price: 65000, cat: 'packages' },
      { title: 'Aisle & Arch Florals', description: 'Lush floral arch + aisle markers.', price: 8500, cat: 'florals' },
      { title: 'Tablescape Centrepieces · Set of 10', description: 'Seasonal centrepieces.', price: 4200, cat: 'florals' },
      { title: 'Letterpress Invitations · 100', description: 'Cotton stock, 2-color letterpress.', price: 2800, cat: 'stationery' },
      { title: 'Hand-painted Signage', description: 'Welcome + seating chart.', price: 1500, cat: 'stationery' },
    ],
  },
  courier_delivery: {
    categories: [
      { name: 'Same-day', slug: 'same-day', description: 'Within Doha, same-day.' },
      { name: 'Scheduled', slug: 'scheduled', description: 'Pick a window.' },
      { name: 'Subscriptions', slug: 'subscriptions', description: 'Recurring runs.' },
    ],
    products: [
      { title: 'Documents · Same-day', description: 'Doha-wide, within 3 hours.', price: 35, cat: 'same-day' },
      { title: 'Small Parcel · Same-day', description: 'Up to 5kg, Doha-wide.', price: 55, cat: 'same-day' },
      { title: 'Scheduled Pickup · 4hr Window', description: 'Pick a 4-hour pickup window.', price: 45, cat: 'scheduled' },
      { title: 'Bulky Item · Booked', description: 'Pre-arranged bulky pickup.', price: 95, cat: 'scheduled' },
      { title: 'Daily Run · Monthly Sub', description: 'One run per weekday, billed monthly.', price: 1200, cat: 'subscriptions' },
    ],
  },
  tailoring_abaya: {
    categories: [
      { name: 'Abaya', slug: 'abaya', description: 'Bespoke abayas.' },
      { name: 'Jalabiya', slug: 'jalabiya', description: 'Traditional & modern jalabiyat.' },
      { name: 'Alterations', slug: 'alterations', description: 'Tailoring services.' },
    ],
    products: [
      { title: 'Classic Black Abaya · Bespoke', description: 'Hand-stitched, three fittings.', price: 950, cat: 'abaya' },
      { title: 'Embroidered Abaya · Bespoke', description: 'Tone-on-tone embroidery.', price: 1650, cat: 'abaya' },
      { title: 'Pearl-trim Open Abaya', description: 'Crepe with pearl trim.', price: 1200, cat: 'abaya' },
      { title: 'Festive Jalabiya', description: 'Bespoke jalabiya for occasions.', price: 1450, cat: 'jalabiya' },
      { title: 'Everyday Jalabiya', description: 'Soft cotton everyday cut.', price: 480, cat: 'jalabiya' },
      { title: 'Hem Adjustment', description: 'Per garment.', price: 45, cat: 'alterations' },
      { title: 'Full Re-fit', description: 'Bust, waist, hip refit.', price: 180, cat: 'alterations' },
    ],
  },
};

// Generic fallback for any business_type not explicitly mapped above.
const FALLBACK = {
  categories: [
    { name: 'Featured', slug: 'featured', description: 'Hand-picked highlights.' },
    { name: 'New', slug: 'new', description: 'Recently added.' },
    { name: 'Essentials', slug: 'essentials', description: 'Core lineup.' },
  ],
  products: [
    { title: 'Signature Item · Small', description: 'Our most popular signature.', price: 120, cat: 'featured' },
    { title: 'Signature Item · Large', description: 'Bigger format of the favourite.', price: 220, cat: 'featured' },
    { title: 'New Release · Edition One', description: 'Just landed this season.', price: 180, cat: 'new' },
    { title: 'New Release · Edition Two', description: 'Quiet companion piece.', price: 165, cat: 'new' },
    { title: 'Everyday Essential', description: 'Stocked year-round.', price: 95, cat: 'essentials' },
    { title: 'Everyday Essential · Pro', description: 'Larger, longer-lasting.', price: 145, cat: 'essentials' },
    { title: 'Limited Run', description: 'Numbered, limited release.', price: 280, cat: 'featured', status: 'sold_out' },
  ],
};

// ----- Seeding logic ------------------------------------------------------

async function loadStorefronts() {
  if (slugArg) {
    const rows = await sql`select slug, business_type from briefs where slug = ${slugArg}`;
    return rows;
  }
  return await sql`select slug, business_type from briefs`;
}

async function productCount(slug) {
  const rows = await sql`select count(*)::int as n from products where storefront_slug = ${slug}`;
  return rows[0]?.n ?? 0;
}

async function ensureCategories(slug, defs) {
  const map = new Map(); // slug -> id
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const inserted = await sql`
      insert into categories (storefront_slug, name, slug, description, position)
      values (${slug}, ${d.name}, ${d.slug}, ${d.description ?? null}, ${i})
      on conflict (storefront_slug, slug) do update
        set name = excluded.name,
            description = coalesce(categories.description, excluded.description)
      returning id, slug
    `;
    map.set(inserted[0].slug, inserted[0].id);
  }
  return map;
}

async function seedStorefront(row) {
  const { slug, business_type } = row;
  const cat = CATALOG[business_type] ?? FALLBACK;

  if (!force) {
    const n = await productCount(slug);
    if (n >= 5) {
      console.log(`  ${slug.padEnd(16)} skip (already has ${n} products; pass --force to re-seed)`);
      return;
    }
  }

  const categoryMap = await ensureCategories(slug, cat.categories);

  let added = 0;
  for (let i = 0; i < cat.products.length; i++) {
    const p = cat.products[i];
    const categoryId = categoryMap.get(p.cat);
    const categoryName = cat.categories.find((c) => c.slug === p.cat)?.name ?? null;
    const status = p.status ?? 'active';
    const imageUrl = PICSUM(`${slug}-${i}`);

    const inserted = await sql`
      insert into products
        (storefront_slug, title, description, price_qar, image_url, category, status, position)
      values
        (${slug}, ${p.title}, ${p.description ?? null}, ${p.price}, ${imageUrl},
         ${categoryName}, ${status}, ${i})
      returning id
    `;
    const productId = inserted[0].id;

    if (categoryId) {
      await sql`
        insert into product_categories (product_id, category_id)
        values (${productId}, ${categoryId})
        on conflict do nothing
      `;
    }
    added++;
  }
  console.log(`  ${slug.padEnd(16)} ok  (${cat.categories.length} categories, ${added} products, type=${business_type})`);
}

const stores = await loadStorefronts();
if (stores.length === 0) {
  console.error(slugArg ? `No storefront found with slug=${slugArg}` : 'No storefronts in briefs.');
  process.exit(1);
}

console.log(`Seeding mock products into ${stores.length} storefront(s)${force ? ' (force mode)' : ''}…`);
for (const row of stores) {
  try {
    await seedStorefront(row);
  } catch (err) {
    console.error(`  ${row.slug.padEnd(16)} FAILED`);
    console.error(err);
  }
}
console.log('Done.');
