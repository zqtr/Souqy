export const souqnaClerkAppearance = {
  layout: {
    socialButtonsPlacement: 'bottom',
    socialButtonsVariant: 'blockButton',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'w-full border-0 bg-transparent p-0 shadow-none',
    header: 'hidden',
    socialButtonsBlockButton:
      'h-10 rounded-md border-[color:rgba(255,190,138,0.24)] bg-[color:rgba(17,17,17,0.88)] text-[color:#fff8ef] shadow-none hover:bg-[color:rgba(42,36,31,0.92)]',
    dividerLine: 'bg-[color:var(--surface-rule)]',
    dividerText: 'text-[12px] normal-case tracking-normal text-[color:var(--ink-faint)]',
    formFieldLabel: 'text-[color:var(--ink-muted)]',
    formFieldInput:
      'h-10 rounded-md border-[color:rgba(255,190,138,0.24)] bg-[color:rgba(17,17,17,0.88)] text-[color:#fff8ef] shadow-none focus:border-[color:#ffbe8a] focus:ring-[color:rgba(255,190,138,0.2)]',
    formButtonPrimary:
      'h-10 rounded-md bg-[color:#ffbe8a] text-[color:#15110d] shadow-none hover:bg-[color:#ffd0aa]',
    footer: 'hidden',
    footerAction: 'hidden',
    identityPreview: 'rounded-md bg-[color:rgba(17,17,17,0.88)]',
    formResendCodeLink: 'text-[color:#ffbe8a]',
    otpCodeFieldInput:
      'rounded-md border-[color:rgba(255,190,138,0.24)] bg-[color:rgba(17,17,17,0.88)] text-[color:#fff8ef]',
  },
  variables: {
    colorPrimary: '#ffbe8a',
    colorBackground: 'transparent',
    colorInputBackground: 'rgba(17,17,17,0.88)',
    colorInputText: '#fff8ef',
    colorText: '#fff8ef',
    colorTextSecondary: 'rgba(255,248,239,0.68)',
    colorTextOnPrimaryBackground: '#15110d',
    colorNeutral: 'rgba(255,190,138,0.24)',
    colorDanger: '#ffbe8a',
    borderRadius: '0.5rem',
    fontFamily: 'var(--font-sans), var(--font-arabic), ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons:
      'var(--font-sans), var(--font-arabic), ui-sans-serif, system-ui, sans-serif',
  },
} as const;
