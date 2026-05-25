/**
 * Stub for the future full-page notifications inbox. The bell
 * dropdown footer links here so screen readers / power users have a
 * canonical "view all" destination even though the rich timeline UI
 * is still on the roadmap.
 */
export default function NotificationsPage() {
  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(40px, 8vw, 96px) 20px',
        textAlign: 'center',
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--admin-accent, #b58a3a)',
          }}
        >
          Notifications · <span lang="ar">التنبيهات</span>
        </p>
        <h1
          style={{
            margin: '12px 0 0',
            fontFamily: 'var(--font-serif), serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(28px, 4vw, 44px)',
            color: 'var(--ink-strong)',
          }}
        >
          Coming soon
        </h1>
        <p
          lang="ar"
          dir="rtl"
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-arabic-serif), serif',
            fontStyle: 'italic',
            fontSize: 18,
            color: 'var(--ink-muted)',
          }}
        >
          قريباً
        </p>
      </div>
    </main>
  );
}
