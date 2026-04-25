export const Errors = {
  notFound: {
    title: 'Página Não Encontrada',
    description: 'A página que você está procurando não existe.',
    backHome: 'Voltar ao Início',
    helpCenter: 'Central de Ajuda'
  },

  linkNotFound: {
    title: 'Link Não Encontrado',
    description: 'Este link curto não existe ou foi excluído.',
    createNew: 'Criar um Novo Link'
  },

  linkExpired: {
    title: 'Link Expirado',
    description: 'Este link expirou e não está mais disponível.',
    expiresAt: 'Expirou em'
  },

  linkBanned: {
    title: 'Link Indisponível',
    description: 'Este link foi desativado por violar nossos termos de serviço.'
  },

  unauthorized: {
    title: 'Não Autorizado',
    description: 'Você precisa estar logado para acessar esta página.',
    login: 'Entrar'
  },

  serverError: {
    title: 'Erro no Servidor',
    description:
      'Algo deu errado do nosso lado. Por favor, tente novamente mais tarde.',
    retry: 'Tentar Novamente',
    backHome: 'Voltar ao Início',
    errorIdLabel: 'ID do Erro',
    detailsLabel: 'Detalhes do erro (apenas em desenvolvimento)'
  }
} as const;
