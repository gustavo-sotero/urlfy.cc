export const Contact = {
  title: 'Get in Touch',
  subtitle: 'Have a question or suggestion? We would love to hear from you.',
  metaTitle: 'Contact',
  metaDescription: 'Contact the urlfy.cc team. We are here to help!',

  name: 'Name',
  email: 'Email',
  message: 'Message',
  send: 'Send Message',
  success: 'Message sent successfully!',
  error: 'Failed to send message. Please try again.',

  sendUsMessage: 'Send us a message',
  connectWithUs: 'Connect with us',
  quickLinks: 'Quick Links',
  helpCenter: 'Help Center',
  aboutUs: 'About Us',
  termsOfService: 'Terms of Service',
  privacyPolicy: 'Privacy Policy',
  responseTime: 'We usually respond within 24-48 hours on business days.',

  form: {
    namePlaceholder: 'Your name',
    emailPlaceholder: 'your.email@example.com',
    subject: 'Subject',
    subjectPlaceholder: 'What is it about?',
    messagePlaceholder: 'Tell us more...',
    characters: 'characters',
    consentTitle: 'Data Storage Consent (LGPD Required)',
    consentDescription:
      'I agree to the storage of this data for contact purposes. Your information will only be used to reply to your message.',
    sending: 'Sending...',
    sendMessage: 'Send Message',

    validation: {
      nameMin: 'Name must be at least 2 characters',
      emailInvalid: 'Invalid email address',
      subjectMin: 'Subject must be at least 3 characters',
      messageMin: 'Message must be at least 10 characters',
      messageMax: 'Message must be at most 5000 characters',
      consentRequired: 'You must agree to data storage consent'
    },

    toast: {
      rateLimitTitle: 'Rate Limit Exceeded',
      rateLimitDescription: 'Too many requests. Please try again later.',
      failedTitle: 'Failed to Send Message',
      failedDescription: 'An error occurred. Please try again.',
      successTitle: 'Message Sent!',
      successDescription: 'We will reply soon.',
      networkTitle: 'Network Error',
      networkDescription:
        'Could not send the message. Check your connection and try again.'
    },

    successState: {
      title: 'Message Sent Successfully!',
      description:
        'Thank you for reaching out. We will reply as soon as possible.',
      sendAnother: 'Send Another Message'
    }
  }
} as const;
