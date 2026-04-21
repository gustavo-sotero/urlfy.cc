// src/app/(admin)/admin/users/page.tsx
'use client';

import { Loader2, MoreHorizontal, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { QueryError } from '@/components/query-error';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { UserResponse } from '@/lib/api';
import { useBanUser, useUnbanUser, useUsers } from '@/lib/hooks/use-admin';

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<UserResponse | null>(null);

  const { data, isLoading, isError, error, refetch } = useUsers({
    page,
    limit: 20,
    search: searchQuery || undefined
  });

  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const confirmBan = async () => {
    if (!banTarget) return;
    try {
      await banUser.mutateAsync(banTarget.id);
      toast.success('Usuário banido com sucesso');
    } catch {
      toast.error('Erro ao banir usuário');
    } finally {
      setBanTarget(null);
    }
  };

  const handleUnban = async (user: UserResponse) => {
    try {
      await unbanUser.mutateAsync(user.id);
      toast.success('Usuário reativado com sucesso');
    } catch {
      toast.error('Erro ao reativar usuário');
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={banTarget !== null}
        onOpenChange={(open) => !open && setBanTarget(null)}
        title="Banir usuário"
        description={`Tem certeza que deseja banir ${banTarget?.email}?`}
        onConfirm={confirmBan}
        confirmText="Banir usuário"
        loading={banUser.isPending}
      />
      <div>
        <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, bloqueios e quotas de links
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por e-mail, nome ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <QueryError
              error={error as Error}
              onRetry={refetch}
              title="Erro ao carregar usuários"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Acesso admin</TableHead>
                    <TableHead>Quota</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : data?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.email}
                        </TableCell>
                        <TableCell>{user.name || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isAdmin ? 'default' : 'secondary'}
                          >
                            {user.isAdmin ? 'Autorizado' : 'Sem acesso'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.linksQuota}</TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Ações do usuário"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setBanTarget(user)}
                                className="text-destructive"
                              >
                                Banir usuário
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUnban(user)}
                              >
                                Reativar usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.meta.lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
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
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.meta.hasMore}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
