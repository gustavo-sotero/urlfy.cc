export const Emails = {
  welcome: {
    subject: 'Welcome to urlfy.cc, {firstName}',
    previewText:
      'Your dashboard is ready, and a separate verification email is on the way.',
    greeting: 'Hello, {firstName},',
    welcomeMessage:
      'Welcome to urlfy.cc. Your dashboard is ready, and we also sent a separate verification email so you can confirm this address whenever you want.',
    accountCreated: 'Account ready',
    yourEmail: 'Email address',
    whatYouCanDo: 'Start with three quick wins',
    createLinks: 'Create short links',
    createLinksDesc:
      'Turn long URLs into clear, shareable links in a few seconds.',
    customizeUrls: 'Shape the slug',
    customizeUrlsDesc:
      'Create memorable aliases when you need cleaner campaigns and sharing.',
    trackAnalytics: 'Track engagement',
    trackAnalyticsDesc:
      'Monitor clicks and traffic patterns from one dashboard.',
    getStarted: 'Open dashboard',
    needHelp: 'Need help?',
    contactSupport: 'Visit the help center',
    footer:
      'If you did not create this account, you can safely ignore this email.'
  },
  emailVerification: {
    subject: 'Verify your email for urlfy.cc',
    previewText: 'Confirm that you own this email address.',
    title: 'Verify your email address',
    greeting: 'Hello, {firstName},',
    message:
      'A new urlfy.cc account was created with this email. Confirm that you own this address so account and security updates keep reaching the right inbox.',
    securityNotice: 'Verification link',
    expiresIn:
      'For security, this link expires in {minutes} minutes and can only be used once.',
    ctaButton: 'Verify email',
    cantClick: 'If the button does not work,',
    copyLink: 'copy and paste this link into your browser:',
    footer:
      'This message is separate from your welcome email. If you did not create this account, you can ignore it.'
  },
  passwordReset: {
    subject: 'Reset your password for urlfy.cc',
    previewText: 'Use this secure link to choose a new password.',
    title: 'Reset your password',
    greeting: 'Hello, {firstName},',
    message: 'We received a password reset request for your urlfy.cc account.',
    expiresNotice: 'This secure link expires in {minutes} minutes.',
    ctaButton: 'Choose a new password',
    copyLink: 'Or paste this link into your browser:',
    securityTips: 'Security tips',
    tip1: 'Never share your password with anyone',
    tip2: 'Use a unique password for each service',
    tip3: 'Consider using a password manager',
    didntRequest:
      'If you did not request this, you can safely ignore this email and your password will stay the same.',
    footer: 'Your current password keeps working until you finish the reset.'
  },
  dataDeletionConfirmation: {
    subject: 'We received your data deletion request',
    previewText: 'Your deletion request is queued and being processed.',
    title: 'Data deletion request received',
    greeting: 'Hello, {firstName},',
    message:
      'We received your request to delete your personal data under GDPR/LGPD.',
    requestDetails: 'Request details',
    requestedOn: 'Requested on',
    deadline: 'Processing deadline',
    whatHappensNext: 'What happens next',
    step1: 'We will review and process the request within 72 hours.',
    step2: 'Personal data tied to your account will be deleted permanently.',
    step3: 'We will send a confirmation email once the process is complete.',
    exportData: 'Export my data',
    cancelRequest: 'Reply if you need to cancel this request',
    footer: 'Deletion is permanent once processing is complete.',
    deletionHeader: 'What will be deleted',
    deletionItem1: 'All shortened links created',
    deletionItem2: 'Analytics history and metrics',
    deletionItem3: 'Authentication data and profile',
    deletionItem4: 'Settings and preferences',
    deletionItem5: 'API Keys and access tokens',
    exportPrompt: 'Need a copy first?',
    exportDesc:
      'Export your data before deletion if you want a personal backup.',
    warningNote:
      'If you changed your mind, reply to this email before the deadline above.'
  },
  linkBanned: {
    subject: 'Action required: one of your links was blocked',
    previewText: 'Review the reason for the block and the next steps.',
    title: 'A link on your account was blocked',
    greeting: 'Hello, {firstName},',
    message:
      'One of your links was blocked after a review for a Terms of Use violation.',
    shortCode: 'Short Code',
    originalUrl: 'Original URL',
    reason: 'Reason',
    bannedOn: 'Blocked on',
    whatYouCanDo: 'Next steps',
    reviewTerms: 'Review our Terms of Use',
    reviewTermsDesc:
      'Check the rule that applies to this destination before publishing another link.',
    appeal: 'Request a review',
    appealDesc: 'Use the appeal link if you believe this was a mistake.',
    createNew: 'Create a compliant replacement',
    createNewDesc: 'Make sure the new destination follows the platform rules.',
    footer: 'Repeated violations may lead to account restrictions.',
    implicationsHeader: 'What this means',
    implication1: 'The link is no longer accessible',
    implication2: 'Visitors will see an error page',
    implication3: 'Statistics have been preserved',
    implication4: 'You can contest this decision',
    commonReasonsHeader: 'Common reasons for blocking',
    commonReason1: 'Malicious content or phishing',
    commonReason2: 'Spam or abusive practices',
    commonReason3: 'Intellectual property violation',
    commonReason4: 'Illegal or inappropriate content',
    appealCta: 'Contest Ban'
  },
  quotaWarning: {
    subject: 'You have used {percent}% of your link quota',
    previewText: 'Your workspace is getting close to its limit.',
    title: 'Your link quota is almost full',
    greeting: 'Hello, {firstName},',
    message: 'You are approaching the limit for links on your current plan.',
    currentUsage: 'Current usage',
    quotaLimit: 'Plan limit',
    percentUsed: 'Used',
    whatYouCanDo: 'Recommended actions',
    upgrade: 'Upgrade your plan',
    upgradeDesc: 'Unlock more capacity and premium controls.',
    manageLinks: 'Archive or delete unused links',
    manageLinksDesc: 'Free up room by cleaning up links you no longer need.',
    footer: 'If you need help choosing the next step, visit the help center.',
    warningNear:
      'You are close to the limit. Review your current links or upgrade before new link creation slows you down.',
    warningCritical:
      'You only have {remaining} links left before you hit the limit.',
    upgradeCta: 'View plans'
  }
} as const;
