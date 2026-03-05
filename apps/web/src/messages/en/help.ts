export const Help = {
  title: 'How can we help?',
  subtitle: 'Find answers to the most common questions about urlfy.cc',
  metaTitle: 'Help & Support - urlfy.cc',
  metaDescription:
    'Frequently asked questions and help documentation for urlfy.cc',
  searchPlaceholder: 'Search help articles...',
  categories: 'Categories',
  gettingStarted: 'Getting Started',
  features: 'Features',
  api: 'API Documentation',
  troubleshooting: 'Troubleshooting',

  faqTitle: 'Frequently Asked Questions',

  faq: {
    q1: {
      question: 'How do I create a shortened link?',
      intro: 'Creating a shortened link is very simple:',
      steps: {
        s1: 'Paste your long URL in the input field on the homepage',
        s2: 'Click the "Shorten" button',
        s3: 'Your short link will be generated instantly',
        s4: 'Copy and share wherever you want!'
      },
      note: 'No account creation is required to use the basic service.'
    },
    q2: {
      question: 'Can I customize my short link?',
      content:
        'Yes! Users with an account can create custom aliases. For example, instead of urlfy.cc/abc123, you can create urlfy.cc/my-offer.',
      tip: 'Simply create a free account and use the "Custom alias" field when creating a link.'
    },
    q3: {
      question: 'How do I track my link statistics?',
      intro: 'To access detailed analytics, you need to be logged in:',
      steps: {
        s1: 'Log in to your account',
        s2: 'Go to the Dashboard',
        s3: 'Click any link to see its statistics'
      },
      note: 'You will see information such as number of clicks, countries of origin, devices used and much more.'
    },
    q4: {
      question: 'Can I protect a link with a password?',
      content:
        'Yes, logged-in users can add password protection to their links. When someone tries to access the link, they will be asked for the password before being redirected.',
      tip: 'This is useful for sharing sensitive or restricted content with specific groups of people.'
    },
    q5: {
      question: 'Do links expire?',
      content:
        'By default, free links do not expire. However, users with an account can set an automatic expiration date or click limit.',
      note: 'After expiration, the link will stop working and show a message informing that it has expired.'
    },
    q6: {
      question: 'How do I generate a QR Code for my link?',
      intro:
        'Every link created on urlfy.cc can automatically generate a QR Code:',
      steps: {
        s1: 'Go to the dashboard and click the desired link',
        s2: 'Click the "Generate QR Code" button',
        s3: 'Choose the format (PNG or SVG) and size',
        s4: 'Download and use wherever you want!'
      }
    },
    q7: {
      question: 'Is my data safe?',
      intro: 'Yes! We take security and privacy very seriously:',
      items: {
        i1: 'All connections are encrypted with TLS/SSL',
        i2: 'Passwords are stored with bcrypt hash',
        i3: 'IP addresses are anonymized immediately',
        i4: 'We are 100% compliant with LGPD and GDPR'
      },
      linkText: 'Read our',
      privacyLink: 'Privacy Policy',
      linkSuffix: 'for more details.'
    },
    q8: {
      question: 'What is the difference between plans?',
      content:
        'Note: As this is a personal R&D and portfolio project, there are no commercial plans. The service is free for demonstration and feature testing purposes.'
    },
    q9: {
      question: 'Can I delete my data?',
      intro: 'Yes, you have full control over your data. You can:',
      items: {
        i1: 'Delete individual links at any time',
        i2: 'Export all your data in JSON format',
        i3: 'Request complete account and data deletion'
      },
      note: 'We process deletion requests within 72 hours, as required by LGPD.'
    },
    q10: {
      question: 'Is there an API for integration?',
      content:
        'Yes! Registered users have access to our complete REST API, allowing programmatic creation, management and analysis of links.',
      tip: 'API documentation is available at api.urlfy.cc/docs after creating your API key in the dashboard.'
    }
  },

  contactSection: {
    title: 'Still need help?',
    cardTitle: 'Contact Form',
    cardDescription:
      'Get in touch with us and we will respond within 24-48 hours.',
    sendMessage: 'Send message'
  }
} as const;
