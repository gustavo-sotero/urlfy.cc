export const Terms = {
  title: 'Terms of Service',
  lastUpdated: 'Last updated',
  metaTitle: 'Terms of Service - urlfy.cc',
  metaDescription: 'Terms and conditions of use for the urlfy.cc service',

  sections: {
    s1: {
      title: '1. Acceptance of Terms',
      content:
        'By accessing and using urlfy.cc ("Service"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our Service.',
      warningTitle: '⚠️ Nature of the Service',
      warningContent:
        'urlfy.cc is a personal research and development project and technical demonstration, not a commercial product. This service is provided "AS IS" for portfolio and learning purposes. There are no guarantees of availability, data persistence, or SLA (Service Level Agreement).'
    },
    s2: {
      title: '2. Description of the Service',
      content:
        'urlfy.cc is a URL shortening service developed as a portfolio project that allows users to transform long links into shorter, more manageable versions. The Service includes, but is not limited to:',
      items: {
        i1: 'Creating shortened links',
        i2: 'Analytics and click statistics',
        i3: 'Link customization (custom aliases)',
        i4: 'Password protection and link expiration',
        i5: 'QR Code generation'
      },
      disclaimer:
        'Important: This service may be discontinued, modified, or have its data deleted at any time without prior notice, as it is a demonstration environment.'
    },
    s3: {
      title: '3. User Accounts',
      sub1Title: '3.1 Registration',
      sub1Content:
        'To access certain features, you may need to create an account. You agree to provide accurate, current, and complete information during the registration process.',
      sub2Title: '3.2 Account Security',
      sub2Content:
        'You are responsible for maintaining the confidentiality of your password and account. You agree to notify us immediately of any unauthorized use of your account.'
    },
    s4: {
      title: '4. Acceptable Use',
      content:
        'This is a demonstration service for educational purposes. You agree to use it responsibly and ethically.',
      prohibitedIntro: 'You agree NOT to use the Service to:',
      items: {
        i1: 'Create links to illegal, malicious, phishing, or spam content',
        i2: 'Distribute malware, viruses, or any harmful code',
        i3: 'Violate third-party intellectual property rights',
        i4: 'Harass, abuse, or harm other people',
        i5: 'Collect personal information from other users without consent',
        i6: 'Use excessive automation or scraping techniques',
        i7: 'Overload or interfere with the Service infrastructure'
      },
      note: 'Note: As this is a personal research and development project, use should be limited to testing and demonstration purposes. Intensive commercial use is not recommended.'
    },
    s5: {
      title: '5. User Content',
      sub1Title: '5.1 Responsibility',
      sub1Content:
        'You retain ownership of and are solely responsible for all links and content you create through the Service.',
      sub2Title: '5.2 License',
      sub2Content:
        'By creating a link, you grant us a worldwide, non-exclusive, royalty-free license to host, store, transfer, and display that link to provide the Service.'
    },
    s6: {
      title: '6. Violation and Termination',
      content:
        'We reserve the right to suspend or terminate your account and access to the Service, without prior notice, for violation of these Terms or for any other reason we deem appropriate.'
    },
    s7: {
      title: '7. Limitation of Liability',
      warningTitle:
        'Disclaimer of Warranties (Personal research and development project)',
      warningContent:
        'The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied, including, but not limited to:',
      items: {
        i1: 'Continuous availability or uptime (no SLA defined)',
        i2: 'Data persistence (backups may not exist or be incomplete)',
        i3: 'Bug fixes or regular maintenance',
        i4: 'Consistent performance',
        i5: 'Technical support'
      },
      content2:
        'As this is a portfolio project, we do not guarantee that the Service will always be available, uninterrupted, or error-free. Under no circumstances will we be liable for indirect, incidental, consequential damages, or data loss.',
      recommendation:
        'Recommendation: Do not use this service for business-critical links or those requiring availability guarantees.'
    },
    s8: {
      title: '8. Modifications to Terms',
      content:
        'We reserve the right to modify these Terms at any time. We will notify users of significant changes through the Service or by email. Continued use of the Service after such modifications constitutes acceptance of the new Terms.'
    },
    s9: {
      title: '9. Governing Law',
      content:
        'These Terms are governed by the laws of Brazil. Any dispute related to these Terms will be resolved in the competent courts of Brazil.'
    },
    s10: {
      title: '10. Contact',
      content: 'For questions about these Terms, contact us through our',
      contactLink: 'contact page'
    }
  }
} as const;
