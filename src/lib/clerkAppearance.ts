import type { Appearance } from '@clerk/types';
import { palette } from '@/lib/tokens';

/**
 * Souqna-themed Clerk appearance.
 *
 * Single source of truth for every Clerk surface — `<SignIn />`,
 * `<SignUp />`, `<UserButton />`, `<UserProfile />`, `<PricingTable />`,
 * `<OrganizationSwitcher />`, etc. The root `ClerkProvider` calls this
 * once with the theme it pulled from the founder's cookie; downstream
 * components inherit by default and can pass a tighter override on a
 * per-instance basis (the Nav avatar uses `compact: true` to shrink
 * the halo, for example).
 *
 * Editorial language:
 *   - Sand / Ink surfaces (no chrome shadows; thin maroon-tinted borders).
 *   - Gold for the primary CTA — the "act now" beat.
 *   - Maroon for links, focus rings, and the avatar halo so AI-edit
 *     affordances and account chrome share one visual register.
 *   - Thmanyah Serif Display via `--font-serif` for headings and
 *     identifiers; mono caps (`--font-mono`) for labels and badges so
 *     the chrome reads as part of the same editorial system as the storefront.
 *
 * RTL: Clerk renders LTR-positioned inline styles, but every logical
 * surface (cards, modals, identity rows) honours the document `dir`.
 * We don't pass any direction-specific overrides — Arabic locales get
 * mirrored layout via the `<html dir="rtl">` from `next-intl`.
 */

export type SouqnaClerkOptions = {
  dark: boolean;
  /**
   * Compact mode — drops the gold halo around the avatar and tightens
   * the popover spacing. Use on inline avatars in `<Nav />` and
   * `<AdminTopBar />` where the rotating Souqy star already lives
   * nearby and a second halo would visually compete.
   */
  compact?: boolean;
};

/**
 * Maroon-on-sand palette baseline for light surfaces; ink/sandPale for
 * dark. Centralised so a future palette tweak doesn't require chasing
 * raw hex strings through `elements`.
 */
function tones(dark: boolean) {
  return {
    surface: dark ? palette.ink : palette.sand,
    surfaceRaised: dark ? palette.charcoal : palette.sandPale,
    text: dark ? palette.sandPale : palette.ink,
    textMuted: dark ? 'rgba(241,233,215,0.65)' : 'rgba(31,27,22,0.62)',
    textSubtle: dark ? 'rgba(241,233,215,0.42)' : 'rgba(31,27,22,0.45)',
    divider: dark ? 'rgba(232,220,196,0.14)' : 'rgba(31,27,22,0.10)',
    border: dark ? 'rgba(139,58,58,0.40)' : 'rgba(139,58,58,0.20)',
    borderStrong: dark ? 'rgba(139,58,58,0.55)' : 'rgba(139,58,58,0.30)',
    inputBg: dark ? '#262220' : '#FFFFFF',
    inputBorder: dark ? 'rgba(232,220,196,0.18)' : 'rgba(31,27,22,0.14)',
    focusRing: `${palette.maroon}55`,
    dangerSoft: dark ? 'rgba(230,138,138,0.16)' : 'rgba(178,58,58,0.10)',
    danger: dark ? '#E68A8A' : '#B23A3A',
    successSoft: dark ? 'rgba(143,168,108,0.18)' : 'rgba(111,143,77,0.14)',
    success: dark ? '#A6C58A' : '#6F8F4D',
  };
}

export function souqnaClerkAppearance({
  dark,
  compact = false,
}: SouqnaClerkOptions): Appearance {
  const t = tones(dark);

  return {
    layout: {
      // Editorial vibe = no big provider button blocks; render
      // OAuth providers as a tidy icon row above the form.
      socialButtonsVariant: 'iconButton',
      socialButtonsPlacement: 'top',
      // Logo lives inside the card so the modal feels like a single
      // atelier surface, not a header + body split.
      logoPlacement: 'inside',
      logoImageUrl: '/favicon.svg',
      // Privacy/help links are pulled into the modal footer when set.
      privacyPageUrl: '/privacy',
      termsPageUrl: '/terms',
      helpPageUrl: '/contact',
      // Hide the small "Secured by Clerk" badge at the bottom — we
      // already brand every flow as Souqna and the lockup competes
      // visually with the gold CTA.
      unsafe_disableDevelopmentModeWarnings: false,
      shimmer: true,
    },

    variables: {
      colorPrimary: palette.maroon,
      colorBackground: t.surface,
      colorText: t.text,
      colorTextSecondary: t.textMuted,
      colorTextOnPrimaryBackground: palette.sand,
      colorInputBackground: t.inputBg,
      colorInputText: t.text,
      colorDanger: t.danger,
      colorSuccess: t.success,
      colorWarning: palette.goldDeep,
      colorNeutral: t.text,
      colorShimmer: dark ? 'rgba(232,220,196,0.06)' : 'rgba(31,27,22,0.05)',
      fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
      fontFamilyButtons: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
      fontSize: '0.95rem',
      fontWeight: { normal: 400, medium: 500, bold: 600 },
      borderRadius: '6px',
      // 0.95rem unit keeps Clerk's spacing in step with our 14-15px
      // body rhythm. Default is 1rem which feels too airy next to the
      // dense builder chrome.
      spacingUnit: '0.95rem',
    },

    elements: {
      // ── Card / page chrome ───────────────────────────────────────
      rootBox: {
        fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
        color: t.text,
      },
      cardBox: {
        backgroundColor: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        boxShadow: dark
          ? '0 24px 60px rgba(0,0,0,0.45)'
          : '0 24px 60px rgba(31,27,22,0.06)',
      },
      card: {
        backgroundColor: 'transparent',
        boxShadow: 'none',
        border: 'none',
        padding: '28px 28px 24px',
      },

      // ── Header ───────────────────────────────────────────────────
      header: {
        marginBottom: 18,
      },
      logoBox: {
        marginBottom: 14,
      },
      logoImage: {
        height: 28,
        width: 'auto',
        opacity: dark ? 0.95 : 0.85,
      },
      headerTitle: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: '1.6rem',
        letterSpacing: '0.005em',
        color: t.text,
        lineHeight: 1.18,
      },
      headerSubtitle: {
        fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
        fontSize: '0.92rem',
        color: t.textMuted,
        marginTop: 6,
        lineHeight: 1.5,
      },

      // ── Forms ────────────────────────────────────────────────────
      formFieldRow: { marginBlock: 10 },
      formFieldLabelRow: { marginBottom: 4 },
      formFieldLabel: {
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '0.65rem',
        fontWeight: 500,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: t.textMuted,
      },
      formFieldInput: {
        backgroundColor: t.inputBg,
        color: t.text,
        border: `1px solid ${t.inputBorder}`,
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: '0.95rem',
        boxShadow: 'none',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
      },
      formFieldInput__focused: {
        borderColor: palette.maroon,
        boxShadow: `0 0 0 3px ${t.focusRing}`,
      },
      formFieldInput__error: {
        borderColor: t.danger,
        boxShadow: `0 0 0 3px ${t.dangerSoft}`,
      },
      formFieldInputShowPasswordButton: {
        color: t.textMuted,
      },
      formFieldHintText: {
        color: t.textSubtle,
        fontSize: '0.78rem',
        fontStyle: 'italic',
      },
      formFieldErrorText: {
        color: t.danger,
        fontSize: '0.78rem',
      },

      // ── OTP / verification fields ────────────────────────────────
      otpCodeFieldInput: {
        backgroundColor: t.inputBg,
        color: t.text,
        border: `1px solid ${t.inputBorder}`,
        borderRadius: 6,
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '1.1rem',
      },

      // ── Buttons ──────────────────────────────────────────────────
      formButtonPrimary: {
        backgroundColor: palette.gold,
        color: palette.ink,
        border: 'none',
        borderRadius: 6,
        padding: '11px 18px',
        fontWeight: 500,
        textTransform: 'none',
        letterSpacing: '0.005em',
        boxShadow: 'none',
        transition: 'background-color 160ms ease, transform 160ms ease',
      },
      formButtonPrimary__loading: {
        backgroundColor: palette.goldDeep,
      },
      formButtonReset: {
        color: palette.maroon,
        backgroundColor: 'transparent',
        border: `1px solid ${t.border}`,
        borderRadius: 6,
      },
      // Inline action buttons (e.g. "Edit", "Resend") rendered as
      // ghost text-buttons — no fill, maroon link colour, underline
      // on hover for a hint of editorial typography.
      button__noBorder: {
        color: palette.maroon,
      },

      // ── Social providers (icon-row variant) ──────────────────────
      socialButtons: {
        gap: 8,
        marginBottom: 14,
      },
      socialButtonsIconButton: {
        backgroundColor: 'transparent',
        border: `1px solid ${t.inputBorder}`,
        borderRadius: 999,
        width: 40,
        height: 40,
        transition: 'background-color 160ms ease, border-color 160ms ease',
      },

      // ── Dividers ─────────────────────────────────────────────────
      dividerRow: { marginBlock: 16 },
      dividerLine: { backgroundColor: t.divider },
      dividerText: {
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '0.62rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: t.textSubtle,
      },

      // ── Footer ───────────────────────────────────────────────────
      footer: {
        backgroundColor: 'transparent',
        borderTop: `1px solid ${t.divider}`,
        paddingTop: 14,
        marginTop: 16,
      },
      footerAction: {
        fontSize: '0.85rem',
        color: t.textMuted,
      },
      footerActionLink: {
        color: palette.maroon,
        fontWeight: 500,
        textDecoration: 'none',
        borderBottom: `1px solid ${palette.maroon}55`,
      },
      footerPagesLink: {
        color: t.textMuted,
        fontSize: '0.78rem',
      },

      // ── Identity / preview ───────────────────────────────────────
      identityPreview: {
        backgroundColor: t.surfaceRaised,
        border: `1px solid ${t.divider}`,
        borderRadius: 6,
        padding: '10px 12px',
      },
      identityPreviewText: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '1rem',
        color: t.text,
      },
      identityPreviewEditButton: {
        color: palette.maroon,
      },

      // ── Alerts / badges ──────────────────────────────────────────
      alert: {
        backgroundColor: t.dangerSoft,
        color: t.danger,
        border: `1px solid ${t.danger}33`,
        borderRadius: 6,
        padding: '10px 12px',
      },
      alertText: { fontSize: '0.85rem' },
      badge: {
        backgroundColor: t.surfaceRaised,
        color: palette.maroon,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: '2px 8px',
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '0.6rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 500,
      },
      badge__primary: {
        backgroundColor: `${palette.maroon}18`,
        color: palette.maroon,
        borderColor: `${palette.maroon}40`,
      },

      // ── UserButton (avatar in nav / chrome) ──────────────────────
      userButtonBox: {
        gap: 8,
      },
      userButtonOuterIdentifier: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '0.95rem',
        color: t.text,
      },
      userButtonAvatarBox: {
        width: compact ? 32 : 36,
        height: compact ? 32 : 36,
        borderRadius: 999,
        boxShadow: compact
          ? `0 0 0 1px ${t.borderStrong}`
          : `0 0 0 1px ${palette.maroon}44, 0 0 0 4px ${palette.gold}11`,
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      },
      userButtonAvatarBox__open: {
        boxShadow: `0 0 0 1px ${palette.maroon}, 0 0 0 5px ${palette.gold}33`,
      },
      avatarBox: {
        borderRadius: 999,
      },
      avatarImage: {
        borderRadius: 999,
      },

      // ── UserButton popover ───────────────────────────────────────
      userButtonPopoverCard: {
        backgroundColor: t.surface,
        border: `1px solid ${t.borderStrong}`,
        borderRadius: 10,
        boxShadow: dark
          ? '0 18px 48px rgba(0,0,0,0.6)'
          : '0 18px 48px rgba(31,27,22,0.18)',
        padding: 6,
      },
      userButtonPopoverMain: {
        backgroundColor: 'transparent',
      },
      userButtonPopoverActionButton: {
        color: t.text,
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: '0.92rem',
        transition: 'background-color 120ms ease',
      },
      userButtonPopoverActionButtonText: {
        color: t.text,
      },
      userButtonPopoverActionButtonIcon: {
        color: t.textMuted,
      },
      userButtonPopoverFooter: {
        borderTop: `1px solid ${t.divider}`,
        paddingTop: 8,
        marginTop: 4,
      },
      userPreview: {
        padding: '10px 12px',
      },
      userPreviewMainIdentifier: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '1.05rem',
        color: t.text,
      },
      userPreviewSecondaryIdentifier: {
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '0.7rem',
        letterSpacing: '0.06em',
        color: t.textMuted,
      },

      // ── UserProfile / OrganizationProfile shells ─────────────────
      navbar: {
        backgroundColor: 'transparent',
        borderInlineEnd: `1px solid ${t.divider}`,
        paddingInline: 14,
        paddingBlock: 12,
      },
      navbarButtons: { gap: 2 },
      navbarButton: {
        color: t.textMuted,
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: '0.88rem',
        transition: 'background-color 120ms ease, color 120ms ease',
      },
      navbarButton__active: {
        color: palette.maroon,
        backgroundColor: dark
          ? 'rgba(139,58,58,0.18)'
          : 'rgba(139,58,58,0.08)',
      },
      navbarButtonIcon: { color: 'currentColor' },
      pageScrollBox: { padding: '24px 28px' },
      page: { gap: 22 },
      profileSectionTitle: {
        marginBottom: 6,
      },
      profileSectionTitleText: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '1.1rem',
        color: t.text,
      },
      profileSectionSubtitle: {
        color: t.textMuted,
        fontSize: '0.85rem',
      },
      profileSectionContent: { gap: 8 },
      profileSection: {
        borderBottom: `1px solid ${t.divider}`,
        paddingBlock: 18,
      },

      // ── Menus / dropdowns ────────────────────────────────────────
      menuButton: {
        color: t.textMuted,
        borderRadius: 6,
      },
      menuList: {
        backgroundColor: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        boxShadow: dark
          ? '0 14px 32px rgba(0,0,0,0.5)'
          : '0 14px 32px rgba(31,27,22,0.12)',
        padding: 4,
      },
      menuItem: {
        color: t.text,
        borderRadius: 5,
        padding: '8px 10px',
        fontSize: '0.9rem',
        transition: 'background-color 120ms ease',
      },

      // ── PricingTable / billing surfaces ──────────────────────────
      pricingTable: { gap: 14 },
      pricingTableCard: {
        backgroundColor: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: 'none',
        padding: 18,
      },
      pricingTableCardHeader: {
        borderBottom: `1px solid ${t.divider}`,
        paddingBottom: 12,
        marginBottom: 12,
      },
      pricingTableCardTitle: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '1.4rem',
        color: t.text,
      },
      pricingTableCardFee: {
        fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
        fontSize: '2rem',
        color: t.text,
      },
      pricingTableCardFeePeriod: {
        color: t.textMuted,
        fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
        fontSize: '0.7rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      },
      pricingTableCardFeatures: { gap: 8 },
      pricingTableCardCtaContainer: {
        marginTop: 14,
      },

      // ── Modal scrim (signed-out modal flows) ─────────────────────
      modalBackdrop: {
        backgroundColor: dark
          ? 'rgba(10,8,6,0.66)'
          : 'rgba(31,27,22,0.45)',
        backdropFilter: 'blur(4px)',
      },
    },
  };
}
