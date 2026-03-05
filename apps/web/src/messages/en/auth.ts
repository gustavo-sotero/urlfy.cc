export const Auth = {
  login: {
    title: 'Sign in',
    subtitle: 'Sign in to your account to manage your links',
    email: 'Email',
    password: 'Password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    loginButton: 'Sign In',
    signingIn: 'Signing in...',
    signInWithEmail: 'Sign in with Email',
    noAccount: "Don't have an account?",
    createFreeAccount: 'Create free account',
    placeholders: {
      email: 'your@email.com',
      password: '••••••••'
    }
  },

  signup: {
    title: 'Create account',
    subtitle: 'Create your free account and start shortening links',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    signupButton: 'Create Account',
    creatingAccount: 'Creating account...',
    hasAccount: 'Already have an account?',
    signIn: 'Sign in',
    acceptTerms: 'I have read and accept the',
    termsLink: 'terms of service',
    and: 'and',
    privacyLink: 'privacy policy',
    passwordHint: 'Minimum 8 characters',
    placeholders: {
      name: 'Your name',
      email: 'your@email.com',
      password: '••••••••'
    }
  },

  oauth: {
    continueWith: 'Or continue with',
    createWith: 'Or create with email',
    google: 'Google',
    github: 'GitHub'
  },

  errors: {
    invalidEmail: 'Invalid email',
    passwordMin: 'Password must be at least {min} characters',
    nameMin: 'Name must be at least {min} characters',
    passwordsNoMatch: 'Passwords do not match',
    mustAcceptTerms: 'You must accept the terms of service',
    loginFailed: 'Login failed',
    signupFailed: 'Failed to create account',
    tryAgain: 'An error occurred. Please try again.',
    invalidCode: 'Invalid code. Please try again.',
    twoFactorFailed: 'Invalid code'
  },

  forgotPassword: {
    title: 'Forgot password?',
    subtitle: "Enter your email and we'll send you a password reset link",
    email: 'Email',
    sendButton: 'Send reset link',
    sending: 'Sending...',
    backToLogin: 'Back to login',
    successTitle: 'Check your email',
    successMessage:
      'If an account exists with this email, you will receive password reset instructions. The link is valid for 15 minutes.',
    expiryNote: 'The link expires in 15 minutes for security reasons',
    placeholders: {
      email: 'your@email.com'
    }
  },

  resetPassword: {
    title: 'Reset password',
    subtitle: 'Enter your new password below',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    resetButton: 'Reset password',
    resetting: 'Resetting...',
    backToLogin: 'Back to login',
    successTitle: 'Password reset successful',
    successMessage:
      'Your password has been reset successfully. You can now sign in with your new password.',
    errorTokenMissing:
      'Reset token is missing. Please request a new password reset link.',
    errorTokenInvalid:
      'This password reset link is invalid or has expired. Please request a new one.',
    expiryNote: 'This link expires in 15 minutes',
    passwordHint: 'Minimum 8 characters',
    placeholders: {
      newPassword: '••••••••',
      confirmPassword: '••••••••'
    }
  }
} as const;
