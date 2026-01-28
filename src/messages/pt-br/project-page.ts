export const ProjectPage = {
  metaTitle: 'Sobre o Projeto - urlfy.cc',
  metaDescription:
    'Uma jornada técnica sobre arquitetura, decisões e trade-offs no desenvolvimento de um encurtador de URLs moderno.',
  ogTitle: 'Por trás do código: urlfy.cc',
  ogDescription:
    'Arquitetura, decisões técnicas e trade-offs de um projeto full-stack moderno',

  hero: {
    badge: 'Projeto de Portfólio & Pesquisa',
    title: 'Por trás do código',
    subtitle: 'urlfy.cc',
    description:
      'Uma jornada técnica sobre arquitetura, decisões e trade-offs no desenvolvimento de um encurtador de URLs moderno e de alta performance.'
  },

  architecture: {
    title: 'Arquitetura Híbrida',
    subtitle: 'Next.js para UI + ElysiaJS para API = Type-Safety End-to-End',
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
    subtitle: '100% containerizado, self-hosted e pronto para produção',
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
      subtitle: 'SigNoz + OpenTelemetry',
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
        why: 'Simplicidade operacional para um projeto de portfólio. Menor custo de infraestrutura.',
        impact:
          'Fácil de deployar e manter, mas escala vertical (vs. horizontal com microservices).',
        alternatives:
          'Microservices seria mais escalável, mas muito mais complexo e caro para um projeto pessoal de pesquisa e desenvolvimento.'
      }
    }
  },

  metrics: {
    title: 'Impacto Técnico (Simulado)',
    subtitle: 'Métricas e SLOs para demonstração de engenharia',
    latency: {
      value: '< 30ms',
      label: 'Latência P50 de Redirect',
      description: 'Cache Redis + Middleware Edge'
    },
    throughput: {
      value: '10K+',
      label: 'Requisições/segundo',
      description: 'Bun Runtime + APIs Nativas'
    },
    availability: {
      value: '99.9%',
      label: 'Availability Target',
      description: 'Health Checks + Circuit Breaker'
    }
  },

  security: {
    title: 'Segurança & Compliance',
    protections: {
      title: 'Proteções Implementadas',
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
      forgotten: 'Right to be forgotten (72h)',
      retention: 'Data retention (90 dias)'
    }
  },

  author: {
    title: 'Sobre o Desenvolvedor',
    name: 'Gustavo Sotero',
    role: 'Full-Stack Developer',
    description:
      'Este projeto foi desenvolvido como demonstração de habilidades técnicas em arquitetura de software, performance engineering e boas práticas de desenvolvimento. Não se trata de um produto comercial, mas sim de um estudo de caso e portfólio.',
    portfolio: 'Portfólio',
    github: 'Ver no GitHub'
  },

  cta: {
    title: 'Explore a Documentação',
    description:
      'Mergulhe nos detalhes técnicos através da documentação completa da API e código-fonte no GitHub.',
    apiDocs: 'API Documentation',
    repository: 'Repositório'
  }
} as const;
