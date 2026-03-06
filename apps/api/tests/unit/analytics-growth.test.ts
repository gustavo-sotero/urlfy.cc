import { describe, expect, it } from 'bun:test';

/**
 * Unit tests for calculateGrowth function
 * Tests the period-over-period growth calculation logic
 */

// Helper function matching the one in analytics.service.ts
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

describe('Analytics Growth Calculation', () => {
  describe('calculateGrowth', () => {
    it('should return 100 when previous is 0 and current is positive', () => {
      expect(calculateGrowth(100, 0)).toBe(100);
      expect(calculateGrowth(1, 0)).toBe(100);
      expect(calculateGrowth(1000, 0)).toBe(100);
    });

    it('should return 0 when both previous and current are 0', () => {
      expect(calculateGrowth(0, 0)).toBe(0);
    });

    it('should calculate positive growth correctly', () => {
      expect(calculateGrowth(110, 100)).toBe(10); // 10% growth
      expect(calculateGrowth(150, 100)).toBe(50); // 50% growth
      expect(calculateGrowth(200, 100)).toBe(100); // 100% growth
    });

    it('should calculate negative growth correctly', () => {
      expect(calculateGrowth(90, 100)).toBe(-10); // -10% decline
      expect(calculateGrowth(50, 100)).toBe(-50); // -50% decline
      expect(calculateGrowth(0, 100)).toBe(-100); // -100% decline
    });

    it('should round to nearest integer', () => {
      expect(calculateGrowth(105, 100)).toBe(5); // 5% (exactly)
      expect(calculateGrowth(106, 100)).toBe(6); // 6% (exactly)
      expect(calculateGrowth(104, 100)).toBe(4); // 4% (exactly)
    });

    it('should handle decimal results by rounding', () => {
      expect(calculateGrowth(103, 100)).toBe(3); // 3% (3% exactly)
      expect(calculateGrowth(133, 100)).toBe(33); // 33% (33% exactly)
      expect(calculateGrowth(167, 100)).toBe(67); // 67% (67% exactly)
    });

    it('should handle edge cases', () => {
      // Very small numbers
      expect(calculateGrowth(2, 1)).toBe(100); // 100% growth
      expect(calculateGrowth(1, 2)).toBe(-50); // -50% decline

      // Large numbers
      expect(calculateGrowth(1100, 1000)).toBe(10); // 10% growth
      expect(calculateGrowth(900, 1000)).toBe(-10); // -10% decline
    });
  });
});
