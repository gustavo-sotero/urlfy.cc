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
    deletedSubtitle: 'Review deleted links and restore anything still needed',
    recentLinks: 'Recent Links',
    viewAll: 'View all',
    newLink: 'New Link',
    deleteConfirm: 'Are you sure you want to delete this link?',
    createFirst: 'Create first link',
    showActive: 'Active links',
    showDeleted: 'Deleted links'
  },

  linkCard: {
    clicks: 'clicks',
    createdAt: 'Created',
    expiresAt: 'Expires',
    copyLink: 'Copy Link',
    viewAnalytics: 'View Analytics',
    edit: 'Edit',
    delete: 'Delete',
    restore: 'Restore',
    qrCode: 'QR Code',
    deleted: 'Deleted',
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
    title: 'Verify your email address',
    description:
      'You can keep using urlfy.cc, but verifying your email confirms that you own this address and helps us deliver security and onboarding messages to the right inbox.',
    justSentTitle: 'Verification email sent',
    justSentDescription:
      'We sent a verification email to {email}. This is separate from your welcome email.',
    justSentHelp:
      'Check your inbox and spam folder. If nothing arrives in a few minutes, use the resend action below.',
    sending: 'Sending...',
    sent: 'Verification email sent',
    resend: 'Resend verification email',
    checkInbox:
      'Check your inbox and spam folder. If nothing arrives in a few minutes, you can resend it.',
    errorEmail: 'We could not determine which email address to verify.',
    errorResend: 'We could not resend the verification email. Please try again.'
  },

  pagination: {
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {page} of {total}'
  },

  empty: {
    noSearch: 'No links found',
    noDeletedSearch: 'No deleted links match this search',
    noLinks: "You don't have any links yet. Create your first link!",
    noDeletedLinks: 'You do not have any deleted links to restore.',
    createAction: 'Create first link'
  },

  toasts: {
    deleteSuccess: 'Link deleted successfully',
    deleteError: 'Error deleting link',
    restoreSuccess: 'Link restored successfully',
    restoreError: 'Error restoring link',
    loadError: 'Error loading dashboard data',
    loadLinksError: 'Error loading links'
  }
} as const;
