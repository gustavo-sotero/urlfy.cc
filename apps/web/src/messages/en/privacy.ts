export const Privacy = {
  title: 'Privacy Policy',
  lastUpdated: 'Last updated',
  metaTitle: 'Privacy Policy - urlfy.cc',
  metaDescription:
    'Privacy policy and data protection for urlfy.cc - LGPD/GDPR compliant',

  exportData: 'Export My Data',
  deleteAccount: 'Delete My Account',
  dataRetention: 'Data Retention Policy',

  sections: {
    s1: {
      title: '1. Introduction',
      warningTitle: '📚 Context: Personal R&D project',
      warningContent:
        'urlfy.cc is a production-grade URL shortener that also serves as a portfolio and applied-research project. Collected data is used to operate the service and to demonstrate analytics and compliance (LGPD/GDPR) practices.',
      warningNote:
        'Important: As this is a demonstration environment, data may be periodically deleted or modified without prior notice. We do not recommend using this service for business-critical links.',
      content:
        'urlfy.cc ("we", "our" or "Service") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store and protect your information in accordance with the Brazilian General Data Protection Law (LGPD) and international regulations such as GDPR.'
    },
    s2: {
      title: '2. Data We Collect',
      sub1Title: '2.1 Account Information',
      sub1Intro: 'When you create an account, we collect:',
      sub1Items: {
        i1: 'Name and email address',
        i2: 'Password (stored with bcrypt encryption)',
        i3: 'OAuth profile information (if using social login)'
      },
      sub2Title: '2.2 Analytics Data',
      sub2Intro: 'To provide statistics about your links, we collect:',
      sub2Items: {
        i1: 'IP address (anonymized through immediate SHA-256 hash)',
        i2: 'Country and city (through offline geolocation)',
        i3: 'Browser, operating system and device type',
        i4: 'Referral URL (click source)',
        i5: 'Access timestamp'
      },
      sub2Note:
        'Important: We never store your IP address in plain text. It is converted to an irreversible hash immediately after collection.',
      sub3Title: '2.3 Cookies',
      sub3Intro: 'We use cookies to:',
      sub3Items: {
        i1: 'Keep your session active (essential cookies)',
        i2: 'Protect against CSRF (security cookies)'
      }
    },
    s3: {
      title: '3. How We Use Your Data',
      intro: 'We use your data to:',
      items: {
        i1: 'Provide and maintain the Service',
        i2: 'Generate statistics and analytics about your links',
        i3: 'Authenticate and manage your account',
        i4: 'Send important notifications about the Service',
        i5: 'Detect and prevent fraud and abuse',
        i6: 'Comply with legal obligations'
      },
      note: 'Research Context: Collected data is also used to demonstrate technical competencies in implementing analytics systems with privacy (IP hashing, anonymization, LGPD compliance).'
    },
    s4: {
      title: '4. Legal Basis (LGPD)',
      intro: 'We process your data based on:',
      items: {
        i1Heading: 'Consent:',
        i1: 'When you create an account or accept cookies',
        i2Heading: 'Contract execution:',
        i2: 'To provide the requested Service',
        i3Heading: 'Legitimate interest:',
        i3: 'For security, fraud prevention and Service improvements',
        i4Heading: 'Legal obligation:',
        i4: 'When required by law'
      }
    },
    s5: {
      title: '5. Data Sharing',
      intro: 'We do not sell your personal data. We may share data only with:',
      items: {
        i1Heading: 'Service providers:',
        i1: 'Companies that help us operate the Service (hosting, email)',
        i2Heading: 'Legal authorities:',
        i2: 'When required by law or to protect legal rights'
      }
    },
    s6: {
      title: '6. Data Retention',
      intro: 'We keep your data for the following periods:',
      items: {
        i1Heading: 'Account data:',
        i1: 'As long as your account is active',
        i2Heading: 'Raw analytics:',
        i2: '90 days (then only aggregated data)',
        i3Heading: 'Backups:',
        i3: 'Up to 30 days after deletion'
      },
      warningTitle: '⚠️ Warning: Demonstration Environment',
      warningContent:
        'As this is a personal R&D project, data may be periodically deleted (including before the periods described above) for demonstrations, testing or maintenance. We recommend not storing critical links or important data in this service.'
    },
    s7: {
      title: '7. Your Rights (LGPD/GDPR)',
      intro: 'You have the right to:',
      items: {
        i1Heading: 'Access:',
        i1: 'Request a copy of all your data',
        i2Heading: 'Rectification:',
        i2: 'Correct inaccurate or incomplete data',
        i3Heading: 'Deletion:',
        i3: 'Request the removal of your data',
        i4Heading: 'Portability:',
        i4: 'Receive your data in a structured format',
        i5Heading: 'Consent revocation:',
        i5: 'Withdraw consent at any time',
        i6Heading: 'Opposition:',
        i6: 'Object to the processing of your data'
      },
      contactNote:
        'To exercise these rights, access your account settings or contact us through our',
      contactLink: 'contact page',
      contactSuffix:
        '. We will respond within 72 hours as required by the LGPD.'
    },
    s8: {
      title: '8. Security',
      intro:
        'We implement technical and organizational measures to protect your data:',
      items: {
        i1: 'TLS/SSL encryption on all connections',
        i2: 'Passwords stored with bcrypt (secure hashing)',
        i3: 'Immediate anonymization of IP addresses',
        i4: 'Encrypted backups',
        i5: 'Strict access controls',
        i6: 'Continuous security monitoring'
      }
    },
    s9: {
      title: '9. International Transfers',
      content:
        'Your data is stored on servers located in Brazil. If international data transfer is necessary, we ensure adequate protection as required by the LGPD.'
    },
    s10: {
      title: '10. Minors',
      content:
        'The Service is not directed at minors under 18. We do not intentionally collect data from minors. If we become aware of such data, we will delete it immediately.'
    },
    s11: {
      title: '11. Changes to this Policy',
      content:
        'We may update this Policy periodically. We will notify you of significant changes through the Service or by email. We recommend reviewing this Policy regularly.'
    },
    s12: {
      title: '12. Contact and DPO',
      content:
        'For privacy questions or to exercise your rights, contact us through our',
      contactLink: 'contact page'
    },
    s13: {
      title: '13. Supervisory Authority',
      content:
        'If you are not satisfied with our response, you have the right to file a complaint with the National Data Protection Authority (ANPD) in Brazil.'
    }
  }
} as const;
