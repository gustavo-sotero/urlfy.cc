// src/app/(dashboard)/links/[id]/edit/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useLink, useUpdateLink } from '@/lib/hooks/use-links';
import { removeEmptyFields } from '@/lib/utils';
import type { UpdateLinkInput } from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════

const schema = z.object({
  isActive: z.boolean().optional(),
  expiresAt: z.string().optional(),
  maxClicks: z
    .number()
    .positive('O limite deve ser maior que zero')
    .optional()
    .or(z.nan())
    .transform((val) => (Number.isNaN(val) ? undefined : val))
    .optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  metaImage: z
    .string()
    .url('URL de imagem inválida')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val))
    .optional(),
  notes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Transform form data to API payload for update
 * Removes empty fields
 */
function transformFormData(data: FormData): UpdateLinkInput {
  return removeEmptyFields(data) as unknown as UpdateLinkInput;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function EditLinkPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;

  const { data: link, isLoading, isError, error, refetch } = useLink(linkId);
  const updateLink = useUpdateLink();

  const form = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (link) {
      form.reset({
        isActive: link.isActive,
        expiresAt: link.expiresAt
          ? new Date(link.expiresAt).toISOString().slice(0, 16)
          : undefined,
        maxClicks: link.maxClicks || undefined,
        metaTitle: link.metaTitle || undefined,
        metaDescription: link.metaDescription || undefined,
        metaImage: link.metaImage || undefined,
        notes: link.notes || undefined
      });
    }
  }, [link, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = transformFormData(data);

      await updateLink.mutateAsync({
        id: linkId,
        data: payload
      });
      router.push(`/dashboard/links/${linkId}`);
    } catch (error) {
      // Error is already handled by the mutation hook (toast)
      // Log for debugging purposes
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to update link:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !link) {
    return (
      <QueryError
        error={error as Error}
        onRetry={() => refetch()}
        title="Erro ao carregar link"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/dashboard/links/${linkId}`}
            aria-label="Voltar para detalhes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Editar Link</h2>
          <p className="text-muted-foreground">{link.shortCode}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Status & Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Status e Limites</CardTitle>
            <CardDescription>
              Configure disponibilidade e restrições
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Link Ativo</Label>
                <div className="text-sm text-muted-foreground">
                  Desative temporariamente este link
                </div>
              </div>
              <input
                type="checkbox"
                id="isActive"
                {...form.register('isActive')}
                className="h-4 w-4"
              />
            </div>

            <AccessibleFormField
              id="expiresAt"
              label="Data de Expiração"
              error={form.formState.errors.expiresAt?.message}
              hint="Link será desativado automaticamente após esta data"
            >
              <Input
                id="expiresAt"
                type="datetime-local"
                {...form.register('expiresAt')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="maxClicks"
              label="Limite de Cliques"
              error={form.formState.errors.maxClicks?.message}
              hint={`Cliques atuais: ${link.clicksCount}`}
            >
              <Input
                id="maxClicks"
                type="number"
                min="1"
                placeholder="1000"
                {...form.register('maxClicks', { valueAsNumber: true })}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Meta Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Meta Tags (Open Graph)</CardTitle>
            <CardDescription>
              Personalize como o link aparece ao ser compartilhado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="metaTitle"
              label="Título"
              error={form.formState.errors.metaTitle?.message}
              hint="Máximo 60 caracteres"
            >
              <Input
                id="metaTitle"
                maxLength={60}
                placeholder="Título do link"
                {...form.register('metaTitle')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaDescription"
              label="Descrição"
              error={form.formState.errors.metaDescription?.message}
              hint="Máximo 160 caracteres"
            >
              <Textarea
                id="metaDescription"
                maxLength={160}
                placeholder="Descrição do link"
                {...form.register('metaDescription')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaImage"
              label="URL da Imagem"
              error={form.formState.errors.metaImage?.message}
              hint="URL da imagem que será exibida ao compartilhar"
            >
              <Input
                id="metaImage"
                type="url"
                placeholder="https://example.com/image.png"
                {...form.register('metaImage')}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notas Privadas</CardTitle>
            <CardDescription>
              Anotações pessoais sobre este link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccessibleFormField
              id="notes"
              label="Notas"
              error={form.formState.errors.notes?.message}
            >
              <Textarea
                id="notes"
                placeholder="Notas sobre este link..."
                rows={4}
                {...form.register('notes')}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/links/${linkId}`)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={updateLink.isPending}
            aria-busy={updateLink.isPending}
          >
            {updateLink.isPending ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
