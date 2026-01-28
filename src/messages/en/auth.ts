export const Auth = {
  login: {
    title: 'Welcome Back',
    subtitle: 'Sign in to your account',
    email: 'Email',
    password: 'Password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    loginButton: 'Sign In',
    noAccount: "Don't have an account?",
    signUp: 'Sign up'
  },

  signup: {
    title: 'Create Account',
    subtitle: 'Get started with urlfy.cc',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    signupButton: 'Create Account',
    hasAccount: 'Already have an account?',
    signIn: 'Sign in',
    terms: 'By signing up, you agree to our',
    termsLink: 'Terms of Service',
    and: 'and',
    privacyLink: 'Privacy Policy'
  },

  oauth: {
    continueWith: 'Or continue with',
    google: 'Google',
    github: 'GitHub'
  }
} as const;
