// src/app/(dashboard)/links/[id]/edit/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import {
  LinkFormCollapsibleSection,
  LinkSummaryPanel
} from '@/components/forms/link-form-panels';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Link, useRouter } from '@/i18n/routing';
import { reportActionError } from '@/lib/browser-logger';
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
  return removeEmptyFields(data) as UpdateLinkInput;
}

function getHostLabel(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function formatPreviewDate(
  value: string | undefined,
  locale: string
): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function EditLinkPage() {
  const t = useTranslations('LinkForm');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  const { data: link, isLoading, isError, error, refetch } = useLink(linkId);
  const updateLink = useUpdateLink();

  // react-hook-form's `values` prop keeps the form in sync with fetched data
  // automatically — no useEffect needed, no extra render cycle.
  const form = useForm<FormData>({
    resolver: zodResolver(createSchema(t)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
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

  const [
    isActiveValue,
    expiresAtValue,
    maxClicksValue,
    metaTitleValue,
    metaDescriptionValue,
    notesValue
  ] = useWatch({
    control: form.control,
    name: [
      'isActive',
      'expiresAt',
      'maxClicks',
      'metaTitle',
      'metaDescription',
      'notes'
    ]
  });

  const expirationLabel = formatPreviewDate(expiresAtValue, intlLocale);
  const limitsLabel = [
    maxClicksValue
      ? t('summary.maxClicksValue', { count: maxClicksValue })
      : null,
    expirationLabel
      ? t('summary.expiresOnValue', { date: expirationLabel })
      : null
  ]
    .filter(Boolean)
    .join(' • ');
  const hasMetadata = Boolean(
    metaTitleValue?.trim() || metaDescriptionValue?.trim()
  );
  const destinationLabel =
    getHostLabel(link?.originalUrl) ||
    link?.originalUrl ||
    t('summary.noDestination');
  const summaryStatus = updateLink.isPending
    ? t('summary.statusSaving')
    : form.formState.isValidating
      ? t('summary.statusValidating')
      : form.formState.isValid
        ? t('summary.statusReady')
        : t('summary.statusNeedsReview');

  const onSubmit = async (data: FormData) => {
    try {
      const payload = transformFormData(data);

      await updateLink.mutateAsync({
        id: linkId,
        data: payload
      });
      router.push(`/dashboard/links/${linkId}`);
    } catch (error) {
      reportActionError(error, {
        action: 'dashboard-update-link',
        linkId
      });
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
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/dashboard/links/${linkId}`}
            aria-label={t('actions.backToDetails')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {t('sections.limits')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('titleEdit')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{link.shortCode}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <Card className="border-border/60 bg-card/90">
            <CardHeader className="space-y-2">
              <CardTitle>{t('sections.limits')}</CardTitle>
              <CardDescription>{t('sections.limitsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {t('summary.shortLink')}
                  </p>
                  <p className="break-all text-sm font-medium text-foreground">
                    {link.shortUrl}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {t('summary.destination')}
                  </p>
                  <p className="break-all text-sm font-medium text-foreground">
                    {destinationLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">{t('fields.isActive.label')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {t('fields.isActive.hint')}
                  </div>
                </div>
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="isActive"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  )}
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

          <LinkSummaryPanel
            title={t('summary.title')}
            description={t('summary.descriptionEdit')}
            status={summaryStatus}
            items={[
              {
                label: t('summary.shortLink'),
                value: link.shortUrl
              },
              {
                label: t('summary.destination'),
                value: destinationLabel
              },
              {
                label: t('summary.linkStatus'),
                value:
                  isActiveValue === false
                    ? t('summary.inactiveValue')
                    : t('summary.activeValue')
              },
              {
                label: t('summary.limits'),
                value: limitsLabel || t('summary.none')
              },
              {
                label: t('summary.currentClicks'),
                value: String(link.clicksCount)
              }
            ]}
            pills={[
              hasMetadata ? t('summary.metadataPill') : null,
              notesValue?.trim() ? t('summary.notesPill') : null
            ].filter((value): value is string => Boolean(value))}
            className="xl:sticky xl:top-24"
            footer={
              <div className="flex flex-col-reverse gap-3 sm:flex-row xl:flex-col">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/links/${linkId}`)}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={updateLink.isPending || form.formState.isValidating}
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
            }
          />

          <div className="space-y-6">
            <LinkFormCollapsibleSection
              title={t('sections.meta')}
              description={t('sections.metaDesc')}
              summary={hasMetadata ? t('summary.metadataPill') : undefined}
              defaultOpen={hasMetadata}
            >
              <div className="space-y-4">
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
              </div>
            </LinkFormCollapsibleSection>

            <LinkFormCollapsibleSection
              title={t('fields.notes.label')}
              description={t('fields.notes.hint')}
              summary={notesValue?.trim() ? t('summary.notesPill') : undefined}
              defaultOpen={Boolean(notesValue?.trim())}
            >
              <div>
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
              </div>
            </LinkFormCollapsibleSection>
          </div>
        </div>
      </form>
    </div>
  );
}
