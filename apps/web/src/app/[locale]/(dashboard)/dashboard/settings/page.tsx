// src/app/(dashboard)/settings/page.tsx
'use client';

import { CheckCircle2, Info, Loader2, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiKeysManager } from '@/components/dashboard/settings/api-keys-manager';
import { BackupCodes } from '@/components/settings/backup-codes';
import { DisableTwoFactor } from '@/components/settings/disable-two-factor';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authClient, useSession } from '@/lib/auth.client';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const { data: session, isPending } = useSession();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const nameValue = nameDraft ?? session?.user?.name ?? '';

  const handleSaveProfile = async () => {
    const normalizedName = nameValue.trim();

    if (!normalizedName) {
      toast.error(t('profile.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await authClient.updateUser({ name: normalizedName });
      setNameDraft(normalizedName);
      toast.success(t('toasts.profileUpdated'));
    } catch {
      toast.error(t('toasts.profileError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('profile.name')}</Label>
              <Input
                id="name"
                placeholder={t('profile.namePlaceholder')}
                value={nameValue}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.email')}</Label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email ?? ''}
                disabled
                className="h-11 bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t('profile.emailHint')}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('profile.save')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>{t('security.title')}</CardTitle>
          </div>
          <CardDescription>{t('security.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <BackupCodes asDialog={true} />
                <DisableTwoFactor
                  isAdmin={session?.user?.role === 'admin'}
                  onSuccess={() => window.location.reload()}
                />
              </div>
            ) : (
              <div className="mt-4">
                <TwoFactorSetup onSuccess={() => window.location.reload()} />
              </div>
            )}

            {session?.user?.role === 'admin' &&
              session?.user?.twoFactorEnabled && (
                <div className="mt-3 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 dark:bg-blue-900/20">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {t('security.adminWarning')}
                  </p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/90">
        <CardHeader>
          <CardTitle>{t('preferences.title')}</CardTitle>
          <CardDescription>{t('preferences.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
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

      <ApiKeysManager />

      <Card className="border-destructive/70 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t('dangerZone.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('dangerZone.description')}
            </p>
            <Button variant="destructive" className="w-full sm:w-auto">
              {t('dangerZone.deleteAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
