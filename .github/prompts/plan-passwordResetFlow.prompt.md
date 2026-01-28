# Plano técnico — fluxo de recuperação e redefinição de senha (Better-Auth + Resend)

Objetivo: implementar o fluxo completo de “esqueci minha senha” e “redefinir senha” com Better-Auth, usando o envio de email via Resend e exibindo expiração de 15 minutos na UI, mantendo tipagem e boas práticas (TypeScript, i18n e componentes reutilizáveis).

---

## 1) Ajustes no Better-Auth (server)

### 1.1. Configurar `sendResetPassword`

- **Arquivo**: src/lib/auth.ts
- **Meta**: usar o fluxo de email existente (Resend) e o template `PasswordResetEmail`.
- **Boas práticas**:
  - Não aguardar envio do email para evitar timing attacks.
  - Usar `waitUntil` (quando aplicável) ou fire-and-forget.
  - Não logar tokens no console.

**Pseudo-implementação:**

```ts
import { sendPasswordResetEmail } from '@/lib/email';

emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }, request) => {
    // Evitar await direto em produção serverless
    void sendPasswordResetEmail({
      to: user.email,
      firstName: user.name ?? 'usuário',
      resetUrl: url,
      expiresInMinutes: 15
    });
  },
  onPasswordReset: async ({ user }, request) => {
    // callback pós-reset
  }
}
```

### 1.2. Tipagem e segurança

- Garantir que `user` possui `email` e nome (fallback seguro).
- Não manipular `token` no email; use apenas `url` fornecida pelo Better-Auth.

---

## 2) Página “Esqueci minha senha”

### 2.1. Rota e arquivo

- **Arquivo**: src/app/[locale]/(auth)/forgot-password/page.tsx
- **Rota**: /[locale]/forgot-password

### 2.2. UI e comportamento

- Formulário com campo `email`.
- Botão para enviar o link de reset.
- Feedback inline de sucesso/erro (sem página dedicada).
- Aviso de expiração: “Link válido por 15 minutos”.

### 2.3. Integração com Better-Auth (client)

- Usar `authClient.requestPasswordReset`.
- `redirectTo` deve apontar para a página de reset local.
- Tratar erros de forma amigável sem revelar se o email existe.

**Pseudo-implementação:**

```ts
const { data, error } = await authClient.requestPasswordReset({
  email,
  redirectTo: `${origin}/${locale}/reset-password`
});
```

### 2.4. Boas práticas

- Input com validação HTML e fallback server-side.
- Desabilitar botão durante submit.
- Acessibilidade: `aria-live` para mensagens.

---

## 3) Página “Redefinir senha”

### 3.1. Rota e arquivo

- **Arquivo**: src/app/[locale]/(auth)/reset-password/page.tsx
- **Rota**: /[locale]/reset-password?token=...

### 3.2. UI e comportamento

- Inputs: `newPassword`, `confirmPassword`.
- Validação local: tamanho mínimo, match entre senhas.
- Estado de erro para token inválido ou expirado.
- Aviso de expiração: 15 minutos.

### 3.3. Integração com Better-Auth (client)

- Ler `token` de `searchParams`.
- Se ausente, exibir erro.
- Chamar `authClient.resetPassword({ newPassword, token })`.

**Pseudo-implementação:**

```ts
const token = searchParams.get('token');
if (!token) {
  setError('TOKEN_MISSING');
}
const { data, error } = await authClient.resetPassword({
  newPassword,
  token
});
```

---

## 4) Navegação do layout de auth

### 4.1. Onde inserir

- **Arquivo**: src/app/[locale]/(auth)/layout.tsx

### 4.2. Elementos

- Link “Home” (rota pública).
- Seletor de idioma usando o padrão já existente no layout público.

### 4.3. Boas práticas

- Evitar duplicar lógica: preferir componente reutilizável se existir.
- Preservar `locale` na navegação.

---

## 5) Ajustes no login

- Atualizar o link “Esqueceu a senha?” para a nova rota.
- **Arquivo**: src/app/[locale]/(auth)/login/page.tsx

---

## 6) i18n (mensagens)

Adicionar chaves para:

- Títulos e descrições das páginas
- Labels de inputs
- Mensagens de sucesso/erro
- Aviso de expiração

**Arquivos:**

- src/messages/pt-br.ts
- src/messages/en.ts

---

## 7) Boas práticas e tipagem

- Manter tipagem forte nos estados e handlers.
- Evitar `any` e `as` desnecessários.
- Manter componentes “client” apenas onde necessário.
- Usar `useTransition` ou `useState` para controlar submit e feedback.

---

## 8) Checklist de pronto para implementação

- [ ] `sendResetPassword` usa Resend e `PasswordResetEmail`
- [ ] Página forgot-password com feedback inline
- [ ] Página reset-password com leitura de token
- [ ] Expiração exibida (15 min)
- [ ] Link do login atualizado
- [ ] Layout de auth com Home + idioma
- [ ] Mensagens i18n adicionadas
- [ ] Tipagem e acessibilidade revisadas
