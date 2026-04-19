import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

let isMobileValue = false;
const lineChartProps: Array<Record<string, unknown>> = [];
const lineProps: Array<Record<string, unknown>> = [];
const barChartProps: Array<Record<string, unknown>> = [];
const xAxisProps: Array<Record<string, unknown>> = [];
const yAxisProps: Array<Record<string, unknown>> = [];
const legendProps: Array<Record<string, unknown>> = [];
const pieProps: Array<Record<string, unknown>> = [];

function resetCapturedProps() {
  lineChartProps.length = 0;
  lineProps.length = 0;
  barChartProps.length = 0;
  xAxisProps.length = 0;
  yAxisProps.length = 0;
  legendProps.length = 0;
  pieProps.length = 0;
}

mock.module('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: mock((namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'Analytics.charts': {
        clicksChartAriaLabel: 'Clicks chart',
        noData: 'No data',
        clicks: 'Clicks',
        uniqueVisitors: 'Unique visitors',
        topCountries: 'Top countries',
        topReferrers: 'Top referrers'
      },
      Analytics: {
        'devices.desktop': 'Desktop',
        'devices.mobile': 'Mobile',
        'devices.tablet': 'Tablet',
        'charts.noData': 'No data',
        'charts.clicks': 'Clicks'
      }
    };

    return (key: string) => messages[namespace]?.[key] || key;
  })
}));

mock.module('@/lib/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileValue
}));

mock.module('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: (props: Record<string, unknown>) => {
    legendProps.push(props);
    return <div data-testid="legend" />;
  },
  LineChart: (props: Record<string, unknown> & { children?: ReactNode }) => {
    lineChartProps.push(props);
    return <div data-testid="line-chart">{props.children}</div>;
  },
  Line: (props: Record<string, unknown>) => {
    lineProps.push(props);
    return <div data-testid={`line-${String(props.dataKey)}`} />;
  },
  XAxis: (props: Record<string, unknown>) => {
    xAxisProps.push(props);
    return <div data-testid="x-axis" />;
  },
  YAxis: (props: Record<string, unknown>) => {
    yAxisProps.push(props);
    return <div data-testid="y-axis" />;
  },
  BarChart: (props: Record<string, unknown> & { children?: ReactNode }) => {
    barChartProps.push(props);
    return <div data-testid="bar-chart">{props.children}</div>;
  },
  Bar: ({ children }: { children?: ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  PieChart: ({ children }: { children?: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: (props: Record<string, unknown> & { children?: ReactNode }) => {
    pieProps.push(props);
    return <div data-testid="pie">{props.children}</div>;
  }
}));

describe('Dashboard charts', () => {
  afterEach(() => {
    cleanup();
    isMobileValue = false;
    resetCapturedProps();
  });

  it('builds sorted mobile chart data for ClicksChart', async () => {
    isMobileValue = true;
    const { ClicksChart } = await import('@/components/charts/clicks-chart');

    render(
      <ClicksChart
        data={[
          {
            linkId: 'link-1',
            date: '2026-01-03T00:00:00.000Z',
            clicks: 8,
            uniqueVisitors: 4
          },
          {
            linkId: 'link-1',
            date: '2026-01-01T00:00:00.000Z',
            clicks: 3,
            uniqueVisitors: 2
          }
        ]}
      />
    );

    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Clicks chart'
    );
    expect(
      (lineChartProps[0].data as Array<{ clicks: number }>).map(
        (item) => item.clicks
      )
    ).toEqual([3, 8]);
    expect(xAxisProps[0].minTickGap).toBe(20);
    expect(legendProps[0].wrapperStyle).toEqual({
      paddingTop: '12px',
      fontSize: '11px'
    });
    expect(lineProps.find((item) => item.dataKey === 'clicks')?.dot).toBe(
      false
    );
  });

  it('limits CountriesChart items on mobile and exposes truncation rules', async () => {
    isMobileValue = true;
    const { CountriesChart } = await import(
      '@/components/charts/countries-chart'
    );

    render(
      <CountriesChart
        data={Array.from({ length: 8 }, (_, index) => ({
          code: `C${index}`,
          countryName: `Long Country Name ${index}`,
          clicks: index + 1
        }))}
      />
    );

    expect(
      (barChartProps[0].data as Array<{ countryName: string }>).length
    ).toBe(6);
    expect(yAxisProps[0].width).toBe(56);
    expect(
      (yAxisProps[0].tickFormatter as (value: string) => string)(
        'VeryLongCountryName'
      )
    ).toBe('VeryLong…');
  });

  it('renders localized device cards and compact pie radii on mobile', async () => {
    isMobileValue = true;
    const { DevicesChart } = await import('@/components/charts/devices-chart');

    render(
      <DevicesChart
        data={[
          { type: 'desktop', clicks: 10, percentage: 50 },
          { type: 'mobile', clicks: 7, percentage: 35 },
          { type: 'tablet', clicks: 3, percentage: 15 }
        ]}
      />
    );

    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Desktop: 10'
    );
    expect(screen.getByText('Desktop')).toBeDefined();
    expect(screen.getByText('Mobile')).toBeDefined();
    expect(screen.getByText('Tablet')).toBeDefined();
    expect(screen.getByText('10 • 50.0%')).toBeDefined();
    expect(pieProps[0].outerRadius).toBe(68);
    expect(pieProps[0].innerRadius).toBe(34);
  });

  it('falls back to domain values and limits ReferrersChart entries on mobile', async () => {
    isMobileValue = true;
    const { ReferrersChart } = await import(
      '@/components/charts/referrers-chart'
    );

    render(
      <ReferrersChart
        data={[
          { domain: 'google.com', clicks: 20 },
          { referrer: 'newsletter.example.com', clicks: 10 },
          { clicks: 8 },
          { referrer: 'social.example.com', clicks: 7 },
          { referrer: 'blog.example.com', clicks: 6 },
          { referrer: 'extra.example.com', clicks: 5 }
        ]}
      />
    );

    expect((barChartProps[0].data as Array<{ referrer: string }>).length).toBe(
      5
    );
    expect(
      (barChartProps[0].data as Array<{ referrer: string }>)[0].referrer
    ).toBe('google.com');
    expect(
      (barChartProps[0].data as Array<{ referrer: string }>)[2].referrer
    ).toBe('Direct');
    expect(yAxisProps[0].width).toBe(28);
    expect(
      (xAxisProps[0].tickFormatter as (value: string) => string)(
        'newsletter.example.com'
      )
    ).toBe('newsletter…');
  });
});
