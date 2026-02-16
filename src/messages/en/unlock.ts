export const Unlock = {
  title: 'Protected Link',
  description: 'This link requires a password to access',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter the password',
  verifying: 'Verifying...',
  unlock: 'Unlock',
  errors: {
    passwordRequired: 'Password is required',
    wrongPassword: 'Incorrect password',
    invalidRedirect: 'Invalid redirect destination'
  }
} as const;
