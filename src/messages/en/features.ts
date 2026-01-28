export const Features = {
  sectionTitle: 'Features',
  sectionDescription: 'Everything you need to manage your links',

  fast: {
    title: 'Blazing Fast',
    description:
      'Redirect latency under 30ms with Redis caching and optimized database queries.'
  },

  analytics: {
    title: 'Detailed Analytics',
    description:
      'Track clicks, geographic data, devices, and referrers with privacy-first approach.'
  },

  security: {
    title: 'Secure & Private',
    description:
      'Password-protected links, GDPR compliance, and IP anonymization by default.'
  },

  custom: {
    title: 'Custom Aliases',
    description:
      'Create memorable branded short links with custom slugs and vanity URLs.'
  },

  qrcode: {
    title: 'QR Codes',
    description:
      'Generate QR codes instantly for your short links in multiple formats and sizes.'
  },

  api: {
    title: 'Developer API',
    description:
      'Full REST API with comprehensive documentation for programmatic access.'
  }
} as const;
