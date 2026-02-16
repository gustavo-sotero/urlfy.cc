export const Analytics = {
  title: 'Analytics',
  subtitle: 'Detailed metrics of your links',
  overview: 'Overview',
  overviewDesc: 'Performance overview of your links',
  totalClicks: 'Total Clicks',
  uniqueVisitors: 'Unique Visitors',
  avgClicksPerDay: 'Avg Clicks/Day',
  lastClicked: 'Last Clicked',
  conversionRate: 'Conversion Rate',
  activeLinks: 'Active Links',
  comparedToPrevious: 'compared to previous period',
  conversionRateDesc: 'Unique visitors / Total clicks',
  ofTotal: 'of {total} total links',

  filters: {
    allLinks: 'All Links',
    selectLink: 'Select Link',
    selectPeriod: 'Select Period'
  },

  charts: {
    clicksOverTime: 'Clicks Over Time',
    topCountries: 'Top Countries',
    deviceBreakdown: 'Device Breakdown',
    topBrowsers: 'Top Browsers',
    topReferrers: 'Top Referrers',
    trafficSources: 'Traffic Sources',
    clicks: 'Clicks',
    uniqueVisitors: 'Unique Visitors',
    clicksChartAriaLabel: 'Chart showing clicks over time',
    noData: 'No data available'
  },

  devices: {
    desktop: 'Desktop',
    mobile: 'Mobile',
    tablet: 'Tablet'
  },

  period: {
    today: 'Today',
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    custom: 'Custom Range',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    last90: 'Last 90 days'
  },

  empty: {
    title: 'No data',
    description: 'Wait for the first clicks to see metrics.',
    noData: 'No data available for the selected period'
  },

  growth: {
    comparedToPreviousPeriod: 'compared to previous period'
  },

  errors: {
    loadFailed: 'Error loading analytics',
    loadLinks: 'Error loading links'
  }
} as const;
