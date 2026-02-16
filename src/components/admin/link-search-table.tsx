// src/components/admin/link-search-table.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
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
          No links found. Try adjusting your search.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Original URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Clicks</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                    <Badge variant="destructive">Banned</Badge>
                  ) : link.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
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
                  addSuffix: true
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
                    Reactivate
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onBan(link)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Ban
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
