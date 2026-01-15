// src/app/(admin)/admin/links/page.tsx
'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BanLinkDialog, LinkSearchTable } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { banLink, searchLinks, unbanLink } from '@/lib/api-client';
import type { LinkResponse } from '@/types/links.types';

export default function AdminLinksPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await searchLinks(query);
      setResults(data);
      toast.success(`${data.length} link(s) encontrado(s)`);
    } catch (error) {
      toast.error('Erro ao buscar links');
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
      handleSearch(); // Refresh results
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
      handleSearch(); // Refresh results
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
              placeholder="Buscar por código, URL ou usuário..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {results.length === 0 && !query ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Digite algo para buscar
            </div>
          ) : (
            <div className="mt-4">
              <LinkSearchTable
                links={results}
                onBan={openBanDialog}
                onUnban={handleUnban}
              />
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
