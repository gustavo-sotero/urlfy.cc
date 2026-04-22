export const ProjectPage = {
  metaTitle: 'O Projeto - urlfy.cc',
  metaDescription:
    'Arquitetura, decisões e trade-offs por trás do urlfy.cc — encurtador de URLs em produção, portfólio e projeto de pesquisa aplicada.',
  ogTitle: 'Por trás do código: urlfy.cc',
  ogDescription:
    'Arquitetura, decisões e trade-offs de um projeto full-stack moderno',

  hero: {
    badge: 'Projeto Real · Portfólio · Pesquisa Aplicada',
    title: 'Por trás do código',
    subtitle: 'urlfy.cc',
    description:
      'Um encurtador de URLs em produção com arquitetura full-stack moderna — rodando em produção, funcionando também como portfólio e plataforma de pesquisa aplicada.'
  },

  architecture: {
    title: 'Arquitetura Híbrida',
    subtitle: 'Next.js para UI + ElysiaJS para API — type-safety end-to-end',
    docsLink: 'Ver docs de arquitetura →',
    frontend: {
      title: 'Frontend (Next.js 16)',
      appRouter: 'Server Components para SEO e performance',
      middleware: 'Middleware para redirecionamento de links',
      ui: 'Design system acessível e consistente'
    },
    api: {
      title: 'API (ElysiaJS + Bun)',
      typeSafe: 'TypeBox para validação runtime com inferência de tipos',
      fast: 'Bun Native APIs (SQL, Redis, Password)',
      openapi: 'Documentação automática em'
    }
  },

  infrastructure: {
    title: 'Infraestrutura & Stack',
    subtitle: '100% containerizado e self-hosted',
    docsLink: 'Ver docs de infraestrutura →',
    persistence: {
      title: 'Persistência',
      subtitle: 'PostgreSQL 16 + Drizzle ORM',
      feature1: 'Particionamento mensal de eventos',
      feature2: 'Type-safe queries com Drizzle',
      feature3: 'Migrações versionadas'
    },
    cache: {
      title: 'Cache',
      subtitle: 'Redis 7 (Bun Native)',
      feature1: 'Hot-path caching para redirects',
      feature2: 'Rate limiting (Sliding Window)',
      feature3: 'Cache negativo para códigos inválidos'
    },
    observability: {
      title: 'Observabilidade',
      subtitle: 'Grafana LGTM + OpenTelemetry',
      feature1: 'Traces distribuídos',
      feature2: 'Métricas de performance (SLOs)',
      feature3: 'Logs estruturados'
    }
  },

  tradeoffs: {
    title: 'Decisões Técnicas & Trade-offs',
    subtitle: 'Escolhas arquiteturais, motivações e alternativas consideradas',
    why: 'Por quê?',
    impact: 'Impacto',
    alternatives: 'Alternativas Consideradas',
    decisions: {
      typeSafety: {
        title: 'Type-Safety First (TypeScript Strict + Drizzle)',
        why: 'Capturar erros em tempo de build, não em produção. Melhor developer experience com autocompleção e refactoring seguro.',
        impact:
          'Reduz bugs em produção, mas aumenta tempo de desenvolvimento inicial e curva de aprendizado.',
        alternatives:
          'JavaScript puro seria mais rápido de prototipar, mas menos seguro e escalável.'
      },
      bunRuntime: {
        title: 'Bun Runtime vs Node.js',
        why: 'APIs nativas para SQL, Redis e Password Hashing reduzem dependências externas. Performance superior em I/O.',
        impact:
          'Menos dependências (bcrypt, ioredis), mas ecossistema ainda em maturação. Menor community support.',
        alternatives:
          'Node.js teria melhor compatibilidade, mas mais overhead e dependências.'
      },
      mvcPattern: {
        title: 'Feature-Based MVC (Elysia Best Practices)',
        why: 'Separação clara de responsabilidades, facilita testes unitários e manutenção de longo prazo.',
        impact: 'Mais boilerplate inicial, mas código escalável e testável.',
        alternatives:
          'Next.js Route Handlers seria mais simples, mas perderia type-safety e validação runtime.'
      },
      eventDriven: {
        title: 'Event-Driven Analytics (Redis Streams)',
        why: 'Não bloquear o redirect com writes de analytics. Native Bun implementation para zero deps.',
        impact: 'Performance excelente e type-safe. Sem BullMQ/Redis externo.',
        alternatives:
          'BullMQ adicionaria dependências desnecessárias (ioredis).'
      },
      monolith: {
        title: 'Monolith Self-Hosted (Docker Compose)',
        why: 'Simplicidade operacional para um projeto nesta escala. Menor custo de infraestrutura.',
        impact:
          'Fácil de deployar e manter, mas escala vertical (vs. horizontal com microservices).',
        alternatives:
          'Microservices seria mais escalável, mas muito mais complexo e caro neste estágio.'
      }
    }
  },

  metrics: {
    title: 'Targets de Performance',
    subtitle:
      'Targets de SLO — baselines e metodologia de medição nos docs de arquitetura',
    latency: {
      value: '< 30ms',
      label: 'Redirect P50 (target)',
      description: 'Cache Redis + Middleware Edge'
    },
    throughput: {
      value: '10K+',
      label: 'Requisições/segundo (target)',
      description: 'Bun Runtime + APIs Nativas'
    },
    availability: {
      value: '99.9%',
      label: 'SLO de Availability',
      description: 'Health Checks + Circuit Breaker'
    }
  },

  security: {
    title: 'Segurança & Compliance',
    docsLink: 'Ver docs de segurança →',
    protections: {
      title: 'Proteções',
      rateLimit: 'Rate Limiting (Sliding Window)',
      headers: 'Headers de Segurança (CSP, HSTS)',
      csrf: 'CSRF Protection',
      sanitization: 'Input Sanitization (DOMPurify)',
      blacklist: 'Blacklist de URLs maliciosas'
    },
    compliance: {
      title: 'Compliance LGPD/GDPR',
      anonymization: 'Anonimização de IPs (SHA-256)',
      consent: 'Consentimento explícito',
      export: 'Exportação de dados',
      forgotten: 'Direito ao esquecimento (72h)',
      retention: 'Data retention (90 dias)'
    }
  },

  author: {
    title: 'Sobre o Desenvolvedor',
    name: 'Gustavo Sotero',
    role: 'Full-Stack Developer',
    description:
      'Arquiteto de software e desenvolvedor focado em sistemas de alta performance, TypeScript e infraestrutura moderna. Este projeto demonstra competências em arquitetura, performance engineering e boas práticas através de uma codebase viva.',
    portfolio: 'Portfólio',
    github: 'Ver no GitHub'
  },

  cta: {
    title: 'Explore a Documentação',
    description:
      'Arquitetura, banco de dados, cache, segurança e referência de API — tudo nos docs.',
    apiDocs: 'API Documentation',
    repository: 'Repositório'
  }
} as const;
