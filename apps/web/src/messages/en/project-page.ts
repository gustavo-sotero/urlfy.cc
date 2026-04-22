export const ProjectPage = {
  metaTitle: 'Project Notes - urlfy.cc',
  metaDescription:
    'What urlfy.cc implements today, why the architecture looks like this, and how to read its documented engineering targets.',
  ogTitle: 'Inside urlfy.cc',
  ogDescription:
    'Current architecture, trade-offs, and validation targets for a real product project in progress.',

  hero: {
    badge: 'Real Product Project · Portfolio · Applied Research',
    title: 'Project Notes',
    subtitle: 'urlfy.cc',
    description:
      'A self-hosted URL shortener built as a real product project: localized web app, dedicated API, Bun worker, Docker-based operations, and docs kept close to the code.'
  },

  architecture: {
    title: 'Current Architecture',
    subtitle:
      'What exists today and why the browser stays same-origin while web, API, and worker remain decoupled.',
    docsLink: 'Read the architecture docs →',
    frontend: {
      title: 'Web application',
      appRouter:
        'Next.js 16 App Router serves the public pages, auth flows, dashboard, and redirect entrypoints.',
      middleware:
        'The edge proxy keeps browser traffic same-origin in local development and behind production ingress.',
      ui: 'The public shell and dashboard share one localized UI instead of splitting into separate frontends.'
    },
    api: {
      title: 'API and background work',
      typeSafe:
        'A dedicated Elysia service owns /api, OpenAPI output, and runtime validation.',
      fast: 'A Bun worker handles analytics, cleanup, and other asynchronous jobs outside the request path.',
      openapi: 'Interactive and repo-level references start at'
    }
  },

  infrastructure: {
    title: 'Operational Choices',
    subtitle:
      'Small enough to understand end-to-end, explicit enough to run and document.',
    docsLink: 'See deployment and system docs →',
    persistence: {
      title: 'Shared data layer',
      subtitle: 'PostgreSQL + Drizzle + workspace packages',
      feature1:
        'Schema, migrations, and reserved slugs live in shared packages instead of app-specific copies.',
      feature2:
        'Redirect and domain logic are reused across web, API, and worker boundaries.',
      feature3:
        'State lives close to contracts instead of being buried in framework adapters.'
    },
    cache: {
      title: 'Cache and routing',
      subtitle: 'Redis + same-origin redirect path',
      feature1:
        'Redirects use hot-path cache reads before touching the database.',
      feature2:
        'Rate limiting, locking, and negative-cache helpers are shared across services.',
      feature3:
        'The redirect hot path stays in web, avoiding the previous internal API hop.'
    },
    observability: {
      title: 'Operational feedback',
      subtitle: 'Health, readiness, logs, and validation docs',
      feature1:
        'Health and readiness endpoints are part of the shipped surface.',
      feature2: 'Structured telemetry is shared across the monorepo services.',
      feature3:
        'Performance validation lives in docs and tests instead of marketing-style claims.'
    }
  },

  tradeoffs: {
    title: 'Trade-offs Chosen Deliberately',
    subtitle:
      'Why the codebase looks like this today, not like a generic starter.',
    why: 'Why now?',
    impact: 'What it costs',
    alternatives: 'Alternative',
    decisions: {
      typeSafety: {
        title: 'Shared contracts first',
        why: 'One contract surface across web, API, and worker makes changes safer than duplicating types by hand.',
        impact:
          'Safer refactors and clearer ownership, with more up-front schema work.',
        alternatives:
          'A looser setup would be faster to sketch, but easier to let drift.'
      },
      bunRuntime: {
        title: 'Bun as the default runtime',
        why: 'Native Redis, SQL, and password tooling reduce glue code in the main runtime path.',
        impact:
          'Leaner dependencies and good I/O characteristics, with a smaller ecosystem than Node.js.',
        alternatives:
          'Node.js would widen compatibility, but would reintroduce more adapter code.'
      },
      mvcPattern: {
        title: 'Thin controllers, explicit services',
        why: 'Request handling stays close to the framework while business rules stay testable and reusable.',
        impact:
          'More files and a clearer ownership model, at the cost of less flashy simplicity.',
        alternatives:
          'Putting everything in route handlers would feel smaller at first, but harder to evolve.'
      },
      eventDriven: {
        title: 'Async analytics instead of blocking redirects',
        why: 'Redirects should stay fast even when analytics, cleanup, or downstream systems are busy.',
        impact:
          'Better latency on the hot path, with more background-job and observability work.',
        alternatives:
          'Inline writes are simpler, but they spend latency budget on non-critical work.'
      },
      monolith: {
        title: 'One monorepo, multiple services',
        why: 'The project is easier to reason about when runtime boundaries stay explicit but code still ships from one repo.',
        impact:
          'Lower operational overhead today, with fewer isolation guarantees than a larger distributed system.',
        alternatives:
          'A microservice split would add ceremony before this codebase actually needs it.'
      }
    }
  },

  metrics: {
    title: 'Numbers In Context',
    subtitle:
      'These are documented validation targets, not live public telemetry.',
    latency: {
      value: '< 30ms',
      label: 'Redirect P50 target',
      description: 'Warm-cache goal from the redirect baseline runbook'
    },
    throughput: {
      value: '< 300ms',
      label: 'Redirect P99 target',
      description: 'Upper bound tracked during load validation'
    },
    availability: {
      value: '> 70%',
      label: 'Warm-cache hit-rate target',
      description: 'Expected after warm-up in k6 redirect checks'
    }
  },

  security: {
    title: 'Security and Operational Guardrails',
    docsLink: 'Read the security docs →',
    protections: {
      title: 'Implemented guardrails',
      rateLimit: 'Rate limiting on public write and redirect surfaces',
      headers: 'Security headers from shared policy',
      csrf: 'CSRF protection on interactive form flows',
      sanitization: 'Runtime validation and input sanitization near handlers',
      blacklist: 'Operational review paths for suspicious destinations'
    },
    compliance: {
      title: 'Privacy posture',
      anonymization: 'Analytics flows minimize direct IP exposure',
      consent: 'Consent-aware analytics in the public web app',
      export: 'User export and deletion remain explicit product surfaces',
      forgotten: 'Privacy-related flows stay visible instead of implied',
      retention: 'Policy details live in docs and PRD instead of this page'
    }
  },

  author: {
    title: 'Built and maintained by',
    name: 'Gustavo Sotero',
    role: 'Full-stack engineer',
    description:
      'urlfy.cc is where product framing, runtime choices, and operational trade-offs are exercised in code instead of staying as diagrams or slideware.',
    portfolio: 'Portfolio',
    github: 'Project Repository'
  },

  cta: {
    title: 'Start with the README',
    description:
      'The README is the short entry point. The architecture docs go deeper, and /api/docs reflects the live API surface.',
    apiDocs: 'Open API docs',
    repository: 'Repository README'
  }
} as const;
