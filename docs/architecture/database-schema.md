# Database Schema - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [← Overview](./overview.md) | [Caching →](./caching-strategy.md)

**Navegação:** [Overview](./overview.md) · [Database](#) · [Caching](./caching-strategy.md) · [Security](./security.md) · [API](../api/endpoints.md)

---

## Visão Geral

O banco de dados PostgreSQL 16+ é acessado via **Bun SQL** (`import { sql } from 'bun'`) com **Drizzle ORM** para type-safety.

## Tabelas Better-Auth (Gerenciadas pelo CLI)

> ⚠️ **Geradas automaticamente:** `bun x @better-auth/cli generate`

| Tabela          | Plugin      | Descrição                                |
| --------------- | ----------- | ---------------------------------------- |
| `users`         | Core        | Usuários + campos dos plugins            |
| `sessions`      | Core        | Sessões ativas                           |
| `accounts`      | Core        | Contas OAuth (Google, GitHub)            |
| `verifications` | Core        | Tokens de email/reset                    |
| `twoFactors`    | `twoFactor` | Secrets TOTP e backup codes              |
| `apikeys`       | `apiKey`    | API Keys com rate limiting e permissions |

**Campo customizado em `users`:** `linksQuota` (INTEGER) - Limite de links por plano.

---

## Tabela: `links`

Tabela principal para armazenamento de links encurtados.

| Campo                | Tipo          | Descrição                                               |
| -------------------- | ------------- | ------------------------------------------------------- |
| `id`                 | UUID          | Chave primária                                          |
| `user_id`            | UUID          | FK para users (nullable para guests)                    |
| `original_url`       | TEXT          | URL de destino (max: 2048 caracteres)                   |
| `short_code`         | VARCHAR(20)   | Código curto (unique index)                             |
| `redirect_type`      | SMALLINT      | Tipo de redirect: 301 (permanente) ou 302 (temporário)  |
| `clicks_count`       | INTEGER       | Contador denormalizado (default: 0)                     |
| `max_clicks`         | INTEGER       | Limite de cliques (nullable)                            |
| `password_hash`      | VARCHAR(255)  | Senha do link (**bcrypt**, nullable)                    |
| `is_active`          | BOOLEAN       | Status ativo/inativo (default: true)                    |
| `is_banned`          | BOOLEAN       | Link bloqueado por admin (default: false)               |
| `banned_at`          | TIMESTAMP     | Data do banimento (nullable)                            |
| `banned_reason`      | VARCHAR(255)  | Motivo do ban (nullable)                                |
| `expires_at`         | TIMESTAMP     | Data de expiração (nullable)                            |
| `meta_title`         | VARCHAR(255)  | OG title customizado (max: 60 chars recomendado)        |
| `meta_description`   | TEXT          | OG description customizado (max: 160 chars recomendado) |
| `meta_image`         | VARCHAR(500)  | OG image URL                                            |
| `utm_source`         | VARCHAR(100)  | UTM tracking                                            |
| `utm_medium`         | VARCHAR(100)  | UTM tracking                                            |
| `utm_campaign`       | VARCHAR(100)  | UTM tracking                                            |
| `last_clicked_at`    | TIMESTAMP     | Último clique                                           |
| `qr_generated_at`    | TIMESTAMP     | Última geração de QR                                    |
| `created_by_ip_hash` | VARCHAR(64)   | Hash do IP do criador                                   |
| `tags`               | VARCHAR(50)[] | Array de tags para organização (nullable)               |
| `notes`              | TEXT          | Notas privadas do usuário (nullable)                    |
| `created_at`         | TIMESTAMP     | Data de criação                                         |
| `updated_at`         | TIMESTAMP     | Última atualização                                      |
| `deleted_at`         | TIMESTAMP     | Soft delete (nullable)                                  |

### Índices

```sql
-- Lookup principal (mais importante)
CREATE UNIQUE INDEX idx_links_short_code ON links(short_code);

-- Listagem de links do usuário (excluindo deletados)
CREATE INDEX idx_links_user_active ON links(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Ordenação por data
CREATE INDEX idx_links_created_at ON links(created_at);

-- Validação no redirect
CREATE INDEX idx_links_validation ON links(is_active, is_banned, expires_at);

-- Job de cleanup de links expirados
CREATE INDEX idx_links_expires ON links(expires_at)
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Busca por tags (GIN para array)
CREATE INDEX idx_links_tags ON links USING GIN(tags);
```

### Notas de Implementação

- `clicks_count` deve usar incremento atômico:
  ```sql
  UPDATE links SET clicks_count = clicks_count + 1 WHERE id = $1
  ```

---

## Tabela: `analytics_events` (Particionada)

Eventos de clique com particionamento mensal para escalabilidade.

| Campo          | Tipo         | Descrição                                  |
| -------------- | ------------ | ------------------------------------------ |
| `id`           | UUID         | Chave primária                             |
| `link_id`      | UUID         | FK para links                              |
| `visitor_hash` | VARCHAR(64)  | Hash SHA-256 do IP + salt (LGPD compliant) |
| `country`      | VARCHAR(2)   | Código ISO do país                         |
| `city`         | VARCHAR(100) | Cidade                                     |
| `browser`      | VARCHAR(50)  | Navegador                                  |
| `os`           | VARCHAR(50)  | Sistema operacional                        |
| `device_type`  | ENUM         | `desktop` / `mobile` / `tablet`            |
| `referrer`     | TEXT         | URL de origem (domínio apenas)             |
| `utm_source`   | VARCHAR(100) | UTM source capturado                       |
| `utm_medium`   | VARCHAR(100) | UTM medium capturado                       |
| `utm_campaign` | VARCHAR(100) | UTM campaign capturado                     |
| `is_bot`       | BOOLEAN      | Flag para filtrar bots (default: false)    |
| `created_at`   | TIMESTAMP    | Timestamp do clique (partition key)        |

### Índices

```sql
-- Queries de analytics por período
CREATE INDEX idx_analytics_link_date ON analytics_events(link_id, created_at);

-- Particionamento e cleanup
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
```

### Particionamento

```sql
-- Particionamento por range mensal
CREATE TABLE analytics_events (
  ...
) PARTITION BY RANGE (created_at);

-- Exemplo de partição
CREATE TABLE analytics_events_2026_01
  PARTITION OF analytics_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Salt Rotation (LGPD/GDPR)

O salt usado no `visitor_hash` é rotacionado **semanalmente**:

```typescript
// Opção 1: Salt semanal (recomendado para analytics)
const salt = `${year}-W${weekNumber}`;

// Opção 2: Salt por link (melhor precisão por link)
const salt = link.id;
```

---

## Tabela: `link_clicks_daily` (Agregação)

Agregação diária para dashboard de analytics.

| Campo             | Tipo    | Descrição         |
| ----------------- | ------- | ----------------- |
| `link_id`         | UUID    | FK para links     |
| `date`            | DATE    | Data              |
| `clicks`          | INTEGER | Total de cliques  |
| `unique_visitors` | INTEGER | Visitantes únicos |

**Primary Key:** `(link_id, date)`

---

## Tabela: `reserved_slugs`

Blacklist de slugs reservados.

| Campo    | Tipo         | Descrição           |
| -------- | ------------ | ------------------- |
| `slug`   | VARCHAR(50)  | Slug reservado (PK) |
| `reason` | VARCHAR(255) | Motivo da reserva   |

### Slugs Reservados Iniciais

```sql
INSERT INTO reserved_slugs (slug, reason) VALUES
  -- Rotas do sistema
  ('api', 'system_route'),
  ('auth', 'system_route'),
  ('dashboard', 'system_route'),
  ('admin', 'system_route'),
  ('login', 'system_route'),
  ('signup', 'system_route'),
  ('logout', 'system_route'),
  ('settings', 'system_route'),
  ('health', 'system_route'),
  ('metrics', 'system_route'),
  -- SEO/Browser
  ('favicon.ico', 'browser'),
  ('robots.txt', 'seo'),
  ('sitemap.xml', 'seo'),
  ('.well-known', 'browser'),
  -- Legal
  ('terms', 'legal'),
  ('privacy', 'legal'),
  ('cookies', 'legal'),
  ('tos', 'legal'),
  -- Outros
  ('docs', 'reserved'),
  ('help', 'reserved'),
  ('support', 'reserved'),
  ('status', 'reserved'),
  ('about', 'reserved'),
  ('pricing', 'reserved'),
  ('blog', 'reserved');
```

---

## Tabela: `banned_urls`

URLs e domínios bloqueados.

| Campo         | Tipo         | Descrição                         |
| ------------- | ------------ | --------------------------------- |
| `id`          | UUID         | Chave primária                    |
| `url_pattern` | TEXT         | URL ou padrão a bloquear          |
| `match_type`  | ENUM         | `exact` / `domain` / `prefix`     |
| `reason`      | VARCHAR(255) | Motivo do bloqueio                |
| `source`      | VARCHAR(50)  | Origem (manual, report, imported) |
| `created_by`  | UUID         | FK para users (admin)             |
| `created_at`  | TIMESTAMP    | Data de criação                   |

> ⚠️ **Segurança:** Regex removido do `match_type` para evitar ReDoS attacks.

---

## Tabela: `audit_logs`

Logs de ações administrativas.

| Campo         | Tipo        | Descrição                         |
| ------------- | ----------- | --------------------------------- |
| `id`          | UUID        | Chave primária                    |
| `user_id`     | UUID        | FK para users (quem executou)     |
| `action`      | VARCHAR(50) | Ação (ban_link, delete_user, etc) |
| `entity_type` | VARCHAR(50) | Tipo (link, user)                 |
| `entity_id`   | UUID        | ID da entidade afetada            |
| `metadata`    | JSONB       | Dados adicionais                  |
| `ip_address`  | VARCHAR(45) | IP do admin                       |
| `created_at`  | TIMESTAMP   | Data da ação                      |

---

## Tabela: `data_deletion_requests` (LGPD/GDPR)

Solicitações de exclusão de dados.

| Campo            | Tipo      | Descrição                                         |
| ---------------- | --------- | ------------------------------------------------- |
| `id`             | UUID      | Chave primária                                    |
| `user_id`        | UUID      | FK para users                                     |
| `status`         | ENUM      | `pending` / `processing` / `completed` / `failed` |
| `requested_at`   | TIMESTAMP | Data da solicitação                               |
| `deadline_at`    | TIMESTAMP | Prazo legal (72h após solicitação)                |
| `completed_at`   | TIMESTAMP | Data de conclusão (nullable)                      |
| `failure_reason` | TEXT      | Motivo da falha (nullable)                        |
| `processed_by`   | UUID      | FK para users (admin, nullable)                   |
| `data_exported`  | BOOLEAN   | Se os dados foram exportados                      |

### Índices

```sql
-- Jobs pendentes
CREATE INDEX idx_deletion_pending ON data_deletion_requests(status, deadline_at);
```

---

## Estratégia de Escalabilidade

### Analytics Events

1. **Particionamento mensal** em `created_at`
2. **Agregação diária** via job BullMQ → `link_clicks_daily`
3. **TTL de dados brutos:** 90 dias
4. **Cleanup automático:** Job mensal dropa partições antigas

### Jobs BullMQ

| Job                  | Frequência         | Descrição                                   |
| -------------------- | ------------------ | ------------------------------------------- |
| `aggregate-daily`    | 1x/dia (02:00 UTC) | Sumariza eventos em `link_clicks_daily`     |
| `cleanup-partitions` | 1x/mês             | Dropa partições > 90 dias                   |
| `hard-delete-links`  | 1x/mês             | Remove links com `deleted_at` > 30 dias     |
| `process-deletions`  | 1x/hora            | Processa `data_deletion_requests` pendentes |
