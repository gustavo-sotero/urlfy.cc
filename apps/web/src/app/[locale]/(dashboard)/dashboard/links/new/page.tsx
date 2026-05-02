// src/app/(dashboard)/links/new/page.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  isAliasFormat
} from '@urlfy/contracts/alias-policy';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import {
  LinkFormCollapsibleSection,
  LinkSummaryPanel
} from '@/components/forms/link-form-panels';
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
import { Link, useRouter } from '@/i18n/routing';
import { reportActionError } from '@/lib/browser-logger';
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
  const optionalCustomAlias = z
    .string()
    .trim()
    .refine((value) => {
      if (value === '') {
        return true;
      }

      if (value.length < ALIAS_MIN_LENGTH || value.length > ALIAS_MAX_LENGTH) {
        return false;
      }

      return isAliasFormat(value);
    }, t('validation.invalidAlias'))
    .optional();

  return z.object({
    url: z.string().url(t('validation.invalidUrl')),
    customAlias: optionalCustomAlias,
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

  return removeEmptyFields(transformed) as CreateLinkInput;
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

export default function NewLinkPage() {
  const t = useTranslations('LinkForm');
  const locale = useLocale();
  const router = useRouter();
  const createLink = useCreateLink();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  const form = useForm<FormData>({
    resolver: zodResolver(createSchema(t)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      url: '',
      customAlias: '',
      expiresAt: '',
      maxClicks: undefined,
      password: '',
      metaTitle: '',
      metaDescription: '',
      metaImage: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      notes: '',
      redirectType: String(REDIRECT_TYPES.TEMPORARY) as '301' | '302'
    }
  });

  const [
    urlValue,
    aliasValue,
    redirectType,
    expiresAtValue,
    maxClicksValue,
    passwordValue,
    metaTitleValue,
    metaDescriptionValue,
    utmSourceValue,
    utmMediumValue,
    utmCampaignValue,
    notesValue
  ] = useWatch({
    control: form.control,
    name: [
      'url',
      'customAlias',
      'redirectType',
      'expiresAt',
      'maxClicks',
      'password',
      'metaTitle',
      'metaDescription',
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'notes'
    ]
  });

  const aliasPreview = aliasValue?.trim() || t('summary.autoAlias');
  const destinationLabel = getHostLabel(urlValue) || t('summary.noDestination');
  const redirectLabel =
    redirectType === '301'
      ? `301 - ${t('permanent')}`
      : `302 - ${t('temporary')}`;
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
  const hasTracking = Boolean(
    utmSourceValue?.trim() || utmMediumValue?.trim() || utmCampaignValue?.trim()
  );
  const summaryPills = [
    passwordValue?.trim() ? t('summary.passwordPill') : null,
    limitsLabel ? t('summary.limitsPill') : null,
    hasMetadata ? t('summary.metadataPill') : null,
    hasTracking ? t('summary.trackingPill') : null,
    notesValue?.trim() ? t('summary.notesPill') : null
  ].filter((value): value is string => Boolean(value));
  const summaryStatus = createLink.isPending
    ? t('summary.statusCreating')
    : form.formState.isValidating
      ? t('summary.statusValidating')
      : form.formState.isValid
        ? t('summary.statusReady')
        : t('summary.statusNeedsReview');

  const onSubmit = async (data: FormData) => {
    try {
      const payload = transformFormData(data);
      const link = await createLink.mutateAsync(payload);
      router.push(`/dashboard/links?created=${link.id}`);
    } catch (error) {
      reportActionError(error, {
        action: 'dashboard-create-link'
      });
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/links" aria-label={t('actions.backToList')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {t('sections.basic')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('titleNew')}
          </h2>
          <p className="max-w-2xl text-muted-foreground">{t('subtitleNew')}</p>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 pb-24 xl:pb-0"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="space-y-6">
            <Card className="border-border/60 bg-card/90">
              <CardHeader className="space-y-2">
                <CardTitle>{t('sections.basic')}</CardTitle>
                <CardDescription>{t('sections.basicDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
                    className="h-12"
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
                    className="h-11"
                  />
                </AccessibleFormField>

                <div className="space-y-2">
                  <Label htmlFor="redirectType">
                    {t('fields.redirectType.label')}
                  </Label>
                  <Select
                    value={redirectType}
                    onValueChange={(value) =>
                      form.setValue('redirectType', value as '301' | '302', {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true
                      })
                    }
                  >
                    <SelectTrigger id="redirectType" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">
                        301 - {t('permanent')}
                      </SelectItem>
                      <SelectItem value="302">
                        302 - {t('temporary')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('fields.redirectType.hint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <LinkFormCollapsibleSection
                title={t('sections.advanced')}
                description={t('sections.advancedDesc')}
                summary={limitsLabel || undefined}
                defaultOpen={Boolean(
                  expiresAtValue || maxClicksValue || passwordValue?.trim()
                )}
              >
                <div className="space-y-4">
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
                </div>
              </LinkFormCollapsibleSection>

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
                title={t('sections.tracking')}
                description={t('sections.trackingDesc')}
                summary={hasTracking ? t('summary.trackingPill') : undefined}
                defaultOpen={hasTracking}
              >
                <div>
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
                </div>
              </LinkFormCollapsibleSection>

              <LinkFormCollapsibleSection
                title={t('fields.notes.label')}
                description={t('fields.notes.hint')}
                summary={
                  notesValue?.trim() ? t('summary.notesPill') : undefined
                }
                defaultOpen={Boolean(notesValue?.trim())}
              >
                <div>
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
                </div>
              </LinkFormCollapsibleSection>
            </div>
          </div>

          <LinkSummaryPanel
            title={t('summary.title')}
            description={t('summary.descriptionNew')}
            status={summaryStatus}
            items={[
              {
                label: t('summary.destination'),
                value: destinationLabel
              },
              {
                label: t('summary.shortCode'),
                value: aliasPreview
              },
              {
                label: t('summary.redirect'),
                value: redirectLabel
              },
              {
                label: t('summary.limits'),
                value: limitsLabel || t('summary.none')
              },
              {
                label: t('summary.security'),
                value: passwordValue?.trim()
                  ? t('summary.passwordEnabled')
                  : t('summary.none')
              }
            ]}
            pills={summaryPills}
            className="xl:sticky xl:top-24"
            footer={
              <div className="hidden gap-3 xl:flex xl:flex-col">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard/links')}
                >
                  {t('actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createLink.isPending || form.formState.isValidating}
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
            }
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80 xl:hidden">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push('/dashboard/links')}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                className="w-full"
                disabled={createLink.isPending || form.formState.isValidating}
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
          </div>
        </div>
      </form>
    </div>
  );
}
