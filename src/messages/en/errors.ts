export const Errors = {
  notFound: {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist.',
    backHome: 'Back to Home'
  },

  linkNotFound: {
    title: 'Link Not Found',
    description: 'This short link does not exist or has been deleted.',
    createNew: 'Create a New Link'
  },

  linkExpired: {
    title: 'Link Expired',
    description: 'This link has expired and is no longer available.',
    expiresAt: 'Expired on'
  },

  linkBanned: {
    title: 'Link Unavailable',
    description:
      'This link has been disabled for violating our terms of service.'
  },

  unauthorized: {
    title: 'Unauthorized',
    description: 'You need to be logged in to access this page.',
    login: 'Login'
  },

  serverError: {
    title: 'Server Error',
    description: 'Something went wrong on our end. Please try again later.',
    retry: 'Retry'
  }
} as const;
