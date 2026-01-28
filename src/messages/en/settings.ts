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
  }
} as const;
