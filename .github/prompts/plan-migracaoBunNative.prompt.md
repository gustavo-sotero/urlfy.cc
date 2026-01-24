# Plano de Implementação: Migração para Event-Driven com Bun Native & Redis Streams

> **Objetivo:** Substituir `ioredis`/`bullmq` pela API nativa `Bun.redis` e Redis Streams, removendo dependências pesadas, otimizando performance e mantendo a DX.

---

## 🏗️ 1. Camada de Infraestrutura (Redis Native)

### 1.1. Refatorar `src/server/lib/redis.ts`

Substituir a implementação baseada em `ioredis` pelo cliente nativo do Bun.

**Requisitos Técnicos:**

- Remover import `ioredis`.
- Usar `import { redis } from 'bun'`.
- Manter o Singleton se necessário, ou exportar a instância direta do Bun.

```typescript
// src/server/lib/redis.ts
import { Redis } from 'bun';

// O Bun gerencia a conexão automaticamente via var de ambiente
export const redis = new Redis({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
  // ... outras configs de retry/timeout nativas
});
```

### 1.2. Criar Wrapper de Streams `src/server/lib/redis-stream.ts`

Como o `Bun.redis` não possui métodos tipados para Streams (ex: `xadd`, `xreadgroup`), criar uma classe utilitária para abstrair o comando bruto `.send()`.

**Funcionalidades:**

- **`add(stream, payload)`**: Serializar payload (flattened key-value ou JSON) e executar `XADD`.
- **`createGroup(stream, group)`**: Executar `XGROUP CREATE ... MKSTREAM`. Ignorar erro `BUSYGROUP`.
- **`readGroup(group, consumer, streams, count, block)`**: Executar `XREADGROUP`.
- **`ack(stream, group, ids)`**: Executar `XACK`.
- **`autoClaim(...)`**: Executar `XAUTOCLAIM` para recuperação de mensagens (GC).
- **`info(stream)`**: Executar `XINFO STREAM` e `XINFO GROUPS`.

**Crítico:** Implementar **Parsers Tipados** para as respostas do Redis RESP3 (arrays aninhados), evitando "magic indexes" no código de negócio.

---

## ⚙️ 2. Core Engine de Consumo

### 2.1. Criar Classe Abstrata `src/server/lib/worker-base.ts`

Uma classe base robusta para padronizar todos os consumers do sistema.

**Estrutura da Classe:**

- `abstract processMessage(id: string, payload: T): Promise<void>`
- `run()`: Loop infinito principal.
  - `try/catch` robusto.
  - `XREADGROUP` com block (ex: 5000ms).
  - Chamada para `processMessage`.
  - `XACK` automático após sucesso.
- `runGarbageCollector()`: Loop secundário (ex: a cada 60s).
  - `XAUTOCLAIM` para pegar mensagens presas na PEL (Pending Entries List) de workers mortos.
- **Graceful Shutdown:** Escutar sinais `SIGTERM`/`SIGINT` para encerrar loops limpamente.

---

## 🔄 3. Implementação do Worker e Producer

### 3.1. Migrar Producer (Middleware/Controller)

No ponto de redirecionamento (onde hoje chama-se `bullmq.add`), usar o novo wrapper.

```typescript
// Exemplo conceitual
await StreamService.add('analytics:clicks', {
  linkId: link.id,
  ip: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent')
  // ...
});
```

- **Requisito:** Deve ser "Fire-and-Forget". Não aguardar a confirmação de escrita bloquear a request HTTP se o Redis estiver lento (embora `Bun.redis` seja extremamente rápido).

### 3.2. Implementar `src/server/workers/analytics.worker.ts`

Implementação concreta da classe `WorkerBase`.

- **Stream:** `analytics:clicks`
- **Group:** `analytics-group`
- **Lógica:**
  1. Parse do payload.
  2. Enriquecimento de dados (GeoIP).
  3. Batch insert no Banco de Dados (Drizzle).
  - _Dica:_ Considere implementar um buffer interno no worker para fazer inserts em batch no DB se o throughput for muito alto, em vez de 1 insert por mensagem.

### 3.3. Entrypoint de Workers `src/workers.ts`

Arquivo único para iniciar todos os workers (analytics, emails, etc) em paralelo.

```typescript
import { AnalyticsWorker } from './server/workers/analytics.worker';

const analytics = new AnalyticsWorker();

console.log('🚀 Starting Workers...');
analytics.run();
// analytics.runGarbageCollector(); // Iniciar em paralelo
```

---

## 🛠️ 4. Developer Experience (DX)

### 4.1. Scripts `package.json`

Permitir rodar tudo com um comando.

1.  Instalar `concurrently` (dev deps).
2.  Criar script `worker:dev`: `bun run --watch src/workers.ts`
3.  Atualizar script `dev`:
    ```json
    "dev": "concurrently \"bun run --bun next dev\" \"bun run worker:dev\" --names \"APP,WKR\" -c \"blue,magenta\"",
    ```

---

## 📊 5. Observabilidade & Admin UI

### 5.1. Endpoint de Introspecção (`src/server/modules/admin/queues.controller.ts`)

Criar endpoint para o painel de controle monitorar a saúde das filas sem o BullMQ Dashboard.

- `GET /api/admin/queues`
- Retornar objeto estruturado:
  ```json
  {
    "analytics:clicks": {
      "length": 150,
      "groups": 1,
      "consumers": 2,
      "pending": 0, // Lag
      "lastGeneratedId": "..."
    }
  }
  ```

### 5.2. Página Admin (`src/app/(admin)/admin/queues/page.tsx`)

Criar interface simples usando componentes do Shadcn/UI (Cards/Tables) para exibir essas métricas.

- Auto-refresh a cada 5s ou botão de reload manual.

---

## 🧹 6. Limpeza e Migração

### 6.1. Remoção de Dependências

- `bun remove bullmq ioredis`
- Remover arquivos de config antigos (`src/server/config/queue.ts`, etc).
- Procurar globalmente por imports de `bullmq` e remover.

### 6.2. Documentação

- Atualizar `docs/architecture/overview.md` (Remover BullMQ).
- Atualizar `docs/architecture/caching-strategy.md` (Oficializar `Bun.redis`).
- Atualizar `docs/modules/module-05-analytics.md` (Documentar padrão Streams).

---

## ⚠️ Checklist de Boas Práticas

- [ ] **Type Safety:** Garantir que o parser de `redis.send` retorne tipos estritos, não `any`.
- [ ] **Error Handling:** O worker **nunca** deve crashar por erro de processamento de uma mensagem única. Catch, Log e (opcionalmente) Dead Letter Queue (mover para stream `:dlq`).
- [ ] **Idempotência:** Garantir que processar a mesma mensagem duas vezes (em caso de falha de ACK) não duplique estatísticas críticas.
- [ ] **Conexões:** Garantir que o `workers.ts` feche as conexões com DB e Redis ao receber `SIGTERM` (Docker stop).
