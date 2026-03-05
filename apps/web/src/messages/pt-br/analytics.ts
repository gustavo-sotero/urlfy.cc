export const Analytics = {
  title: 'Analytics',
  subtitle: 'Métricas detalhadas dos seus links',
  overview: 'Visão Geral',
  overviewDesc: 'Visão geral do desempenho dos seus links',
  totalClicks: 'Total de Cliques',
  uniqueVisitors: 'Visitantes Únicos',
  avgClicksPerDay: 'Média de Cliques/Dia',
  lastClicked: 'Último Clique',
  conversionRate: 'Taxa de Conversão',
  activeLinks: 'Links Ativos',
  comparedToPrevious: 'em relação ao período anterior',
  conversionRateDesc: 'Visitantes únicos / Total de cliques',
  ofTotal: 'de {total} links totais',

  filters: {
    allLinks: 'Todos os Links',
    selectLink: 'Selecionar Link',
    selectPeriod: 'Selecionar Período'
  },

  charts: {
    clicksOverTime: 'Cliques ao Longo do Tempo',
    topCountries: 'Principais Países',
    deviceBreakdown: 'Distribuição por Dispositivo',
    topBrowsers: 'Principais Navegadores',
    topReferrers: 'Principais Referências',
    trafficSources: 'Origem do Tráfego',
    clicks: 'Cliques',
    uniqueVisitors: 'Visitantes Únicos',
    clicksChartAriaLabel: 'Gráfico de cliques ao longo do tempo',
    noData: 'Sem dados disponíveis'
  },

  devices: {
    desktop: 'Desktop',
    mobile: 'Celular',
    tablet: 'Tablet'
  },

  period: {
    today: 'Hoje',
    week: 'Últimos 7 Dias',
    month: 'Últimos 30 Dias',
    custom: 'Período Personalizado',
    last7: 'Últimos 7 dias',
    last30: 'Últimos 30 dias',
    last90: 'Últimos 90 dias'
  },

  empty: {
    title: 'Sem dados',
    description: 'Aguarde os primeiros cliques para ver métricas.',
    noData: 'Nenhum dado disponível para o período selecionado'
  },

  growth: {
    comparedToPreviousPeriod: 'em relação ao período anterior'
  },

  errors: {
    loadFailed: 'Erro ao carregar analytics',
    loadLinks: 'Erro ao carregar links'
  }
} as const;
