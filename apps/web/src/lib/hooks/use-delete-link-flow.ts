import { useState } from 'react';
import { useDeleteLink } from './use-links';

interface UseDeleteLinkFlowOptions {
  onSuccess?: (id: string) => void;
  onError?: (err: unknown) => void;
}

interface UseDeleteLinkFlowReturn {
  /** ID of the link pending deletion, or null when no dialog is open. */
  deleteTarget: string | null;
  /** Whether the confirm dialog should be open. */
  isDialogOpen: boolean;
  /** Whether the delete mutation is in flight. */
  isPending: boolean;
  /** Open the confirm dialog for the given link id. */
  startDelete: (id: string) => void;
  /** Cancel the pending deletion and close the dialog. */
  cancelDelete: () => void;
  /** Execute the mutation for the current deleteTarget. */
  confirmDelete: () => Promise<void>;
}

/**
 * Shared hook that encapsulates the full delete-link flow:
 * state management, mutation call, and success/error callbacks.
 *
 * Usage:
 *   const flow = useDeleteLinkFlow({ onSuccess: () => toast.success('Deleted') });
 *   <ConfirmDialog open={flow.isDialogOpen} onOpenChange={(o) => !o && flow.cancelDelete()} ... />
 */
export function useDeleteLinkFlow({
  onSuccess,
  onError
}: UseDeleteLinkFlowOptions = {}): UseDeleteLinkFlowReturn {
  const deleteLink = useDeleteLink();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function startDelete(id: string) {
    setDeleteTarget(id);
  }

  function cancelDelete() {
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    try {
      await deleteLink.mutateAsync(id);
      setDeleteTarget(null);
      onSuccess?.(id);
    } catch (err) {
      setDeleteTarget(null);
      onError?.(err);
    }
  }

  return {
    deleteTarget,
    isDialogOpen: deleteTarget !== null,
    isPending: deleteLink.isPending,
    startDelete,
    cancelDelete,
    confirmDelete
  };
}
