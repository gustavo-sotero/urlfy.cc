'use client';

import { format } from 'date-fns';
import { Check, Eye, Loader2, Mail, MailOpen, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { ContactMessage, MessageStatus } from '@/lib/api';
import { useAdminMessages, useUpdateMessageStatus } from '@/lib/hooks';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function MessagesTable() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(
    null
  );

  const { data: messagesData, isLoading } = useAdminMessages(statusFilter);
  const messages = messagesData?.data ?? [];

  const updateStatusMutation = useUpdateMessageStatus({
    onSuccess: () => {
      toast.success('Status Updated', {
        description: 'Message status has been updated'
      });
      setSelectedMessage(null);
    },
    onError: (error) => {
      toast.error('Update Failed', {
        description: error.message || 'Unknown error'
      });
    }
  });

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleUpdateStatus = (id: string, newStatus: MessageStatus) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return (
          <Badge variant="default" className="gap-1">
            <Mail className="h-3 w-3" />
            Unread
          </Badge>
        );
      case 'read':
        return (
          <Badge variant="secondary" className="gap-1">
            <MailOpen className="h-3 w-3" />
            Read
          </Badge>
        );
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-4">
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      {messages.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No messages found
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell className="font-mono text-xs">
                  {message.createdAt
                    ? format(new Date(message.createdAt), 'MMM dd, HH:mm')
                    : '-'}
                </TableCell>
                <TableCell className="font-medium">{message.name}</TableCell>
                <TableCell className="text-sm">{message.email}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {message.subject}
                </TableCell>
                <TableCell>{getStatusBadge(message.status)}</TableCell>
                <TableCell>
                  {message.telegramSent === 'yes' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMessage(message)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Message Detail Dialog */}
      <Dialog
        open={!!selectedMessage}
        onOpenChange={() => setSelectedMessage(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
            <DialogDescription>
              Received on{' '}
              {selectedMessage?.createdAt
                ? format(new Date(selectedMessage.createdAt), 'PPP')
                : 'Unknown date'}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Name
                  </div>
                  <div>{selectedMessage.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Email
                  </div>
                  <div>{selectedMessage.email}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Subject
                </div>
                <div className="font-medium">{selectedMessage.subject}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Message
                </div>
                <div className="mt-2 rounded-md border bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap">
                    {selectedMessage.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Status
                  </div>
                  <div>{getStatusBadge(selectedMessage.status)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Telegram Notification
                  </div>
                  <div>
                    {selectedMessage.telegramSent === 'yes' ? (
                      <span className="text-green-600">Sent</span>
                    ) : (
                      <span className="text-red-600">Failed</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedMessage.status !== 'read' && (
                  <Button
                    onClick={() =>
                      handleUpdateStatus(selectedMessage.id, 'read')
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    Mark as Read
                  </Button>
                )}
                {selectedMessage.status !== 'archived' && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateStatus(selectedMessage.id, 'archived')
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    Archive
                  </Button>
                )}
                {selectedMessage.status === 'archived' && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateStatus(selectedMessage.id, 'unread')
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    Unarchive
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
