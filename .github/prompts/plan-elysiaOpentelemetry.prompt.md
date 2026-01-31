# Plan: Implementação do @elysiajs/opentelemetry

## Objetivo

Integrar o plugin oficial `@elysiajs/opentelemetry` ao router Elysia para obter **observabilidade granular** do ciclo de vida de requisições (parsing, validação, handlers, transforms), complementando a instrumentação global Node.js já configurada em `src/server/lib/telemetry.ts`.

---

## Contexto Técnico

### Estado Atual

- **SDK Global:** `@opentelemetry/sdk-node` inicializado em `src/server/lib/telemetry.ts` via `initTelemetry()`.
- **Exportadores:** OTLP HTTP para traces, métricas e logs enviados ao SigNoz.
- **Auto-Instrumentação:** `@opentelemetry/auto-instrumentations-node` captura HTTP, pg, ioredis, etc.
- **Limitação:** O Elysia é uma "caixa preta" - spans mostram apenas `POST /api/links` sem detalhamento interno.

### Benefícios do Plugin

| Aspecto       | Antes                   | Depois                                                                   |
| ------------- | ----------------------- | ------------------------------------------------------------------------ |
| Granularidade | 1 span por requisição   | Spans para `parse`, `beforeHandle`, `handle`, `afterHandle`, `transform` |
| Nomes         | `HTTP POST` genérico    | Nome da função handler (ex: `createLink`)                                |
| Erros         | Stack trace no span pai | Span específico do hook que falhou                                       |
| SSE/Streaming | Não suportado           | Suportado nativamente                                                    |

---

## Steps

### Step 1: Instalar Dependência

**Comando:**

```bash
bun add @elysiajs/opentelemetry
```

**Verificação:** Confirmar adição em `package.json` na seção `dependencies`.

**Tipagem:** O pacote inclui tipos TypeScript nativos (`@elysiajs/opentelemetry/dist/index.d.ts`).

---

### Step 2: Configurar Build do Next.js

**Arquivo:** `next.config.ts`

**Justificativa:** O plugin depende de módulos Node.js nativos que não devem ser bundled pelo webpack do Next.js. Sem essa configuração, erros de runtime ocorrerão em produção.

**Alterações:**

1. Adicionar `@elysiajs/opentelemetry` ao array `serverExternalPackages`.
2. Incluir o pacote em `outputFileTracingIncludes` para garantir que os arquivos sejam copiados no build standalone.

**Código Esperado:**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/sdk-node',
    '@elysiajs/opentelemetry' // ← ADICIONAR
    // ... outros pacotes
  ],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/@opentelemetry/**/*',
      './node_modules/@elysiajs/opentelemetry/**/*' // ← ADICIONAR
      // ... outros includes
    ]
  }
};
```

---

### Step 3: Registrar Plugin no Router Elysia

**Arquivo:** `src/server/index.ts`

**Posição:** O plugin DEVE ser registrado **antes** de todos os outros plugins e controllers para capturar o ciclo de vida completo.

**Código de Integração:**

```typescript
import { opentelemetry } from '@elysiajs/opentelemetry';

export const api = new Elysia({ prefix: '/api' })
  // ═══════════════════════════════════════════════════════════════════
  // OBSERVABILITY - Deve ser o PRIMEIRO plugin
  // ═══════════════════════════════════════════════════════════════════
  .use(
    opentelemetry({
      // O plugin detecta automaticamente o SDK global inicializado
      // em src/server/lib/telemetry.ts. Não é necessário passar
      // spanProcessors ou exporters aqui.
    })
  )
  // Outros plugins APÓS o opentelemetry
  .use(errorMiddleware)
  .use(corsPlugin);
// ...
```

**Tipagem:** O tipo `ElysiaConfig` do plugin aceita opções opcionais. A configuração vazia `{}` usa defaults que respeitam o SDK global.

---

### Step 4: Nomear Handlers para Melhor Rastreabilidade

**Justificativa:** O plugin usa `Function.name` para nomear spans. Funções anônimas resultam em spans `<anonymous>`, dificultando debugging.

**Padrão Recomendado:**

```typescript
// ❌ EVITAR: Span será nomeado "anonymous"
.get('/', async ({ user }) => {
  return LinkService.list(user!.id);
})

// ✅ PREFERIR: Span será nomeado "listLinks"
.get('/', async function listLinks({ user }) {
  return LinkService.list(user!.id);
})
```

**Arquivos Prioritários para Refatoração:**

- `src/server/modules/links/links.controller.ts`
- `src/server/modules/auth/auth.controller.ts`
- `src/server/modules/analytics/analytics.controller.ts`
- `src/server/modules/admin/*.controller.ts`

**Nota:** Esta refatoração é opcional mas altamente recomendada para controllers críticos (hot paths).

---

### Step 5: Validação e Testes

**5.1. Iniciar Infraestrutura:**

```bash
bun run docker:up:full  # Inclui SigNoz
```

**5.2. Iniciar Aplicação:**

```bash
bun dev
```

**5.3. Gerar Traces:**

```bash
# Health check simples
curl http://localhost:3000/api/health

# Criar link (fluxo completo)
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**5.4. Verificar no SigNoz:**

1. Acessar `http://localhost:3301` (SigNoz UI).
2. Navegar para **Traces** → Filtrar por `service.name = urlfy-api`.
3. Clicar em um trace para visualizar:
   - Span pai: `POST /api/links` (Next.js)
   - Spans filhos: `parse`, `beforeHandle`, `createLink`, `afterHandle`

**Critérios de Sucesso:**

- [ ] Spans do Elysia aparecem aninhados sob o trace do Next.js.
- [ ] Handlers nomeados exibem o nome correto (não `anonymous`).
- [ ] Erros de validação mostram span específico com stack trace.
- [ ] Latência por fase (parse vs handle) é mensurável.

---

## Configurações Avançadas (Opcional)

### Atributos Customizados por Span

Se necessário adicionar metadados específicos do domínio:

```typescript
import { getCurrentSpan, setAttributes } from '@elysiajs/opentelemetry';

// Dentro de um handler
.post('/', async function createLink({ body, user }) {
  setAttributes({
    'urlfy.link.url_domain': new URL(body.url).hostname,
    'urlfy.user.id': user?.id ?? 'anonymous',
  });
  // ...
})
```

### Record Utility para Operações Internas

Envolver chamadas de serviço com spans explícitos:

```typescript
import { record } from '@elysiajs/opentelemetry';

// Dentro de um handler ou service
const link = await record('LinkService.create', async () => {
  return LinkService.create(input, userId);
});
```

---

## Checklist Final

- [ ] Pacote instalado via `bun add @elysiajs/opentelemetry`
- [ ] `next.config.ts` atualizado com `serverExternalPackages` e `outputFileTracingIncludes`
- [ ] Plugin registrado como **primeiro** `.use()` em `src/server/index.ts`
- [ ] Build de produção testado: `bun run build && bun run start`
- [ ] Traces validados no SigNoz com spans filhos do Elysia
- [ ] (Opcional) Handlers críticos renomeados para funções nomeadas

---

## Referências

- [Elysia OpenTelemetry Plugin](https://elysiajs.com/plugins/opentelemetry.html)
- [Elysia OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [Documentação do Projeto - Telemetry](../docs/architecture/overview.md)
