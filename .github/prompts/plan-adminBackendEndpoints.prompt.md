# Plano de Implementação Técnica: Admin Backend Endpoints

> **Objetivo:** Implementar o módulo administrativo completo seguindo a arquitetura Feature-Based MVC do projeto, com foco em type-safety absoluta (Elysia + TypeBox + Drizzle) e separação clara de responsabilidades.

---

## 🏗️ Arquitetura do Módulo

O módulo `admin` será isolado em `src/server/modules/admin/` e exposto na API v1.

**Estrutura de Arquivos:**

```text
src/server/modules/admin/
├── admin.schema.ts      # Contratos de dados (SSOT)
├── admin.service.ts     # Lógica de negócio e acesso ao banco
├── admin.controller.ts  # Definição de rotas e middleware
└── index.ts             # Exports do módulo
```

---

## 🛠️ Passo 1: Schemas e Tipagem (Single Source of Truth)

**Arquivo:** `src/server/modules/admin/admin.schema.ts`

Definir todos os DTOs usando `TypeBox`. Isso garante validação em tempo de execução e inferência de tipos estáticos para o TypeScript.

### Definições Necessárias

1.  **Stats Schemas**
    - `AdminStatsResponse`: Objeto contendo KPIs (totalUsers, totalLinks, activeLinks, totalClicks).

2.  **User Management Schemas**
    - `AdminUserListQuery`: Paginação (`page`, `limit`), busca (`search`) e filtros (`role`, `isBanned`).
    - `AdminUserListResponse`: Array paginado de usuários (sanitize sensitive data).
    - `AdminUserUpdateBody`: Campos editáveis (`role`, `isBanned`, `banReason`).

3.  **Link Management Schemas**
    - `AdminLinkBanBody`: Motivo do banimento (`bannedReason`).

**Boas Práticas:**

- Usar `t.Object()`, `t.String()`, `t.Optional()` do Elysia.
- Exportar os tipos estáticos: `export type AdminStats = Static<typeof AdminStatsResponse>`.

---

## 🧠 Passo 2: Service Layer (Lógica de Negócio)

**Arquivo:** `src/server/modules/admin/admin.service.ts`

Implementar uma classe abstrata `AdminService` que contém apenas métodos estáticos. O Service **não deve** saber sobre HTTP (Request/Response), apenas sobre dados.

### Métodos Obrigatórios

1.  **`getGlobalStats()`**
    - Executar queries `count()` paralelas no Drizzle (`users`, `links`, `analytics_events`).
    - Retornar objeto formatado conforme `AdminStatsResponse`.

2.  **`listUsers(query: AdminUserListQuery)`**
    - Query dinâmica no Drizzle com filtros opcionais.
    - Implementar paginação (offset/limit).

3.  **`updateUserStatus(userId: string, data: AdminUserUpdateBody, adminId: string)`**
    - **Transação Atômica:**
      1.  Atualizar tabela `users`.
      2.  Inserir registro na tabela `audit_logs` (Ação: `UPDATE_USER`).
    - Validar se o admin não está se banindo a si mesmo.

4.  **`banLink(linkId: string, reason: string, adminId: string)`**
    - **Transação Atômica:**
      1.  Atualizar `links` (`is_banned = true`, `banned_at = now()`).
      2.  Inserir `audit_logs` (Ação: `BAN_LINK`).
      3.  Invalidar Cache do Redis para o link.

---

## 🎮 Passo 3: Controller Layer (Rotas e Segurança)

**Arquivo:** `src/server/modules/admin/admin.controller.ts`

Controlador Elysia que orquestra os chamados.

### Requisitos Técnicos

1.  **Middleware de Segurança (`requireAdmin`)**
    - Criar ou reutilizar middleware que verifica `ctx.user.role === 'admin'`.
    - Retornar `403 Forbidden` se falhar.

2.  **Injeção de Models**
    - Usar `.model()` para registrar os schemas do Passo 1. Isso habilita o intellisense no cliente (Eden Treaty) e gera o Swagger correto.

3.  **Endpoints**
    - `GET /stats`: Chama `AdminService.getGlobalStats`.
    - `GET /users`: Chama `AdminService.listUsers`.
    - `PATCH /users/:id`: Chama `AdminService.updateUserStatus`.
    - `PATCH /links/:id/ban`: Chama `AdminService.banLink`.
    - `PATCH /links/:id/unban`: Lógica inversa de ban.

**Exemplo de Estrutura:**

```typescript
export const adminController = new Elysia({ prefix: '/admin' })
  .use(requireAdmin)
  .use(AdminModels)
  .get('/stats', () => AdminService.getGlobalStats(), {
    response: 'admin.stats'
  });
// ...
```

---

## 🔌 Passo 4: Integração na API Global

**Arquivo:** `src/server/api/index.ts`

- Importar `adminController`.
- Montar o controlador na rota ``.
- **Importante:** Remover quaisquer rotas de admin legadas/stubs que estejam poluindo o arquivo principal.

---

## 📡 Passo 5: Atualização do Cliente (Type-Safe)

**Arquivo:** `src/lib/api-client.ts`

Atualizar o cliente frontend para usar os novos endpoints reais.

1.  Remover funções "stub" (`getAdminStats` com dados mockados).
2.  Implementar funções que chamam `client.api.v1.admin...`.
3.  Assegurar que os tipos de retorno batem com os definidos n backend (graças ao Eden Treaty isso deve ser automático, mas precisa verificar a exportação no `src/server/api/index.ts`).

---

## ✅ Checklist de Qualidade

- [ ] **Type Safety:** Sem uso de `any`. Todos os inputs validados via TypeBox.
- [ ] **Segurança:** Todos os endpoints protegidos por verificação de role.
- [ ] **Auditabilidade:** Ações de escrita (ban, update) geram logs de auditoria.
- [ ] **Performance:** Queries de listagem possuem paginação obrigatória.
- [ ] **Cache:** Banimento de link deve invalidar cache imediatamente.
