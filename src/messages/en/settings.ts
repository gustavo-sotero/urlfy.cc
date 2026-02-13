export const Settings = {
  title: 'Settings',
  subtitle: 'Manage your preferences and account settings',
  account: 'Account',
  apiKeys: 'API Keys',

  profile: {
    title: 'Profile',
    description: 'Manage your personal information',
    name: 'Name',
    namePlaceholder: 'Your name',
    nameRequired: 'Name is required',
    email: 'Email',
    emailHint: 'Email cannot be changed',
    avatar: 'Avatar',
    updateProfile: 'Update Profile',
    save: 'Save changes',
    saveChanges: 'Save changes',
    saving: 'Saving...'
  },

  security: {
    title: 'Security',
    description: 'Manage authentication and 2FA',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    twoFactor: 'Two-Factor Authentication (2FA)',
    twoFactorDesc: 'Add an extra layer of security to your account',
    twoFactorDescription: 'Add an extra layer of security to your account',
    active: 'Active',
    twoFactorActive: 'Active',
    twoFactorRequired:
      'As an administrator, you are required to keep 2FA enabled to protect the system.',
    adminWarning:
      'As an administrator, you are required to keep 2FA enabled to protect the system.',
    enable2FA: 'Enable 2FA',
    disable2FA: 'Disable 2FA',
    backupCodes: 'Backup Codes',
    viewBackupCodes: 'View Backup Codes'
  },

  preferences: {
    title: 'Preferences',
    description: 'Customize your experience',
    language: 'Language',
    theme: 'Theme',
    notifications: 'Notifications',
    emailNotifications: 'Email Notifications',
    emailNotificationsDescription:
      'Receive notifications about your links via email',
    weeklyReports: 'Weekly Reports',
    weeklyReportsDescription: 'Receive analytics reports every week'
  },

  dangerZone: {
    title: 'Danger Zone',
    description: 'Permanently remove your account and all data',
    deleteAccount: 'Delete Account'
  },

  toasts: {
    saved: 'Settings updated',
    profileSaved: 'Profile updated successfully',
    profileUpdated: 'Profile updated successfully',
    error: 'Error saving settings',
    profileError: 'Error updating profile',
    nameRequired: 'Name is required'
  },

  apiKeysManager: {
    title: 'API Keys',
    description: 'Use API keys to access your links programmatically',
    documentation: 'Documentation',
    keysCount: '{count} key(s) created',
    generateNew: 'Generate new key',
    never: 'Never',
    empty: {
      title: 'No API keys created yet',
      description: 'Create your first key to start using the API'
    },
    table: {
      name: 'Name',
      key: 'Key',
      status: 'Status',
      createdAt: 'Created',
      lastUsed: 'Last used',
      actions: 'Actions',
      noName: 'Unnamed'
    },
    status: {
      active: 'Active',
      expired: 'Expired',
      revoked: 'Revoked',
      quotaExceeded: 'Quota Exceeded',
      unknown: 'Unknown'
    },
    revoke: {
      title: 'Revoke API Key?',
      description:
        'This action cannot be undone. The key {name} will be permanently revoked and can no longer be used.',
      cancel: 'Cancel',
      confirm: 'Revoke'
    },
    create: {
      title: 'Create New API Key',
      description: 'Give a descriptive name to easily identify this key.',
      nameLabel: 'Key name',
      namePlaceholder: 'E.g.: My Personal App',
      cancel: 'Cancel',
      submit: 'Create Key'
    },
    validation: {
      nameMin: 'Name must have at least 3 characters',
      nameMax: 'Name must have at most 50 characters'
    },
    success: {
      created: 'Key Created Successfully!',
      copyNow: 'Copy your key now!',
      oneTimeWarning:
        'This key will only be displayed once. Store it in a safe place.',
      keyLabel: 'Your API key',
      done: 'Done',
      copied: 'Copied to clipboard!'
    },
    errors: {
      copyError: 'Error copying',
      copyFallback: 'Use Ctrl+C to copy manually'
    }
  }
} as const;
