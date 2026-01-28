// src/app/(dashboard)/links/new/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Link } from '@/i18n/routing';
import { useCreateLink } from '@/lib/hooks/use-links';
import {
  parseRedirectType,
  REDIRECT_TYPES,
  removeEmptyFields
} from '@/lib/utils';
import type { CreateLinkInput } from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════

function createSchema(t: (key: string) => string) {
  return z.object({
    url: z.string().url(t('validation.invalidUrl')),
    customAlias: z.string().optional(),
    redirectType: z.enum(['301', '302']).optional(),
    expiresAt: z.string().optional(),
    maxClicks: z
      .number()
      .positive(t('validation.positiveNumber'))
      .optional()
      .or(z.nan())
      .transform((val) => (Number.isNaN(val) ? undefined : val))
      .optional(),
    password: z.string().optional(),
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
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional()
  });
}

type FormData = z.infer<ReturnType<typeof createSchema>>;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Transform form data to API payload
 * Removes empty fields and converts types as needed
 */
function transformFormData(data: FormData): CreateLinkInput {
  const transformed = {
    ...data,
    redirectType: parseRedirectType(data.redirectType)
  };

  return removeEmptyFields(transformed) as unknown as CreateLinkInput;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function NewLinkPage() {
  const t = useTranslations('LinkForm');
  const router = useRouter();
  const createLink = useCreateLink();

  const form = useForm<FormData>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      redirectType: String(REDIRECT_TYPES.TEMPORARY) as '301' | '302'
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const payload = transformFormData(data);
      const link = await createLink.mutateAsync(payload);
      router.push(`/dashboard/links?created=${link.id}`);
    } catch (error) {
      // Error is already handled by the mutation hook (toast)
      // Log for debugging purposes
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create link:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/links" aria-label={t('actions.backToList')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('titleNew')}</h2>
          <p className="text-muted-foreground">{t('subtitleNew')}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.basic')}</CardTitle>
            <CardDescription>{t('sections.basicDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="url"
              label={t('fields.url.label')}
              required
              error={form.formState.errors.url?.message}
              hint={t('fields.url.hint')}
            >
              <Input
                id="url"
                type="url"
                placeholder={t('fields.url.placeholder')}
                {...form.register('url')}
                aria-invalid={!!form.formState.errors.url}
                aria-required
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="customAlias"
              label={t('fields.alias.label')}
              error={form.formState.errors.customAlias?.message}
              hint={t('fields.alias.hint')}
            >
              <Input
                id="customAlias"
                placeholder={t('fields.alias.placeholder')}
                {...form.register('customAlias')}
              />
            </AccessibleFormField>

            <div className="space-y-2">
              <Label htmlFor="redirectType">
                {t('fields.redirectType.label')}
              </Label>
              <Select
                value={form.watch('redirectType')}
                onValueChange={(value) =>
                  form.setValue('redirectType', value as '301' | '302')
                }
              >
                <SelectTrigger id="redirectType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 - {t('permanent')}</SelectItem>
                  <SelectItem value="302">302 - {t('temporary')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('fields.redirectType.hint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.advanced')}</CardTitle>
            <CardDescription>{t('sections.advancedDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              hint={t('fields.maxClicks.hint')}
            >
              <Input
                id="maxClicks"
                type="number"
                min="1"
                placeholder="1000"
                {...form.register('maxClicks', { valueAsNumber: true })}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="password"
              label={t('fields.password.label')}
              error={form.formState.errors.password?.message}
              hint={t('fields.password.hint')}
            >
              <Input
                id="password"
                type="password"
                placeholder={t('fields.password.placeholder')}
                {...form.register('password')}
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

        {/* UTM Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.tracking')}</CardTitle>
            <CardDescription>{t('sections.trackingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <AccessibleFormField
                id="utmSource"
                label={t('utmSource')}
                error={form.formState.errors.utmSource?.message}
              >
                <Input
                  id="utmSource"
                  placeholder="twitter"
                  {...form.register('utmSource')}
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="utmMedium"
                label={t('utmMedium')}
                error={form.formState.errors.utmMedium?.message}
              >
                <Input
                  id="utmMedium"
                  placeholder="social"
                  {...form.register('utmMedium')}
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="utmCampaign"
                label={t('utmCampaign')}
                error={form.formState.errors.utmCampaign?.message}
              >
                <Input
                  id="utmCampaign"
                  placeholder="launch"
                  {...form.register('utmCampaign')}
                />
              </AccessibleFormField>
            </div>
          </CardContent>
        </Card>

        {/* Personal Organization */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.security')}</CardTitle>
            <CardDescription>{t('sections.securityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="notes"
              label={t('fields.notes.label')}
              error={form.formState.errors.notes?.message}
              hint={t('fields.notes.hint')}
            >
              <Textarea
                id="notes"
                placeholder={t('notesPlaceholder')}
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
            onClick={() => router.push('/dashboard/links')}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={createLink.isPending}
            aria-busy={createLink.isPending}
          >
            {createLink.isPending ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                {t('actions.create')}...
              </>
            ) : (
              t('actions.create')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
