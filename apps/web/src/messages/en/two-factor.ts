export const TwoFactor = {
  verification: {
    heading: 'Two-Factor Authentication',
    totpDescription: 'Enter the 6-digit code from your authenticator app',
    backupDescription: 'Enter one of your backup codes',
    enterBackupCode: 'Enter a backup code',
    verifyingCode: 'Verifying code...',
    backupCodeLabel: 'Backup Code',
    backupPlaceholder: 'xxxx-xxxx-xxxx',
    verifying: 'Verifying...',
    verifyBackupCode: 'Verify Backup Code',
    useBackupCode: 'Use backup code',
    useAuthenticator: 'Use authenticator app',
    backToLogin: '\u2190 Back to login'
  },

  setup: {
    enableButton: 'Enable Two-Factor Authentication',
    dialogTitle: 'Enable 2FA',
    dialogDescription: 'To begin, confirm your current password',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    verifying: 'Verifying...',
    continue: 'Continue',
    scanQrCode: 'Scan the QR Code',
    scanDescription:
      'Use an authenticator app like Google Authenticator or Authy',
    qrAlt: 'QR Code for 2FA setup',
    manualCode: 'Or enter the code manually:',
    codeCopied: 'Code copied',
    next: 'Next',
    verifyTitle: 'Verify Code',
    verifyDescription: 'Enter the 6-digit code from your authenticator app',
    verifyingCode: 'Verifying code...',
    back: 'Back',
    verify: 'Verify',
    activatedTitle: '2FA Activated!',
    activatedDescription:
      'Store these backup codes in a safe place. Each code can only be used once.',
    copied: 'Copied!',
    copy: 'Copy',
    download: 'Download',
    warning:
      '\u26A0\uFE0F These codes will not be shown again. Make sure to save them before continuing.',
    finish: 'Finish',
    errors: {
      init: 'Error initializing 2FA. Please try again.',
      password: 'Incorrect password or error setting up 2FA',
      invalidCode: 'Invalid code. Please try again.',
      code6digits: 'Enter the 6-digit code',
      copyError: 'Error copying codes',
      passwordRequired: 'Password is required'
    },
    success: {
      activated: '2FA activated successfully!',
      adminNote:
        'Wait up to 30 seconds to access admin areas due to session cache.',
      codesCopied: 'Codes copied to clipboard',
      codesDownloaded: 'Codes downloaded'
    }
  },

  backupCodes: {
    generateTitle: 'Generate New Backup Codes',
    generateDescription:
      'For security, confirm your password and authenticator code. New codes will be generated and existing ones will be invalidated.',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    authCodeLabel: 'Authenticator Code',
    generating: 'Generating...',
    generateButton: 'Generate New Codes',
    codesTitle: 'Backup Codes',
    codesDescription:
      'Store these codes in a safe place. Each code can only be used once to recover access to your account.',
    copied: 'Copied!',
    copy: 'Copy',
    download: 'Download',
    warning:
      '\u26A0\uFE0F Your old codes have been invalidated. Save these new codes in a safe place.',
    close: 'Close',
    generateNew: 'Generate New Codes',
    errors: {
      invalidAuth: 'Invalid authentication code',
      generateFailed: 'Could not generate new backup codes',
      authFailed: 'Incorrect authentication code or password',
      copyError: 'Error copying codes',
      passwordRequired: 'Password is required',
      code6digits: 'Code must have 6 digits'
    },
    success: {
      codesCopied: 'Codes copied to clipboard',
      codesDownloaded: 'Codes downloaded'
    }
  },

  disable: {
    button: 'Disable 2FA',
    adminWarning:
      'Administrators are required to keep 2FA enabled for security',
    dialogTitle: 'Disable Two-Factor Authentication?',
    dialogDescription:
      'This will make your account less secure. You will only need your password to log in.',
    confirmPassword: 'Confirm your password',
    passwordPlaceholder: 'Enter your password',
    cancel: 'Cancel',
    disabling: 'Disabling...',
    disableButton: 'Disable 2FA',
    success: '2FA disabled successfully',
    errors: {
      passwordRequired: 'Password is required',
      failed: 'Error disabling 2FA. Check your password.'
    }
  }
} as const;
