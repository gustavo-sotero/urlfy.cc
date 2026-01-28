# Plano técnico: internacionalização das páginas de autenticação

## Objetivo

Internacionalizar as páginas de login/cadastro, garantindo que todo o conteúdo de UI e mensagens de validação sejam resolvidos via i18n e que as rotas respeitem o contexto de locale.

## Escopo

- **Páginas**: login e signup.
- **Rotas**: migração para segmento com locale ou criação de redirecionamento.
- **Mensagens**: extração de strings, chaves de tradução e padronização de validação.
- **Tipagem**: uso rigoroso de tipos inferidos pelo schema, sem duplicação de interfaces.

## Estratégia de rotas (decisão necessária)

**Opção A (recomendada)**: mover as páginas de auth para dentro de `[locale]`.

- Ex.: `src/app/[locale]/(auth)/login/page.tsx`
- Benefícios: layout i18n aplicado automaticamente; URLs localizadas.

**Opção B**: manter `/login` e usar fallback de locale.

- Requer middleware/redirect para injetar locale.
- Útil se há dependências externas ou SEO mantendo `/login`.

### Recomendações

- Preferir **Opção A** para consistência com i18n e Next.js App Router.
- Se optar por **Opção B**, adicionar redirecionamento explícito para `/[locale]/login`.

## Inventário de locais relevantes

1. Páginas de auth:
   - `src/app/(auth)/login/page.tsx`
   - `src/app/(auth)/signup/page.tsx`
2. Layout i18n:
   - `src/app/[locale]/layout.tsx`
3. Configuração de i18n:
   - `src/i18n/routing.ts`
   - `src/i18n/request.ts`
4. Mensagens:
   - `src/messages/en.ts` ou `src/messages/en/*`
   - `src/messages/pt-br.ts` ou `src/messages/pt-br/*`

## Passos técnicos detalhados

### 1) Consolidar estratégia de URLs

- Validar se o projeto já utiliza locale prefixado (ex.: `/pt-br`, `/en`).
- Se **sim**, migrar `/(auth)` para dentro de `[locale]`.
- Se **não**, implementar redirect no middleware para `/(auth)`.

**Checklist**:

- [ ] Identificar rotas atuais de login/signup.
- [ ] Confirmar se existem páginas `/(auth)` com dependências específicas.
- [ ] Definir estratégia (A/B) com base em SEO/UX.

### 2) Reorganizar pastas (se Opção A)

Mover as páginas de auth para o contexto de locale:

```
src/app/[locale]/(auth)/login/page.tsx
src/app/[locale]/(auth)/signup/page.tsx
src/app/[locale]/(auth)/layout.tsx
```

**Boas práticas**:

- Atualizar imports relativos.
- Evitar duplicação de layouts.
- Garantir que o layout [locale] continue sendo aplicado.

### 3) Adicionar i18n com `useTranslations`

Substituir todas as strings hardcoded por chaves de tradução.

Exemplo:

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('auth.login');

<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
```

**Checklist**:

- [ ] Títulos, descrições, placeholders, CTAs.
- [ ] Links “Esqueci minha senha”, “Criar conta”.
- [ ] Textos auxiliares e labels de formulário.

### 4) Internacionalizar validações

Evitar mensagens hardcoded nos schemas. Usar strings via `t()` no momento de validação.

Exemplo com Zod:

```ts
const schema = z.object({
  email: z.string().email(t('errors.invalidEmail')),
  password: z.string().min(8, t('errors.passwordMin'))
});
```

**Boas práticas**:

- Não usar mensagens estáticas nos schemas compartilhados.
- Centralizar mensagens por domínio (`auth.login.errors`).
- Se schema é reutilizado server-side, considerar map de mensagens por locale.

### 5) Atualizar arquivos de mensagens

Adicionar keys necessárias em **en** e **pt-br**.

Exemplo de estrutura:

```ts
export const messages = {
  auth: {
    login: {
      title: 'Sign in',
      subtitle: 'Access your account',
      fields: {
        email: 'Email',
        password: 'Password'
      },
      actions: {
        submit: 'Sign in',
        signup: 'Create account'
      },
      errors: {
        invalidEmail: 'Invalid email format',
        passwordMin: 'Password must be at least 8 characters'
      }
    }
  }
};
```

### 6) Tipagem e lint

- Garantir que nenhum `interface` duplica schema.
- Evitar `Context` no controller.
- Respeitar tipagem inferida pelo i18n.

### 7) Ajustes de links e navegação

- Garantir que `Link` respeite o locale atual.
- Usar helpers de i18n (ex.: `Link` customizado do routing).

### 8) Validar execução

- Smoke test: acessar `/pt-br/login` e `/en/login`.
- Garantir fallback correto para locale default.
- Verificar console para missing keys.

## Critérios de aceite

- Login e signup renderizam corretamente em **en** e **pt-br**.
- Nenhuma string hardcoded restante nas páginas.
- Mensagens de validação traduzidas.
- Rotas respeitam locale (com ou sem redirect conforme decisão).
- Sem erros de TypeScript e lint.

## Riscos e mitigação

- **Risco**: schemas compartilhados com validação server-side.
  - **Mitigação**: separar mensagens por layer ou injetar mensagens no client.
- **Risco**: break de URLs antigas.
  - **Mitigação**: adicionar redirect permanente (301) se migrar rotas.

## Notas finais

- Seguir as melhores práticas de Elysia e i18n já adotadas no projeto.
- Manter consistência com o padrão `useTranslations` e `routing.ts`.
- Evitar duplicação de tipos: sempre inferir a partir de schemas/TypeBox.
