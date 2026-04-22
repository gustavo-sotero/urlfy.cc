export const ProjectPage = {
  metaTitle: 'The Project - urlfy.cc',
  metaDescription:
    'Architecture, decisions, and trade-offs behind urlfy.cc — a production-grade URL shortener, portfolio, and applied-research project.',
  ogTitle: 'Behind the code: urlfy.cc',
  ogDescription:
    'Architecture, decisions, and trade-offs of a modern full-stack project',

  hero: {
    badge: 'Real Project · Portfolio · Applied Research',
    title: 'Behind the code',
    subtitle: 'urlfy.cc',
    description:
      'A production-grade URL shortener with modern full-stack architecture — running in production, also serving as portfolio and applied-research platform.'
  },

  architecture: {
    title: 'Hybrid Architecture',
    subtitle: 'Next.js for UI + ElysiaJS for API — end-to-end type-safety',
    docsLink: 'See architecture docs →',
    frontend: {
      title: 'Frontend (Next.js 16)',
      appRouter: 'Server Components for SEO and performance',
      middleware: 'Middleware for link redirection',
      ui: 'Accessible and consistent design system'
    },
    api: {
      title: 'API (ElysiaJS + Bun)',
      typeSafe: 'TypeBox for runtime validation with type inference',
      fast: 'Bun Native APIs (SQL, Redis, Password)',
      openapi: 'Automatic documentation at'
    }
  },

  infrastructure: {
    title: 'Infrastructure & Stack',
    subtitle: '100% containerized and self-hosted',
    docsLink: 'See infrastructure docs →',
    persistence: {
      title: 'Persistence',
      subtitle: 'PostgreSQL 16 + Drizzle ORM',
      feature1: 'Monthly event partitioning',
      feature2: 'Type-safe queries with Drizzle',
      feature3: 'Versioned migrations'
    },
    cache: {
      title: 'Cache',
      subtitle: 'Redis 7 (Bun Native)',
      feature1: 'Hot-path caching for redirects',
      feature2: 'Rate limiting (Sliding Window)',
      feature3: 'Negative cache for invalid codes'
    },
    observability: {
      title: 'Observability',
      subtitle: 'Grafana LGTM + OpenTelemetry',
      feature1: 'Distributed traces',
      feature2: 'Performance metrics (SLOs)',
      feature3: 'Structured logs'
    }
  },

  tradeoffs: {
    title: 'Technical Decisions & Trade-offs',
    subtitle: 'Architectural choices, motivations and alternatives considered',
    why: 'Why?',
    impact: 'Impact',
    alternatives: 'Alternatives Considered',
    decisions: {
      typeSafety: {
        title: 'Type-Safety First (TypeScript Strict + Drizzle)',
        why: 'Catch errors at build time, not in production. Better developer experience with autocomplete and safe refactoring.',
        impact:
          'Reduces production bugs, but increases initial development time and learning curve.',
        alternatives:
          'Pure JavaScript would be faster to prototype, but less safe and scalable.'
      },
      bunRuntime: {
        title: 'Bun Runtime vs Node.js',
        why: 'Native APIs for SQL, Redis and Password Hashing reduce external dependencies. Superior I/O performance.',
        impact:
          'Fewer dependencies (bcrypt, ioredis), but ecosystem still maturing. Less community support.',
        alternatives:
          'Node.js would have better compatibility, but more overhead and dependencies.'
      },
      mvcPattern: {
        title: 'Feature-Based MVC (Elysia Best Practices)',
        why: 'Clear separation of concerns, facilitates unit testing and long-term maintenance.',
        impact: 'More initial boilerplate, but scalable and testable code.',
        alternatives:
          'Next.js Route Handlers would be simpler, but would lose type-safety and runtime validation.'
      },
      eventDriven: {
        title: 'Event-Driven Analytics (Redis Streams)',
        why: "Don't block redirect with analytics writes. Native Bun implementation for zero deps.",
        impact:
          'Excellent performance and type-safe. No BullMQ/external Redis.',
        alternatives: 'BullMQ would add unnecessary dependencies (ioredis).'
      },
      monolith: {
        title: 'Monolith Self-Hosted (Docker Compose)',
        why: 'Operational simplicity for a project at this scale. Lower infrastructure cost.',
        impact:
          'Easy to deploy and maintain, but scales vertically (vs. horizontally with microservices).',
        alternatives:
          'Microservices would be more scalable, but much more complex and expensive at this stage.'
      }
    }
  },

  metrics: {
    title: 'Performance Targets',
    subtitle:
      'SLO targets — baselines and measurement methodology in the architecture docs',
    latency: {
      value: '< 30ms',
      label: 'Redirect P50 (target)',
      description: 'Redis Cache + Edge Middleware'
    },
    throughput: {
      value: '10K+',
      label: 'Requests/second (target)',
      description: 'Bun Runtime + Native APIs'
    },
    availability: {
      value: '99.9%',
      label: 'Availability SLO',
      description: 'Health Checks + Circuit Breaker'
    }
  },

  security: {
    title: 'Security & Compliance',
    docsLink: 'See security docs →',
    protections: {
      title: 'Protections',
      rateLimit: 'Rate Limiting (Sliding Window)',
      headers: 'Security Headers (CSP, HSTS)',
      csrf: 'CSRF Protection',
      sanitization: 'Input Sanitization (DOMPurify)',
      blacklist: 'Malicious URL blacklist'
    },
    compliance: {
      title: 'GDPR/LGPD Compliance',
      anonymization: 'IP Anonymization (SHA-256)',
      consent: 'Explicit consent',
      export: 'Data export',
      forgotten: 'Right to be forgotten (72h)',
      retention: 'Data retention (90 days)'
    }
  },

  author: {
    title: 'About the Developer',
    name: 'Gustavo Sotero',
    role: 'Full-Stack Developer',
    description:
      'Software architect and developer focused on high-performance systems, TypeScript, and modern infrastructure. This project demonstrates competencies in architecture, performance engineering, and best practices through a living codebase.',
    portfolio: 'Portfolio',
    github: 'View on GitHub'
  },

  cta: {
    title: 'Explore the Documentation',
    description:
      'Architecture, database, caching, security, and API reference — all in the docs.',
    apiDocs: 'API Documentation',
    repository: 'Repository'
  }
} as const;
