// src/app/(dashboard)/links/[id]/edit/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Link, useRouter } from '@/i18n/routing';
import { useLink, useUpdateLink } from '@/lib/hooks/use-links';
import { removeEmptyFields } from '@/lib/utils';
import type { UpdateLinkInput } from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════

function createSchema(t: (key: string) => string) {
  return z.object({
    isActive: z.boolean().optional(),
    expiresAt: z.string().optional(),
    maxClicks: z
      .number()
      .positive(t('validation.positiveNumber'))
      .optional()
      .or(z.nan())
      .transform((val) => (Number.isNaN(val) ? undefined : val))
      .optional(),
    metaTitle: z.string().max(60, t('validation.maxLength60')).optional(),
    metaDescription: z
      .string()
      .max(160, t('validation.maxLength160'))
      .optional(),
    metaImage: z
      .string()
      .url(t('validation.invalidImage'))
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val))
      .optional(),
    notes: z.string().optional()
  });
}

type FormData = z.infer<ReturnType<typeof createSchema>>;

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
  const t = useTranslations('LinkForm');
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;

  const { data: link, isLoading, isError, error, refetch } = useLink(linkId);
  const updateLink = useUpdateLink();

  // react-hook-form's `values` prop keeps the form in sync with fetched data
  // automatically — no useEffect needed, no extra render cycle.
  const form = useForm<FormData>({
    resolver: zodResolver(createSchema(t)),
    values: link
      ? {
          isActive: link.isActive,
          expiresAt: link.expiresAt
            ? new Date(link.expiresAt).toISOString().slice(0, 16)
            : undefined,
          maxClicks: link.maxClicks || undefined,
          metaTitle: link.metaTitle || undefined,
          metaDescription: link.metaDescription || undefined,
          metaImage: link.metaImage || undefined,
          notes: link.notes || undefined
        }
      : undefined
  });

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
        title={t('errors.loadFailed')}
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
            aria-label={t('actions.backToDetails')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t('titleEdit')}
          </h2>
          <p className="text-muted-foreground">{link.shortCode}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Status & Limits */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.limits')}</CardTitle>
            <CardDescription>{t('sections.limitsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">{t('fields.isActive.label')}</Label>
                <div className="text-sm text-muted-foreground">
                  {t('fields.isActive.hint')}
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
              label={t('fields.expiresAt.label')}
              error={form.formState.errors.expiresAt?.message}
              hint={t('fields.expiresAt.hint')}
            >
              <Input
                id="expiresAt"
                type="datetime-local"
                {...form.register('expiresAt')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="maxClicks"
              label={t('fields.maxClicks.label')}
              error={form.formState.errors.maxClicks?.message}
              hint={t('hints.currentClicks', { count: link.clicksCount })}
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
            <CardTitle>{t('sections.meta')}</CardTitle>
            <CardDescription>{t('sections.metaDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="metaTitle"
              label={t('fields.metaTitle.label')}
              error={form.formState.errors.metaTitle?.message}
              hint={t('fields.metaTitle.hint')}
            >
              <Input
                id="metaTitle"
                maxLength={60}
                placeholder={t('metaTitle')}
                {...form.register('metaTitle')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaDescription"
              label={t('fields.metaDescription.label')}
              error={form.formState.errors.metaDescription?.message}
              hint={t('fields.metaDescription.hint')}
            >
              <Textarea
                id="metaDescription"
                maxLength={160}
                placeholder={t('metaDescription')}
                {...form.register('metaDescription')}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaImage"
              label={t('fields.metaImage.label')}
              error={form.formState.errors.metaImage?.message}
              hint={t('fields.metaImage.hint')}
            >
              <Input
                id="metaImage"
                type="url"
                placeholder={t('metaImagePlaceholder')}
                {...form.register('metaImage')}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('fields.notes.label')}</CardTitle>
            <CardDescription>{t('fields.notes.hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <AccessibleFormField
              id="notes"
              label={t('fields.notes.label')}
              error={form.formState.errors.notes?.message}
            >
              <Textarea
                id="notes"
                placeholder={t('notesPlaceholder')}
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
            {t('actions.cancel')}
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
                {t('actions.save')}...
              </>
            ) : (
              t('actions.save')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
