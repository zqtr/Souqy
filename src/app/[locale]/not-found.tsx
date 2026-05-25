import Link from 'next/link';
import { ArchMark } from '@/components/primitives/ArchMark';

export default function NotFound() {
  return (
    <section
      className="bg-[color:var(--surface-bg)] text-[color:var(--ink-strong)]"
      style={{
        minHeight: '80vh',
        padding: '160px clamp(24px, 4vw, 48px) 96px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <ArchMark size={56} />
        <div
          className="font-mono text-[11px] mt-8"
          style={{
            color: 'var(--color-maroon)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          404 · LOST IN THE SOUQ
        </div>
        <h1
          className="m-0 mt-4 text-balance"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 300,
            fontSize: 'clamp(40px, 5vw, 76px)',
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
          }}
        >
          We can't find this page.
        </h1>
        <p
          dir="rtl"
          className="mt-4"
          style={{
            fontFamily: 'var(--font-arabic), var(--font-sans)',
            fontSize: 22,
            color: 'var(--ink-muted)',
            fontWeight: 300,
            lineHeight: 1.5,
          }}
        >
          الصفحة التي تبحث عنها لم تكتب بعد.
        </p>
        <div className="mt-10 flex flex-wrap gap-6 items-center font-mono text-[12px]">
          <Link
            href="/"
            className="text-[color:var(--ink-strong)] no-underline pb-1"
            style={{ borderBottom: '1px solid var(--color-gold)' }}
          >
            ← Return to the home page
          </Link>
          <Link
            href="/begin"
            className="text-[color:var(--ink-muted)] no-underline"
          >
            or begin a project
          </Link>
        </div>
      </div>
    </section>
  );
}
