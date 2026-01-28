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
      'Como administrador, você é obrigado a manter o 2FA ativado para proteger o sistema.',
    adminWarning:
      'Como administrador, você é obrigado a manter o 2FA ativado para proteger o sistema.',
    enable2FA: 'Ativar 2FA',
    disable2FA: 'Desativar 2FA',
    backupCodes: 'Códigos de Backup',
    viewBackupCodes: 'Ver Códigos de Backup'
  },

  preferences: {
    title: 'Preferências',
    description: 'Personalize sua experiência',
    language: 'Idioma',
    theme: 'Tema',
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
  }
} as const;
