# Plan: Internationalizar emails (i18n)

> Objetivo: tornar todos os emails do projeto multilíngues com seleção de locale por usuário, mantendo tipagem forte e padrão de templates consistente. Não implementar aqui; este plano está pronto para execução.

---

## Escopo e premissas

- **Runtime**: Bun + Next.js + Elysia.
- **Templates**: localizados em [src/emails/components](src/emails/components).
- **Catálogo i18n**: [src/messages/en.ts](src/messages/en.ts) e [src/messages/pt-br.ts](src/messages/pt-br.ts).
- **Source of truth de locale**: **sempre usar o idioma do usuário** (`user.locale` ou equivalente). O fallback global só é usado quando o usuário não possui locale definido.
- **Boas práticas**:
  - Não duplicar tipos e schemas.
  - Manter tipagem estática para payloads de email.
  - Separar lógica de renderização (templates) de envio (service).

---

## 1) Inventário dos emails existentes

### 1.1 Descobrir templates e props

- Listar componentes de email e suas props atuais.
- Verificar se há `renderToStaticMarkup`/`render` centralizado.
- Verificar se há camada de `EmailService` e pontos de envio.

**Checklist técnico**:

- [ ] Identificar todos os templates em `src/emails/components`.
- [ ] Encontrar o(s) entry-point(s) de renderização (ex.: `src/emails/index.ts`, `src/server/services/email.service.ts`, etc.).
- [ ] Mapear todos os pontos de envio (ex.: autenticação, verificação, reset de senha, LGPD, etc.).

---

## 2) Definir contrato de locale e tipos de email

### 2.1 Tipo de locale

Definir um tipo centralizado de locale (se ainda não existir):

```ts
export type AppLocale = 'en' | 'pt-br';
```

- O tipo deve ser compartilhável entre UI e emails.
- Evitar `string` genérico.

### 2.2 Payloads tipados por template

Criar tipos de payload por template, garantindo:

- Campos obrigatórios claros.
- Sem `any` ou `Record<string, unknown>` quando possível.
- Tipos reutilizáveis para links, nome de usuário, etc.

Exemplo:

```ts
export interface WelcomeEmailPayload {
  userName: string;
  verifyUrl: string;
  expiresInMinutes: number;
}
```

---

## 3) Organizar strings de tradução

### 3.1 Estrutura recomendada no catálogo

Agrupar por domínio `emails` e por template.

```ts
export const messages = {
  emails: {
    welcome: {
      subject: 'Welcome to urlfy.cc',
      title: 'Welcome, {name}!',
      cta: 'Verify email',
      footer: 'If you did not request this, ignore.'
    },
    resetPassword: {
      subject: 'Reset your password',
      title: 'Reset password',
      cta: 'Create a new password',
      footer: 'Link expires in {minutes} minutes.'
    }
  }
} as const;
```

### 3.2 Tipagem das chaves

Se houver utilitário `t()` tipado, garantir que:

- Chaves existam nos dois idiomas.
- Chaves tenham mesma estrutura.

Evitar divergências entre `en` e `pt-br`.

---

## 4) Interface de renderização de emails

### 4.1 Contrato do render

Definir um helper de renderização que aceita:

- `locale: AppLocale`
- `template: EmailTemplate`
- `payload: PayloadByTemplate[T]`

```ts
export type EmailTemplate = 'welcome' | 'resetPassword' | 'magicLink';

export type EmailPayloadByTemplate = {
  welcome: WelcomeEmailPayload;
  resetPassword: ResetPasswordPayload;
  magicLink: MagicLinkPayload;
};

export interface RenderEmailInput<T extends EmailTemplate> {
  locale: AppLocale;
  template: T;
  payload: EmailPayloadByTemplate[T];
}
```

### 4.2 Retorno padronizado

```ts
export interface RenderEmailResult {
  subject: string;
  html: string;
  text?: string;
}
```

---

## 5) Atualizar templates para i18n

### 5.1 Injeção de `t`

Passar `t` (ou `messages`) como prop para cada template.

```tsx
interface WelcomeEmailProps {
  t: EmailMessages['welcome'];
  payload: WelcomeEmailPayload;
}
```

### 5.2 Remover strings hardcoded

Substituir textos fixos por `t.*`.

### 5.3 Garantir consistência

- Assunto **sempre** vem do catálogo i18n.
- Texto do botão e conteúdo vêm do catálogo.
- Fallback seguro (ex.: se `pt-br` faltar, usar `en`).

---

## 6) Seleção de locale no envio (garantia do idioma do usuário)

### 6.1 Fonte de locale (source of truth)

**Garantia obrigatória:** o idioma do email deve ser **sempre** o idioma do usuário. Para isso, o plano **exige** uma fonte de verdade persistida e acessível no momento do envio.

Opção recomendada (prioritária):

- Persistir `users.locale` no banco (ex.: `en` | `pt-br`).
- Atualizar `users.locale` no signup e em mudanças de preferência (perfil).
- **Regra de seleção:** `locale = user.locale ?? defaultLocale`.

Fallbacks aceitáveis (apenas quando `user.locale` não existe):

- `defaultLocale` global (ex.: `'pt-br'` em produção no Brasil ou `'en'`).
- Nunca inferir por `Accept-Language` no envio de email, pois email é assíncrono.

### 6.2 Integração no service (passo a passo)

No `EmailService` (ou equivalente):

1. Carregar usuário com `locale` junto com o envio (query já inclui locale).
2. Resolver locale com fallback:

- `const locale = user.locale ?? defaultLocale;`

3. Validar locale contra `AppLocale`:

- Se inválido, substituir por `defaultLocale`.

4. Renderizar com locale explícito:

- `renderEmail({ locale, template, payload })`.

5. Enviar com assunto e HTML localizados.

Exemplo técnico:

```ts
import type { AppLocale } from '@/i18n/types';
import { defaultLocale, isAppLocale } from '@/i18n/locales';

const rawLocale = user?.locale;
const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : defaultLocale;

const { subject, html } = renderEmail({
  locale,
  template: 'welcome',
  payload
});

await emailProvider.send({ to: user.email, subject, html });
```

> Nota: `isAppLocale` deve ser um type guard simples validando contra o union de locales.

Pseudo-fluxo:

```ts
const locale = user?.locale ?? defaultLocale;
const { subject, html } = renderEmail({
  locale,
  template: 'welcome',
  payload
});
await emailProvider.send({ to: user.email, subject, html });
```

---

## 7) Tests e validação

### 7.1 Tests de snapshot

- Gerar HTML para cada template nos dois idiomas.
- Comparar snapshots para evitar regressão.

### 7.2 Tests de tipagem

- Assegurar que templates aceitam apenas payloads corretos.
- Assegurar que chaves de tradução existem.

---

## 8) Documentação

Atualizar documentação em [src/emails/README.md](src/emails/README.md):

- Como adicionar novo template.
- Como adicionar novas traduções.
- Padrão para `subject` e fallback.

---

## Considerações finais (boas práticas)

- **Sem duplicação de tipos**: usar `typeof schema.static` ou tipos inferidos.
- **Sem strings fixas**: todas as strings de email devem vir do catálogo i18n.
- **Sem `any`**: tipar payloads e retorno do render.
- **Locale explícito**: nunca inferir locale de forma implícita no template.
- **Compatibilidade futura**: estruturar templates para fácil adição de novos idiomas.

---

## Riscos e mitigação

| Risco                       | Mitigação                         |
| --------------------------- | --------------------------------- |
| Divergência entre traduções | validação de chaves em build/test |
| Templates sem tradução      | fallback para `en` + warning      |
| Payload incompleto          | tipagem obrigatória com TS        |

---

## Critérios de aceite

- [ ] Todos os templates usam catálogo i18n.
- [ ] Assuntos de email são localizados.
- [ ] Locale escolhido por usuário (fallback global).
- [ ] Tipos garantem payloads corretos por template.
- [ ] Documentação atualizada.
