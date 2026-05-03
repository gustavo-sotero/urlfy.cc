// src/components/shared/link-card.tsx
'use client';

import {
  BarChart2,
  Calendar,
  Edit,
  ExternalLink,
  Lock,
  MoreHorizontal,
  MousePointer,
  RotateCcw,
  Trash
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/routing';
import type { LinkResponse } from '@/types/links.types';
import { CopyButton } from './copy-button';

interface Props {
  link: LinkResponse;
  onDelete: (id: string) => void;
  mode?: 'live' | 'deleted';
  onRestore?: (id: string) => void;
}

export function LinkCard({ link, onDelete, mode = 'live', onRestore }: Props) {
  const t = useTranslations('Dashboard.linkCard');
  const locale = useLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;
  const isDeletedView = mode === 'deleted';

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
  const isMaxed = link.maxClicks !== null && link.clicksCount >= link.maxClicks;

  return (
    <Card
      className="overflow-hidden border-border/60 bg-card/85 p-4 transition-shadow hover:shadow-md sm:p-5"
      data-testid={`link-card-${link.shortCode}`}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              {isDeletedView ? (
                <span className="min-w-0 break-all font-mono text-sm font-semibold text-muted-foreground">
                  {link.shortUrl}
                </span>
              ) : (
                <>
                  <a
                    href={link.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all font-mono text-sm font-semibold text-primary hover:underline"
                  >
                    {link.shortUrl}
                  </a>
                  <CopyButton text={link.shortUrl} />
                </>
              )}
              {link.isProtected && (
                <Badge variant="outline" className="rounded-full">
                  <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
                  {t('passwordProtected')}
                </Badge>
              )}
            </div>
            <a
              href={link.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all text-sm text-muted-foreground transition-colors hover:text-foreground sm:line-clamp-1"
            >
              {link.originalUrl}
            </a>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('options')}
                className="mt-0.5 h-9 w-9 shrink-0 rounded-full"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isDeletedView ? (
                <DropdownMenuItem onClick={() => onRestore?.(link.id)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('restore')}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/links/${link.id}`}>
                      <BarChart2 className="mr-2 h-4 w-4" />
                      {t('viewAnalytics')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/links/${link.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('edit')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={link.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t('open')}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(link.id)}
                    className="text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    {t('delete')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDeletedView && <Badge variant="secondary">{t('deleted')}</Badge>}
          {!link.isActive && <Badge variant="secondary">{t('inactive')}</Badge>}
          {isExpired && <Badge variant="destructive">{t('expired')}</Badge>}
          {isMaxed && <Badge variant="destructive">{t('limitReached')}</Badge>}
          {link.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2">
            <MousePointer className="h-3.5 w-3.5 shrink-0" />
            <span>
              {link.clicksCount} {t('clicks')}
            </span>
          </div>
          {link.expiresAt && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('expiresIn', {
                  date: new Date(link.expiresAt).toLocaleDateString(intlLocale)
                })}
              </span>
            </div>
          )}
          {link.maxClicks && (
            <div className="rounded-xl bg-muted/45 px-3 py-2">
              <span>{t('limit', { max: link.maxClicks })}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
