import { MessagesTable } from '@/components/admin/messages-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Mensagens - Admin',
  description: 'Gerenciar mensagens enviadas pelo formulário de contato'
};

export default function AdminMessagesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mensagens de Contato</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie mensagens recebidas pelo formulário de contato
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <MessagesTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
