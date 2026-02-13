export const TwoFactor = {
  verification: {
    heading: 'Autenticação de Dois Fatores',
    totpDescription:
      'Digite o código de 6 dígitos do seu aplicativo autenticador',
    backupDescription: 'Digite um dos seus códigos de backup',
    enterBackupCode: 'Digite um código de backup',
    verifyingCode: 'Verificando código...',
    backupCodeLabel: 'Código de Backup',
    backupPlaceholder: 'xxxx-xxxx-xxxx',
    verifying: 'Verificando...',
    verifyBackupCode: 'Verificar Código de Backup',
    useBackupCode: 'Usar código de backup',
    useAuthenticator: 'Usar aplicativo autenticador',
    backToLogin: '\u2190 Voltar ao login'
  },

  setup: {
    enableButton: 'Ativar Autenticação de Dois Fatores',
    dialogTitle: 'Ativar 2FA',
    dialogDescription: 'Para começar, confirme sua senha atual',
    passwordLabel: 'Senha',
    passwordPlaceholder: 'Digite sua senha',
    verifying: 'Verificando...',
    continue: 'Continuar',
    scanQrCode: 'Escaneie o QR Code',
    scanDescription:
      'Use um aplicativo autenticador como Google Authenticator ou Authy',
    qrAlt: 'QR Code para configuração do 2FA',
    manualCode: 'Ou insira manualmente o código:',
    codeCopied: 'Código copiado',
    next: 'Próximo',
    verifyTitle: 'Verifique o Código',
    verifyDescription:
      'Digite o código de 6 dígitos do seu aplicativo autenticador',
    verifyingCode: 'Verificando código...',
    back: 'Voltar',
    verify: 'Verificar',
    activatedTitle: '2FA Ativado!',
    activatedDescription:
      'Guarde estes códigos de backup em um lugar seguro. Cada código pode ser usado apenas uma vez.',
    copied: 'Copiado!',
    copy: 'Copiar',
    download: 'Baixar',
    warning:
      '\u26A0\uFE0F Estes códigos não serão exibidos novamente. Certifique-se de salvá-los antes de continuar.',
    finish: 'Concluir',
    errors: {
      init: 'Erro ao inicializar 2FA. Tente novamente.',
      password: 'Senha incorreta ou erro ao configurar 2FA',
      invalidCode: 'Código inválido. Tente novamente.',
      code6digits: 'Digite o código de 6 dígitos',
      copyError: 'Erro ao copiar códigos',
      passwordRequired: 'Senha é obrigatória'
    },
    success: {
      activated: '2FA ativado com sucesso!',
      adminNote:
        'Aguarde até 30 segundos para acessar áreas de admin devido ao cache de sessão.',
      codesCopied: 'Códigos copiados para a área de transferência',
      codesDownloaded: 'Códigos baixados'
    }
  },

  backupCodes: {
    generateTitle: 'Gerar Novos Códigos de Backup',
    generateDescription:
      'Por segurança, confirme sua senha e o código do autenticador. Novos códigos serão gerados e os antigos serão invalidados.',
    passwordLabel: 'Senha',
    passwordPlaceholder: 'Digite sua senha',
    authCodeLabel: 'Código do Autenticador',
    generating: 'Gerando...',
    generateButton: 'Gerar Novos Códigos',
    codesTitle: 'Códigos de Backup',
    codesDescription:
      'Guarde estes códigos em um lugar seguro. Cada código pode ser usado apenas uma vez para recuperar o acesso à sua conta.',
    copied: 'Copiado!',
    copy: 'Copiar',
    download: 'Baixar',
    warning:
      '\u26A0\uFE0F Seus códigos antigos foram invalidados. Salve estes novos códigos em um lugar seguro.',
    close: 'Fechar',
    generateNew: 'Gerar Novos Códigos',
    errors: {
      invalidAuth: 'Código de autenticação inválido',
      generateFailed: 'Não foi possível gerar novos códigos de backup',
      authFailed: 'Código de autenticação ou senha incorretos',
      copyError: 'Erro ao copiar códigos',
      passwordRequired: 'Senha é obrigatória',
      code6digits: 'Código deve ter 6 dígitos'
    },
    success: {
      codesCopied: 'Códigos copiados para a área de transferência',
      codesDownloaded: 'Códigos baixados'
    }
  },

  disable: {
    button: 'Desativar 2FA',
    adminWarning: 'Administradores devem manter 2FA ativado por segurança',
    dialogTitle: 'Desativar Autenticação de Dois Fatores?',
    dialogDescription:
      'Isso tornará sua conta menos segura. Você precisará apenas da senha para fazer login.',
    confirmPassword: 'Confirme sua senha',
    passwordPlaceholder: 'Digite sua senha',
    cancel: 'Cancelar',
    disabling: 'Desativando...',
    disableButton: 'Desativar 2FA',
    success: '2FA desativado com sucesso',
    errors: {
      passwordRequired: 'Senha é obrigatória',
      failed: 'Erro ao desativar 2FA. Verifique sua senha.'
    }
  }
} as const;
