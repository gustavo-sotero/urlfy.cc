export const Emails = {
  welcome: {
    subject: 'Welcome to urlfy.cc, {firstName}! 🎉',
    previewText: 'Welcome to urlfy.cc, {firstName}! 🎉',
    greeting: 'Hello, {firstName}! 👋',
    welcomeMessage:
      'Welcome to urlfy.cc! We are very happy to have you with us.',
    accountCreated: 'Your account was created successfully',
    yourEmail: 'Your email',
    whatYouCanDo: 'What you can do now:',
    createLinks: 'Create Short Links',
    createLinksDesc: 'Shorten long URLs quickly and easily',
    customizeUrls: 'Customize Your URLs',
    customizeUrlsDesc: 'Create memorable aliases and custom slugs',
    trackAnalytics: 'Track Performance',
    trackAnalyticsDesc: 'Access detailed analytics and metrics',
    getStarted: 'Get Started',
    needHelp: 'Need help?',
    contactSupport: 'Contact our support',
    footer:
      'If you did not create this account, you can safely ignore this email.'
  },
  emailVerification: {
    subject: 'Confirm your email - urlfy.cc',
    previewText: 'Confirm your email to start using urlfy.cc',
    title: 'Confirm Your Email',
    greeting: 'Hello, {firstName}! 👋',
    message:
      "We're almost there! To start using urlfy.cc and enjoy all the features, you need to confirm your email address.",
    securityNotice: '🔐 Security',
    expiresIn:
      'This link expires in {minutes} minutes and can only be used once.',
    ctaButton: 'Confirm My Email',
    cantClick: "Can't click the button?",
    copyLink: 'Copy and paste this link into your browser:',
    footer:
      'If you did not create an account with urlfy.cc, you can safely ignore this email.'
  },
  passwordReset: {
    subject: 'Reset your password - urlfy.cc',
    previewText: 'Password recovery - urlfy.cc',
    title: 'Reset Password',
    greeting: 'Hello, {firstName}!',
    message:
      'We received a request to reset the password for your urlfy.cc account. If you did not make this request, please ignore this email.',
    expiresNotice: '⏱️ This link expires in {minutes} minutes for security.',
    ctaButton: 'Reset My Password',
    copyLink: 'Or copy and paste this link:',
    securityTips: '🔐 Security Tips',
    tip1: 'Never share your password with anyone',
    tip2: 'Use a unique password for each service',
    tip3: 'Consider using a password manager',
    didntRequest: "If you didn't request this, no action is needed.",
    footer: 'Your password will remain unchanged until you create a new one.'
  },
  dataDeletionConfirmation: {
    subject: 'Data Deletion Request Received',
    previewText: 'We received your data deletion request',
    title: 'Data Deletion Request',
    greeting: 'Hello, {firstName},',
    message:
      'We received your request to delete your personal data in accordance with GDPR/LGPD.',
    requestDetails: 'Request Details',
    requestedOn: 'Requested on',
    deadline: 'Processing deadline',
    whatHappensNext: 'What happens next?',
    step1: 'Your request will be processed within 72 hours',
    step2: 'All your personal data will be permanently deleted',
    step3: 'You will receive a confirmation email once completed',
    exportData: 'Export My Data Before Deletion',
    cancelRequest: 'Cancel this request',
    footer: 'This action is irreversible and cannot be undone.'
  },
  linkBanned: {
    subject: '⚠️ Link Blocked - Action Required',
    previewText: 'Link blocked for terms of use violation',
    title: 'Link Blocked',
    greeting: 'Hello, {firstName},',
    message:
      'We are informing you that one of your links has been blocked due to a violation of our Terms of Use.',
    shortCode: 'Short Code',
    originalUrl: 'Original URL',
    reason: 'Reason',
    bannedOn: 'Blocked on',
    whatYouCanDo: 'What you can do:',
    reviewTerms: 'Review our Terms of Use',
    appeal: 'File an appeal',
    appealDesc: 'If you believe this was a mistake',
    createNew: 'Create a new compliant link',
    createNewDesc: 'Make sure it follows our policies',
    footer:
      'Repeated violations may result in account suspension. Please review our Terms of Use.'
  },
  quotaWarning: {
    subject: '⚠️ You are using {percent}% of your quota',
    previewText: 'Your link quota is almost full',
    title: 'Quota Warning',
    greeting: 'Hello, {firstName}!',
    message:
      'Your link quota is almost full. Consider upgrading your plan or managing your existing links.',
    currentUsage: 'Current usage',
    quotaLimit: 'Quota limit',
    percentUsed: 'Percent used',
    whatYouCanDo: 'What you can do:',
    upgrade: 'Upgrade your plan',
    upgradeDesc: 'Get more links and premium features',
    manageLinks: 'Manage your links',
    manageLinksDesc: 'Delete unused links to free up space',
    footer: 'Need help? Contact our support team.'
  }
} as const;
