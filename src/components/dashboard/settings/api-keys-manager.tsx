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
import Link from 'next/link';
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
import type { ApiKeyPublic } from '@/lib/api-client';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey
} from '@/lib/hooks/use-api-keys';

// ═══════════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════

const createKeySchema = z.object({
  name: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
});

type CreateKeyFormData = z.infer<typeof createKeySchema>;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format date to locale string
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Get badge variant for key status
 */
function getStatusBadge(status: ApiKeyPublic['status']) {
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-500">
          Ativa
        </Badge>
      );
    case 'expired':
      return <Badge variant="secondary">Expirada</Badge>;
    case 'revoked':
      return <Badge variant="destructive">Revogada</Badge>;
    case 'quota_exceeded':
      return <Badge variant="outline">Quota Excedida</Badge>;
    default:
      return <Badge variant="secondary">Desconhecido</Badge>;
  }
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  } catch {
    toast.error('Erro ao copiar', {
      description: 'Use Ctrl+C para copiar manualmente'
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
  if (keys.length === 0) {
    return (
      <div className="text-center py-8">
        <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Nenhuma chave de API criada ainda
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Crie sua primeira chave para começar a usar a API
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Chave</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Último uso</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">
                {key.name || 'Sem nome'}
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {key.prefix || 'urlfy_sk_'}****
                </code>
              </TableCell>
              <TableCell>{getStatusBadge(key.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(key.createdAt)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(key.lastUsedAt)}
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
                      <AlertDialogTitle>Revogar Chave de API?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A chave{' '}
                        <strong>{key.name || key.prefix}</strong> será
                        permanentemente revogada e não poderá mais ser usada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRevoke(key.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Revogar
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
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const createMutation = useCreateApiKey();

  const form = useForm<CreateKeyFormData>({
    resolver: zodResolver(createKeySchema),
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
          Gerar nova chave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-125">
        {!createdKey ? (
          // Step 1: Create Form
          <>
            <DialogHeader>
              <DialogTitle>Criar Nova Chave de API</DialogTitle>
              <DialogDescription>
                Dê um nome descritivo para identificar esta chave facilmente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da chave</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Meu App Pessoal"
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
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Criar Chave
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
                Chave Criada com Sucesso!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Copie sua chave agora!
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Esta chave será exibida apenas uma vez. Armazene-a em um
                      local seguro.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sua chave de API</Label>
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
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Concluído
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
  const { data, isLoading } = useApiKeys();
  const revokeMutation = useRevokeApiKey();

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
              Chaves de API
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Use chaves de API para acessar seus links programaticamente
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/api/docs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Documentação
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {data?.total || 0} chave{data?.total !== 1 ? 's' : ''} criada
            {data?.total !== 1 ? 's' : ''}
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
