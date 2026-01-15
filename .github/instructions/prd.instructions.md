---
applyTo: '**'
---

# Product Requirements Document (PRD) - urlfy.cc

| **Projeto**     | urlfy.cc                                                                            |
| :-------------- | :---------------------------------------------------------------------------------- |
| **Versão**      | 3.0.0                                                                               |
| **Status**      | Em Planejamento                                                                     |
| **Tipo**        | Projeto de Portfólio (Full Stack)                                                   |
| **Responsável** | Gustavo Sotero                                                                      |
| **Objetivo**    | Encurtador de links de alta performance com arquitetura self-hosted e event-driven. |

---

## 1. Visão Geral

O **urlfy.cc** é um serviço de encurtamento de URLs focado em performance e simplicidade, atendendo:

- **Usuários casuais:** Links rápidos sem cadastro
- **Power users:** Personalização, métricas detalhadas e acesso via API

### 1.1 Diferenciais Técnicos (Portfólio)

| Aspecto        | Abordagem                                             |
| -------------- | ----------------------------------------------------- |
| Performance    | Bun runtime com APIs nativas (SQL, Redis)             |
| Infraestrutura | 100% containerizada (Docker Compose)                  |
| Type-Safety    | End-to-end com ElysiaJS + Drizzle (single source)     |
| API Pattern    | Feature-based MVC (Controller/Service/Model) - Elysia |
| Throughput     | Redis nativo + rate limiting sliding window           |
| Analytics      | Event sourcing com agregações diárias                 |
| Observability  | SigNoz (OpenTelemetry nativo)                         |
| Compliance     | LGPD/GDPR (anonimização imediata de IPs)              |

> 📚 **Detalhes técnicos:** Ver [architecture/overview.md](../../docs/architecture/overview.md)

---

## 2. Personas

### 2.1 O Visitante (Guest)

- **Perfil:** Precisa compartilhar link longo rapidamente
- **Dores:** Não quer cadastro, odeia formulários
- **Jornada:** Cola link → Clica "Encurtar" → Copia → Sai

### 2.2 O Power User (Logado)

- **Perfil:** Marketing, criadores de conteúdo, desenvolvedores
- **Dores:** Precisa de métricas, URLs personalizadas, controle de validade
- **Jornada:** Loga → Cria link customizado → Define expiração → Analisa gráficos

### 2.3 O Administrador

- **Perfil:** Gestor do sistema
- **Dores:** Spam, phishing, sobrecarga
- **Jornada:** Monitora dashboard → Bane links maliciosos → Gerencia usuários

---

## 3. Requisitos Funcionais

### 3.1 Encurtamento de Links (Core)

| ID        | Requisito                                                                  |
| --------- | -------------------------------------------------------------------------- |
| **RF-01** | Sistema deve gerar hash único de 7 caracteres (NanoID, charset 0-9a-zA-Z)  |
| **RF-02** | Usuários logados podem definir alias personalizado                         |
| **RF-03** | Slugs reservados do sistema devem ser bloqueados                           |
| **RF-04** | URL de destino deve ser validada (formato + protocolo http/https)          |
| **RF-05** | URLs de outros encurtadores devem ser bloqueadas                           |
| **RF-06** | URLs maliciosas devem ser verificadas contra blacklist manual              |
| **RF-07** | Usuários logados podem definir data de expiração                           |
| **RF-08** | Usuários logados podem definir limite de cliques                           |
| **RF-09** | Links podem ser protegidos por senha (opcional)                            |
| **RF-10** | Sistema deve gerar QR Code do link                                         |
| **RF-11** | Usuários logados podem customizar meta tags (OG title, description, image) |

### 3.2 Redirecionamento

| ID        | Requisito                                                           |
| --------- | ------------------------------------------------------------------- |
| **RF-12** | Redirecionamento deve verificar cache antes do banco                |
| **RF-13** | Links inativos, banidos ou expirados não devem redirecionar         |
| **RF-14** | Profundidade de redirect deve ser limitada (max: 3)                 |
| **RF-15** | Evento de clique deve ser registrado assincronamente                |
| **RF-16** | Tipo de redirect configurável: 301 (permanente) ou 302 (temporário) |

### 3.3 Analytics

| ID        | Requisito                                                                          |
| --------- | ---------------------------------------------------------------------------------- |
| **RF-17** | Cada clique deve registrar: timestamp, país, cidade, browser, OS, device, referrer |
| **RF-18** | IP deve ser anonimizado imediatamente (hash SHA-256)                               |
| **RF-19** | Geo-location deve ser resolvida via MaxMind (offline)                              |
| **RF-20** | Dados brutos mantidos por 90 dias, depois apenas agregados                         |
| **RF-21** | Dashboard deve exibir: cliques por dia, top países, device breakdown               |

### 3.4 Gestão de Links

| ID        | Requisito                                                       |
| --------- | --------------------------------------------------------------- |
| **RF-22** | Usuário pode listar seus links (paginado)                       |
| **RF-23** | Usuário pode ativar/desativar link                              |
| **RF-24** | Usuário pode deletar link (soft delete, recuperável em 30 dias) |
| **RF-25** | Usuário pode editar: alias, meta tags, expiração, UTMs          |
| **RF-26** | Usuário pode duplicar link existente                            |

### 3.5 Autenticação

| ID        | Requisito                                         |
| --------- | ------------------------------------------------- |
| **RF-27** | Login via Email/Password + OAuth (Google, GitHub) |
| **RF-28** | 2FA obrigatório para role admin (TOTP)            |
| **RF-29** | API Keys para acesso programático                 |
| **RF-30** | Documentação automática em `/api/auth/reference`  |

### 3.6 Administração

| ID        | Requisito                                          |
| --------- | -------------------------------------------------- |
| **RF-31** | Dashboard com KPIs: total links, cliques, usuários |
| **RF-32** | Busca global de links + ação "Banir"               |
| **RF-33** | Gestão de usuários: ban, unban, alterar role       |
| **RF-34** | Logs de auditoria para ações administrativas       |

### 3.7 Compliance (LGPD/GDPR)

| ID        | Requisito                                     |
| --------- | --------------------------------------------- |
| **RF-35** | Banner de consentimento para analytics        |
| **RF-36** | Endpoint para exportação de dados do usuário  |
| **RF-37** | Endpoint para solicitar exclusão de dados     |
| **RF-38** | Exclusão completa em até 72h após solicitação |

---

## 4. Requisitos Não-Funcionais

### 4.1 Performance (SLOs)

| Métrica              | Target  | Crítico |
| -------------------- | ------- | ------- |
| Availability         | 99.9%   | < 99.5% |
| Redirect Latency P50 | < 30ms  | > 100ms |
| Redirect Latency P99 | < 300ms | > 500ms |
| API Latency P99      | < 300ms | > 1s    |
| Error Rate           | < 0.1%  | > 1%    |
| Cache Hit Rate       | > 85%   | < 70%   |

### 4.2 Segurança

| ID         | Requisito                                         |
| ---------- | ------------------------------------------------- |
| **RNF-01** | Rate limiting por IP e por link                   |
| **RNF-02** | Headers de segurança (CSP, HSTS, X-Frame-Options) |
| **RNF-03** | CORS restrito a domínios permitidos               |
| **RNF-04** | CSRF protection para formulários                  |
| **RNF-05** | Sanitização de inputs (meta tags especialmente)   |

> 📚 **Detalhes:** Ver [architecture/security.md](../../docs/architecture/security.md)

### 4.3 Resiliência

| ID         | Requisito                                  |
| ---------- | ------------------------------------------ |
| **RNF-06** | Circuit breaker para dependências externas |
| **RNF-07** | Dead Letter Queue para eventos falhos      |
| **RNF-08** | Graceful degradation se Redis indisponível |

### 4.4 Observabilidade

| ID         | Requisito                                     |
| ---------- | --------------------------------------------- |
| **RNF-09** | Logs estruturados com correlation IDs         |
| **RNF-10** | Traces distribuídos via OpenTelemetry         |
| **RNF-11** | Alertas para latência, error rate, cache miss |

### 4.5 Backup & DR

| Métrica | Target   |
| ------- | -------- |
| RTO     | < 1 hora |
| RPO     | < 1 hora |

---

## 5. Padrões de Código Elysia

> 📚 **Referência oficial:** [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice)

### 5.1 Estrutura Feature-Based (MVC)

Organização por módulos funcionais:

```
src/server/
├── api/v1/
│   ├── links/
│   │   ├── index.ts      # Controller (Elysia instance)
│   │   ├── service.ts    # Service (lógica de negócio)
│   │   └── model.ts      # Model (validação TypeBox)
│   ├── auth/
│   └── analytics/
├── models/               # Schemas centralizados
└── services/             # Services compartilhados
```

### 5.2 Controller Pattern

| Prática                        | Recomendação                                        |
| ------------------------------ | --------------------------------------------------- |
| **1 Elysia = 1 Controller**    | Cada módulo é uma instância Elysia com prefix       |
| **Não passar Context inteiro** | Usar destructuring para extrair apenas o necessário |
| **Testes via handle()**        | Usar `app.handle(new Request(...))` para unit tests |
| **Decoupling**                 | Controllers não devem conter lógica de negócio      |

### 5.3 Service Pattern

| Tipo                      | Implementação                                                |
| ------------------------- | ------------------------------------------------------------ |
| **Non-request dependent** | `abstract class` com métodos `static` (não requer instância) |
| **Request dependent**     | Elysia instance com `macro` ou `decorate` (plugin singleton) |

### 5.4 Model Pattern (Single Source of Truth)

| Prática                   | Descrição                                                     |
| ------------------------- | ------------------------------------------------------------- |
| **Usar `t.Object()`**     | TypeBox para validação runtime + inferência de tipos          |
| **`typeof model.static`** | Extrair tipo TypeScript do schema                             |
| **Model Injection**       | Registrar models via `.model()` para OpenAPI e cache de tipos |
| **Agrupar por domínio**   | `AuthModel`, `LinkModel`, etc.                                |

```typescript
// ✅ Correto: Single source of truth
const LinkCreateBody = t.Object({
  url: t.String({ maxLength: 2048 }),
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 }))
});
type LinkCreateBodyType = typeof LinkCreateBody.static;

// ❌ Incorreto: Tipo separado do schema
interface LinkCreateBody {
  url: string;
  customAlias?: string;
}
```

### 5.5 Anti-Patterns

| Anti-Pattern                          | Por quê evitar                                   |
| ------------------------------------- | ------------------------------------------------ |
| Classe controller com `Context`       | Perde type-safety e dificulta manutenção         |
| Passar `Context` inteiro para service | Acoplamento desnecessário, dificulta testes      |
| Interface/classe como model           | Duplica definições, perde validação runtime      |
| Decorators em excesso                 | Acopla código ao Elysia, dificulta portabilidade |

---

## 6. Roadmap

### Fase 1: Core MVP (Visitante)

- [ ] Setup Next.js + Bun + Elysia + Docker
- [ ] PostgreSQL + Drizzle + Redis
- [ ] Criação de link (guest)
- [ ] Middleware de redirecionamento
- [ ] Landing page com input
- [ ] Testes unitários

### Fase 2: Performance & Infra

- [ ] Cache Redis com invalidação
- [ ] Rate limiting (sliding window)
- [ ] Circuit breaker
- [ ] BullMQ (filas + DLQ)
- [ ] SigNoz (observability)
- [ ] MaxMind (geo-location)
- [ ] CI/CD + testes de carga

### Fase 3: Autenticação

- [ ] Better-Auth + plugins
- [ ] OAuth (Google, GitHub)
- [ ] Dashboard do usuário
- [ ] Features premium (alias, expiração, senha, meta tags)

### Fase 4: Analytics & Admin

- [ ] Event sourcing com BullMQ
- [ ] Particionamento de eventos
- [ ] Agregação diária
- [ ] Dashboard de gráficos
- [ ] Painel admin + audit logs

### Fase 5: Compliance & Polish

- [ ] Endpoints LGPD
- [ ] Banner de cookies
- [ ] Anonimização automática
- [ ] Testes E2E (Playwright)
- [ ] Documentação final

---

## 7. Critérios de Aceite

### Performance

- [ ] Lighthouse Score > 90
- [ ] Redirect P50 < 30ms (cache hit)
- [ ] Throughput > 10.000 req/s (validado com k6)

### Qualidade

- [ ] 100% TypeScript Strict
- [ ] Cobertura de testes > 80%
- [ ] Testes E2E para fluxos críticos
- [ ] Testes de contrato da API

### Documentação

- [ ] README com Docker Compose
- [ ] API documentada (Swagger + OpenAPI)
- [ ] Diagrama de arquitetura

### DevOps

- [ ] Docker Compose funcional
- [ ] GitHub Actions (lint, test, build)
- [ ] Health checks configurados

### Segurança

- [ ] Headers verificados (securityheaders.com)
- [ ] Rate limiting funcionando
- [ ] Blacklist de URLs ativa

---

## 8. Backlog Futuro

- Integrações (Zapier, Slack)
- Workspaces/Teams
- Domínios customizados
- A/B Testing
- Webhooks
- Link Preview Service
- Analytics avançado (funis, cohorts)

---

## 9. Documentação Relacionada

| Documento                                                                       | Descrição                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| [architecture/overview.md](../../docs/architecture/overview.md)                 | Visão geral da arquitetura e Docker Compose   |
| [architecture/database-schema.md](../../docs/architecture/database-schema.md)   | Schemas de banco, índices, particionamento    |
| [architecture/caching-strategy.md](../../docs/architecture/caching-strategy.md) | Cache Redis, stampede protection, invalidação |
| [architecture/security.md](../../docs/architecture/security.md)                 | Rate limiting, CORS, CSRF, LGPD               |
| [api/endpoints.md](../../docs/api/endpoints.md)                                 | Referência completa da API REST               |

---

## Changelog

| Versão | Data       | Alterações                                                                                |
| ------ | ---------- | ----------------------------------------------------------------------------------------- |
| 3.0.0  | 2026-01-06 | **Refatoração:** PRD focado em requisitos. Detalhes técnicos movidos para docs separados. |
| 2.0.0  | 2026-01-06 | Arquitetura self-hosted com Docker, APIs nativas Bun.                                     |
| 1.x    | -          | Versões anteriores.                                                                       |

---

_Este documento define O QUE o sistema deve fazer. Para detalhes de COMO, consulte a documentação de arquitetura._
