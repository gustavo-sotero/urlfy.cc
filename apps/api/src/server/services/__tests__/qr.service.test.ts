// src/server/services/__tests__/qr.service.test.ts
import { describe, expect, it } from 'bun:test';
import {
  validateQRFormat,
  validateQRSize
} from '@/server/modules/links/services/qr.utils';

describe('QR Service', () => {
  describe('validateQRSize', () => {
    it('should return exact size if valid', () => {
      const validSizes: Array<100 | 200 | 300 | 500 | 1000> = [
        100, 200, 300, 500, 1000
      ];

      validSizes.forEach((size) => {
        expect(validateQRSize(size)).toBe(size);
      });
    });

    it('should return closest valid size for invalid input', () => {
      expect(validateQRSize(150)).toBe(100); // Closer to 100 than 200
      expect(validateQRSize(250)).toBe(200); // Closer to 200 than 300
      expect(validateQRSize(400)).toBe(300); // Closer to 300 than 500
      expect(validateQRSize(650)).toBe(500); // Closer to 500 than 1000
      expect(validateQRSize(50)).toBe(100); // Closest to 100 (min)
      expect(validateQRSize(2000)).toBe(1000); // Closest to 1000 (max)
    });
  });

  describe('validateQRFormat', () => {
    it('should return svg for svg format', () => {
      expect(validateQRFormat('svg')).toBe('svg');
    });

    it('should return png for png format', () => {
      expect(validateQRFormat('png')).toBe('png');
    });

    it('should default to png for invalid formats', () => {
      expect(validateQRFormat('jpg')).toBe('png');
      expect(validateQRFormat('gif')).toBe('png');
      expect(validateQRFormat('webp')).toBe('png');
      expect(validateQRFormat('')).toBe('png');
    });
  });
});
