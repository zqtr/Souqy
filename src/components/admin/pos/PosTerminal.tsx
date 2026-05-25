'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chargeCashSale, resetRegister } from '@/app/actions/pos';
import type { PosRegister } from '@/lib/pos';
import { CheckGlyph, ChevronRight, SettingsGlyph } from '../glyphs';

type ProductLite = {
  id: string;
  title: string;
  priceQar: number | null;
  imageUrl: string | null;
  category: string | null;
  status: 'active' | 'sold_out' | 'draft';
};

type LineItem = {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
};

type Props = {
  storefrontSlug: string;
  businessName: string;
  register: PosRegister;
  products: ProductLite[];
};

/**
 * The POS terminal — three-pane layout:
 *
 *   [ Categories ▾ ] [ Product grid (3-4 cols) ] [ Cart sidebar ]
 *
 * Tapping a product adds it to the cart. The cart side shows a live
 * subtotal and a cash-tendered input that calculates change due as
 * the founder enters bills. "Charge cash" closes the sale via
 * `chargeCashSale`, surfaces a receipt panel, and clears the cart.
 *
 * Designed touch-first: 56px tap targets, no hover dependencies, the
 * grid wraps gracefully on tablets.
 */
export function PosTerminal({
  storefrontSlug,
  businessName,
  register,
  products,
}: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<LineItem[]>([]);
  const [cashTendered, setCashTendered] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const [receipt, setReceipt] = useState<{
    orderNumber: number;
    total: number;
    cashTendered: number;
    change: number;
    items: LineItem[];
    at: Date;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.priceQar === null) return false;
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCategory, search]);

  const subtotal = cart.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((acc, l) => acc + l.quantity, 0);
  const tendered = Number(cashTendered) || 0;
  const change = Math.max(tendered - subtotal, 0);
  const canCharge = cart.length > 0 && tendered + 0.0001 >= subtotal;

  function addToCart(p: ProductLite) {
    if (p.priceQar === null) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + 1 };
        return next;
      }
      return [
        ...prev,
        { productId: p.id, title: p.title, unitPrice: p.priceQar!, quantity: 1 },
      ];
    });
    setError(null);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setCashTendered('');
    setError(null);
  }

  function charge() {
    if (!canCharge) return;
    startTransition(async () => {
      const result = await chargeCashSale({
        storefrontSlug,
        items: cart.map((l) => ({
          productId: l.productId,
          productTitle: l.title,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
        cashTendered: tendered,
      });
      if (result.status === 'success') {
        setReceipt({
          orderNumber: result.orderNumber!,
          total: subtotal,
          cashTendered: tendered,
          change,
          items: cart,
          at: new Date(),
        });
        setCart([]);
        setCashTendered('');
        router.refresh();
      } else if (result.status === 'error') {
        setError(result.message);
      }
    });
  }

  function resetTerminal() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Reset the register? You will need to re-enter location, cash float, and PIN.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      await resetRegister({ storefrontSlug });
      router.refresh();
    });
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '20px 0 16px',
          marginBottom: 18,
          borderBottom: '1px solid var(--surface-rule)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)',
              marginBottom: 6,
            }}
          >
            ◈ Point of sale · {register.locationName}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontWeight: 400,
              fontSize: 'clamp(22px, 2.6vw, 28px)',
              color: 'var(--ink-strong)',
              letterSpacing: '-0.01em',
            }}
          >
            {businessName} register
          </h1>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-muted)',
          }}
        >
          <span>
            Float · {register.currencyCode}{' '}
            {register.cashFloat.toLocaleString('en-US')}
          </span>
          <button
            type="button"
            onClick={resetTerminal}
            disabled={pending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--surface-rule-strong)',
              color: 'var(--ink-strong)',
              fontSize: 12,
              cursor: pending ? 'default' : 'pointer',
            }}
          >
            <SettingsGlyph size={14} /> Reset register
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 18,
        }}
        className="souqna-pos-grid"
      >
        <section
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--surface-rule)',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 480,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              style={{
                flex: '1 1 220px',
                minWidth: 180,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--surface-rule-strong)',
                background: 'var(--surface-bg)',
                color: 'var(--ink-strong)',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                maxWidth: '100%',
              }}
            >
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 999,
                      background: active
                        ? 'color-mix(in srgb, var(--admin-accent) 18%, transparent)'
                        : 'transparent',
                      border: `1px solid ${
                        active ? 'var(--admin-accent)' : 'var(--surface-rule-strong)'
                      }`,
                      color: active ? 'var(--admin-accent)' : 'var(--ink-strong)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5,
                      letterSpacing: '0.04em',
                      textTransform: cat === 'all' ? 'uppercase' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--ink-muted)',
                fontSize: 14,
                maxWidth: 380,
              }}
            >
              No products match. Add some from the{' '}
              <a
                href={`/account/products?store=${encodeURIComponent(storefrontSlug)}`}
                style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}
              >
                Products tab
              </a>{' '}
              with prices set, then come back.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              {visible.map((p) => {
                const soldOut = p.status === 'sold_out';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !soldOut && addToCart(p)}
                    disabled={soldOut}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 6,
                      padding: 12,
                      borderRadius: 10,
                      background: soldOut
                        ? 'color-mix(in srgb, var(--ink-strong) 4%, transparent)'
                        : 'var(--surface-bg)',
                      border: '1px solid var(--surface-rule)',
                      color: 'var(--ink-strong)',
                      cursor: soldOut ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                      transition: 'border-color 140ms ease',
                      opacity: soldOut ? 0.55 : 1,
                      minHeight: 96,
                    }}
                    onMouseEnter={(e) => {
                      if (!soldOut)
                        e.currentTarget.style.borderColor =
                          'color-mix(in srgb, var(--admin-accent) 45%, transparent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--surface-rule)';
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        lineHeight: 1.25,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.title}
                    </span>
                    {p.category ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-muted)',
                        }}
                      >
                        {p.category}
                      </span>
                    ) : null}
                    <span style={{ flex: 1 }} aria-hidden />
                    <span
                      style={{
                        fontFamily: 'var(--font-serif, var(--font-sans))',
                        fontSize: 17,
                        fontWeight: 500,
                        color: soldOut
                          ? 'var(--ink-muted)'
                          : 'var(--admin-accent)',
                      }}
                    >
                      {soldOut
                        ? 'sold out'
                        : `${register.currencyCode} ${p.priceQar!.toLocaleString('en-US')}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside
          className="souqna-pos-cart"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--surface-rule)',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 480,
            position: 'sticky',
            top: 76,
            alignSelf: 'flex-start',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, var(--font-sans))',
                fontWeight: 400,
                fontSize: 18,
                color: 'var(--ink-strong)',
              }}
            >
              Cart
            </h2>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-muted)',
              }}
            >
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </header>

          {cart.length === 0 ? (
            <div
              style={{
                margin: 'auto 0',
                padding: '24px 8px',
                textAlign: 'center',
                color: 'var(--ink-muted)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              Tap a product on the left to start a sale.
            </div>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {cart.map((line) => (
                <li
                  key={line.productId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--surface-rule)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: 'var(--ink-strong)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {line.title}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--ink-muted)',
                        marginTop: 2,
                      }}
                    >
                      {register.currencyCode}{' '}
                      {line.unitPrice.toLocaleString('en-US')} ×{' '}
                      {line.quantity} ={' '}
                      {(line.unitPrice * line.quantity).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <QtyButton onClick={() => changeQty(line.productId, -1)}>
                      −
                    </QtyButton>
                    <span
                      style={{
                        minWidth: 22,
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        color: 'var(--ink-strong)',
                      }}
                    >
                      {line.quantity}
                    </span>
                    <QtyButton onClick={() => changeQty(line.productId, 1)}>
                      +
                    </QtyButton>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      aria-label="Remove line"
                      title="Remove line"
                      style={{
                        marginLeft: 4,
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        background: 'transparent',
                        border: '1px solid var(--surface-rule-strong)',
                        color: 'var(--ink-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div
            style={{
              borderTop: '1px solid var(--surface-rule)',
              paddingTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Row label="Subtotal" value={`${register.currencyCode} ${subtotal.toLocaleString('en-US')}`} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 4,
              }}
            >
              <label
                htmlFor="pos-cash-tendered"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-muted)',
                  alignSelf: 'center',
                }}
              >
                Cash tendered
              </label>
              <input
                id="pos-cash-tendered"
                type="number"
                inputMode="decimal"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder="0"
                disabled={cart.length === 0}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--surface-rule-strong)',
                  background: 'var(--surface-bg)',
                  color: 'var(--ink-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[50, 100, 200, 500, 1000].map((bill) => (
                <button
                  key={bill}
                  type="button"
                  onClick={() =>
                    setCashTendered(String((Number(cashTendered) || 0) + bill))
                  }
                  disabled={cart.length === 0}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid var(--surface-rule-strong)',
                    color: 'var(--ink-strong)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    cursor: cart.length === 0 ? 'default' : 'pointer',
                    opacity: cart.length === 0 ? 0.5 : 1,
                  }}
                >
                  +{bill}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashTendered(String(subtotal))}
                disabled={cart.length === 0 || subtotal === 0}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid var(--surface-rule-strong)',
                  color: 'var(--admin-accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: cart.length === 0 ? 'default' : 'pointer',
                  opacity: cart.length === 0 ? 0.5 : 1,
                }}
              >
                exact
              </button>
            </div>
            <Row
              label="Change"
              value={`${register.currencyCode} ${change.toLocaleString('en-US')}`}
              accent
            />
          </div>

          {error ? (
            <p
              role="alert"
              style={{
                margin: 0,
                color: '#a4521b',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                background: 'color-mix(in srgb, #a4521b 10%, transparent)',
                border: '1px solid color-mix(in srgb, #a4521b 35%, transparent)',
                padding: '8px 10px',
                borderRadius: 8,
              }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={charge}
            disabled={!canCharge || pending}
            style={{
              width: '100%',
              padding: '13px 18px',
              borderRadius: 10,
              background:
                canCharge && !pending
                  ? 'var(--admin-accent)'
                  : 'color-mix(in srgb, var(--admin-accent) 35%, transparent)',
              color: 'var(--ink-on-gold)',
              border: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 600,
              cursor: canCharge && !pending ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {pending ? 'Charging…' : `Charge cash · ${register.currencyCode} ${subtotal.toLocaleString('en-US')}`}
            <ChevronRight size={14} />
          </button>
          {cart.length > 0 ? (
            <button
              type="button"
              onClick={clearCart}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear cart
            </button>
          ) : null}
        </aside>
      </div>

      {receipt ? (
        <ReceiptToast
          receipt={receipt}
          currencyCode={register.currencyCode}
          businessName={businessName}
          register={register}
          onClose={() => setReceipt(null)}
        />
      ) : null}

      <style>{`
        @media (max-width: 880px) {
          .souqna-pos-grid {
            grid-template-columns: 1fr !important;
          }
          .souqna-pos-cart {
            position: static !important;
          }
        }
      `}</style>
    </>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: accent
            ? 'var(--font-serif, var(--font-sans))'
            : 'var(--font-mono)',
          fontSize: accent ? 18 : 14,
          fontWeight: accent ? 500 : 400,
          color: accent ? 'var(--admin-accent)' : 'var(--ink-strong)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function QtyButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        background: 'transparent',
        border: '1px solid var(--surface-rule-strong)',
        color: 'var(--ink-strong)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

function ReceiptToast({
  receipt,
  currencyCode,
  businessName,
  register,
  onClose,
}: {
  receipt: {
    orderNumber: number;
    total: number;
    cashTendered: number;
    change: number;
    items: LineItem[];
    at: Date;
  };
  currencyCode: string;
  businessName: string;
  register: PosRegister;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Sale receipt"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, #1f1b16 60%, transparent)',
        backdropFilter: 'blur(2px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--surface-bg)',
          border: '1px solid var(--surface-rule-strong)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          color: 'var(--ink-strong)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--admin-accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <CheckGlyph size={14} /> Sale closed
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-serif, var(--font-sans))',
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            #{receipt.orderNumber}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-muted)',
              marginTop: 2,
            }}
          >
            {businessName} · {register.locationName} ·{' '}
            {receipt.at.toLocaleString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </div>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '10px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderTop: '1px dashed var(--surface-rule-strong)',
            borderBottom: '1px dashed var(--surface-rule-strong)',
          }}
        >
          {receipt.items.map((l) => (
            <li
              key={l.productId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--ink-strong)',
              }}
            >
              <span>
                {l.quantity}× {l.title}
              </span>
              <span>
                {currencyCode}{' '}
                {(l.unitPrice * l.quantity).toLocaleString('en-US')}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="Total" value={`${currencyCode} ${receipt.total.toLocaleString('en-US')}`} />
          <Row label="Cash tendered" value={`${currencyCode} ${receipt.cashTendered.toLocaleString('en-US')}`} />
          <Row label="Change" value={`${currencyCode} ${receipt.change.toLocaleString('en-US')}`} accent />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-muted)',
            textAlign: 'center',
            paddingTop: 4,
          }}
        >
          {register.receiptFooter}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--surface-rule-strong)',
              color: 'var(--ink-strong)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--admin-accent)',
              color: 'var(--ink-on-gold)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}
