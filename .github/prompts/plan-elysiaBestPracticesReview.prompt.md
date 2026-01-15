Plano técnico detalhado: Revisão de boas práticas Elysia + padrões de arquitetura geral

Objetivo

- Levantar e consolidar as melhores práticas do Elysia e padrões de arquitetura (Next.js App Router, Bun, Drizzle, serviços, middleware).
- Auditar a codebase atual e identificar gaps concretos com evidências (arquivos e pontos específicos).
- Propor refatorações sugeridas (exemplos descritivos, sem código) com priorização por impacto e risco.

Escopo

- Backend: Elysia (controllers/routers), Bun runtime, Drizzle ORM, middleware e services.
- Bridge com Next.js App Router: integração em src/app/api/[[...slugs]]/route.ts.
- Tipagem e validação: Elysia t/model, schema vs types em src/types.
- Segurança e DX: env validation, error handling, logging, observability.

Entradas a revisar (checklist de arquivos/áreas)

- Elysia entry/bridge: src/app/api/[[...slugs]]/route.ts
- Composição de rotas: src/server/api/index.ts (ou equivalente)
- Rotas v1 principais: src/server/api/v1/\*\*
- Middleware: src/server/middleware/\*\*
- Services: src/server/services/\*\*
- DB: src/db/index.ts, src/db/schema/\*\*
- Tipos: src/types/\*\*
- Utilitários: src/lib/\*\*
- Docs relevantes: docs/architecture/\*.md

Critérios de avaliação (Elysia)

1. Estrutura de pastas baseada em features

- Verificar se controllers/handlers e services estão co-localizados por feature.
- Avaliar se há dispersão excessiva (ex.: controllers em api/, services em services/ sem acoplamento claro).

2. “1 Elysia instance = 1 controller”

- Verificar se arquivos de rota são grandes demais e misturam múltiplas responsabilidades.
- Verificar se há “super-controllers” (ex.: links/index.ts com múltiplos sub-domínios).

3. Evitar passar Context completo

- Verificar se handlers recebem Context inteiro ou fazem type assertion para injetar propriedades.
- Validar se decorates são usados para request-scoped data.

4. Services puros vs request-dependent

- Checar se lógica de negócio está em serviços puros (sem context).
- Identificar request-dependent logic que deveria ser plugin/middleware.

5. Validação como fonte única de verdade

- Identificar uso de t.Object inline repetido.
- Checar divergência entre tipos em src/types e schemas do Elysia.
- Procurar modelos reutilizáveis (model injection) e ausência deles.

6. Testabilidade

- Verificar se controllers podem ser testados isoladamente (elysia handle + body/headers).

Critérios de avaliação (Arquitetura Geral)

1. Coesão e separação de camadas

- Handlers devem orquestrar, não conter queries complexas.
- Services devem encapsular regras de domínio e acessos a DB/Redis.

2. Consistência de acesso ao DB

- Checar padrões inconsistentes (db import em múltiplos caminhos).
- Verificar uso de Drizzle query vs SQL raw sem necessidade.

3. Observabilidade e error handling

- Verificar logs estruturados e propagação de correlation ID.
- Verificar padrão de respostas de erro (error codes).

4. Configuração/env

- Checar se há validação estrita de env e acesso centralizado.

5. Edge/runtime constraints

- Identificar uso de APIs não compatíveis em edge/middleware.

6. Security by default

- Validação de inputs e sanitização (especialmente OG meta).
- Rate limiting e idempotency (uso consistente).

Metodologia de auditoria (passo a passo)

1. Inventário de rotas Elysia

- Mapear os arquivos de rotas v1 e módulos de domínio.
- Registrar tamanho, responsabilidade e dependências.

2. Mapa de dependências por feature

- Para cada feature (links, analytics, auth, admin, etc.):
  - Localizar controller/route.
  - Localizar services usados.
  - Localizar schema/model correspondente.

3. Identificação de padrões anti-Elysia

- Procurar:
  - Context casting em handlers.
  - DTOs duplicadas vs t.Object.
  - Handlers com regras de domínio e DB queries inline.

4. Identificação de anti-padrões arquiteturais

- Duplicação de lógica cross-cutting (auth, ip, pagination).
- Dispersão de utilitários.
- Estratégias de cache e invalidação implementadas de formas distintas.

5. Classificação de gaps

- Impacto: alto/médio/baixo.
- Esforço: alto/médio/baixo.
- Risco técnico: alto/médio/baixo.

Entregáveis

- Relatório técnico com:
  - Resumo executivo (3–5 bullets).
  - Lista de gaps por área.
  - Referências a arquivos específicos.
  - Recomendações e exemplos de refatoração (sem código).
  - Prioridades (P0/P1/P2) e esforço estimado.

Exemplos de refatoração sugerida (modelo de escrita)

- “Dividir controller X em controllers menores por responsabilidade: public, auth, admin. Compor via .use() no módulo principal.”
- “Criar models compartilhados em `models.ts` por feature e injetar via `.model({ ... })`, usando `typeof model.static` para types.”
- “Mover queries de DB de handlers para `services/links.ts`, expondo funções puras que recebem apenas dados necessários.”
- “Substituir type assertions de Context por `decorate` e destructuring nos handlers.”
- “Padronizar import do DB em `src/db/index.ts` e reexportar, removendo múltiplos caminhos de import.”

Formato final do relatório

- Seções:
  1. Resumo
  2. Boas práticas Elysia (checklist)
  3. Arquitetura geral (checklist)
  4. Gaps encontrados (com links)
  5. Recomendações priorizadas
  6. Refatorações sugeridas (exemplos)

Critérios de aceitação

- Cada gap deve ter:
  - Evidência (arquivo + descrição objetiva).
  - Risco/impacto.
  - Sugestão de melhoria.
- Recomendações devem respeitar:
  - Uso de Bun.
  - Elysia em rotas Next.
  - Drizzle para DB.

Notas finais

- Não gerar código nesta etapa.
- Não aplicar alterações; apenas relatório e plano de refatoração.
- Caso necessário, apontar dependências/documentação adicional.
