// src/components/settings/disable-two-factor.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth.client';

interface DisableTwoFactorProps {
  isAdmin?: boolean;
  onSuccess: () => void;
}

export function DisableTwoFactor({
  isAdmin = false,
  onSuccess
}: DisableTwoFactorProps) {
  const t = useTranslations('TwoFactor.disable');
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleDisable = async () => {
    if (!password) {
      toast.error(t('errors.passwordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await authClient.twoFactor.disable({
        password
      });

      toast.success(t('success'));
      setOpen(false);
      setPassword('');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isAdmin}
          title={isAdmin ? t('adminWarning') : undefined}
        >
          {t('button')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dialogDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor="disable-password" className="text-sm font-medium">
            {t('confirmPassword')}
          </label>
          <Input
            id="disable-password"
            type="password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisable}
            disabled={isLoading || !password}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('disabling')}
              </>
            ) : (
              t('disableButton')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
