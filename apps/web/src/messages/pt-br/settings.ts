export const Settings = {
  title: 'Configurações',
  subtitle: 'Gerencie suas preferências e configurações da conta',
  account: 'Conta',
  apiKeys: 'Chaves de API',

  profile: {
    title: 'Perfil',
    description: 'Gerencie seus dados pessoais',
    name: 'Nome',
    namePlaceholder: 'Seu nome',
    nameRequired: 'Nome é obrigatório',
    email: 'Email',
    emailHint: 'O email não pode ser alterado',
    avatar: 'Avatar',
    updateProfile: 'Atualizar Perfil',
    save: 'Salvar alterações',
    saveChanges: 'Salvar alterações',
    saving: 'Salvando...'
  },

  security: {
    title: 'Segurança',
    description: 'Gerencie autenticação e 2FA',
    changePassword: 'Alterar Senha',
    currentPassword: 'Senha Atual',
    newPassword: 'Nova Senha',
    confirmPassword: 'Confirmar Senha',
    twoFactor: 'Autenticação de Dois Fatores (2FA)',
    twoFactorDesc: 'Adicione uma camada extra de segurança à sua conta',
    twoFactorDescription: 'Adicione uma camada extra de segurança à sua conta',
    active: 'Ativo',
    twoFactorActive: 'Ativo',
    twoFactorRequired:
      'O 2FA é opcional, mas fortemente recomendado para proteger melhor a sua conta.',
    enable2FA: 'Ativar 2FA',
    disable2FA: 'Desativar 2FA',
    backupCodes: 'Códigos de Backup',
    viewBackupCodes: 'Ver Códigos de Backup'
  },

  preferences: {
    title: 'Preferências',
    description: 'Personalize sua experiência',
    language: 'Idioma',
    notifications: 'Notificações',
    emailNotifications: 'Notificações por E-mail',
    emailNotificationsDescription:
      'Receba notificações sobre seus links por e-mail',
    weeklyReports: 'Relatórios Semanais',
    weeklyReportsDescription: 'Receba relatórios de analytics toda semana'
  },

  dangerZone: {
    title: 'Zona de Perigo',
    description: 'Permanentemente remova sua conta e todos os dados',
    deleteAccount: 'Excluir Conta'
  },

  toasts: {
    saved: 'Configurações atualizadas',
    profileSaved: 'Perfil atualizado com sucesso',
    profileUpdated: 'Perfil atualizado com sucesso',
    error: 'Erro ao salvar configurações',
    profileError: 'Erro ao atualizar perfil',
    nameRequired: 'Nome é obrigatório'
  },

  apiKeysManager: {
    title: 'Chaves de API',
    description: 'Use chaves de API para acessar seus links programaticamente',
    documentation: 'Documentação',
    keysCount: '{count} chave(s) criada(s)',
    generateNew: 'Gerar nova chave',
    never: 'Nunca',
    empty: {
      title: 'Nenhuma chave de API criada ainda',
      description: 'Crie sua primeira chave para começar a usar a API'
    },
    table: {
      name: 'Nome',
      key: 'Chave',
      status: 'Status',
      createdAt: 'Criada em',
      lastUsed: 'Último uso',
      actions: 'Ações',
      noName: 'Sem nome'
    },
    status: {
      active: 'Ativa',
      expired: 'Expirada',
      revoked: 'Revogada',
      quotaExceeded: 'Quota Excedida',
      unknown: 'Desconhecido'
    },
    revoke: {
      title: 'Revogar Chave de API?',
      description:
        'Esta ação não pode ser desfeita. A chave {name} será permanentemente revogada e não poderá mais ser usada.',
      cancel: 'Cancelar',
      confirm: 'Revogar'
    },
    create: {
      title: 'Criar Nova Chave de API',
      description:
        'Dê um nome descritivo para identificar esta chave facilmente.',
      nameLabel: 'Nome da chave',
      namePlaceholder: 'Ex: Meu App Pessoal',
      cancel: 'Cancelar',
      submit: 'Criar Chave'
    },
    validation: {
      nameMin: 'Nome deve ter no mínimo 3 caracteres',
      nameMax: 'Nome deve ter no máximo 50 caracteres'
    },
    success: {
      created: 'Chave Criada com Sucesso!',
      copyNow: 'Copie sua chave agora!',
      oneTimeWarning:
        'Esta chave será exibida apenas uma vez. Armazene-a em um local seguro.',
      keyLabel: 'Sua chave de API',
      done: 'Concluído',
      copied: 'Copiado para a área de transferência!'
    },
    errors: {
      copyError: 'Erro ao copiar',
      copyFallback: 'Use Ctrl+C para copiar manualmente'
    }
  }
} as const;
