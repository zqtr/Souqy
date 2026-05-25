export type SettingsNavItem = {
  id: string;
  label: string;
  href: string;
  soon?: boolean;
};

export type SettingsNavSection = {
  id: string;
  title: string;
  summary: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV_SECTIONS: SettingsNavSection[] = [
  {
    id: 'store',
    title: 'Store',
    summary: 'Identity, branding, contact details, domain, and plan.',
    items: [
      { id: 'general', label: 'General', href: '/account/settings/general' },
      { id: 'websites', label: 'Websites', href: '/account/settings/websites' },
      { id: 'brand', label: 'Brand & logo', href: '/account/settings/brand' },
      { id: 'appearance', label: 'Appearance', href: '/account/settings/appearance' },
      { id: 'contact', label: 'Contact details', href: '/account/settings/contact' },
      { id: 'domain', label: 'Domain', href: '/account/settings/domain', soon: true },
      { id: 'plan', label: 'Plan', href: '/account/settings/plan' },
    ],
  },
  {
    id: 'commerce',
    title: 'Commerce',
    summary: 'Locations, checkout, payment methods, shipping, taxes, and duties.',
    items: [
      { id: 'locations', label: 'Locations', href: '/account/settings/locations' },
      { id: 'payments', label: 'Payments', href: '/account/settings/payments' },
      { id: 'checkout', label: 'Checkout', href: '/account/settings/checkout' },
      { id: 'shipping', label: 'Shipping & delivery', href: '/account/settings/shipping', soon: true },
      { id: 'taxes', label: 'Taxes & duties', href: '/account/settings/taxes', soon: true },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    summary: 'Customer accounts, email notifications, and store policies.',
    items: [
      { id: 'customer-accounts', label: 'Customer accounts', href: '/account/settings/customer-accounts' },
      { id: 'notifications', label: 'Email notifications', href: '/account/settings/notifications' },
      { id: 'policies', label: 'Store policies', href: '/account/settings/policies' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform',
    summary: 'Your account, team access, audit log, data, and markets.',
    items: [
      { id: 'account', label: 'Your account', href: '/account/settings/account' },
      { id: 'team', label: 'Team', href: '/account/settings/team' },
      { id: 'activity-log', label: 'Activity log', href: '/account/settings/activity-log' },
      { id: 'custom-data', label: 'Custom data', href: '/account/settings/custom-data', soon: true },
      { id: 'markets', label: 'Markets', href: '/account/settings/markets', soon: true },
    ],
  },
];
