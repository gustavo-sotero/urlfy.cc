export const Emails = {
  welcome: {
    subject: 'Bem-vindo ao urlfy.cc, {firstName}! 🎉',
    previewText: 'Bem-vindo ao urlfy.cc, {firstName}! 🎉',
    greeting: 'Olá, {firstName}! 👋',
    welcomeMessage:
      'Bem-vindo ao urlfy.cc! Estamos muito felizes em tê-lo conosco.',
    accountCreated: 'Sua conta foi criada com sucesso',
    yourEmail: 'Seu email',
    whatYouCanDo: 'O que você pode fazer agora:',
    createLinks: 'Criar Links Curtos',
    createLinksDesc: 'Encurte URLs longas de forma rápida e fácil',
    customizeUrls: 'Personalizar suas URLs',
    customizeUrlsDesc: 'Crie aliases memoráveis e slugs personalizados',
    trackAnalytics: 'Acompanhar Performance',
    trackAnalyticsDesc: 'Acesse análises detalhadas e métricas',
    getStarted: 'Começar Agora',
    needHelp: 'Precisa de ajuda?',
    contactSupport: 'Entre em contato com nosso suporte',
    footer:
      'Se você não criou esta conta, pode ignorar este email com segurança.'
  },
  emailVerification: {
    subject: 'Confirme seu email - urlfy.cc',
    previewText: 'Confirme seu email para começar a usar o urlfy.cc',
    title: 'Confirme seu Email',
    greeting: 'Olá, {firstName}! 👋',
    message:
      'Estamos quase lá! Para começar a usar o urlfy.cc e aproveitar todos os recursos, você precisa confirmar seu endereço de email.',
    securityNotice: '🔐 Segurança',
    expiresIn:
      'Este link expira em {minutes} minutos e só pode ser usado uma vez.',
    ctaButton: 'Confirmar Meu Email',
    cantClick: 'Não consegue clicar no botão?',
    copyLink: 'Copie e cole este link no seu navegador:',
    footer:
      'Se você não criou uma conta no urlfy.cc, pode ignorar este email com segurança.'
  },
  passwordReset: {
    subject: 'Redefinir sua senha - urlfy.cc',
    previewText: 'Recuperação de senha - urlfy.cc',
    title: 'Redefinir Senha',
    greeting: 'Olá, {firstName}!',
    message:
      'Recebemos uma solicitação para redefinir a senha da sua conta no urlfy.cc. Se você não fez essa solicitação, ignore este email.',
    expiresNotice: '⏱️ Este link expira em {minutes} minutos por segurança.',
    ctaButton: 'Redefinir Minha Senha',
    copyLink: 'Ou copie e cole este link:',
    securityTips: '🔐 Dicas de Segurança',
    tip1: 'Nunca compartilhe sua senha com ninguém',
    tip2: 'Use uma senha única para cada serviço',
    tip3: 'Considere usar um gerenciador de senhas',
    didntRequest: 'Se você não solicitou isso, nenhuma ação é necessária.',
    footer: 'Sua senha permanecerá inalterada até que você crie uma nova.'
  },
  dataDeletionConfirmation: {
    subject: 'Solicitação de Exclusão de Dados Recebida',
    previewText: 'Recebemos sua solicitação de exclusão de dados',
    title: 'Solicitação de Exclusão de Dados',
    greeting: 'Olá, {firstName},',
    message:
      'Recebemos sua solicitação para excluir seus dados pessoais de acordo com GDPR/LGPD.',
    requestDetails: 'Detalhes da Solicitação',
    requestedOn: 'Solicitado em',
    deadline: 'Prazo de processamento',
    whatHappensNext: 'O que acontece agora?',
    step1: 'Sua solicitação será processada em até 72 horas',
    step2: 'Todos os seus dados pessoais serão excluídos permanentemente',
    step3: 'Você receberá um email de confirmação quando concluído',
    exportData: 'Exportar Meus Dados Antes da Exclusão',
    cancelRequest: 'Cancelar esta solicitação',
    footer: 'Esta ação é irreversível e não pode ser desfeita.'
  },
  linkBanned: {
    subject: '⚠️ Link Bloqueado - Ação Necessária',
    previewText: 'Link bloqueado por violação dos termos de uso',
    title: 'Link Bloqueado',
    greeting: 'Olá, {firstName},',
    message:
      'Informamos que um dos seus links foi bloqueado por violação dos nossos Termos de Uso.',
    shortCode: 'Código Curto',
    originalUrl: 'URL Original',
    reason: 'Motivo',
    bannedOn: 'Bloqueado em',
    whatYouCanDo: 'O que você pode fazer:',
    reviewTerms: 'Revisar nossos Termos de Uso',
    appeal: 'Apresentar recurso',
    appealDesc: 'Se você acredita que foi um erro',
    createNew: 'Criar um novo link em conformidade',
    createNewDesc: 'Certifique-se de seguir nossas políticas',
    footer:
      'Violações repetidas podem resultar em suspensão da conta. Por favor, revise nossos Termos de Uso.'
  },
  quotaWarning: {
    subject: '⚠️ Você está usando {percent}% da sua quota',
    previewText: 'Sua quota de links está quase cheia',
    title: 'Aviso de Quota',
    greeting: 'Olá, {firstName}!',
    message:
      'Sua quota de links está quase cheia. Considere fazer upgrade do seu plano ou gerenciar seus links existentes.',
    currentUsage: 'Uso atual',
    quotaLimit: 'Limite da quota',
    percentUsed: 'Percentual usado',
    whatYouCanDo: 'O que você pode fazer:',
    upgrade: 'Fazer upgrade do seu plano',
    upgradeDesc: 'Obtenha mais links e recursos premium',
    manageLinks: 'Gerenciar seus links',
    manageLinksDesc: 'Delete links não utilizados para liberar espaço',
    footer: 'Precisa de ajuda? Entre em contato com nossa equipe de suporte.'
  }
} as const;
