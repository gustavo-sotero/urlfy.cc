// src/app/(dashboard)/settings/page.tsx
'use client';

import { CheckCircle2, Loader2, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiKeysManager } from '@/components/dashboard/settings/api-keys-manager';
import {
  BackupCodes,
  DisableTwoFactor
} from '@/components/settings/backup-codes';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { authClient, useSession } from '@/lib/auth.client';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const { data: session, isPending } = useSession();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize name from session when loaded
  if (session?.user && name === '' && session.user.name) {
    setName(session.user.name);
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error(t('profile.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await authClient.updateUser({ name });
      toast.success(t('toasts.profileUpdated'));
    } catch {
      toast.error(t('toasts.profileError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Separator />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('profile.name')}</Label>
            <Input
              id="name"
              placeholder={t('profile.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input
              id="email"
              type="email"
              value={session?.user?.email ?? ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {t('profile.emailHint')}
            </p>
          </div>
          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Security Settings - Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>{t('security.title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>{t('security.twoFactor')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('security.twoFactorDescription')}
                </p>
              </div>
              {session?.user?.twoFactorEnabled && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t('security.active')}
                </Badge>
              )}
            </div>

            {session?.user?.twoFactorEnabled ? (
              /* User has 2FA enabled */
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <BackupCodes asDialog={true} />
                <DisableTwoFactor
                  isAdmin={session?.user?.role === 'admin'}
                  onSuccess={() => window.location.reload()}
                />
              </div>
            ) : (
              /* User doesn't have 2FA enabled */
              <div className="mt-4">
                <TwoFactorSetup onSuccess={() => window.location.reload()} />
              </div>
            )}

            {session?.user?.role === 'admin' &&
              session?.user?.twoFactorEnabled && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 mt-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ℹ️ {t('security.adminWarning')}
                  </p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">
                {t('preferences.emailNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('preferences.emailNotificationsDescription')}
              </p>
            </div>
            <Switch id="email-notifications" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="analytics-reports">
                {t('preferences.weeklyReports')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('preferences.weeklyReportsDescription')}
              </p>
            </div>
            <Switch id="analytics-reports" />
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysManager />

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t('dangerZone.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('dangerZone.description')}
            </p>
            <Button variant="destructive">
              {t('dangerZone.deleteAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
