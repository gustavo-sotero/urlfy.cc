# Plano técnico detalhado — Swagger único com Better‑Auth + exemplos reais por status

## Objetivo

Consolidar a documentação OpenAPI em um único Swagger UI em /api/docs, incluindo endpoints do Better‑Auth e exemplos completos por status HTTP, com tipagem forte e boas práticas de modelagem. Além disso, corrigir a indicação de autenticação para rotas públicas que hoje aparecem como protegidas.

## Princípios e boas práticas

- **Single Source of Truth**: modelos de resposta centralizados e reutilizados por rotas (TypeBox + OpenAPI).
- **Typing estrito**: tipos derivados de schemas (`typeof schema.static`) e uso de `t.Union`, `t.Literal`, `t.Object` de forma consistente.
- **Respostas por status**: mapear 200/201/204, 400, 401, 403, 404, 409, 410, 422, 429, 451, 500 quando aplicável.
- **Exemplos reais**: incluir `examples` em cada `content` de resposta no OpenAPI (ou `example` quando único), evitando payload vazio.
- **OpenAPI “one spec”**: gerar spec única em runtime para refletir mudanças sem rebuild.
- **Segurança precisa**: descrever `security: []` em rotas públicas para melhor UX.

## Visão geral da solução

1. **Gerar duas specs** (Elysia e Better‑Auth) em runtime.
2. **Mesclar** as specs em um único documento OpenAPI (JSON).
3. **Servir Swagger UI único** apontando para a spec mesclada.
4. **Completar respostas por status** em todos os endpoints usando modelos e exemplos.
5. **Ajustar segurança** por rota (public vs protected) sem alterar comportamento runtime.

## Etapa 1 — Descoberta e validação das specs

- Confirmar os endpoints reais das specs JSON:
  - Elysia OpenAPI JSON (ex.: /api/docs/json ou /api/docs/openapi.json).
  - Better‑Auth OpenAPI JSON (ex.: /api/auth/reference/openapi.json).
- Se não houver endpoint JSON, expor endpoint JSON manualmente com o output do gerador.
- Verificar versão OpenAPI e compatibilidade dos dois documentos (3.0.x vs 3.1.x).
- Auditar `components`, `securitySchemes`, `tags`, e `paths` de ambos.

## Etapa 2 — Estratégia de merge da spec (runtime)

- Implementar um endpoint interno (ex.: /api/docs/merged.json) responsável por:
  - Buscar a spec Elysia local (preferencialmente em memória/cache).
  - Buscar a spec Better‑Auth local.
  - Mesclar `paths`, `components.schemas`, `components.securitySchemes`, `tags`.
  - Deduplicar conflitos com nomes de schemas e tags usando prefixos consistentes:
    - Ex.: `Auth.*`, `Links.*`, `Analytics.*`, `BetterAuth.*`.
  - Garantir coerência de `servers` e `info`.
- Considerar **cache in‑memory** com TTL curto (ex.: 60s) para reduzir custo.
- Validar o documento resultante com um validador OpenAPI (opcional).

## Etapa 3 — Swagger UI único

- Atualizar /api/docs para carregar **o documento mesclado**.
- Se o plugin padrão não permitir apontar para spec externa:
  - Usar UI personalizada (ex.: Swagger UI HTML simples ou Scalar).
  - Incluir URL da spec mesclada.
- Garantir CSP correta para recursos externos, mantendo compatibilidade com política atual.

## Etapa 4 — Padronização de respostas e exemplos

- Inventariar todas as rotas em `src/server/modules/**/index.ts`.
- Para cada rota, adicionar `response` completo com:
  - **Success** (`200`, `201`, `204`) com exemplo real (payload e metadados).
  - **Error** (400/401/403/404/409/410/422/429/451/500) usando modelos padronizados.
- Consolidar exemplos no `ResponseModels`:
  - `SuccessResponse<T>`
  - `PaginatedResponse<T>`
  - `ErrorResponse` com `code`, `message`, `details`, `requestId`.
- Evitar exemplos vazios. Cada exemplo deve refletir o payload real do endpoint.
- Manter consistência com `types` em `src/types` e `models` em cada módulo.

## Etapa 5 — Segurança por rota (UX)

- Remover auth das rotas públicas via `security: []`.
- Rotas públicas típicas:
  - `GET /api/health`
  - `GET /api/health/ready`
  - `GET /api/links/by-code/:code`
  - `GET /api/links/by-code/:code/preview`
  - `GET /api/links/by-code/:code/qr`
  - `POST /api/links/validate`
  - `POST /api/links` (guest permitido)
  - `GET /api/auth/session` (se for opcional)
- Rotas protegidas devem explicitar `security` coerente com scheme (bearer/cookie/apiKey).
- Evitar alterar lógica de auth; é **apenas documentação**.

## Etapa 6 — Melhorias de tipagem e consistência

- Remover interfaces paralelas e usar TypeBox como fonte única.
- Garantir que `response` use modelos tipados e referenciáveis (`.model()` + `$ref`).
- Enriquecer `t.Object` com `examples`/`example` nos campos relevantes.
- Mapear erros conhecidos do domínio com enums (`t.Literal`) para `code`.

## Etapa 7 — Verificação e QA

- Abrir /api/docs e verificar:
  - Better‑Auth aparecendo com paths completos.
  - Cada endpoint possui múltiplos status com exemplos reais.
  - Rotas públicas sem “auth required”.
- Validar com testes visuais e inspeção de JSON.

## Checklist técnico por arquivo

- [ ] Ajustar OpenAPI config e docs UI em src/server/api/index.ts.
- [ ] Criar endpoint de merge e cache da spec (novo arquivo em src/server/api/docs ou lib).
- [ ] Atualizar ResponseModels e schemas de cada módulo para exemplos completos.
- [ ] Adicionar `response` por status em todas as rotas de controllers.
- [ ] Marcar `security: []` para rotas públicas.

## Critérios de aceitação

- Swagger único em /api/docs com Better‑Auth incluído.
- Todas as rotas exibem **exemplos reais** por status.
- Rotas públicas não exibem “Authentication required”.
- Tipagem e modelos consistentes com TypeBox + $ref.

## Riscos e mitigação

- **Conflito de schemas**: resolver com prefixos e deduplicação no merge.
- **Performance**: cache curto para spec mesclada.
- **Incompatibilidade OpenAPI**: normalizar versão e campos incompatíveis.

## Próximos passos (após aprovação)

- Implementar merge runtime.
- Completar respostas e exemplos por rota.
- Ajustar segurança por rota.
- Validar visualmente e com testes.
