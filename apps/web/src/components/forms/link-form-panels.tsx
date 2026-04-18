'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface LinkFormCollapsibleSectionProps {
  title: string;
  description: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function LinkFormCollapsibleSection({
  title,
  description,
  summary,
  defaultOpen = false,
  children
}: LinkFormCollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="overflow-hidden border-border/60 bg-card/85">
        <CardHeader className="p-0">
          <CollapsibleTrigger className="group flex w-full items-start justify-between gap-4 px-5 py-5 text-left sm:px-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
                {summary ? (
                  <Badge variant="secondary" className="rounded-full">
                    {summary}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="max-w-2xl text-sm leading-6">
                {description}
              </CardDescription>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors group-hover:border-border group-hover:text-foreground">
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </span>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t border-border/60 px-5 py-5 sm:px-6">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface LinkSummaryItem {
  label: string;
  value: string;
}

interface LinkSummaryPanelProps {
  title: string;
  description: string;
  status: string;
  items: LinkSummaryItem[];
  pills?: string[];
  footer?: ReactNode;
  className?: string;
}

export function LinkSummaryPanel({
  title,
  description,
  status,
  items,
  pills,
  footer,
  className
}: LinkSummaryPanelProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 bg-card/90 shadow-sm',
        className
      )}
    >
      <CardHeader className="space-y-3 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            <CardDescription className="text-sm leading-6">
              {description}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit rounded-full">
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
            >
              <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {pills?.length ? (
          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <Badge key={pill} variant="outline" className="rounded-full">
                {pill}
              </Badge>
            ))}
          </div>
        ) : null}

        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
