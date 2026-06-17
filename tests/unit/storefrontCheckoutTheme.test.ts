import { describe, expect, it } from 'vitest';
import {
  checkoutThemeForBackground,
  storefrontThemeForBackground,
} from '@/lib/storefrontCheckoutTheme';

describe('storefrontThemeForBackground', () => {
  it('keeps the fallback theme when no solid background can be read', () => {
    expect(storefrontThemeForBackground(undefined, 'dark')).toBe('dark');
    expect(storefrontThemeForBackground('linear-gradient(#fff, #000)', 'light')).toBe('light');
  });

  it('uses light storefront tokens for solid light backgrounds', () => {
    expect(storefrontThemeForBackground('#fff', 'dark')).toBe('light');
    expect(storefrontThemeForBackground('#f7efe2', 'dark')).toBe('light');
    expect(storefrontThemeForBackground('rgb(255, 255, 255)', 'dark')).toBe('light');
    expect(storefrontThemeForBackground('white', 'dark')).toBe('light');
  });

  it('uses dark storefront tokens for solid dark backgrounds', () => {
    expect(storefrontThemeForBackground('#000', 'light')).toBe('dark');
    expect(storefrontThemeForBackground('#0a1714', 'light')).toBe('dark');
    expect(storefrontThemeForBackground('rgb(10 10 10)', 'light')).toBe('dark');
    expect(storefrontThemeForBackground('black', 'light')).toBe('dark');
  });

  it('ignores mostly transparent colors', () => {
    expect(storefrontThemeForBackground('rgba(255, 255, 255, 0.2)', 'dark')).toBe('dark');
    expect(storefrontThemeForBackground('rgb(255 255 255 / 20%)', 'dark')).toBe('dark');
  });

  it('keeps checkout surfaces on the same contrast rule', () => {
    expect(checkoutThemeForBackground('#fff', 'dark')).toBe('light');
  });
});
