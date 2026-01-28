# Plano técnico: divisão de mensagens i18n (en / pt-br)

## Objetivo

Dividir os dicionários de mensagens em arquivos menores por domínio, mantendo tipagem forte, compatibilidade com o shape atual e carregamento via `next-intl` sem regressões.

## Escopo

- Refatorar os arquivos de mensagens atuais em agregadores por locale.
- Criar subarquivos por domínio (ex.: `Common`, `Navigation`, `Hero`, etc.).
- Garantir que o objeto final exportado preserve exatamente as mesmas chaves e estruturas utilizadas no app.
- Manter `en` como source of truth.

## Premissas técnicas

- O carregamento de mensagens é centralizado no request config (`src/i18n/request.ts`) e o layout injeta as mensagens no `NextIntlClientProvider`.
- Tipagem deve ser preservada com inferência a partir do `en`.
- Componentes/rotas usam `useTranslations()` com namespaces atuais.

## Estrutura de diretórios proposta

```
src/messages/
  en/
    common.ts
    navigation.ts
    hero.ts
    features.ts
    link-form.ts
    dashboard.ts
    analytics.ts
    settings.ts
    about.ts
    contact.ts
    help.ts
    terms.ts
    privacy.ts
    errors.ts
    footer.ts
    auth.ts
    project-page.ts
    index.ts
  pt-br/
    common.ts
    navigation.ts
    hero.ts
    features.ts
    link-form.ts
    dashboard.ts
    analytics.ts
    settings.ts
    about.ts
    contact.ts
    help.ts
    terms.ts
    privacy.ts
    errors.ts
    footer.ts
    auth.ts
    project-page.ts
    index.ts
  en.ts
  pt-br.ts
```

## Estratégia de compatibilidade

- `src/messages/en.ts` e `src/messages/pt-br.ts` tornam-se **agregadores** que exportam o mesmo shape atual.
- Cada subarquivo exporta somente o bloco do namespace correspondente.
- O agregador compõe o objeto final com `as const`.

## Tipagem e boas práticas

- `en` continua como source of truth, com `as const` para tipos literais.
- `pt-br` deve aderir 1:1 à estrutura de `en` (mesmas chaves e profundidade), sem chaves extras.
- Se existir tipagem global baseada em `typeof en`, ela deve continuar válida.
- Evitar `any` ou casts desnecessários; preferir inferência e validação via TypeScript.

## Passos detalhados

### 1) Criar subarquivos de `en`

Para cada namespace, mover seu bloco para um arquivo separado.
Exemplo para `Common`:

```ts
// src/messages/en/common.ts
export const Common = {
  dashboard: 'Dashboard',
  settings: 'Settings',
  language: 'Language',
  home: 'Home',
  about: 'About',
  contact: 'Contact',
  help: 'Help',
  terms: 'Terms',
  privacy: 'Privacy',
  login: 'Login',
  logout: 'Logout',
  signup: 'Sign Up',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  create: 'Create',
  back: 'Back',
  next: 'Next',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  search: 'Search',
  filter: 'Filter',
  clear: 'Clear',
  apply: 'Apply'
} as const;
```

### 2) Criar agregador `en/index.ts`

```ts
// src/messages/en/index.ts
import { Common } from './common';
import { Navigation } from './navigation';
import { Hero } from './hero';
import { Features } from './features';
import { LinkForm } from './link-form';
import { Dashboard } from './dashboard';
import { Analytics } from './analytics';
import { Settings } from './settings';
import { About } from './about';
import { Contact } from './contact';
import { Help } from './help';
import { Terms } from './terms';
import { Privacy } from './privacy';
import { Errors } from './errors';
import { Footer } from './footer';
import { Auth } from './auth';
import { ProjectPage } from './project-page';

export const enMessages = {
  Common,
  Navigation,
  Hero,
  Features,
  LinkForm,
  Dashboard,
  Analytics,
  Settings,
  About,
  Contact,
  Help,
  Terms,
  Privacy,
  Errors,
  Footer,
  Auth,
  ProjectPage
} as const;
```

### 3) Atualizar `src/messages/en.ts`

- Manter comentário de “source of truth”.
- Exportar `enMessages` como default.

```ts
// src/messages/en.ts
/**
 * English (en) - Default Locale
 * Source of truth for all translations.
 */
export { enMessages as default } from './en/index';
```

### 4) Repetir para `pt-br`

- Criar subarquivos espelhando **exatamente** a estrutura de `en`.
- Agregador `pt-br/index.ts` exporta `ptMessages` com `as const`.
- `src/messages/pt-br.ts` exporta `ptMessages` como default.

```ts
// src/messages/pt-br.ts
/**
 * Portuguese - Brazil (pt-br)
 * Translated from English source of truth.
 */
export { ptMessages as default } from './pt-br/index';
```

### 5) Garantir compatibilidade no carregamento

- O loader deve continuar importando `src/messages/en.ts` e `src/messages/pt-br.ts`.
- Se já existir import dinâmico, manter o contrato de retorno (objeto completo por locale).

### 6) Checagens finais

- Verificar tipagem com `tsc`/`bun run type-check`.
- Garantir ausência de chaves faltantes em `pt-br` (comparar com `en`).
- Confirmar que `useTranslations('Namespace')` continua funcionando para todos os módulos.

## Checklist de implementação

- [ ] Criar estrutura de pastas `src/messages/en` e `src/messages/pt-br`.
- [ ] Extrair cada namespace em arquivo próprio.
- [ ] Criar agregadores `index.ts` em cada locale.
- [ ] Atualizar `src/messages/en.ts` e `src/messages/pt-br.ts` para reexportar agregadores.
- [ ] Validar import dinâmico no request config.
- [ ] Validar build e type-check.

## Observações importantes

- Não renomear namespaces; manter exatamente as chaves atuais.
- Não mudar o shape do objeto final.
- Usar `as const` para preservar literals e inferência.
- Evitar duplicar tipagens — derive sempre do `en` quando necessário.
