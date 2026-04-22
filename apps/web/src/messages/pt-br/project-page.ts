export const ProjectPage = {
  metaTitle: 'Notas do Projeto - urlfy.cc',
  metaDescription:
    'O que o urlfy.cc implementa hoje, por que a arquitetura é assim e como ler seus targets de engenharia documentados.',
  ogTitle: 'Por dentro do urlfy.cc',
  ogDescription:
    'Arquitetura atual, trade-offs e targets de validação de um projeto de produto real em evolução.',

  hero: {
    badge: 'Projeto de Produto Real · Portfólio · Pesquisa Aplicada',
    title: 'Notas do Projeto',
    subtitle: 'urlfy.cc',
    description:
      'Um encurtador de URLs self-hosted tratado como projeto de produto real: app web localizado, API dedicada, worker em Bun, operação com Docker e documentação mantida perto do código.'
  },

  architecture: {
    title: 'Arquitetura Atual',
    subtitle:
      'O que existe hoje e por que o navegador permanece same-origin enquanto web, API e worker seguem desacoplados.',
    docsLink: 'Ler os docs de arquitetura →',
    frontend: {
      title: 'Aplicação web',
      appRouter:
        'O App Router do Next.js 16 entrega páginas públicas, fluxos de auth, dashboard e entradas do redirect.',
      middleware:
        'O proxy de borda mantém o tráfego do navegador same-origin no desenvolvimento local e atrás do ingress em produção.',
      ui: 'Shell público e dashboard compartilham uma UI localizada, sem virar frontends separados.'
    },
    api: {
      title: 'API e trabalho em background',
      typeSafe:
        'Um serviço Elysia dedicado concentra /api, saída OpenAPI e validação em runtime.',
      fast: 'Um worker em Bun processa analytics, limpeza e outros jobs assíncronos fora do request path.',
      openapi: 'As referências interativas e do repositório começam em'
    }
  },

  infrastructure: {
    title: 'Escolhas Operacionais',
    subtitle:
      'Pequeno o suficiente para entender de ponta a ponta, explícito o suficiente para rodar e documentar.',
    docsLink: 'Ver docs de deploy e do sistema →',
    persistence: {
      title: 'Camada de dados compartilhada',
      subtitle: 'PostgreSQL + Drizzle + packages do workspace',
      feature1:
        'Schema, migrações e slugs reservados vivem em packages compartilhados, não em cópias por app.',
      feature2:
        'Lógica de redirect e domínio é reutilizada entre web, API e worker.',
      feature3:
        'O estado fica próximo dos contratos, em vez de ficar enterrado em adapters de framework.'
    },
    cache: {
      title: 'Cache e roteamento',
      subtitle: 'Redis + caminho de redirect same-origin',
      feature1:
        'Redirects usam leitura de cache no hot path antes de tocar o banco.',
      feature2:
        'Helpers de rate limiting, locking e cache negativo são compartilhados entre os serviços.',
      feature3:
        'O hot path do redirect permanece na web, evitando o antigo hop interno para a API.'
    },
    observability: {
      title: 'Feedback operacional',
      subtitle: 'Health, readiness, logs e docs de validação',
      feature1:
        'Endpoints de health e readiness fazem parte da superfície entregue.',
      feature2:
        'Telemetria estruturada é compartilhada entre os serviços do monorepo.',
      feature3:
        'A validação de performance vive em docs e testes, não em claims de marketing.'
    }
  },

  tradeoffs: {
    title: 'Trade-offs Escolhidos de Propósito',
    subtitle:
      'Por que a codebase se parece com isso hoje, e não com um starter genérico.',
    why: 'Por que agora?',
    impact: 'Custo assumido',
    alternatives: 'Alternativa',
    decisions: {
      typeSafety: {
        title: 'Contratos compartilhados primeiro',
        why: 'Uma superfície única de contratos entre web, API e worker torna mudanças mais seguras do que duplicar tipos manualmente.',
        impact:
          'Refactors mais seguros e ownership mais claro, com mais trabalho inicial de schema.',
        alternatives:
          'Uma configuração mais solta seria mais rápida de rascunhar, mas deixaria drift aparecer com facilidade.'
      },
      bunRuntime: {
        title: 'Bun como runtime padrão',
        why: 'Ferramentas nativas para Redis, SQL e senhas reduzem código de cola no caminho principal da aplicação.',
        impact:
          'Dependências mais enxutas e bom perfil de I/O, com ecossistema menor que o Node.js.',
        alternatives:
          'Node.js ampliaria a compatibilidade, mas reintroduziria mais código de adaptação.'
      },
      mvcPattern: {
        title: 'Controllers finos, services explícitos',
        why: 'O handling do request fica próximo do framework enquanto as regras de negócio continuam testáveis e reutilizáveis.',
        impact:
          'Mais arquivos e um modelo de ownership mais claro, ao custo de menos simplicidade aparente.',
        alternatives:
          'Colocar tudo em route handlers pareceria menor no início, mas seria mais difícil de evoluir.'
      },
      eventDriven: {
        title: 'Analytics assíncrono em vez de bloquear redirects',
        why: 'O redirect precisa continuar rápido mesmo quando analytics, limpeza ou sistemas downstream estiverem ocupados.',
        impact:
          'Melhor latência no hot path, com mais trabalho em background jobs e observabilidade.',
        alternatives:
          'Escritas inline são mais simples, mas gastam orçamento de latência em trabalho não crítico.'
      },
      monolith: {
        title: 'Um monorepo, múltiplos serviços',
        why: 'O projeto fica mais fácil de entender quando as fronteiras de runtime são explícitas, mas o código ainda é entregue a partir de um único repositório.',
        impact:
          'Menor sobrecarga operacional hoje, com menos garantias de isolamento do que um sistema mais distribuído.',
        alternatives:
          'Uma divisão em microservices adicionaria cerimônia antes de a codebase realmente precisar disso.'
      }
    }
  },

  metrics: {
    title: 'Números em Contexto',
    subtitle:
      'Estes cards mostram targets documentados de validação, não telemetria pública ao vivo.',
    latency: {
      value: '< 30ms',
      label: 'Target de redirect P50',
      description: 'Meta de warm-cache no runbook de baseline do redirect'
    },
    throughput: {
      value: '< 300ms',
      label: 'Target de redirect P99',
      description: 'Limite superior acompanhado durante a validação de carga'
    },
    availability: {
      value: '> 70%',
      label: 'Target de cache hit em warm-cache',
      description: 'Esperado após warm-up nos checks de redirect com k6'
    }
  },

  security: {
    title: 'Segurança e Guardrails Operacionais',
    docsLink: 'Ler os docs de segurança →',
    protections: {
      title: 'Guardrails implementados',
      rateLimit: 'Rate limiting nas superfícies públicas de escrita e redirect',
      headers: 'Headers de segurança definidos por policy compartilhada',
      csrf: 'Proteção CSRF nos fluxos interativos com formulários',
      sanitization: 'Validação em runtime e sanitização perto dos handlers',
      blacklist: 'Caminhos operacionais de revisão para destinos suspeitos'
    },
    compliance: {
      title: 'Postura de privacidade',
      anonymization: 'Os fluxos de analytics minimizam exposição direta de IP',
      consent: 'Analytics com consentimento explícito na web pública',
      export:
        'Exportação e exclusão continuam visíveis como superfícies do produto',
      forgotten: 'Fluxos de privacidade ficam explícitos em vez de implícitos',
      retention:
        'Detalhes de política vivem nos docs e no PRD, não nesta página'
    }
  },

  author: {
    title: 'Construído e mantido por',
    name: 'Gustavo Sotero',
    role: 'Engenheiro full-stack',
    description:
      'urlfy.cc é o lugar onde enquadramento de produto, escolhas de runtime e trade-offs operacionais são exercitados em código, em vez de ficarem só em diagramas ou slides.',
    portfolio: 'Portfólio',
    github: 'Repositório do projeto'
  },

  cta: {
    title: 'Comece pelo README',
    description:
      'O README é a porta de entrada curta. Os docs de arquitetura aprofundam as decisões, e /api/docs reflete a superfície viva da API.',
    apiDocs: 'Abrir docs da API',
    repository: 'README do repositório'
  }
} as const;
