export const LinkForm = {
  // Page titles
  titleNew: 'Create New Link',
  titleEdit: 'Edit Link',
  subtitleNew: 'Fill in the fields below to create a shortened link',
  subtitleEdit: 'Update your link settings',

  // Form sections
  sections: {
    basic: 'Basic Information',
    basicDesc: 'Destination URL and main settings',
    advanced: 'Advanced Settings',
    advancedDesc: 'Customize how your link behaves',
    meta: 'Meta Tags',
    metaDesc: 'Customize how your link appears when shared',
    limits: 'Status & Limits',
    limitsDesc: 'Configure availability and restrictions',
    tracking: 'UTM Tracking',
    trackingDesc: 'Add tracking parameters',
    security: 'Security',
    securityDesc: 'Protect your link with a password'
  },

  // Field labels and placeholders
  label: 'Enter your URL',
  placeholder: 'https://example.com/your-very-long-url',
  shortenButton: 'Shorten',
  customAlias: 'Custom Alias',
  customAliasPlaceholder: 'my-custom-link',
  advancedOptions: 'Advanced Options',
  expiresAt: 'Expires At',
  expirationDate: 'Expiration Date',
  maxClicks: 'Max Clicks',
  maxClicksLimit: 'Click Limit',
  password: 'Password Protection',
  passwordPlaceholder: 'Enter password',
  metaTitle: 'Custom Meta Title',
  metaDescription: 'Custom Meta Description',
  metaImage: 'Meta Image',
  metaImagePlaceholder: 'https://example.com/image.png',
  utmSource: 'UTM Source',
  utmMedium: 'UTM Medium',
  utmCampaign: 'UTM Campaign',
  redirectType: 'Redirect Type',
  permanent: 'Permanent (301)',
  temporary: 'Temporary (302)',
  tags: 'Tags',
  tagsPlaceholder: 'Add tags...',
  notes: 'Notes',
  notesPlaceholder: 'Personal notes about this link...',
  isActive: 'Link Active',

  // Field labels
  fields: {
    url: {
      label: 'Destination URL',
      placeholder: 'https://example.com',
      hint: 'Paste the full URL you want to shorten'
    },
    alias: {
      label: 'Custom Alias',
      placeholder: 'my-link',
      hint: 'Between 3 and 20 characters, no spaces. Leave empty to auto-generate'
    },
    password: {
      label: 'Password',
      placeholder: '••••••',
      hint: 'Protect your link with a password'
    },
    expiresAt: {
      label: 'Expires at',
      hint: 'Link will be automatically disabled after this date'
    },
    maxClicks: {
      label: 'Click limit',
      hint: 'Leave empty for unlimited'
    },
    redirectType: {
      label: 'Redirect type',
      hint: '301: Permanent link (better for SEO). 302: Temporary link'
    },
    metaTitle: {
      label: 'Meta title',
      hint: 'Maximum 60 characters'
    },
    metaDescription: {
      label: 'Meta description',
      hint: 'Maximum 160 characters'
    },
    metaImage: {
      label: 'Meta image',
      hint: 'Image URL for sharing'
    },
    notes: {
      label: 'Notes',
      hint: 'Personal notes (not publicly visible)'
    },
    isActive: {
      label: 'Link Active',
      hint: 'Temporarily disable this link'
    }
  },

  // Hints and descriptions
  hints: {
    alias: 'Between 3 and 20 characters, no spaces',
    aliasEmpty: 'Leave empty to auto-generate',
    maxClicks: 'Leave empty for unlimited',
    currentClicks: 'Current clicks: {count}',
    redirectPermanent: '301: Permanent link (better for SEO)',
    redirectTemporary: '302: Temporary link',
    expiresAt: 'Link will be automatically disabled after this date',
    metaTitle: 'Maximum 60 characters',
    metaDescription: 'Maximum 160 characters',
    metaImage: 'Image URL for sharing',
    notes: 'Personal notes (not publicly visible)',
    isActiveOff: 'Temporarily disable this link'
  },

  // Actions
  actions: {
    save: 'Save changes',
    create: 'Create Link',
    cancel: 'Cancel',
    back: 'Back',
    backToList: 'Back to link list',
    backToDetails: 'Back to details'
  },

  // Validation messages
  validation: {
    required: 'Required field',
    invalidUrl: 'Invalid URL',
    invalidAlias: 'Invalid alias',
    invalidDate: 'Invalid date',
    invalidImage: 'Invalid image URL',
    positiveNumber: 'Limit must be greater than zero',
    maxLength60: 'Maximum 60 characters',
    maxLength160: 'Maximum 160 characters'
  },

  // Error messages
  errors: {
    invalidUrl: 'Please enter a valid URL',
    urlTooLong: 'URL is too long (max 2048 characters)',
    aliasTaken: 'This alias is already taken',
    aliasReserved: 'This alias is reserved by the system',
    quotaExceeded: 'You have reached your link quota',
    createFailed: 'Error creating link',
    updateFailed: 'Error updating link',
    loadFailed: 'Error loading link'
  },

  summary: {
    title: 'Review before you publish',
    descriptionNew:
      'The primary path is ready. Use the extra sections only when this link needs more control.',
    descriptionEdit:
      'Keep the operational settings aligned without digging through every advanced field.',
    destination: 'Destination',
    shortCode: 'Short link slug',
    shortLink: 'Short link',
    redirect: 'Redirect mode',
    limits: 'Limits',
    security: 'Protection',
    linkStatus: 'Link status',
    currentClicks: 'Current clicks',
    none: 'Not configured',
    noDestination: 'Add a valid destination URL',
    autoAlias: 'Auto-generated',
    passwordEnabled: 'Password enabled',
    activeValue: 'Active',
    inactiveValue: 'Paused',
    expiresOnValue: 'Expires on {date}',
    maxClicksValue: '{count} clicks max',
    passwordPill: 'Password protection',
    limitsPill: 'Expiry or click limit',
    metadataPill: 'Meta preview customized',
    trackingPill: 'UTM tracking ready',
    notesPill: 'Private notes added',
    statusCreating: 'Creating link',
    statusSaving: 'Saving changes',
    statusValidating: 'Validating inputs',
    statusReady: 'Ready to submit',
    statusNeedsReview: 'Review required fields'
  },

  // Success messages
  success: {
    created: 'Link created successfully!',
    updated: 'Link updated successfully!',
    copied: 'Link copied to clipboard!'
  },

  // Guest/landing form
  guest: {
    label: 'Enter your URL',
    placeholder: 'Paste your URL here...',
    shorten: 'Shorten',
    creating: 'Creating...',
    successMessage: 'Link created successfully!',
    createAnother: 'Create another link',
    shortUrlLabel: 'Your shortened URL',
    invalidUrl: 'Invalid URL',
    freeNoSignup: 'Free and no sign-up required'
  }
} as const;
