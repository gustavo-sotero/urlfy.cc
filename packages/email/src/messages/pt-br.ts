export const Emails = {
  welcome: {
    subject: 'Bem-vindo ao urlfy.cc, {firstName}',
    previewText:
      'Seu dashboard está pronto, e um e-mail de verificação separado já foi enviado.',
    greeting: 'Olá, {firstName},',
    welcomeMessage:
      'Bem-vindo ao urlfy.cc. Seu dashboard já está pronto, e também enviamos um e-mail de verificação separado para você confirmar este endereço quando quiser.',
    accountCreated: 'Conta pronta',
    yourEmail: 'Endereço de e-mail',
    whatYouCanDo: 'Comece com três passos rápidos',
    createLinks: 'Criar links curtos',
    createLinksDesc:
      'Transforme URLs longas em links claros e fáceis de compartilhar.',
    customizeUrls: 'Ajustar o slug',
    customizeUrlsDesc:
      'Crie aliases memoráveis quando precisar de campanhas e compartilhamentos mais limpos.',
    trackAnalytics: 'Acompanhar engajamento',
    trackAnalyticsDesc:
      'Monitore cliques e padrões de tráfego em um único dashboard.',
    getStarted: 'Abrir dashboard',
    needHelp: 'Precisa de ajuda?',
    contactSupport: 'Visite a central de ajuda',
    footer:
      'Se você não criou esta conta, pode ignorar este email com segurança.'
  },
  emailVerification: {
    subject: 'Verifique seu e-mail no urlfy.cc',
    previewText: 'Confirme que este endereço de e-mail é seu.',
    title: 'Verifique seu e-mail',
    greeting: 'Olá, {firstName},',
    message:
      'Uma nova conta no urlfy.cc foi criada com este e-mail. Confirme que este endereço é seu para manter avisos de conta e segurança chegando na caixa certa.',
    securityNotice: 'Link de verificação',
    expiresIn:
      'Por segurança, este link expira em {minutes} minutos e só pode ser usado uma vez.',
    ctaButton: 'Verificar e-mail',
    cantClick: 'Se o botão não funcionar,',
    copyLink: 'copie e cole este link no seu navegador:',
    footer:
      'Esta mensagem é separada do seu e-mail de boas-vindas. Se você não criou esta conta, pode ignorá-la.'
  },
  passwordReset: {
    subject: 'Redefina sua senha do urlfy.cc',
    previewText: 'Use este link seguro para escolher uma nova senha.',
    title: 'Redefina sua senha',
    greeting: 'Olá, {firstName},',
    message:
      'Recebemos uma solicitação de redefinição de senha para sua conta no urlfy.cc.',
    expiresNotice: 'Este link seguro expira em {minutes} minutos.',
    ctaButton: 'Escolher nova senha',
    copyLink: 'Ou cole este link no seu navegador:',
    securityTips: 'Dicas de segurança',
    tip1: 'Nunca compartilhe sua senha com ninguém',
    tip2: 'Use uma senha única para cada serviço',
    tip3: 'Considere usar um gerenciador de senhas',
    didntRequest:
      'Se você não fez esta solicitação, pode ignorar este e-mail com segurança e sua senha continuará a mesma.',
    footer:
      'Sua senha atual continua funcionando até você concluir a redefinição.'
  },
  dataDeletionConfirmation: {
    subject: 'Recebemos sua solicitação de exclusão de dados',
    previewText:
      'Sua solicitação de exclusão foi registrada e está em processamento.',
    title: 'Solicitação de exclusão recebida',
    greeting: 'Olá, {firstName},',
    message:
      'Recebemos sua solicitação para excluir seus dados pessoais conforme LGPD/GDPR.',
    requestDetails: 'Detalhes da solicitação',
    requestedOn: 'Solicitado em',
    deadline: 'Prazo de processamento',
    whatHappensNext: 'O que acontece agora',
    step1: 'Vamos revisar e processar a solicitação em até 72 horas.',
    step2:
      'Os dados pessoais ligados à sua conta serão excluídos permanentemente.',
    step3: 'Enviaremos um e-mail de confirmação quando o processo terminar.',
    exportData: 'Exportar meus dados',
    cancelRequest: 'Responda se precisar cancelar esta solicitação',
    footer: 'A exclusão é permanente quando o processamento for concluído.',
    deletionHeader: 'O que será excluído',
    deletionItem1: 'Todos os links encurtados criados',
    deletionItem2: 'Histórico de analytics e métricas',
    deletionItem3: 'Dados de autenticação e perfil',
    deletionItem4: 'Configurações e preferências',
    deletionItem5: 'API Keys e tokens de acesso',
    exportPrompt: 'Quer uma cópia antes?',
    exportDesc:
      'Exporte seus dados antes da exclusão se quiser manter um backup pessoal.',
    warningNote:
      'Se você mudou de ideia, responda este e-mail antes do prazo acima.'
  },
  linkBanned: {
    subject: 'Ação necessária: um dos seus links foi bloqueado',
    previewText: 'Revise o motivo do bloqueio e os próximos passos.',
    title: 'Um link da sua conta foi bloqueado',
    greeting: 'Olá, {firstName},',
    message:
      'Um dos seus links foi bloqueado após revisão por violação dos Termos de Uso.',
    shortCode: 'Código Curto',
    originalUrl: 'URL Original',
    reason: 'Motivo',
    bannedOn: 'Bloqueado em',
    whatYouCanDo: 'Próximos passos',
    reviewTerms: 'Revisar nossos Termos de Uso',
    reviewTermsDesc:
      'Confira a regra que se aplica a este destino antes de publicar outro link.',
    appeal: 'Solicitar revisão',
    appealDesc: 'Use o link de recurso se acredita que isso foi um engano.',
    createNew: 'Criar um substituto em conformidade',
    createNewDesc: 'Garanta que o novo destino siga as regras da plataforma.',
    footer: 'Violações repetidas podem gerar restrições na conta.',
    implicationsHeader: 'O que isso significa',
    implication1: 'O link não está mais acessível',
    implication2: 'Visitantes verão uma página de erro',
    implication3: 'As estatísticas foram preservadas',
    implication4: 'Você pode contestar essa decisão',
    commonReasonsHeader: 'Motivos comuns de bloqueio',
    commonReason1: 'Conteúdo malicioso ou phishing',
    commonReason2: 'Spam ou práticas abusivas',
    commonReason3: 'Violação de propriedade intelectual',
    commonReason4: 'Conteúdo ilegal ou inadequado',
    appealCta: 'Contestar Bloqueio'
  },
  quotaWarning: {
    subject: 'Você já usou {percent}% da sua cota de links',
    previewText: 'Seu workspace está se aproximando do limite.',
    title: 'Sua cota de links está quase cheia',
    greeting: 'Olá, {firstName},',
    message: 'Você está se aproximando do limite de links do seu plano atual.',
    currentUsage: 'Uso atual',
    quotaLimit: 'Limite do plano',
    percentUsed: 'Uso',
    whatYouCanDo: 'Ações recomendadas',
    upgrade: 'Fazer upgrade do seu plano',
    upgradeDesc: 'Libere mais capacidade e controles premium.',
    manageLinks: 'Arquivar ou excluir links sem uso',
    manageLinksDesc:
      'Abra espaço limpando links que você não precisa mais manter.',
    footer:
      'Se precisar de ajuda para escolher o próximo passo, visite a central de ajuda.',
    warningNear:
      'Você está perto do limite. Revise seus links atuais ou faça upgrade antes que a criação de novos links fique bloqueada.',
    warningCritical:
      'Você tem apenas {remaining} links restantes antes de atingir o limite.',
    upgradeCta: 'Ver planos'
  }
} as const;
