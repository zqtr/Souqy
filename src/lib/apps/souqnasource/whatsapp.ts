type Listing = { id: string; title: string };
type Supplier = { id: string; whatsapp: string | null };

export function buildQuoteRequestUrl(opts: {
  listing: Listing;
  supplier: Supplier;
  storefront: { name: string; locale: 'en' | 'ar' };
}): { url: string; prefilledMessage: string } {
  const { listing, supplier, storefront } = opts;
  if (!supplier.whatsapp) throw new Error('supplier_no_whatsapp');

  const claimEn = `\n— via SouqnaSource\nReply on Souqna: souqna.qa/s/${supplier.id}`;
  const claimAr = `\n— عبر SouqnaSource\nرد على Souqna: souqna.qa/s/${supplier.id}`;

  const message =
    storefront.locale === 'ar'
      ? `السلام عليكم،\nشفت إعلانكم على Souqna: «${listing.title}»\nأبي أعرف السعر والكمية اللي تقدرون توفرونها.\nمتجري: ${storefront.name}${claimAr}`
      : `Hello,\nI saw your listing on Souqna: "${listing.title}".\nCould you share pricing and minimum order quantity?\nMy store: ${storefront.name}${claimEn}`;

  const url = `https://wa.me/${supplier.whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
  return { url, prefilledMessage: message };
}
