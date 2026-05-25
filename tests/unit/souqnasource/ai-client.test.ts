// tests/unit/souqnasource/ai-client.test.ts
import { describe, it, expect } from 'vitest';
import { safeJsonObject, safeJsonArray } from '@/lib/apps/souqnasource/ai/client';

describe('safeJsonObject', () => {
  it('parses a JSON object', () => {
    expect(safeJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ``` fences', () => {
    expect(safeJsonObject('```json\n{"x":2}\n```')).toEqual({ x: 2 });
  });
  it('returns null on garbage', () => {
    expect(safeJsonObject('hello world')).toBeNull();
  });
});

describe('safeJsonArray', () => {
  it('parses an array', () => {
    expect(safeJsonArray('[1,2]')).toEqual([1, 2]);
  });
  it('returns null when not an array', () => {
    expect(safeJsonArray('{"x":1}')).toBeNull();
  });
});
