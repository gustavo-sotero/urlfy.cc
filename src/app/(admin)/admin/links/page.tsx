// src/app/(admin)/admin/links/page.tsx
'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BanLinkDialog, LinkSearchTable } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  banLink,
  listAdminLinks,
  searchLinks,
  unbanLink
} from '@/lib/api-client';
import type { LinkResponse, PaginatedResponse } from '@/types/links.types';

export default function AdminLinksPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaginatedResponse<LinkResponse>>({
    data: [],
    meta: {
      total: 0,
      page: 1,
      perPage: 20,
      lastPage: 1,
      hasMore: false
    }
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkResponse | null>(null);

  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const data = await listAdminLinks({ page: 1, limit: 20 });
      setResults(data);
    } catch (error) {
      toast.error('Erro ao carregar links');
      console.error(error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSearch = async () => {
    if (!query.trim()) {
      // If search is empty, reload initial data
      loadInitialData();
      return;
    }

    setLoading(true);
    try {
      const searchResults = await searchLinks(query);
      setResults({
        data: searchResults,
        meta: {
          total: searchResults.length,
          page: 1,
          perPage: searchResults.length,
          lastPage: 1,
          hasMore: false
        }
      });
      toast.success(`${searchResults.length} link(s) encontrado(s)`);
    } catch (error) {
      toast.error('Erro ao buscar links');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (page: number) => {
    setLoading(true);
    try {
      const data = await listAdminLinks({
        page,
        limit: results.meta.perPage,
        search: query || undefined
      });
      setResults(data);
    } catch (error) {
      toast.error('Erro ao carregar página');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanConfirm = async (reason: string) => {
    if (!selectedLink) return;

    try {
      await banLink(selectedLink.id, reason);
      toast.success('Link banido com sucesso');
      loadInitialData(); // Refresh results
    } catch (error) {
      toast.error('Erro ao banir link');
      console.error(error);
      throw error;
    }
  };

  const handleUnban = async (link: LinkResponse) => {
    try {
      await unbanLink(link.id);
      toast.success('Link reativado com sucesso');
      loadInitialData(); // Refresh results
    } catch (error) {
      toast.error('Erro ao reativar link');
      console.error(error);
    }
  };

  const openBanDialog = (link: LinkResponse) => {
    setSelectedLink(link);
    setBanDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gerenciar Links</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por código, URL..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {initialLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="mt-4">
              <LinkSearchTable
                links={results.data}
                onBan={openBanDialog}
                onUnban={handleUnban}
              />

              {/* Pagination Controls */}
              {results.meta.lastPage > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {results.data.length} de {results.meta.total}{' '}
                    links
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(results.meta.page - 1)}
                      disabled={results.meta.page === 1 || loading}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {results.meta.page} de {results.meta.lastPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(results.meta.page + 1)}
                      disabled={!results.meta.hasMore || loading}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BanLinkDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        link={selectedLink}
        onConfirm={handleBanConfirm}
      />
    </div>
  );
}
