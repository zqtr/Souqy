import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { direction } from '@/i18n/locales';
import { fontVariables } from '@/lib/fonts';
import { assertStorefrontOwner, getAllProducts } from '@/lib/products';
import { getKit } from '@/lib/apps/lookbook';

export const dynamic = 'force-dynamic';

/**
 * Print-perfect HTML rendering of a single lookbook kit.
 *
 * v1 deliberately avoids any server-side PDF dependency (puppeteer,
 * @react-pdf/renderer): the founder hits this URL, then uses their
 * browser's "Save as PDF…" to export. The page-break CSS is tuned so
 * each product spread breaks cleanly.
 *
 * The route lives under /account/apps/lookbook (NOT inside the
 * marketplace chrome) so the printable HTML doesn't carry the
 * dashboard's nav / footer / sidebar into the PDF.
 */
export default async function LookbookRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; kit?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const sp = await searchParams;
  const slug = sp.store ?? '';
  const kitId = sp.kit ?? '';
  if (!slug || !kitId) notFound();

  const owner = await assertStorefrontOwner(slug, userId);
  if (!owner) notFound();
  const kit = await getKit(slug, kitId);
  if (!kit) notFound();

  const allProducts = await getAllProducts(slug);
  const productMap = new Map(allProducts.map((p) => [p.id, p]));
  const products = kit.productIds
    .map((id) => productMap.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const titleEn = kit.title.en || kit.title.ar || owner.businessName;
  const titleAr = kit.title.ar;
  const introEn = kit.intro.en;
  const introAr = kit.intro.ar;
  const accent = kit.accentVar ?? '--admin-accent';

  return (
    <html lang={owner.locale} dir={direction[owner.locale]} className={fontVariables}>
      <head>
        <title>{kit.fileSlug}</title>
        <style>{`
          @page { size: A4; margin: 18mm 16mm; }
          html, body { background: #fdfbf6; color: #1f1b16; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: var(--font-exo-2), ui-sans-serif, system-ui, sans-serif; font-size: 13pt; line-height: 1.55; }
          html[dir='rtl'] body { font-family: var(--font-thmanyah-serif-display), ui-serif, Georgia, serif; font-weight: 700; }
          h1, h2, h3 { font-weight: 500; letter-spacing: 0; }
          html[dir='rtl'] h1, html[dir='rtl'] h2, html[dir='rtl'] h3 { font-family: var(--font-thmanyah-serif-display), ui-serif, Georgia, serif; font-weight: 700; }
          .eyebrow { font-family: var(--font-jetbrains-mono), var(--font-exo-2), ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9pt; letter-spacing: 0.18em; text-transform: uppercase; color: var(--lb-accent, #a8893f); margin-bottom: 12pt; }
          .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 90vh; text-align: center; padding: 0 32pt; }
          .cover h1 { font-size: 42pt; line-height: 1.1; margin: 0; }
          .cover h1 + h1 { font-size: 24pt; opacity: 0.7; margin-top: 14pt; direction: rtl; }
          .cover img { max-width: 70%; max-height: 60vh; object-fit: contain; margin-bottom: 28pt; }
          .intro { padding: 32pt 16pt; max-width: 540pt; margin: 0 auto; }
          .intro h2 { font-size: 22pt; margin: 0 0 14pt; }
          .intro p { margin: 0 0 14pt; }
          .intro p.ar { direction: rtl; font-size: 12pt; opacity: 0.85; }
          .product { page-break-before: always; padding-top: 24pt; }
          .product .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; align-items: start; }
          .product img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 4pt; }
          .product .meta { display: flex; flex-direction: column; gap: 12pt; }
          .product h3 { font-size: 22pt; margin: 0; }
          .product .price { font-family: 'JetBrains Mono', monospace; font-size: 11pt; color: #a8893f; }
          .product .desc { font-size: 11pt; line-height: 1.55; }
          .contact { page-break-before: always; padding-top: 32pt; text-align: center; }
          .contact .field { margin: 6pt 0; font-size: 12pt; }
          .footer-rule { width: 80pt; height: 1pt; background: #a8893f; margin: 24pt auto; }
          .empty { font-style: italic; opacity: 0.6; }
        `}</style>
      </head>
      <body style={{ ['--lb-accent' as string]: `var(${accent}, #a8893f)` }}>
        <section className="cover">
          {kit.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.coverImageUrl} alt="" />
          ) : null}
          <div className="eyebrow">◈ {owner.businessName}</div>
          <h1>{titleEn}</h1>
          {titleAr ? <h1>{titleAr}</h1> : null}
        </section>

        {introEn || introAr ? (
          <section className="intro">
            <div className="eyebrow">◈ {owner.locale === 'ar' ? 'مقدمة' : 'Introduction'}</div>
            {introEn ? <p>{introEn}</p> : null}
            {introAr ? <p className="ar">{introAr}</p> : null}
          </section>
        ) : null}

        {products.length === 0 ? (
          <section className="intro">
            <p className="empty">No products in this kit yet. Add some from Settings.</p>
          </section>
        ) : null}

        {products.map((p, i) => (
          <section className="product" key={p.id}>
            <div className="eyebrow">◈ {String(i + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</div>
            <div className="grid">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} />
              ) : (
                <div style={{ aspectRatio: '4 / 5', background: '#eee5d4', borderRadius: 4 }} />
              )}
              <div className="meta">
                <h3>{p.title}</h3>
                {p.priceQar !== null ? (
                  <div className="price">{p.priceQar.toFixed(2)} QAR</div>
                ) : null}
                {p.description ? <p className="desc">{p.description}</p> : null}
                {p.category ? <div className="eyebrow" style={{ marginBottom: 0 }}>{p.category}</div> : null}
              </div>
            </div>
          </section>
        ))}

        {kit.pressContact.name || kit.pressContact.email || kit.pressContact.phone ? (
          <section className="contact">
            <div className="footer-rule" />
            <div className="eyebrow">◈ {owner.locale === 'ar' ? 'للتواصل الصحفي' : 'Press contact'}</div>
            {kit.pressContact.name ? <div className="field">{kit.pressContact.name}</div> : null}
            {kit.pressContact.email ? <div className="field">{kit.pressContact.email}</div> : null}
            {kit.pressContact.phone ? <div className="field">{kit.pressContact.phone}</div> : null}
            <div className="footer-rule" />
            <div className="eyebrow">◈ {owner.businessName} · made with Souqna</div>
          </section>
        ) : null}
      </body>
    </html>
  );
}
