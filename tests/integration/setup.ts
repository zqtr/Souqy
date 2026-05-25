import { config } from 'dotenv';
import { vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

config({ path: '.env.local' });
config({ path: '.env.dev.tmp' });
config({ path: '.env' });
