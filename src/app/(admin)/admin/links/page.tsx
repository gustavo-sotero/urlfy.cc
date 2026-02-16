// src/app/(admin)/admin/links/page.tsx
'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BanLinkDialog, LinkSearchTable } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminLinks, useBanLink, useUnbanLink } from '@/lib/hooks';
import type { LinkResponse } from '@/types/links.types';

export default function AdminLinksPage() {
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkResponse | null>(null);

  const {
    data: results,
    isLoading,
    isFetching
  } = useAdminLinks({
    page,
    limit: 20,
    search: activeSearch || undefined
  });

  const banMutation = useBanLink();
  const unbanMutation = useUnbanLink();

  const handleSearch = () => {
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleBanConfirm = async (reason: string) => {
    if (!selectedLink) return;

    try {
      await banMutation.mutateAsync({
        id: selectedLink.id,
        reason
      });
      toast.success('Link banned successfully');
    } catch (error) {
      toast.error('Failed to ban link');
      console.error(error);
      throw error;
    }
  };

  const handleUnban = async (link: LinkResponse) => {
    try {
      await unbanMutation.mutateAsync(link.id);
      toast.success('Link reactivated successfully');
    } catch (error) {
      toast.error('Failed to reactivate link');
      console.error(error);
    }
  };

  const openBanDialog = (link: LinkResponse) => {
    setSelectedLink(link);
    setBanDialogOpen(true);
  };

  const meta = results?.meta ?? {
    total: 0,
    page: 1,
    perPage: 20,
    lastPage: 1,
    hasMore: false
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Links</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by code, URL..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isFetching}>
              <Search className="mr-2 h-4 w-4" />
              {isFetching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="mt-4">
              <LinkSearchTable
                links={results?.data ?? []}
                onBan={openBanDialog}
                onUnban={handleUnban}
              />

              {/* Pagination Controls */}
              {meta.lastPage > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {results?.data.length ?? 0} of {meta.total} links
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(meta.page - 1)}
                      disabled={meta.page === 1 || isFetching}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {meta.page} of {meta.lastPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(meta.page + 1)}
                      disabled={!meta.hasMore || isFetching}
                    >
                      Next
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
