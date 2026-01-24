---
applyTo: '**'
---

# Plano de Implementação Modular - urlfy.cc

> 📖 Baseado no PRD v3.0.0 e Documentação de Arquitetura

Este documento descreve o plano de implementação dividido em módulos lógicos para o desenvolvimento do **urlfy.cc**. Cada módulo foca em um aspecto isolado do sistema para facilitar o desenvolvimento, testes e manutenção.

---

## 📦 Módulo 1: Infraestrutura & Core Setup

**Objetivo:** Estabelecer a fundação do projeto, ambiente de desenvolvimento containerizado e conexões com serviços externos.

| Item    | Descrição                                                                                                                             | Requisitos             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **1.1** | **Docker Environment:** Setup do `docker-compose.yml` com serviços essenciais (PostgreSQL 16, Redis 7, SigNoz).                       | PRD 5.1                |
| **1.2** | **Aplicação Base:** Inicialização do Next.js 16+ (App Router) + ElysiaJS rodando sobre runtime Bun.                                   | Arch Overview          |
| **1.3** | **Database Layer:** Configuração do Drizzle ORM, migrações iniciais e conexão Bun SQL.                                                | Arch Overview          |
| **1.4** | **Cache Layer:** Configuração do cliente Redis (Bun Native) com tipos e padrões de chaves definidos.                                  | Caching Strategy       |
| **1.5** | **Observabilidade:** Integração OpenTelemetry com SigNoz, logs estruturados e **alertas** para latência P99, error rate e cache miss. | RNF-09, RNF-10, RNF-11 |
| **1.6** | **GeoIP Setup:** Container `geoipupdate` com MaxMind GeoLite2 e volume compartilhado.                                                 | RF-19                  |
| **1.7** | **Health Endpoints:** Implementação de `/api/health` e `/api/health/ready` com verificação de dependências (DB, Redis).               | PRD 6                  |
| **1.8** | **Backup & DR Strategy:** Configuração de `pg_dump` via cron ou pgBackRest para PostgreSQL (RPO/RTO < 1h). Snapshots Redis opcionais. | PRD 4.5                |

---

## 🔐 Módulo 2: Autenticação & Identidade

**Objetivo:** Gerenciar usuários, sessões e permissões de acesso.

| Item    | Descrição                                                                                                                            | Requisitos   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **2.1** | **Better-Auth Core:** Integração do Better-Auth com plugins (`twoFactor`, `admin`, `apiKey`, `openAPI`).                             | RF-27, RF-30 |
| **2.2** | **OAuth Providers:** Configuração de Email/Password e OAuth (Google, GitHub).                                                        | RF-27        |
| **2.3** | **API Keys:** Sistema de geração e validação de chaves de API para acesso programático.                                              | RF-29        |
| **2.4** | **ACL/Roles:** Implementação do sistema de permissões (Guest vs User vs Admin) com enforcement de 2FA obrigatório para role `admin`. | RF-28        |
| **2.5** | **User Data:** Schemas de usuário e integração de quota de links (`linksQuota`).                                                     | DB Schema    |
| **2.6** | **Session Management:** Configuração de cookies seguros (SameSite=Strict, HttpOnly, Secure).                                         | Security     |

---

## 🔗 Módulo 3: Gestão de Links (Core Domain)

**Objetivo:** Lógica de negócio principal para criação e gerenciamento de URLs encurtadas.

| Item     | Descrição                                                                                                                                                                | Requisitos                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| **3.1**  | **CRUD de Links:** Endpoints para criar, listar, editar, remover (soft delete) e **duplicar** links.                                                                     | RF-22 a RF-26                     |
| **3.2**  | **Short Code Engine:** Gerador de NanoID (7 chars, charset 0-9a-zA-Z) com validação de colisão/unicidade.                                                                | RF-01                             |
| **3.3**  | **Slugs Reservados:** Tabela `reserved_slugs` com blacklist de rotas do sistema (api, admin, dashboard, etc).                                                            | RF-03                             |
| **3.4**  | **Validações de URL:** Verificador de formato, protocolo (http/https), blacklist de domínios maliciosos e **bloqueio de outros encurtadores** (bit.ly, tinyurl, etc).    | RF-04, RF-05, RF-06               |
| **3.5**  | **Features Premium:** Alias customizado, Expiração (`expiresAt`), Limite de cliques (`maxClicks`), Senha (`passwordHash`) e **tipo de redirect configurável (301/302)**. | RF-02, RF-07, RF-08, RF-09, RF-16 |
| **3.6**  | **Meta Tags OG:** Campos customizáveis (`metaTitle`, `metaDescription`, `metaImage`) com **sanitização via DOMPurify**.                                                  | RF-11, Security                   |
| **3.7**  | **QR Code:** Geração e cache de QR Codes (PNG/SVG) com tamanhos configuráveis (100-1000px).                                                                              | RF-10                             |
| **3.8**  | **UTM Tracking:** Suporte a parâmetros `utm_source`, `utm_medium`, `utm_campaign`.                                                                                       | RF-25                             |
| **3.9**  | **Idempotency Keys:** Suporte a header `Idempotency-Key` para operações POST seguras com cache Redis (TTL 24h).                                                          | Caching Strategy                  |
| **3.10** | **Tags & Notes:** Campos `tags` (array) e `notes` (texto) para organização pessoal de links pelos usuários.                                                              | DB Schema                         |
| **3.11** | **Padrão Elysia MVC:** Organização feature-based com Controller (instância Elysia) + Service (`abstract class` estático) + Model (`t.Object()` TypeBox).                 | Elysia Best Practice              |

---

## 🚀 Módulo 4: Redirect Engine (Hot Path)

**Objetivo:** O componente de alta performance responsável pelo redirecionamento (Middleware).

| Item    | Descrição                                                                                                                                                                              | Requisitos     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **4.1** | **Edge Middleware:** Lógica de interceptação de rotas no Next.js middleware (`middleware.ts`).                                                                                         | Arch Overview  |
| **4.2** | **Caching Strategy:** Implementação do padrão _Cache-Aside_ com Redis (Layer 1) e Fallback para DB (Layer 2). Inclui **cache negativo** (`link:404:{code}`) para códigos inexistentes. | RF-12, Caching |
| **4.3** | **Stampede Protection:** Proteção contra _Cache Stampede_ usando Distributed Locks (Redis SETNX) e Probabilistic Early Expiration.                                                     | Caching        |
| **4.4** | **Validação Rápida:** Checagem de `isActive`, `isBanned`, `expiresAt`, `maxClicks` e senha (via cookie JWT) antes do redirect.                                                         | RF-13          |
| **4.5** | **Redirect Depth Control:** Header `X-Redirect-Depth` com limite máximo de 3 para prevenir loops. Retorna `421 Misdirected Request` se excedido.                                       | RF-14          |
| **4.6** | **Async Handoff:** Disparo de eventos de clique para BullMQ sem bloquear a resposta HTTP.                                                                                              | RF-15          |
| **4.7** | **Graceful Degradation:** Fallback direto para PostgreSQL quando Redis está indisponível, com alerta para SigNoz.                                                                      | RNF-08         |
| **4.8** | **Circuit Breaker:** Implementação com `opossum` ou `cockatiel` para PostgreSQL e Redis (threshold: 50% falhas em 10s, reset: 30s).                                                    | RNF-06         |

---

## 📊 Módulo 5: Analytics & Processamento de Dados

**Objetivo:** Processamento assíncrono de eventos e agregação de métricas.

| Item    | Descrição                                                                                                                                               | Requisitos   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **5.1** | **Queue System:** Setup do BullMQ com configuração de **Dead Letter Queue** (`analytics:dead`) para eventos falhos (retry: 3x com backoff 1s, 5s, 30s). | RNF-07       |
| **5.2** | **Ingestão de Eventos:** Worker para processar cliques brutos na tabela particionada `analytics_events`.                                                | RF-17        |
| **5.3** | **Enriquecimento de Dados:** Resolução de GeoIP offline (MaxMind GeoLite2) e User-Agent parser para browser, OS e device type.                          | RF-19, RF-17 |
| **5.4** | **Privacidade (LGPD):** Hash SHA-256 do IP com salt rotativo semanal (`{year}-W{week}`). IP nunca armazenado em texto.                                  | RF-18        |
| **5.5** | **Bot Detection:** Flag `is_bot` baseada em User-Agent patterns para filtrar métricas.                                                                  | DB Schema    |
| **5.6** | **Agregação Diária:** Jobs agendados para consolidar dados na tabela `link_clicks_daily` (cliques e visitantes únicos).                                 | RF-21        |
| **5.7** | **Data Retention:** Job de cleanup para manter dados brutos por **90 dias**, mantendo apenas agregados após esse período.                               | RF-20        |
| **5.8** | **Particionamento:** Criação automática de partições mensais para `analytics_events`.                                                                   | DB Schema    |

---

## 🛡️ Módulo 6: Segurança & Compliance

**Objetivo:** Proteção contra abusos e conformidade legal.

| Item     | Descrição                                                                                                                                                                        | Requisitos       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **6.1**  | **Rate Limiting por IP/Token:** Algoritmo _Sliding Window_ no Redis com implementação manual (Sorted Sets nativos do Redis via Bun.redis). Limites conforme tabela de endpoints. | RNF-01, Security |
| **6.2**  | **Rate Limiting por Link:** Limite de 5.000 cliques/min por link para detectar abuse coordenado em links virais.                                                                 | Security         |
| **6.3**  | **Security Headers:** CSP, HSTS (preload), X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, Permissions-Policy.                                                  | RNF-02           |
| **6.4**  | **CORS:** Configuração restrita a domínios permitidos (`urlfy.cc`, `www.urlfy.cc`).                                                                                              | RNF-03           |
| **6.5**  | **CSRF Protection:** Cookies com `SameSite=Strict` e proteção automática via Better-Auth.                                                                                        | RNF-04           |
| **6.6**  | **Input Sanitization:** Sanitização de meta tags OG com DOMPurify e validação de URLs de imagem (whitelist de CDNs ou proxy próprio).                                            | RNF-05, Security |
| **6.7**  | **Anti-Abuse:** Detecção de anomalias (>50 falhas login/IP em 5min) e bloqueio automático.                                                                                       | Security         |
| **6.8**  | **GDPR/LGPD Endpoints:** `GET /api/me/export` para exportação de dados e `DELETE /api/me/data` para exclusão (72h deadline).                                                     | RF-35 a RF-38    |
| **6.9**  | **Consent Banner:** Banner de consentimento para analytics no frontend.                                                                                                          | RF-35            |
| **6.10** | **Audit Logs:** Tabela `audit_logs` para registrar ações administrativas (ban, unban, role change).                                                                              | RF-34            |

---

## 🖥️ Módulo 7: Interfaces de Usuário (Client)

**Objetivo:** Interfaces visuais para interação com o sistema.

| Item    | Descrição                                                                                                                                | Requisitos      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **7.1** | **Landing Page:** Interface pública otimizada para conversão (criação rápida de links sem cadastro).                                     | Persona 2.1     |
| **7.2** | **Dashboard do Usuário:** Listagem paginada de links, gráficos de analytics (cliques/dia, top países, device breakdown) e configurações. | RF-21, RF-22    |
| **7.3** | **Página de Unlock:** Tela intermediária para links protegidos por senha com formulário de verificação.                                  | RF-09, Security |
| **7.4** | **Página de Preview:** Preview de metadados do link antes do redirect (OG tags).                                                         | API Endpoints   |
| **7.5** | **Admin Dashboard:** KPIs globais (total links, cliques, usuários), busca de links, ações de ban/unban e gestão de usuários.             | RF-31 a RF-34   |
| **7.6** | **Componentes UI:** Design system com TailwindCSS + Shadcn/UI (acessível, responsivo).                                                   | Arch Overview   |
| **7.7** | **Temas:** Suporte a dark mode.                                                                                                          | -               |

---

## 📋 Matriz de Rastreabilidade

| Requisito PRD    | Módulo(s) | Status |
| ---------------- | --------- | ------ |
| RF-01 a RF-11    | 3         | ✅     |
| RF-12 a RF-16    | 4         | ✅     |
| RF-17 a RF-21    | 5         | ✅     |
| RF-22 a RF-26    | 3         | ✅     |
| RF-27 a RF-30    | 2         | ✅     |
| RF-31 a RF-34    | 7         | ✅     |
| RF-35 a RF-38    | 6         | ✅     |
| RNF-01 a RNF-05  | 6         | ✅     |
| RNF-06 a RNF-08  | 4, 5      | ✅     |
| RNF-09, RNF-10   | 1         | ✅     |
| RNF-11 (Alertas) | 1, 5      | ✅     |
| Backup & DR      | 1         | ✅     |

---

## 🚧 Ordem de Implementação Sugerida

```
Módulo 1 (Infra) ──► Módulo 2 (Auth) ──► Módulo 3 (Links)
                                              │
                    ┌─────────────────────────┘
                    ▼
              Módulo 4 (Redirect) ──► Módulo 5 (Analytics)
                                              │
                    ┌─────────────────────────┘
                    ▼
              Módulo 6 (Security) ──► Módulo 7 (UI)
```

**Dependências críticas:**

- Módulo 4 depende de 1, 2, 3
- Módulo 5 depende de 1, 4
- Módulo 7 depende de todos os anteriores

---

## 📐 Padrões Elysia (Referência Rápida)

> 📖 **Documentação oficial:** [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice)

### Controller Pattern

```typescript
// ✅ Correto: 1 Elysia instance = 1 Controller
const linksController = new Elysia({ prefix: '/links' })
  .use(linksModels) // Injeção de models
  .get(
    '/',
    async ({ query }) => {
      /* handler */
    },
    { query: ListQuery }
  )
  .post(
    '/',
    async ({ body, user }) => {
      /* handler */
    },
    { body: CreateBody }
  );

// ❌ Incorreto: Classe controller com Context
abstract class Controller {
  static root(context: Context) {
    /* NÃO FAZER */
  }
}
```

### Service Pattern

```typescript
// ✅ Non-request dependent: abstract class + static
abstract class LinkService {
  static async create(input: CreateLinkInput): Promise<Link> {
    // Lógica de negócio pura, sem HTTP
  }
}

// ✅ Request dependent: Elysia plugin com macro
const AuthService = new Elysia({ name: 'Auth.Service' }).macro({
  isSignedIn: {
    resolve: ({ cookie }) => {
      /* ... */
    }
  }
});
```

### Model Pattern (Single Source of Truth)

```typescript
// ✅ Correto: TypeBox com tipo inferido
const LinkCreateBody = t.Object({
  url: t.String({ maxLength: 2048 }),
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 }))
});
type LinkCreateBodyType = typeof LinkCreateBody.static;

// ✅ Agrupar por domínio
export const LinksModel = {
  create: LinkCreateBody,
  update: LinkUpdateBody,
  response: LinkResponse
};

// ❌ Incorreto: Interface separada
interface LinkCreateBody {
  url: string;
} // NÃO FAZER
```

### Model Injection (OpenAPI + Type Cache)

```typescript
// Registrar models para melhor performance e OpenAPI
const linksModels = new Elysia().model({
  'links.create': LinkCreateBody,
  'links.update': LinkUpdateBody
});

const controller = new Elysia()
  .use(linksModels)
  .post('/', handler, { body: 'links.create' }); // Referência por nome
```

### Testes com handle()

```typescript
import { describe, it, expect } from 'bun:test';

describe('Links Controller', () => {
  it('should create link', async () => {
    const response = await linksController
      .handle(
        new Request('http://localhost/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com' })
        })
      )
      .then((r) => r.json());

    expect(response.success).toBe(true);
  });
});
```
