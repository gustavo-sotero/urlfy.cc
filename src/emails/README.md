# Email Service - urlfy.cc

Transactional email system using **Resend** with React templates and **full i18n support** (English and Brazilian Portuguese).

## 🌍 Internationalization

All emails are fully localized and automatically sent in the user's preferred language:

- **User's locale is the source of truth**: The email language is determined by the `user.locale` field in the database
- **Automatic fallback**: If user locale is unavailable or invalid, defaults to English (`en`)
- **Supported locales**: `en` (English), `pt-br` (Portuguese - Brazil)

### How Locale Selection Works

```typescript
// User's locale is read from database
const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

// Service automatically resolves locale with fallback
await emailService.sendWelcomeEmail({
  to: user.email,
  firstName: user.name,
  email: user.email,
  locale: user.locale // 'en', 'pt-br', or undefined (fallback to 'en')
});
```

## 📧 Available Templates

### 1. **WelcomeEmail** - Welcome Email

Sent when a new user confirms their email (after verification).

```typescript
await emailService.sendWelcomeEmail({
  to: 'user@example.com',
  firstName: 'João',
  email: 'user@example.com',
  locale: 'pt-br' // Optional: user's locale
});
```

---

### 2. **EmailVerificationEmail** - Email Verification

Sent after signup to confirm the email address.

```typescript
await emailService.sendEmailVerification({
  to: 'user@example.com',
  firstName: 'João',
  verificationUrl: 'https://urlfy.cc/verify-email?token=abc123',
  expiresInMinutes: 30, // Optional, default: 30
  locale: 'pt-br' // Optional: user's locale
});
```

---

### 3. **PasswordResetEmail** - Password Recovery

Sent when the user requests password reset.

```typescript
await emailService.sendPasswordResetEmail({
  to: 'user@example.com',
  firstName: 'João',
  resetUrl: 'https://urlfy.cc/reset-password?token=abc123',
  expiresInMinutes: 15, // Optional, default: 15
  locale: 'pt-br' // Optional: user's locale
});
```

---

### 4. **DataDeletionConfirmationEmail** - LGPD/GDPR Confirmation

Sent when the user requests data deletion.

```typescript
await emailService.sendDataDeletionConfirmation({
  to: 'user@example.com',
  firstName: 'João',
  requestDate: new Date(),
  deadlineDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
  exportUrl: 'https://urlfy.cc/api/me/export', // Optional
  locale: 'pt-br' // Optional: user's locale
});
```

---

### 5. **LinkBannedEmail** - Ban Notification

Sent when a link is banned for terms violation.

```typescript
await emailService.sendLinkBannedNotification({
  to: 'user@example.com',
  firstName: 'João',
  linkUrl: 'https://example.com/bad-content',
  shortCode: 'abc123',
  bannedReason: 'Spam/Phishing',
  bannedAt: new Date(),
  appealUrl: 'https://urlfy.cc/appeal/abc123',
  locale: 'pt-br' // Optional: user's locale
});
```

---

### 6. **QuotaWarningEmail** - Quota Alert

Sent when the user reaches 80% or 90% of their quota.

```typescript
await emailService.sendQuotaWarning({
  to: 'user@example.com',
  firstName: 'João',
  currentUsage: 90,
  quotaLimit: 100,
  percentUsed: 90,
  upgradeUrl: 'https://urlfy.cc/pricing',
  locale: 'pt-br' // Optional: user's locale
});
```

---

## 🔧 How to Add a New Template

### 1. Create Type Definitions

Add to `src/emails/types.ts`:

```typescript
export interface MyNewEmailPayload {
  firstName: string;
  customField: string;
}

export type EmailPayloadByTemplate = {
  // ... existing templates
  myNewEmail: MyNewEmailPayload;
};

export interface EmailMessages {
  // ... existing templates
  myNewEmail: {
    subject: string;
    previewText: string;
    greeting: string;
    // ... other message keys
  };
}
```

### 2. Add Translations

Add to `src/messages/en/emails.ts` and `src/messages/pt-br/emails.ts`:

```typescript
export const Emails = {
  // ... existing templates
  myNewEmail: {
    subject: 'My Email Subject',
    previewText: 'Preview text',
    greeting: 'Hello, {firstName}!'
    // ... other translations
  }
} as const;
```

### 3. Create Template Component

Create `src/emails/components/MyNewEmail.tsx`:

```tsx
import type { EmailMessages } from '../types';
import { EmailLayout } from './EmailLayout';

interface MyNewEmailProps {
  firstName: string;
  customField: string;
  messages: EmailMessages['myNewEmail'];
}

export function MyNewEmail({
  firstName,
  customField,
  messages: t
}: MyNewEmailProps) {
  return (
    <EmailLayout previewText={t.previewText}>
      <div>
        <h2>{t.greeting.replace('{firstName}', firstName)}</h2>
        <p>{customField}</p>
      </div>
    </EmailLayout>
  );
}
```

### 4. Update Render Function

Add case to `src/emails/render.ts`:

```typescript
export async function renderEmail<T extends EmailTemplate>(
  input: RenderEmailInput<T>
) {
  // ... existing code

  switch (template) {
    // ... existing cases

    case 'myNewEmail': {
      const p = payload as EmailPayloadByTemplate['myNewEmail'];
      const t = emailMessages.myNewEmail;

      subject = t.subject;
      reactElement = MyNewEmail({ ...p, messages: t });
      break;
    }
  }

  // ... rest of function
}
```

### 5. Add Service Method

Add to `src/server/services/email.service.ts`:

```typescript
export const emailService = {
  // ... existing methods

  async sendMyNewEmail(params: {
    to: string;
    firstName: string;
    customField: string;
    locale?: string;
  }) {
    const locale = resolveLocale(params.locale);
    const payload: MyNewEmailPayload = {
      firstName: params.firstName,
      customField: params.customField
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'myNewEmail',
      payload
    });

    return sendEmail({
      to: params.to,
      subject,
      html
    });
  }
};
```

---

## 🌐 Adding a New Locale

### 1. Create Translation File

Create `src/messages/<locale>/emails.ts` with all email translations.

### 2. Update Locale Type

Update `src/i18n/routing.ts`:

```typescript
export const routing = defineRouting({
  locales: ['en', 'pt-br', 'new-locale'] as const,
  defaultLocale: 'en'
});
```

### 3. Update Render Function

Import and add locale to `src/emails/render.ts`:

```typescript
import newLocaleMessages from '@/messages/new-locale';

function getMessages(locale: AppLocale) {
  switch (locale) {
    case 'new-locale':
      return newLocaleMessages;
    case 'pt-br':
      return ptMessages;
    default:
      return enMessages;
  }
}
```

---

## 📐 Best Practices

### Type Safety

- **Always use TypeBox schemas** for validation
- **Infer types** from schemas: `typeof schema.static`
- **Never use `any`** in payload types

### Translations

- **Keep keys consistent** across all locales
- **Use placeholders** like `{firstName}` for dynamic content
- **Test both locales** to ensure parity

### Locale Selection

- **Always pass user locale** from database when available
- **Let the service handle fallback** - never pass `undefined` explicitly
- **Default to English** (`en`) when user locale is unknown

### Testing

```typescript
import { emailService } from '@/server/services/email.service';

// Test with explicit locale
await emailService.sendWelcomeEmail({
  to: 'test@example.com',
  firstName: 'Test',
  email: 'test@example.com',
  locale: 'pt-br' // Force Portuguese
});

// Test with fallback (defaults to 'en')
await emailService.sendWelcomeEmail({
  to: 'test@example.com',
  firstName: 'Test',
  email: 'test@example.com'
  // No locale = English fallback
});
```

---

## 🔍 Troubleshooting

### Email not sending

1. Check `RESEND_API_KEY` environment variable
2. Check `RESEND_FROM` email address
3. Look for errors in server logs

### Wrong language

1. Verify user's `locale` field in database
2. Check if locale is valid (`en` or `pt-br`)
3. Ensure `isAppLocale()` type guard is working

### Missing translations

1. Ensure keys exist in **both** `en/emails.ts` and `pt-br/emails.ts`
2. Check for typos in message keys
3. Verify imports in `src/messages/<locale>/index.ts`

---

## 📚 Related Documentation

- [Architecture Overview](../../docs/architecture/overview.md)
- [PRD](../../docs/prd.md)
- [i18n Routing](../i18n/routing.ts)

---

**Last Updated:** 2026-01-28  
**Maintainer:** Engineering Team
percentUsed: 90,
upgradeUrl: 'https://urlfy.cc/pricing'
});

````

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
````

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
