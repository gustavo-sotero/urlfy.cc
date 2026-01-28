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
    passwordProtected: 'Password Protected'
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
