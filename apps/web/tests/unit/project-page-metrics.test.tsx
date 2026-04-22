import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { MetricsSection } from '@/app/[locale]/(public)/project/_components/metrics-section';

const translations: Record<string, string> = {
  'metrics.title': 'Numbers In Context',
  'metrics.subtitle':
    'These cards summarize documented validation targets from the redirect baseline docs, not live public telemetry.',
  'metrics.contextLabel': 'Documented target',
  'metrics.latencyP50.value': '< 30ms',
  'metrics.latencyP50.label': 'Redirect latency P50',
  'metrics.latencyP50.description':
    'Warm-cache goal from the redirect baseline runbook',
  'metrics.latencyP99.value': '< 300ms',
  'metrics.latencyP99.label': 'Redirect latency P99',
  'metrics.latencyP99.description':
    'Upper bound tracked during load validation',
  'metrics.cacheHitRate.value': '> 70%',
  'metrics.cacheHitRate.label': 'Warm-cache hit rate',
  'metrics.cacheHitRate.description':
    'Expected after warm-up in k6 redirect checks'
};

describe('MetricsSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the documented metric labels without stale generic categories', () => {
    render(<MetricsSection t={(key: string) => translations[key] ?? key} />);

    expect(screen.getByText('Redirect latency P50')).toBeDefined();
    expect(screen.getByText('Redirect latency P99')).toBeDefined();
    expect(screen.getByText('Warm-cache hit rate')).toBeDefined();
    expect(screen.getAllByText('Documented target')).toHaveLength(3);
  });
});
