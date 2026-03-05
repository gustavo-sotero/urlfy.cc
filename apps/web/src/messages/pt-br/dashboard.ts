export const Dashboard = {
  title: 'Dashboard',
  subtitle: 'Visão geral dos seus links e estatísticas',
  overviewSubtitle: 'Visão geral do desempenho dos seus links',
  createNew: 'Criar Novo Link',
  search: 'Buscar links...',
  filterActive: 'Ativos',
  filterInactive: 'Inativos',
  filterExpired: 'Expirados',
  filterAll: 'Todos',
  sortNewest: 'Mais Recentes',
  sortOldest: 'Mais Antigos',
  sortMostClicks: 'Mais Cliques',
  noLinks: 'Nenhum link encontrado',
  noLinksDescription: 'Crie seu primeiro link encurtado para começar.',

  stats: {
    totalLinks: 'Total de Links',
    totalClicks: 'Total de Cliques',
    activeLinks: 'Links Ativos',
    clicksThisMonth: 'Cliques Este Mês',
    avgClicks: 'Média de Cliques',
    perLink: 'por link',
    usedOf: '{used} de {limit} utilizados'
  },

  links: {
    title: 'Meus Links',
    subtitle: 'Gerencie todos os seus links encurtados',
    recentLinks: 'Links Recentes',
    viewAll: 'Ver todos',
    newLink: 'Novo Link',
    deleteConfirm: 'Tem certeza que deseja deletar este link?',
    createFirst: 'Criar primeiro link'
  },

  linkCard: {
    clicks: 'cliques',
    createdAt: 'Criado',
    expiresAt: 'Expira',
    copyLink: 'Copiar Link',
    viewAnalytics: 'Ver Analytics',
    edit: 'Editar',
    delete: 'Excluir',
    qrCode: 'QR Code',
    expired: 'Expirado',
    inactive: 'Inativo',
    passwordProtected: 'Protegido por Senha',
    options: 'Opções do link',
    open: 'Abrir',
    limitReached: 'Limite atingido',
    expiresIn: 'Expira em {date}',
    limit: 'Limite: {max}'
  },

  sidebar: {
    dashboard: 'Dashboard',
    links: 'Links',
    analytics: 'Analytics',
    settings: 'Configurações'
  },

  linkDetail: {
    title: 'Detalhes do Link',
    edit: 'Editar',
    delete: 'Deletar',
    deleteConfirm: 'Tem certeza que deseja deletar este link?',
    linkInfo: 'Informações do Link',
    shortLink: 'Link Curto',
    originalUrl: 'URL Original',
    status: 'Status',
    active: 'Ativo',
    inactive: 'Inativo',
    expiresAt: 'Expira em',
    clickLimit: 'Limite de Cliques',
    totalClicks: 'Total de Cliques',
    uniqueVisitors: 'Visitantes Únicos',
    conversionRate: 'Taxa de Conversão',
    avgClicksPerDay: 'Média de Cliques/Dia',
    clicksOverTime: 'Cliques ao Longo do Tempo',
    last30Days: 'Últimos 30 dias',
    countries: 'Países',
    topCountriesByClicks: 'Top países por cliques',
    devices: 'Dispositivos',
    deviceDistribution: 'Distribuição por tipo de dispositivo',
    trafficSources: 'Fontes de Tráfego',
    trafficSourcesDesc: 'De onde vêm seus visitantes',
    openNewTab: 'Abrir link em nova aba',
    backAriaLabel: 'Voltar para lista de links',
    loadError: 'Erro ao carregar link'
  },

  verification: {
    title: 'Verificação de e-mail pendente',
    description:
      'Por favor, verifique seu endereço de e-mail para ter acesso completo à plataforma. Você não poderá criar links até confirmar seu e-mail.',
    sending: 'Enviando...',
    sent: 'E-mail enviado!',
    resend: 'Reenviar e-mail',
    checkInbox: 'Verifique sua caixa de entrada e spam.',
    errorEmail: 'Não foi possível obter o email do usuário.',
    errorResend: 'Falha ao reenviar email. Tente novamente.'
  },

  pagination: {
    previous: 'Anterior',
    next: 'Próxima',
    pageOf: 'Página {page} de {total}'
  },

  empty: {
    noSearch: 'Nenhum link encontrado',
    noLinks: 'Você ainda não tem links. Crie seu primeiro link!',
    createAction: 'Criar primeiro link'
  },

  toasts: {
    deleteSuccess: 'Link deletado com sucesso',
    deleteError: 'Erro ao deletar link',
    loadError: 'Erro ao carregar dados do dashboard',
    loadLinksError: 'Erro ao carregar links'
  }
} as const;
