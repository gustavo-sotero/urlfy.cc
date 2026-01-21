# Plano técnico detalhado — OpenAPI com respostas completas e exemplos

## Objetivo

Completar a documentação OpenAPI exibida em /api/docs adicionando schemas de resposta e exemplos reais (success + error) para todas as rotas. O plano deve manter o padrão do projeto: TypeBox como single source of truth, models registrados via `.model()` e respostas padronizadas, garantindo tipagem forte, consistência e manutenção fácil.

## Princípios e boas práticas

- **Single Source of Truth**: Modelos em TypeBox devem ser a única fonte para validação e tipos TS.
- **OpenAPI First by Models**: Documentação deve ser derivada dos models registrados no Elysia via `.model()`.
- **Respostas padronizadas**: Todas as rotas devem retornar envelope `{ success, data|error, requestId }` consistente.
- **Tipagem explícita**: Sempre informar `response` nas rotas com referência a models registrados.
- **Erros centralizados**: Um único model global de erro, com variantes/enum de `error.code`.
- **Exemplos reutilizáveis**: Preferir exemplos nos schemas (TypeBox) em vez de `detail.responses` por rota.
- **Coerência com PRD/Docs**: Respostas compatíveis com docs/api/endpoints.md.

## Escopo

- Módulos Elysia em `src/server/modules/**` (controllers + models).
- Registro global de models em `src/server/api/index.ts`.
- Schemas de resposta em `src/server/lib/response.schema.ts` (ou equivalente).
- Documentação de endpoints em `docs/api/endpoints.md` para alinhamento.

---

## Fase 1 — Descoberta e inventário

### 1.1 Mapear models registrados

- **Objetivo**: listar todos os models registrados via `.model()`.
- **Ações**:
  - Encontrar arquivos de models por domínio (links, auth, users, analytics, admin, etc.).
  - Identificar keys usadas em `.model()` (ex.: `links.response`, `links.create`).
  - Verificar se há um `ResponseModels` global e como ele está estruturado.

### 1.2 Mapear rotas sem `response`

- **Objetivo**: identificar endpoints que não declaram `response`.
- **Ações**:
  - Auditar controllers em `src/server/modules/**/index.ts`.
  - Criar tabela de rotas com: método, path, status code esperado, model de resposta atual (ou ausente).
  - Priorizar rotas públicas e críticas (links, redirect, health).

### 1.3 Mapear respostas de erro

- **Objetivo**: verificar padrão de erro existente.
- **Ações**:
  - Inspecionar o `onError` global no API root.
  - Verificar se há model de erro único (ex.: `ErrorResponse`).
  - Consolidar códigos de erro usados (VALIDATION_ERROR, LINK_NOT_FOUND, etc.).

---

## Fase 2 — Definição dos schemas de resposta

### 2.1 Padronizar envelope de sucesso

- **Objetivo**: garantir um envelope comum com tipagem forte.
- **Estrutura base**:
  - `success: true`
  - `data: T`
  - `requestId: string`
- **Ações**:
  - Criar/confirmar `SuccessResponse<T>` como helper TypeBox.
  - Modelos específicos para cada rota devem usar o envelope.

### 2.2 Padronizar envelope de erro

- **Objetivo**: centralizar todos os erros em um schema.
- **Estrutura base**:
  - `success: false`
  - `error: { code, message, details? }`
  - `requestId: string`
- **Ações**:
  - Criar/confirmar `ErrorResponse` único.
  - `error.code` como enum TypeBox dos códigos documentados.

### 2.3 Definir exemplos em TypeBox

- **Objetivo**: exemplos reais e consistentes no Swagger.
- **Ações**:
  - Para cada response model, adicionar `examples`.
  - Para erros, criar exemplos por código mais comum (404, 410, 401, 429, 500).
  - Garantir coerência com `docs/api/endpoints.md`.

---

## Fase 3 — Aplicar `response` em todas as rotas

### 3.1 Envelopes de sucesso

- **Objetivo**: todas as rotas devem declarar `response`.
- **Ações**:
  - Nas rotas de CRUD, indicar o model correto (`links.create.response`, etc.).
  - Para listas paginadas, usar modelos com `meta`.
  - Para 204 (sem body), definir response vazio ou explicitamente `t.Void()` se suportado.

### 3.2 Respostas de erro por rota

- **Objetivo**: documentar erros prováveis por endpoint.
- **Ações**:
  - Se necessário, adicionar `response` com `t.Object` de múltiplos status codes.
  - Exemplo: `response: { 200: 'links.response', 404: 'error.response' }`.
  - Reutilizar o mesmo schema de erro.

### 3.3 Garantir consistência OpenAPI

- **Objetivo**: evitar rotas com response inferido.
- **Ações**:
  - Auditar rotas com `detail` e alinhar com response schemas.
  - Remover qualquer duplicidade ou conflito.

---

## Fase 4 — QA de documentação

### 4.1 Validação OpenAPI

- **Objetivo**: garantir que o Swagger exibe exemplos.
- **Ações**:
  - Abrir `/api/docs` e validar:
    - Exemplo de sucesso por rota.
    - Exemplo de erro quando aplicável.
    - Schemas completos com propriedades e tipos.

### 4.2 Alinhamento com documentação externa

- **Objetivo**: manter `docs/api/endpoints.md` como referência consistente.
- **Ações**:
  - Ajustar texto se necessário para refletir a implementação real.
  - Garantir que exemplos batam com os schemas reais.

---

## Critérios de Aceite

- Todas as rotas têm `response` definido.
- OpenAPI exibe exemplos de sucesso (e erro quando aplicável).
- Schemas de erro e sucesso são únicos e reutilizáveis.
- `docs/api/endpoints.md` permanece consistente com a resposta documentada.

---

## Checklist Técnico

- [ ] Inventário de models e rotas concluído
- [ ] Envelope SuccessResponse e ErrorResponse confirmados
- [ ] Exemplos adicionados em TypeBox
- [ ] Todas as rotas definem `response`
- [ ] Swagger com exemplos exibidos
- [ ] Documentação externa alinhada

---

## Observações Finais

- Evitar `detail.responses` por rota, a menos que seja necessário para casos muito específicos.
- Manter a tipagem 100% strict e inferida a partir do TypeBox.
- Usar keys estáveis em `.model()` para não quebrar referências.
