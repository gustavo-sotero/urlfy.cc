/**
 * ═════════════════════════════════════════════════════════════════════
 * API KEYS MANAGER COMPONENT
 * ═════════════════════════════════════════════════════════════════════
 *
 * Comprehensive UI for managing API keys with:
 * - List of existing keys with status indicators
 * - Create new key dialog with form
 * - One-time display of raw key after creation
 * - Revoke functionality with confirmation
 * - Link to public API documentation
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: plan-apiKeyManagement.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { ApiKeyPublic } from '@/lib/api';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey
} from '@/lib/hooks/use-api-keys';

// ═══════════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════

function createKeySchema(minMsg: string, maxMsg: string) {
  return z.object({
    name: z.string().min(3, minMsg).max(50, maxMsg)
  });
}

type CreateKeyFormData = z.infer<ReturnType<typeof createKeySchema>>;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format date to locale string
 */
function formatDate(
  dateString: string | null,
  locale: string,
  neverLabel: string
): string {
  if (!dateString) return neverLabel;
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;
  return new Date(dateString).toLocaleDateString(intlLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Get badge variant for key status
 */
function getStatusBadge(
  status: ApiKeyPublic['status'],
  labels: {
    active: string;
    expired: string;
    revoked: string;
    quotaExceeded: string;
    unknown: string;
  }
) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-500">
          {labels.active}
        </Badge>
      );
    case 'expired':
      return <Badge variant="secondary">{labels.expired}</Badge>;
    case 'revoked':
      return <Badge variant="destructive">{labels.revoked}</Badge>;
    case 'quota_exceeded':
      return <Badge variant="outline">{labels.quotaExceeded}</Badge>;
    default:
      return <Badge variant="secondary">{labels.unknown}</Badge>;
  }
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(
  text: string,
  successMsg: string,
  errorMsg: string,
  fallbackMsg: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    toast.error(errorMsg, {
      description: fallbackMsg
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * API Key List - Display existing keys in a table
 */
function ApiKeyList({
  keys,
  onRevoke
}: {
  keys: ApiKeyPublic[];
  onRevoke: (id: string) => void;
}) {
  const t = useTranslations('Settings.apiKeysManager');
  const locale = useLocale();

  const statusLabels = {
    active: t('status.active'),
    expired: t('status.expired'),
    revoked: t('status.revoked'),
    quotaExceeded: t('status.quotaExceeded'),
    unknown: t('status.unknown')
  };

  if (keys.length === 0) {
    return (
      <div className="text-center py-8">
        <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">{t('empty.title')}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.key')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.createdAt')}</TableHead>
            <TableHead>{t('table.lastUsed')}</TableHead>
            <TableHead className="text-right">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">
                {key.name || t('table.noName')}
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {key.prefix || 'urlfy_sk_'}****
                </code>
              </TableCell>
              <TableCell>{getStatusBadge(key.status, statusLabels)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(key.createdAt, locale, t('never'))}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(key.lastUsedAt, locale, t('never'))}
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={key.status === 'revoked'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('revoke.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('revoke.description', {
                          name: key.name || key.prefix || ''
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t('revoke.cancel')}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRevoke(key.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t('revoke.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Create API Key Dialog - Form to create new keys
 */
function CreateApiKeyDialog() {
  const t = useTranslations('Settings.apiKeysManager');
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const createMutation = useCreateApiKey({
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const schema = createKeySchema(
    t('validation.nameMin'),
    t('validation.nameMax')
  );

  const form = useForm<CreateKeyFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ''
    }
  });

  const handleSubmit = async (data: CreateKeyFormData) => {
    try {
      const result = await createMutation.mutateAsync({
        name: data.name,
        scopes: ['links:read', 'links:write', 'analytics:read'] // Default scopes
      });

      // Store the raw key to display
      setCreatedKey(result.key);

      // Reset form
      form.reset();
    } catch {
      // Error is already handled by the mutation's onError callback
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCreatedKey(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('generateNew')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        {!createdKey ? (
          // Step 1: Create Form
          <>
            <DialogHeader>
              <DialogTitle>{t('create.title')}</DialogTitle>
              <DialogDescription>{t('create.description')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('create.nameLabel')}</Label>
                  <Input
                    id="name"
                    placeholder={t('create.namePlaceholder')}
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createMutation.isPending}
                >
                  {t('create.cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t('create.submit')}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          // Step 2: Success - Display Raw Key
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                {t('success.created')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {t('success.copyNow')}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      {t('success.oneTimeWarning')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('success.keyLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdKey}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        createdKey,
                        t('success.copied'),
                        t('errors.copyError'),
                        t('errors.copyFallback')
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                {t('success.done')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function ApiKeysManager() {
  const t = useTranslations('Settings.apiKeysManager');
  const { data, isLoading } = useApiKeys();
  const revokeMutation = useRevokeApiKey({
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('documentation')}
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {t('keysCount', { count: data?.total || 0 })}
          </p>
          <CreateApiKeyDialog />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ApiKeyList keys={data?.keys || []} onRevoke={handleRevoke} />
        )}
      </CardContent>
    </Card>
  );
}
