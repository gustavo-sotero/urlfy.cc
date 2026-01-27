import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MessagesTable } from '@/components/admin/messages-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Messages - Admin',
  description: 'Manage contact form submissions'
};

export default function AdminMessagesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Contact Messages</h1>
        <p className="text-muted-foreground">
          View and manage contact form submissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
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
