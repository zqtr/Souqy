export const MAX_PRODUCT_SIZE_OPTIONS = 24;
export const MAX_PRODUCT_SIZE_LABEL_LENGTH = 40;
export const MAX_PRODUCT_CUSTOM_INPUT_LENGTH = 80;
export const DEFAULT_PRODUCT_HEIGHT_OPTIONS = ['156', '165', '178'];

export function normalizeSizeOptions(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const sizes: string[] = [];

  for (const item of raw) {
    const label =
      typeof item === 'string'
        ? item
        : typeof item === 'number' && Number.isFinite(item)
          ? String(item)
        : item && typeof item === 'object' && 'label' in item
          ? String((item as { label?: unknown }).label ?? '')
          : '';
    const normalized = label.replace(/\s+/g, ' ').trim().slice(0, MAX_PRODUCT_SIZE_LABEL_LENGTH);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    sizes.push(normalized);
    if (sizes.length >= MAX_PRODUCT_SIZE_OPTIONS) break;
  }

  return sizes;
}

export function isAllowedSizeOption(
  sizeOptions: string[],
  value: string | null | undefined,
): boolean {
  if (sizeOptions.length === 0) return value === null || value === undefined || value.trim() === '';
  const requested = value?.trim().toLowerCase();
  if (!requested) return false;
  return sizeOptions.some((option) => option.toLowerCase() === requested);
}

export function normalizeCustomSizeValue(value: unknown): string | null {
  return normalizeSizeOptions([value])[0] ?? null;
}

export function isAllowedProductSizeOption(
  sizeOptions: string[],
  value: string | null | undefined,
  allowCustomSize = false,
): boolean {
  if (isAllowedSizeOption(sizeOptions, value)) return true;
  return allowCustomSize && normalizeCustomSizeValue(value) !== null;
}

export function normalizeHeightOptions(value: unknown): string[] {
  return normalizeSizeOptions(value);
}

export function isAllowedHeightOption(
  heightOptions: string[],
  value: string | null | undefined,
): boolean {
  return isAllowedSizeOption(heightOptions, value);
}

export function normalizeCustomInputValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PRODUCT_CUSTOM_INPUT_LENGTH);
  return normalized || null;
}

export function normalizeHeightInputLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, MAX_PRODUCT_SIZE_LABEL_LENGTH);
  return normalized || null;
}
