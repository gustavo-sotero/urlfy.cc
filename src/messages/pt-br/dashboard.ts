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
    passwordProtected: 'Protegido por Senha'
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
