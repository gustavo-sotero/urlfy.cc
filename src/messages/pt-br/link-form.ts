export const LinkForm = {
  // Page titles
  titleNew: 'Criar Novo Link',
  titleEdit: 'Editar Link',
  subtitleNew: 'Preencha os campos abaixo para criar um link encurtado',
  subtitleEdit: 'Atualize as configurações do seu link',

  // Form sections
  sections: {
    basic: 'Informações Básicas',
    basicDesc: 'URL de destino e configurações principais',
    advanced: 'Configurações Avançadas',
    advancedDesc: 'Personalize como seu link se comporta',
    meta: 'Meta Tags',
    metaDesc: 'Personalize como seu link aparece ao ser compartilhado',
    limits: 'Status e Limites',
    limitsDesc: 'Configure disponibilidade e restrições',
    tracking: 'UTM Tracking',
    trackingDesc: 'Adicione parâmetros de rastreamento',
    security: 'Segurança',
    securityDesc: 'Proteja seu link com senha'
  },

  // Field labels and placeholders
  label: 'Digite sua URL',
  placeholder: 'https://exemplo.com/sua-url-muito-longa',
  shortenButton: 'Encurtar',
  customAlias: 'Alias Personalizado',
  customAliasPlaceholder: 'meu-link-customizado',
  advancedOptions: 'Opções Avançadas',
  expiresAt: 'Expira Em',
  expirationDate: 'Data de Expiração',
  maxClicks: 'Máximo de Cliques',
  maxClicksLimit: 'Limite de Cliques',
  password: 'Proteção por Senha',
  passwordPlaceholder: 'Digite a senha',
  metaTitle: 'Título Meta Personalizado',
  metaDescription: 'Descrição Meta Personalizada',
  metaImage: 'Imagem Meta',
  metaImagePlaceholder: 'https://exemplo.com/imagem.png',
  utmSource: 'Origem UTM',
  utmMedium: 'Meio UTM',
  utmCampaign: 'Campanha UTM',
  redirectType: 'Tipo de Redirecionamento',
  permanent: 'Permanente (301)',
  temporary: 'Temporário (302)',
  tags: 'Tags',
  tagsPlaceholder: 'Adicione tags...',
  notes: 'Notas',
  notesPlaceholder: 'Anotações pessoais sobre este link...',
  isActive: 'Link Ativo',

  // Field labels
  fields: {
    url: {
      label: 'URL de Destino',
      placeholder: 'https://exemplo.com',
      hint: 'Cole a URL completa que você deseja encurtar'
    },
    alias: {
      label: 'Alias Personalizado',
      placeholder: 'meu-link',
      hint: 'Entre 3 e 20 caracteres, sem espaços. Deixe vazio para gerar automaticamente'
    },
    password: {
      label: 'Senha',
      placeholder: '••••••',
      hint: 'Proteja seu link com senha'
    },
    expiresAt: {
      label: 'Expira em',
      hint: 'Link será desativado automaticamente após esta data'
    },
    maxClicks: {
      label: 'Limite de cliques',
      hint: 'Deixe vazio para ilimitado'
    },
    redirectType: {
      label: 'Tipo de redirect',
      hint: '301: Link permanente (melhor para SEO). 302: Link temporário'
    },
    metaTitle: {
      label: 'Meta title',
      hint: 'Máximo 60 caracteres'
    },
    metaDescription: {
      label: 'Meta description',
      hint: 'Máximo 160 caracteres'
    },
    metaImage: {
      label: 'Meta image',
      hint: 'URL da imagem para compartilhamento'
    },
    notes: {
      label: 'Notas',
      hint: 'Anotações pessoais (não visíveis publicamente)'
    },
    isActive: {
      label: 'Link Ativo',
      hint: 'Desative temporariamente este link'
    }
  },

  // Hints and descriptions
  hints: {
    alias: 'Entre 3 e 20 caracteres, sem espaços',
    aliasEmpty: 'Deixe vazio para gerar automaticamente',
    maxClicks: 'Deixe vazio para ilimitado',
    currentClicks: 'Cliques atuais: {count}',
    redirectPermanent: '301: Link permanente (melhor para SEO)',
    redirectTemporary: '302: Link temporário',
    expiresAt: 'Link será desativado automaticamente após esta data',
    metaTitle: 'Máximo 60 caracteres',
    metaDescription: 'Máximo 160 caracteres',
    metaImage: 'URL da imagem para compartilhamento',
    notes: 'Anotações pessoais (não visíveis publicamente)',
    isActiveOff: 'Desative temporariamente este link'
  },

  // Actions
  actions: {
    save: 'Salvar alterações',
    create: 'Criar Link',
    cancel: 'Cancelar',
    back: 'Voltar',
    backToList: 'Voltar para lista de links',
    backToDetails: 'Voltar para detalhes'
  },

  // Validation messages
  validation: {
    required: 'Campo obrigatório',
    invalidUrl: 'URL inválida',
    invalidAlias: 'Alias inválido',
    invalidDate: 'Data inválida',
    invalidImage: 'URL de imagem inválida',
    positiveNumber: 'O limite deve ser maior que zero',
    maxLength60: 'Máximo de 60 caracteres',
    maxLength160: 'Máximo de 160 caracteres'
  },

  // Error messages
  errors: {
    invalidUrl: 'Por favor, digite uma URL válida',
    urlTooLong: 'URL muito longa (máx 2048 caracteres)',
    aliasTaken: 'Este alias já está em uso',
    aliasReserved: 'Este alias é reservado pelo sistema',
    quotaExceeded: 'Você atingiu sua cota de links',
    createFailed: 'Erro ao criar link',
    updateFailed: 'Erro ao atualizar link',
    loadFailed: 'Erro ao carregar link'
  },

  // Success messages
  success: {
    created: 'Link criado com sucesso!',
    updated: 'Link atualizado com sucesso!',
    copied: 'Link copiado para a área de transferência!'
  }
} as const;
