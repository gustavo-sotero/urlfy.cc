# Plano técnico: Internacionalização do Dashboard (Next.js + Elysia)

## Objetivo

Internacionalizar todas as páginas do dashboard em [src/app/[locale]/(dashboard)](<src/app/[locale]/(dashboard)>), substituindo strings hardcoded por chaves de tradução e garantindo tipagem, consistência de UX e mensagens de validação localizadas.

## Escopo (arquivos-alvo)

- [src/app/[locale]/(dashboard)/dashboard/page.tsx](<src/app/[locale]/(dashboard)/dashboard/page.tsx>)
- [src/app/[locale]/(dashboard)/dashboard/links/page.tsx](<src/app/[locale]/(dashboard)/dashboard/links/page.tsx>)
- [src/app/[locale]/(dashboard)/dashboard/links/new/page.tsx](<src/app/[locale]/(dashboard)/dashboard/links/new/page.tsx>)
- [src/app/[locale]/(dashboard)/dashboard/links/[id]/edit/page.tsx](<src/app/[locale]/(dashboard)/dashboard/links/[id]/edit/page.tsx>)
- [src/app/[locale]/(dashboard)/dashboard/analytics/page.tsx](<src/app/[locale]/(dashboard)/dashboard/analytics/page.tsx>)
- [src/app/[locale]/(dashboard)/dashboard/settings/page.tsx](<src/app/[locale]/(dashboard)/dashboard/settings/page.tsx>)

Mensageria:

- [src/messages/pt-br.ts](src/messages/pt-br.ts)
- [src/messages/en.ts](src/messages/en.ts)
- (se houver namespaces por arquivo) [src/messages/pt-br/\*](src/messages/pt-br/) e [src/messages/en/\*](src/messages/en/)

## Padrão recomendado

- Namespaces por domínio: `dashboard`, `links`, `linksForm`, `analytics`, `settings`.
- `useTranslations()` por domínio na página.
- `useFormatter()` para números, percentuais, datas.
- Validations: mensagens globais + exceções pontuais (URL inválida, senha, expiração, alias, redirectType).

## Plano detalhado

### 1) Inventário e mapeamento de strings

1.1. Listar todas as strings hardcoded nas páginas alvo.
1.2. Agrupar por domínio (dashboard/links/linksForm/analytics/settings).
1.3. Definir chaves consistentes (snakeCase ou camelCase) — manter padrão atual.

Exemplo de mapeamento:

```ts
// dashboard
"Dashboard" -> dashboard.title
"Visão geral do desempenho" -> dashboard.subtitle
"Total de Links" -> dashboard.cards.totalLinks
```

### 2) Estrutura de mensagens (i18n)

2.1. Adicionar chaves nos arquivos base:

- [src/messages/pt-br.ts](src/messages/pt-br.ts)
- [src/messages/en.ts](src/messages/en.ts)

  2.2. Sugestão de estrutura (pt-br):

```ts
export default {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Visão geral do desempenho',
    cards: {
      totalLinks: 'Total de Links',
      totalClicks: 'Total de Cliques',
      ctr: 'Taxa de Conversão',
      activeLinks: 'Links Ativos'
    },
    empty: {
      title: 'Nenhum dado ainda',
      description: 'Crie seu primeiro link para ver métricas aqui.',
      action: 'Criar primeiro link'
    },
    errors: {
      loadFailed: 'Erro ao carregar dados do dashboard'
    }
  },
  links: {
    title: 'Meus Links',
    subtitle: 'Gerencie e organize seus links',
    searchPlaceholder: 'Buscar links...',
    empty: {
      title: 'Nenhum link encontrado',
      description: 'Crie um link para começar.',
      action: 'Criar link'
    },
    pagination: {
      previous: 'Anterior',
      next: 'Próxima'
    },
    toasts: {
      deleteSuccess: 'Link removido',
      deleteError: 'Erro ao remover link'
    }
  },
  linksForm: {
    titleNew: 'Novo Link',
    titleEdit: 'Editar Link',
    sections: {
      basic: 'Informações Básicas',
      og: 'Meta tags',
      limits: 'Status e Limites',
      tracking: 'UTM Tracking',
      security: 'Segurança'
    },
    fields: {
      url: { label: 'URL de destino', placeholder: 'https://exemplo.com' },
      alias: { label: 'Alias customizado', placeholder: 'meu-link' },
      password: { label: 'Senha', placeholder: '••••••' },
      expiresAt: { label: 'Expira em' },
      maxClicks: { label: 'Limite de cliques' },
      redirectType: { label: 'Tipo de redirect' },
      metaTitle: { label: 'Meta title' },
      metaDescription: { label: 'Meta description' },
      metaImage: { label: 'Meta image' }
    },
    hints: {
      alias: 'Entre 3 e 20 caracteres, sem espaços',
      maxClicks: 'Deixe vazio para ilimitado'
    },
    actions: {
      save: 'Salvar',
      create: 'Criar',
      cancel: 'Cancelar'
    },
    validation: {
      required: 'Campo obrigatório',
      invalidUrl: 'URL inválida',
      invalidAlias: 'Alias inválido',
      invalidDate: 'Data inválida'
    }
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Métricas detalhadas dos seus links',
    range: {
      last7: 'Últimos 7 dias',
      last30: 'Últimos 30 dias',
      last90: 'Últimos 90 dias'
    },
    charts: {
      clicksOverTime: 'Cliques ao longo do tempo',
      topCountries: 'Top países',
      devices: 'Dispositivos',
      referrers: 'Origem do tráfego'
    },
    empty: {
      title: 'Sem dados',
      description: 'Aguarde os primeiros cliques para ver métricas.'
    }
  },
  settings: {
    title: 'Configurações',
    profile: {
      title: 'Perfil',
      description: 'Gerencie seus dados pessoais'
    },
    security: {
      title: 'Segurança',
      description: 'Gerencie autenticação e 2FA'
    },
    danger: {
      title: 'Zona de perigo',
      description: 'Ações irreversíveis'
    },
    actions: {
      save: 'Salvar alterações',
      delete: 'Excluir conta'
    },
    toasts: {
      saved: 'Configurações atualizadas',
      error: 'Erro ao salvar configurações'
    }
  }
};
```

2.3. Criar equivalentes em `en` com traduções naturais e consistentes.

### 3) Refatoração das páginas

Para cada página, substituir strings por `t()`:

```tsx
import { useTranslations, useFormatter } from 'next-intl';

const t = useTranslations('links');
const fmt = useFormatter();
```

3.1. **Dashboard**

- Título/subtítulo
- Cards e labels
- Empty state
- Toasts/Errors
- `fmt.number()` para métricas e `fmt.dateTime()` para datas

  3.2. **Links (lista)**

- Título/subtítulo
- Placeholder do search
- Empty state
- Pagination labels
- Toasts

  3.3. **Links (novo)**

- Títulos de seção
- Labels, placeholders e hints
- Botões
- Mensagens de validação

  3.4. **Links (editar)**

- Mesmo padrão do novo
- Mensagens de erro (fetch/update)
- Labels de status

  3.5. **Analytics**

- Título/subtítulo
- Labels de filtros e ranges
- Títulos de gráficos
- Empty state
- `fmt.number()` para percentuais e `fmt.dateTime()` para time-series

  3.6. **Settings**

- Título/subtítulo
- Seções (perfil, segurança, notificações, zona de perigo)
- Botões e toasts

### 4) Validações localizadas

4.1. Definir mensagens globais e pontuais em `linksForm.validation`.
4.2. Integrar `zod` com mensagens de erro do `t()`:

```ts
const schema = z.object({
  url: z
    .string()
    .min(1, t('validation.required'))
    .url(t('validation.invalidUrl')),
  customAlias: z.string().min(3, t('validation.invalidAlias')).optional()
});
```

4.3. Garantir tipagem: `type FormData = z.infer<typeof schema>`.

### 5) Tipagem e boas práticas

- Evitar `any` e casts desnecessários.
- Manter `useTranslations()` com namespace específico por página.
- Manter strings dinâmicas formatadas via `useFormatter()`.
- Não passar `Context` inteiro em handlers (padrão do projeto).
- Respeitar lint (Biome) e `strict` do TS.

### 6) Checklist de validação final

- [ ] Nenhuma string hardcoded nas páginas alvo.
- [ ] Mensagens completas em `pt-br` e `en`.
- [ ] `useFormatter()` aplicado para números/datas.
- [ ] Mensagens de validação localizadas.
- [ ] UI renderizando corretamente em ambos os idiomas.

## Observações

- Se houver componentes compartilhados com strings internas (ex.: cards, dialogs), considerar extração de `t` via props.
- Caso já exista um padrão de mensagens por módulo, seguir o padrão atual para evitar divergências.
