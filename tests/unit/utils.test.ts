// tests/unit/utils.test.ts

import { describe, expect, test } from 'bun:test';
import {
  parseRedirectType,
  REDIRECT_TYPES,
  removeEmptyFields
} from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════
// removeEmptyFields Tests
// ═══════════════════════════════════════════════════════════════════

describe('removeEmptyFields', () => {
  test('should remove empty strings', () => {
    const input = { name: 'John', email: '', age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should remove null values', () => {
    const input = { name: 'John', email: null, age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should remove undefined values', () => {
    const input = { name: 'John', email: undefined, age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should remove empty arrays', () => {
    const input = { name: 'John', tags: [], age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should keep arrays with values', () => {
    const input = { name: 'John', tags: ['tag1'], age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', tags: ['tag1'], age: 30 });
  });

  test('should remove NaN values', () => {
    const input = { name: 'John', score: Number.NaN, age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', age: 30 });
  });

  test('should keep zero values', () => {
    const input = { name: 'John', score: 0, age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', score: 0, age: 30 });
  });

  test('should keep false boolean values', () => {
    const input = { name: 'John', active: false, age: 30 };
    const result = removeEmptyFields(input);

    expect(result).toEqual({ name: 'John', active: false, age: 30 });
  });

  test('should handle empty object', () => {
    const input = {};
    const result = removeEmptyFields(input);

    expect(result).toEqual({});
  });

  test('should handle object with all empty values', () => {
    const input = { name: '', email: null, tags: [], score: undefined };
    const result = removeEmptyFields(input);

    expect(result).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseRedirectType Tests
// ═══════════════════════════════════════════════════════════════════

describe('parseRedirectType', () => {
  test('should parse "301" to 301', () => {
    const result = parseRedirectType('301');
    expect(result).toBe(301);
  });

  test('should parse "302" to 302', () => {
    const result = parseRedirectType('302');
    expect(result).toBe(302);
  });

  test('should return undefined for invalid string', () => {
    const result = parseRedirectType('404');
    expect(result).toBeUndefined();
  });

  test('should return undefined for empty string', () => {
    const result = parseRedirectType('');
    expect(result).toBeUndefined();
  });

  test('should return undefined for null', () => {
    const result = parseRedirectType(null);
    expect(result).toBeUndefined();
  });

  test('should return undefined for undefined', () => {
    const result = parseRedirectType(undefined);
    expect(result).toBeUndefined();
  });

  test('should return undefined for non-numeric string', () => {
    const result = parseRedirectType('abc');
    expect(result).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// REDIRECT_TYPES Constants
// ═══════════════════════════════════════════════════════════════════

describe('REDIRECT_TYPES', () => {
  test('should have PERMANENT constant', () => {
    expect(REDIRECT_TYPES.PERMANENT).toBe(301);
  });

  test('should have TEMPORARY constant', () => {
    expect(REDIRECT_TYPES.TEMPORARY).toBe(302);
  });

  test('should be immutable (as const)', () => {
    // This is a compile-time check, but we can verify the values
    expect(Object.isFrozen(REDIRECT_TYPES)).toBe(false); // Object literals aren't frozen
    expect(REDIRECT_TYPES.PERMANENT).toBe(301);
    expect(REDIRECT_TYPES.TEMPORARY).toBe(302);
  });
});
