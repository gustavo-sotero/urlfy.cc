export const Contact = {
  title: 'Entre em Contato',
  subtitle: 'Tem alguma dúvida ou sugestão? Adoraríamos ouvir você.',
  metaTitle: 'Contato',
  metaDescription:
    'Entre em contato com a equipe urlfy.cc. Estamos aqui para ajudar!',

  name: 'Nome',
  email: 'E-mail',
  message: 'Mensagem',
  send: 'Enviar Mensagem',
  success: 'Mensagem enviada com sucesso!',
  error: 'Falha ao enviar mensagem. Por favor, tente novamente.',

  sendUsMessage: 'Envie-nos uma mensagem',
  projectLinks: 'Links do Projeto',
  quickLinks: 'Links Rápidos',
  helpCenter: 'Central de Ajuda',
  projectNotes: 'Notas do Projeto',
  repositoryLink: 'Repositório no GitHub',
  portfolioLink: 'Portfólio',
  projectNotesLink: 'Notas do Projeto',
  termsOfService: 'Termos de Serviço',
  privacyPolicy: 'Política de Privacidade',
  responseTime:
    'Normalmente respondemos em até 24-48 horas durante dias úteis.',

  form: {
    namePlaceholder: 'Seu nome',
    emailPlaceholder: 'your.email@example.com',
    subject: 'Assunto',
    subjectPlaceholder: 'Sobre o que é?',
    messagePlaceholder: 'Conte-nos mais...',
    characters: 'caracteres',
    consentTitle: 'Consentimento de Armazenamento de Dados (LGPD Obrigatório)',
    consentDescription:
      'Concordo com o armazenamento destes dados para fins de contato. Suas informações serão usadas apenas para responder sua mensagem.',
    sending: 'Enviando...',
    sendMessage: 'Enviar Mensagem',

    validation: {
      nameMin: 'O nome deve ter no mínimo 2 caracteres',
      emailInvalid: 'Endereço de email inválido',
      subjectMin: 'O assunto deve ter no mínimo 3 caracteres',
      messageMin: 'A mensagem deve ter no mínimo 10 caracteres',
      messageMax: 'A mensagem deve ter no máximo 5000 caracteres',
      consentRequired:
        'Você deve concordar com o consentimento de armazenamento de dados'
    },

    toast: {
      rateLimitTitle: 'Limite de Taxa Excedido',
      rateLimitDescription:
        'Muitas requisições. Por favor, tente novamente mais tarde.',
      failedTitle: 'Falha ao Enviar Mensagem',
      failedDescription: 'Ocorreu um erro. Por favor, tente novamente.',
      successTitle: 'Mensagem Enviada!',
      successDescription: 'Responderemos em breve.',
      networkTitle: 'Erro de Rede',
      networkDescription:
        'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.'
    },

    successState: {
      title: 'Mensagem Enviada com Sucesso!',
      description:
        'Obrigado por entrar em contato. Responderemos o mais breve possível.',
      sendAnother: 'Enviar Outra Mensagem'
    }
  }
} as const;
