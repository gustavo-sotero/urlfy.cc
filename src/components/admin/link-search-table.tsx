// src/components/admin/link-search-table.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, CheckCircle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { LinkResponse } from '@/types/links.types';

interface LinkSearchTableProps {
  links: LinkResponse[];
  onBan: (link: LinkResponse) => void;
  onUnban: (link: LinkResponse) => void;
}

export function LinkSearchTable({
  links,
  onBan,
  onUnban
}: LinkSearchTableProps) {
  if (links.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum link encontrado. Tente ajustar sua busca.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>URL Original</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cliques</TableHead>
            <TableHead>Criado</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="font-mono text-sm">
                {link.shortCode}
              </TableCell>
              <TableCell className="max-w-xs">
                <a
                  href={link.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-sm hover:underline"
                  title={link.originalUrl}
                >
                  <span className="truncate">{link.originalUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {link.isBanned ? (
                    <Badge variant="destructive">Banido</Badge>
                  ) : link.isActive ? (
                    <Badge variant="default">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  {link.clicksCount.toLocaleString()}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(link.createdAt), {
                  addSuffix: true,
                  locale: ptBR
                })}
              </TableCell>
              <TableCell className="text-right">
                {link.isBanned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUnban(link)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Reativar
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onBan(link)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Banir
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
