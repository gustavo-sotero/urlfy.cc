// src/app/(dashboard)/links/new/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AccessibleFormField } from "@/components/forms/accessible-form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLink } from "@/lib/hooks/use-links";

const schema = z.object({
  url: z.string().url("URL inválida"),
  customAlias: z.string().optional(),
  redirectType: z.enum(["301", "302"]).optional(),
  expiresAt: z.string().optional(),
  maxClicks: z.number().optional(),
  password: z.string().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  metaImage: z.string().url("URL de imagem inválida").optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewLinkPage() {
  const router = useRouter();
  const createLink = useCreateLink();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      redirectType: "302",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const link = await createLink.mutateAsync({
        ...data,
        redirectType: data.redirectType
          ? (Number.parseInt(data.redirectType, 10) as 301 | 302)
          : undefined,
      });
      router.push(`/dashboard/links?created=${link.id}`);
    } catch (error) {
      console.error("Failed to create link:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/links" aria-label="Voltar para lista de links">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Criar Novo Link</h2>
          <p className="text-muted-foreground">
            Preencha os campos abaixo para criar um link encurtado
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>
              URL de destino e configurações principais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="url"
              label="URL de Destino"
              required
              error={form.formState.errors.url?.message}
              hint="Cole a URL completa que você deseja encurtar"
            >
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/very-long-url"
                {...form.register("url")}
                aria-invalid={!!form.formState.errors.url}
                aria-required
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="customAlias"
              label="Alias Personalizado"
              error={form.formState.errors.customAlias?.message}
              hint="Deixe vazio para gerar automaticamente"
            >
              <Input
                id="customAlias"
                placeholder="meu-link"
                {...form.register("customAlias")}
              />
            </AccessibleFormField>

            <div className="space-y-2">
              <Label htmlFor="redirectType">Tipo de Redirecionamento</Label>
              <Select
                value={form.watch("redirectType")}
                onValueChange={(value) =>
                  form.setValue("redirectType", value as "301" | "302")
                }
              >
                <SelectTrigger id="redirectType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 - Permanente</SelectItem>
                  <SelectItem value="302">302 - Temporário</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                301: Link permanente (melhor para SEO). 302: Link temporário
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Avançadas</CardTitle>
            <CardDescription>Expiração, limites e proteção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="expiresAt"
              label="Data de Expiração"
              error={form.formState.errors.expiresAt?.message}
              hint="Link será desativado automaticamente após esta data"
            >
              <Input
                id="expiresAt"
                type="datetime-local"
                {...form.register("expiresAt")}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="maxClicks"
              label="Limite de Cliques"
              error={form.formState.errors.maxClicks?.message}
              hint="Link será desativado após atingir este número de cliques"
            >
              <Input
                id="maxClicks"
                type="number"
                min="1"
                placeholder="1000"
                {...form.register("maxClicks", { valueAsNumber: true })}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="password"
              label="Senha de Proteção"
              error={form.formState.errors.password?.message}
              hint="Usuários precisarão desta senha para acessar o link"
            >
              <Input
                id="password"
                type="password"
                placeholder="Digite uma senha forte"
                {...form.register("password")}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Meta Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Meta Tags (Open Graph)</CardTitle>
            <CardDescription>
              Personalize como o link aparece ao ser compartilhado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="metaTitle"
              label="Título"
              error={form.formState.errors.metaTitle?.message}
              hint="Máximo 60 caracteres"
            >
              <Input
                id="metaTitle"
                maxLength={60}
                placeholder="Título do link"
                {...form.register("metaTitle")}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaDescription"
              label="Descrição"
              error={form.formState.errors.metaDescription?.message}
              hint="Máximo 160 caracteres"
            >
              <Textarea
                id="metaDescription"
                maxLength={160}
                placeholder="Descrição do link"
                {...form.register("metaDescription")}
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="metaImage"
              label="URL da Imagem"
              error={form.formState.errors.metaImage?.message}
              hint="URL da imagem que será exibida ao compartilhar"
            >
              <Input
                id="metaImage"
                type="url"
                placeholder="https://example.com/image.png"
                {...form.register("metaImage")}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* UTM Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros UTM</CardTitle>
            <CardDescription>Para rastreamento de campanhas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <AccessibleFormField
                id="utmSource"
                label="Source"
                error={form.formState.errors.utmSource?.message}
              >
                <Input
                  id="utmSource"
                  placeholder="twitter"
                  {...form.register("utmSource")}
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="utmMedium"
                label="Medium"
                error={form.formState.errors.utmMedium?.message}
              >
                <Input
                  id="utmMedium"
                  placeholder="social"
                  {...form.register("utmMedium")}
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="utmCampaign"
                label="Campaign"
                error={form.formState.errors.utmCampaign?.message}
              >
                <Input
                  id="utmCampaign"
                  placeholder="launch"
                  {...form.register("utmCampaign")}
                />
              </AccessibleFormField>
            </div>
          </CardContent>
        </Card>

        {/* Personal Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organização Pessoal</CardTitle>
            <CardDescription>Tags e notas privadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibleFormField
              id="notes"
              label="Notas"
              error={form.formState.errors.notes?.message}
              hint="Anotações privadas sobre este link"
            >
              <Textarea
                id="notes"
                placeholder="Notas sobre este link..."
                {...form.register("notes")}
              />
            </AccessibleFormField>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/links")}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createLink.isPending}
            aria-busy={createLink.isPending}
          >
            {createLink.isPending ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Criando...
              </>
            ) : (
              "Criar Link"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
