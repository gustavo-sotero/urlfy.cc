export const Dashboard = {
  title: 'Dashboard',
  subtitle: 'Overview of your links and statistics',
  overviewSubtitle: 'Performance overview of your links',
  createNew: 'Create New Link',
  search: 'Search links...',
  filterActive: 'Active',
  filterInactive: 'Inactive',
  filterExpired: 'Expired',
  filterAll: 'All',
  sortNewest: 'Newest First',
  sortOldest: 'Oldest First',
  sortMostClicks: 'Most Clicks',
  noLinks: 'No links found',
  noLinksDescription: 'Create your first shortened link to get started.',

  stats: {
    totalLinks: 'Total Links',
    totalClicks: 'Total Clicks',
    activeLinks: 'Active Links',
    clicksThisMonth: 'Clicks This Month',
    avgClicks: 'Average Clicks',
    perLink: 'per link',
    usedOf: '{used} of {limit} used'
  },

  links: {
    title: 'My Links',
    subtitle: 'Manage all your shortened links',
    recentLinks: 'Recent Links',
    viewAll: 'View all',
    newLink: 'New Link',
    deleteConfirm: 'Are you sure you want to delete this link?',
    createFirst: 'Create first link'
  },

  linkCard: {
    clicks: 'clicks',
    createdAt: 'Created',
    expiresAt: 'Expires',
    copyLink: 'Copy Link',
    viewAnalytics: 'View Analytics',
    edit: 'Edit',
    delete: 'Delete',
    qrCode: 'QR Code',
    expired: 'Expired',
    inactive: 'Inactive',
    passwordProtected: 'Password Protected',
    options: 'Link options',
    open: 'Open',
    limitReached: 'Limit reached',
    expiresIn: 'Expires on {date}',
    limit: 'Limit: {max}'
  },

  sidebar: {
    dashboard: 'Dashboard',
    links: 'Links',
    analytics: 'Analytics',
    settings: 'Settings'
  },

  linkDetail: {
    title: 'Link Details',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this link?',
    linkInfo: 'Link Information',
    shortLink: 'Short Link',
    originalUrl: 'Original URL',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    expiresAt: 'Expires on',
    clickLimit: 'Click Limit',
    totalClicks: 'Total Clicks',
    uniqueVisitors: 'Unique Visitors',
    conversionRate: 'Conversion Rate',
    avgClicksPerDay: 'Avg Clicks/Day',
    clicksOverTime: 'Clicks Over Time',
    last30Days: 'Last 30 days',
    countries: 'Countries',
    topCountriesByClicks: 'Top countries by clicks',
    devices: 'Devices',
    deviceDistribution: 'Distribution by device type',
    trafficSources: 'Traffic Sources',
    trafficSourcesDesc: 'Where your visitors come from',
    openNewTab: 'Open link in new tab',
    backAriaLabel: 'Back to links list',
    loadError: 'Error loading link'
  },

  verification: {
    title: 'Email verification pending',
    description:
      'Please verify your email address to get full access to the platform. You will not be able to create links until you confirm your email.',
    sending: 'Sending...',
    sent: 'Email sent!',
    resend: 'Resend email',
    checkInbox: 'Check your inbox and spam folder.',
    errorEmail: 'Could not get user email.',
    errorResend: 'Failed to resend email. Please try again.'
  },

  pagination: {
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {page} of {total}'
  },

  empty: {
    noSearch: 'No links found',
    noLinks: "You don't have any links yet. Create your first link!",
    createAction: 'Create first link'
  },

  toasts: {
    deleteSuccess: 'Link deleted successfully',
    deleteError: 'Error deleting link',
    loadError: 'Error loading dashboard data',
    loadLinksError: 'Error loading links'
  }
} as const;
