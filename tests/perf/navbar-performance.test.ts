/**
 * Performance benchmark for Navbar and HeroActions components
 */

import { describe, expect, it } from 'bun:test';
import { performance } from 'node:perf_hooks';

describe('Component Performance', () => {
  it('Navbar renders within acceptable time', async () => {
    const startTime = performance.now();

    // Dynamically import to measure load time
    const { Navbar } = await import('@/components/layout/navbar');

    const loadTime = performance.now() - startTime;

    // Should load in less than 300ms (allowing for cold start and parallel test execution)
    expect(loadTime).toBeLessThan(300);
    expect(Navbar).toBeDefined();
  });

  it('HeroActions renders within acceptable time', async () => {
    const startTime = performance.now();

    const { HeroActions } = await import('@/components/home/hero-actions');

    const loadTime = performance.now() - startTime;

    // Should load in less than 100ms (simpler component)
    expect(loadTime).toBeLessThan(100);
    expect(HeroActions).toBeDefined();
  });
});
