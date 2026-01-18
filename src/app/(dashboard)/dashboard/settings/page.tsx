// src/app/(dashboard)/settings/page.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
      <Card>
        <CardHeader>
          <CardTitle>Chaves de API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use API keys para acessar programaticamente seus links
          </p>
          <Button variant="outline">Gerar nova chave</Button>
        </CardContent>
      </Card>

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
