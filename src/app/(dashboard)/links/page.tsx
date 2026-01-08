// src/app/(dashboard)/links/page.tsx
"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QueryError } from "@/components/query-error";
import { LinkCard } from "@/components/shared/link-card";
import { LinkListSkeleton } from "@/components/shared/link-card-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteLink, useLinks } from "@/lib/hooks/use-links";

export default function LinksPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useLinks({
    page,
    perPage: 20,
    search: search || undefined,
  });

  const deleteLink = useDeleteLink();

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este link?")) {
      try {
        await deleteLink.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete link:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Meus Links</h2>
          <p className="text-muted-foreground">
            Gerencie todos os seus links encurtados
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/links/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Link
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Links List */}
      {isLoading && <LinkListSkeleton count={5} />}

      {isError && (
        <QueryError error={error as Error} onRetry={() => refetch()} />
      )}

      {data && (
        <>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">
                {search
                  ? "Nenhum link encontrado"
                  : "Você ainda não tem links. Crie seu primeiro link!"}
              </p>
              {!search && (
                <Button asChild>
                  <Link href="/dashboard/links/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeiro link
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {data.data.map((link) => (
                <LinkCard key={link.id} link={link} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.meta.lastPage > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {data.meta.lastPage}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.meta.hasMore}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
