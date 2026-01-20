# Email Service - urlfy.cc

Sistema de emails transacionais usando **Resend** com templates React.

## 📧 Templates Disponíveis

### 1. **EmailVerificationEmail** - Verificação de Email

Enviado após o cadastro para confirmar o endereço de email.

```typescript
import { emailService } from '@/server/services/email.service';

await emailService.sendEmailVerification({
  to: 'user@example.com',
  firstName: 'João',
  verificationUrl: 'https://urlfy.cc/verify-email?token=abc123',
  expiresInMinutes: 30 // Opcional, padrão: 30
});
```

---

### 2. **WelcomeEmail** - Boas-vindas

Enviado quando um novo usuário confirma o email (após verificação).

```typescript
await emailService.sendWelcomeEmail({
  to: 'user@example.com',
  firstName: 'João',
  email: 'user@example.com'
});
```

---

### 3. **PasswordResetEmail** - Recuperação de Senha

Enviado quando o usuário solicita redefinição de senha.

```typescript
await emailService.sendPasswordResetEmail({
  to: 'user@example.com',
  firstName: 'João',
  resetUrl: 'https://urlfy.cc/reset-password?token=abc123',
  expiresInMinutes: 15 // Opcional, padrão: 15
});
```

---

### 4. **DataDeletionConfirmationEmail** - Confirmação LGPD

Enviado quando o usuário solicita exclusão de dados.

```typescript
await emailService.sendDataDeletionConfirmation({
  to: 'user@example.com',
  firstName: 'João',
  requestDate: new Date(),
  deadlineDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
  exportUrl: 'https://urlfy.cc/api/me/export' // Opcional
});
```

---

### 5. **LinkBannedEmail** - Notificação de Bloqueio

Enviado quando um link é banido por violar os termos.

```typescript
await emailService.sendLinkBannedNotification({
  to: 'user@example.com',
  firstName: 'João',
  linkUrl: 'https://example.com/bad-content',
  shortCode: 'abc123',
  bannedReason: 'Spam/Phishing',
  bannedAt: new Date(),
  appealUrl: 'https://urlfy.cc/appeal/abc123'
});
```

---

### 6. **QuotaWarningEmail** - Alerta de Quota

Enviado quando o usuário atinge 80% ou 90% da quota.

```typescript
await emailService.sendQuotaWarning({
  to: 'user@example.com',
  firstName: 'João',
  currentUsage: 90,
  quotaLimit: 100,
  percentUsed: 90,
  upgradeUrl: 'https://urlfy.cc/pricing'
});
```

---

## 🎨 Design System

Todos os templates seguem o mesmo design:

- **Paleta de Cores:**
  - Primary: `#6366f1` (Indigo)
  - Secondary: `#8b5cf6` (Purple)
  - Success: `#22c55e` (Green)
  - Warning: `#f59e0b` (Amber)
  - Error: `#ef4444` (Red)
- **Tipografia:**
  - Font: System fonts (Apple, Segoe UI, Roboto)
  - Títulos: 24px-32px, peso 600
  - Corpo: 14px-16px
- **Espaçamento:**
  - Padding interno: 40px (desktop), 30px (mobile)
  - Margin entre seções: 24px-32px

---

## 🔧 Configuração

### Variáveis de Ambiente

```env
RESEND_API_KEY=re_...
RESEND_FROM="urlfy.cc <noreply@urlfy.cc>"
```

### Verificação de Domínio

1. Acesse [resend.com/domains](https://resend.com/domains)
2. Adicione `urlfy.cc`
3. Configure os registros DNS (SPF, DKIM, DMARC)
4. Aguarde verificação

---

## 📦 Como Usar

### Uso Direto (React Component)

```typescript
import { sendEmail } from '@/server/lib/email';
import { WelcomeEmail } from '@/emails/components';

await sendEmail({
  to: 'user@example.com',
  subject: 'Bem-vindo!',
  react: WelcomeEmail({
    firstName: 'João',
    email: 'user@example.com'
  })
});
```

### Uso via Service (Recomendado)

```typescript
import { emailService } from '@/server/services/email.service';

await emailService.sendWelcomeEmail({
  to: 'user@example.com',
  firstName: 'João',
  email: 'user@example.com'
});
```

---

## 🧪 Testando Localmente

### Com Preview (React Email Dev)

```bash
# Instalar React Email CLI
bun add -D react-email

# Rodar servidor de preview
bun run email:dev
```

Acesse: `http://localhost:3000`

### Sem Configuração (Development)

Se `RESEND_API_KEY` não estiver definido, o sistema apenas loga no console:

```
[Email] Welcome email would be sent to: user@example.com
```

---

## 🚀 Próximos Templates

- [x] Email de verificação
- [ ] Email de verificação 2FA (TOTP)
- [ ] Relatório semanal de analytics
- [ ] Notificação de link expirando
- [ ] Confirmação de upgrade de plano
- [ ] Alerta de atividade suspeita
- [ ] Convite para workspace/team

---

## 📖 Referências

- [Resend Docs - React Components](https://resend.com/docs/send-with-react)
- [Resend Docs - Next.js](https://resend.com/docs/send-with-nextjs)
- [React Email - Component Library](https://react.email)
