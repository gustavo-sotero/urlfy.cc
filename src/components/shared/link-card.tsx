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
  Trash
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { LinkResponse } from '@/types/links.types';
import { CopyButton } from './copy-button';

interface Props {
  link: LinkResponse;
  onDelete: (id: string) => void;
}

export function LinkCard({ link, onDelete }: Props) {
  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
  const isMaxed = link.maxClicks !== null && link.clicksCount >= link.maxClicks;

  return (
    <Card
      className="p-4 transition-shadow hover:shadow-md"
      data-testid={`link-card-${link.shortCode}`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <a
                href={link.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm font-medium text-primary hover:underline"
              >
                {link.shortUrl}
              </a>
              <CopyButton text={link.shortUrl} />
              {link.isProtected && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <a
              href={link.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-muted-foreground hover:text-foreground"
            >
              {link.originalUrl}
            </a>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Opções do link">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/links/${link.id}`}>
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/links/${link.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(link.id)}
                className="text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          {!link.isActive && <Badge variant="secondary">Inativo</Badge>}
          {isExpired && <Badge variant="destructive">Expirado</Badge>}
          {isMaxed && <Badge variant="destructive">Limite atingido</Badge>}
          {link.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MousePointer className="h-3 w-3" />
            <span>{link.clicksCount} cliques</span>
          </div>
          {link.expiresAt && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                Expira em {new Date(link.expiresAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
          {link.maxClicks && <span>Limite: {link.maxClicks}</span>}
        </div>
      </div>
    </Card>
  );
}
