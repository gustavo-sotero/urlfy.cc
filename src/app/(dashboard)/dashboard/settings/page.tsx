// src/app/(dashboard)/settings/page.tsx
'use client';

import { CheckCircle2, Loader2, Shield } from 'lucide-react';
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
  const { data: session, isPending } = useSession();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize name from session when loaded
  if (session?.user && name === '' && session.user.name) {
    setName(session.user.name);
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      await authClient.updateUser({ name });
      toast.success('Perfil atualizado com sucesso');
    } catch {
      toast.error('Erro ao atualizar perfil');
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
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <Separator />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={session?.user?.email ?? ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              O email não pode ser alterado
            </p>
          </div>
          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </CardContent>
      </Card>

      {/* Security Settings - Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Segurança</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Autenticação de Dois Fatores (2FA)</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione uma camada extra de segurança à sua conta
                </p>
              </div>
              {session?.user?.twoFactorEnabled && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Ativo
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
                    ℹ️ Como administrador, você é obrigado a manter o 2FA ativado
                    para proteger o sistema.
                  </p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">
                Notificações por email
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba atualizações sobre seus links
              </p>
            </div>
            <Switch id="email-notifications" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="analytics-reports">Relatórios semanais</Label>
              <p className="text-sm text-muted-foreground">
                Estatísticas dos seus links por email
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
          <CardTitle className="text-destructive">Zona de perigo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Deletar sua conta removerá todos os seus dados permanentemente
            </p>
            <Button variant="destructive">Deletar conta</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
