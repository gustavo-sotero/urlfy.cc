export const Help = {
  title: 'Como podemos ajudar?',
  subtitle: 'Encontre respostas para as perguntas mais comuns sobre o urlfy.cc',
  metaTitle: 'Ajuda e Suporte - urlfy.cc',
  metaDescription: 'Perguntas frequentes e documentação de ajuda do urlfy.cc',
  searchPlaceholder: 'Buscar artigos de ajuda...',
  categories: 'Categorias',
  gettingStarted: 'Primeiros Passos',
  features: 'Recursos',
  api: 'Documentação da API',
  troubleshooting: 'Solução de Problemas',

  faqTitle: 'Perguntas Frequentes',

  faq: {
    q1: {
      question: 'Como criar um link encurtado?',
      intro: 'Criar um link encurtado é muito simples:',
      steps: {
        s1: 'Cole sua URL longa no campo de entrada na página inicial',
        s2: 'Clique no botão "Encurtar"',
        s3: 'Seu link curto será gerado instantaneamente',
        s4: 'Copie e compartilhe onde quiser!'
      },
      note: 'Não é necessário criar uma conta para usar o serviço básico.'
    },
    q2: {
      question: 'Posso personalizar meu link curto?',
      content:
        'Sim! Usuários com conta podem criar aliases customizados. Por exemplo, em vez de urlfy.cc/abc123, você pode criar urlfy.cc/minha-oferta.',
      tip: 'Para isso, basta criar uma conta gratuita e usar o campo "Alias customizado" ao criar um link.'
    },
    q3: {
      question: 'Como acompanhar as estatísticas dos meus links?',
      intro: 'Para acessar analytics detalhados, você precisa estar logado:',
      steps: {
        s1: 'Faça login na sua conta',
        s2: 'Acesse o Dashboard',
        s3: 'Clique em qualquer link para ver suas estatísticas'
      },
      note: 'Você verá informações como número de cliques, países de origem, dispositivos utilizados e muito mais.'
    },
    q4: {
      question: 'Posso proteger um link com senha?',
      content:
        'Sim, usuários com conta Creator ou Business podem adicionar proteção por senha aos seus links. Quando alguém tentar acessar o link, será solicitada a senha antes do redirecionamento.',
      tip: 'Isso é útil para compartilhar conteúdo sensível ou restrito com grupos específicos de pessoas.'
    },
    q5: {
      question: 'Os links expiram?',
      content:
        'Por padrão, links gratuitos não expiram. No entanto, usuários com conta podem definir uma data de expiração automática ou um limite de cliques.',
      note: 'Após a expiração, o link deixará de funcionar e mostrará uma mensagem informando que expirou.'
    },
    q6: {
      question: 'Como gerar um QR Code do meu link?',
      intro:
        'Todo link criado no urlfy.cc pode gerar um QR Code automaticamente:',
      steps: {
        s1: 'Acesse o dashboard e clique no link desejado',
        s2: 'Clique no botão "Gerar QR Code"',
        s3: 'Escolha o formato (PNG ou SVG) e o tamanho',
        s4: 'Faça o download e use onde quiser!'
      }
    },
    q7: {
      question: 'Meus dados estão seguros?',
      intro: 'Sim! Levamos a segurança e privacidade muito a sério:',
      items: {
        i1: 'Todas as conexões são criptografadas com TLS/SSL',
        i2: 'Senhas são armazenadas com hash bcrypt',
        i3: 'Endereços IP são anonimizados imediatamente',
        i4: 'Somos 100% conformes com LGPD e GDPR'
      },
      linkText: 'Leia nossa',
      privacyLink: 'Política de Privacidade',
      linkSuffix: 'para mais detalhes.'
    },
    q8: {
      question: 'Qual a diferença entre os planos?',
      content:
        'Nota: Como este é um projeto pessoal de pesquisa e desenvolvimento e de portfólio, não há planos comerciais. O serviço é gratuito para fins de demonstração e teste de funcionalidades.'
    },
    q9: {
      question: 'Posso deletar meus dados?',
      intro: 'Sim, você tem controle total sobre seus dados. Você pode:',
      items: {
        i1: 'Deletar links individuais a qualquer momento',
        i2: 'Exportar todos os seus dados em formato JSON',
        i3: 'Solicitar a exclusão completa da conta e dados associados'
      },
      note: 'Processamos solicitações de exclusão em até 72 horas, conforme a LGPD.'
    },
    q10: {
      question: 'Existe uma API para integração?',
      content:
        'Sim! Usuários do plano Business têm acesso à nossa API REST completa, permitindo criar, gerenciar e analisar links programaticamente.',
      tip: 'A documentação da API está disponível em api.urlfy.cc/docs após a criação da sua chave de API no dashboard.'
    }
  },

  contactSection: {
    title: 'Ainda precisa de ajuda?',
    cardTitle: 'Formulário de Contato',
    cardDescription:
      'Entre em contato conosco e responderemos em até 24-48 horas.',
    sendMessage: 'Enviar mensagem'
  }
} as const;
