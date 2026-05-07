export const Auth = {
  login: {
    title: 'Fazer login',
    subtitle: 'Entre na sua conta para gerenciar seus links',
    email: 'E-mail',
    password: 'Senha',
    rememberMe: 'Lembrar-me',
    forgotPassword: 'Esqueceu a senha?',
    loginButton: 'Entrar',
    signingIn: 'Entrando...',
    signInWithEmail: 'Entrar com Email',
    reauthSubtitle:
      'O acesso administrativo exige um novo login recente com GitHub.',
    noAccount: 'Não tem conta?',
    createFreeAccount: 'Criar conta grátis',
    placeholders: {
      email: 'seu@email.com',
      password: '••••••••'
    }
  },

  signup: {
    title: 'Criar conta',
    subtitle: 'Crie sua conta grátis e comece a encurtar links',
    name: 'Nome',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    signupButton: 'Criar Conta',
    creatingAccount: 'Criando conta...',
    hasAccount: 'Já tem conta?',
    signIn: 'Fazer login',
    acceptTerms: 'Li e aceito os',
    termsLink: 'termos de uso',
    and: 'e a',
    privacyLink: 'política de privacidade',
    passwordHint: 'Mínimo de 8 caracteres',
    placeholders: {
      name: 'Seu nome',
      email: 'seu@email.com',
      password: '••••••••'
    }
  },

  oauth: {
    continueWith: 'Ou continue com',
    createWith: 'Ou crie com email',
    google: 'Google',
    github: 'GitHub'
  },

  errors: {
    invalidEmail: 'Email inválido',
    passwordMin: 'Senha deve ter no mínimo {min} caracteres',
    nameMin: 'Nome deve ter no mínimo {min} caracteres',
    passwordsNoMatch: 'As senhas não coincidem',
    mustAcceptTerms: 'Você deve aceitar os termos de uso',
    loginFailed: 'Erro ao fazer login',
    signupFailed: 'Erro ao criar conta',
    tryAgain: 'Erro ao processar. Tente novamente.',
    invalidCode: 'Código inválido. Tente novamente.',
    twoFactorFailed: 'Código inválido'
  },

  forgotPassword: {
    title: 'Esqueceu a senha?',
    subtitle: 'Digite seu email e enviaremos um link para redefinir sua senha',
    email: 'E-mail',
    sendButton: 'Enviar link de recuperação',
    sending: 'Enviando...',
    backToLogin: 'Voltar ao login',
    successTitle: 'Verifique seu email',
    successMessage:
      'Se existir uma conta com este email, você receberá instruções para redefinir a senha. O link é válido por 15 minutos.',
    expiryNote: 'O link expira em 15 minutos por motivos de segurança',
    placeholders: {
      email: 'seu@email.com'
    }
  },

  resetPassword: {
    title: 'Redefinir senha',
    subtitle: 'Digite sua nova senha abaixo',
    newPassword: 'Nova senha',
    confirmPassword: 'Confirmar nova senha',
    resetButton: 'Redefinir senha',
    resetting: 'Redefinindo...',
    backToLogin: 'Voltar ao login',
    successTitle: 'Senha redefinida com sucesso',
    successMessage:
      'Sua senha foi redefinida com sucesso. Agora você pode fazer login com sua nova senha.',
    errorTokenMissing:
      'Token de redefinição ausente. Por favor, solicite um novo link de redefinição de senha.',
    errorTokenInvalid:
      'Este link de redefinição de senha é inválido ou expirou. Por favor, solicite um novo.',
    expiryNote: 'Este link expira em 15 minutos',
    passwordHint: 'Mínimo de 8 caracteres',
    placeholders: {
      newPassword: '••••••••',
      confirmPassword: '••••••••'
    }
  },

  emailVerificationResult: {
    metaTitle: 'Verificação de e-mail',
    metaDescription:
      'Confirme o status da verificação do seu e-mail e continue com segurança para a sua conta.',
    successBadge: 'E-mail verificado',
    successTitle: 'Seu e-mail foi confirmado',
    successDescription:
      'Seu link de verificação funcionou e este endereço agora está confirmado.',
    successHint:
      'Se este navegador ainda não estiver autenticado, siga para o login e nós o levaremos de volta ao seu dashboard.',
    errorBadge: 'Falha na verificação',
    errorTitle: 'Este link de verificação não é mais válido',
    errorDescription:
      'Este link de verificação é inválido, expirou ou já foi utilizado.',
    errorHint:
      'Entre na sua conta e solicite um novo e-mail de verificação pelo dashboard se ainda precisar concluir a confirmação.',
    pendingBadge: 'Status da verificação',
    pendingTitle: 'Status da verificação atualizado',
    pendingDescription:
      'Continue para a sua conta para confirmar o status mais recente de verificação deste endereço.',
    pendingHint:
      'Se este navegador ainda não estiver autenticado, continue para o login e depois abra o dashboard.',
    continueCta: 'Continuar para o login',
    retryCta: 'Abrir login',
    homeCta: 'Voltar para a home',
    errorCodeLabel: 'Código do erro:'
  }
} as const;
