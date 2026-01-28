# Módulo 7: Interfaces de Usuário (Client)

> 📖 [← Módulo 6: Security & Compliance](./module-06-security.md) | [← Plano de Implementação](../implementation-plan.md)

**Requisitos Cobertos:** RF-21 a RF-26, RF-31 a RF-34, Personas 2.1 a 2.3

---

## 1. Visão Geral

Este módulo implementa todas as **interfaces visuais** do urlfy.cc usando Next.js App Router, TailwindCSS e Shadcn/UI.

### Interfaces Principais

- **Landing Page:** Criação rápida de links (guest)
- **Dashboard:** Gestão de links e analytics (user)
- **Unlock Page:** Verificação de senha
- **Preview Page:** Metadados do link
- **Admin Panel:** Gestão global do sistema

---

## 2. Stack de Frontend

| Tecnologia      | Função                 |
| --------------- | ---------------------- |
| Next.js 16+     | App Router, RSC        |
| TailwindCSS     | Styling                |
| Shadcn/UI       | Componentes acessíveis |
| React Hook Form | Formulários            |
| Zod             | Validação              |
| TanStack Query  | Data fetching          |
| Recharts        | Gráficos de analytics  |
| next-themes     | Dark mode              |

---

## 3. Estrutura de Diretórios

```
src/
├── app/
│   ├── (public)/               # Rotas públicas
│   │   ├── page.tsx            # Landing page
│   │   ├── unlock/
│   │   │   └── [code]/
│   │   │       └── page.tsx    # Unlock page
│   │   └── preview/
│   │       └── [code]/
│   │           └── page.tsx    # Preview page
│   ├── (auth)/                 # Rotas de auth
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (dashboard)/            # Rotas protegidas
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Dashboard home
│   │   ├── links/
│   │   │   ├── page.tsx        # Lista de links
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # Criar link
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Detalhes
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   └── (admin)/                # Admin routes
│       ├── layout.tsx
│       └── admin/
│           ├── page.tsx        # Admin dashboard
│           ├── links/
│           │   └── page.tsx    # Busca de links
│           ├── users/
│           │   └── page.tsx    # Gestão de usuários
│           └── audit/
│               └── page.tsx    # Audit logs
├── components/
│   ├── ui/                     # Shadcn components
│   ├── forms/
│   │   ├── link-form.tsx
│   │   ├── unlock-form.tsx
│   │   └── login-form.tsx
│   ├── charts/
│   │   ├── clicks-chart.tsx
│   │   ├── countries-chart.tsx
│   │   └── devices-chart.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── footer.tsx
│   └── shared/
│       ├── link-card.tsx
│       ├── qr-code.tsx
│       └── copy-button.tsx
└── lib/
    ├── api-client.ts           # API wrapper
    └── hooks/
        ├── use-links.ts
        └── use-analytics.ts
```

---

## 4. Landing Page

### 4.1 Componente Principal

```tsx
// src/app/(public)/page.tsx
import { LinkForm } from '@/components/forms/link-form';
import { Features } from '@/components/landing/features';
import { Stats } from '@/components/landing/stats';

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Encurte seus links em segundos
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          URLs curtas, métricas detalhadas e controle total. Sem cadastro para
          começar.
        </p>

        {/* Form de criação rápida */}
        <div className="max-w-xl mx-auto">
          <LinkForm variant="landing" />
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* Stats */}
      <Stats />
    </main>
  );
}
```

### 4.2 Form de Link

```tsx
// src/components/forms/link-form.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/shared/copy-button';
import { createLink } from '@/lib/api-client';

const schema = z.object({
  url: z.url('URL inválida')
});

type FormData = z.infer<typeof schema>;

interface Props {
  variant: 'landing' | 'dashboard';
}

export function LinkForm({ variant }: Props) {
  const [result, setResult] = useState<{ shortUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const response = await createLink(data);
      setResult({ shortUrl: response.data.shortUrl });
    } catch (error) {
      form.setError('url', { message: 'Erro ao criar link' });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="flex gap-2 p-4 bg-muted rounded-lg">
        <Input value={result.shortUrl} readOnly className="flex-1" />
        <CopyButton text={result.shortUrl} />
        <Button variant="outline" onClick={() => setResult(null)}>
          Novo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
      <Input
        placeholder="Cole sua URL aqui..."
        {...form.register('url')}
        className="flex-1"
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Encurtando...' : 'Encurtar'}
      </Button>
    </form>
  );
}
```

---

## 5. Dashboard

### 5.1 Layout

```tsx
// src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 5.2 Lista de Links

```tsx
// src/app/(dashboard)/links/page.tsx
import { Suspense } from 'react';
import { LinksList } from '@/components/links/links-list';
import { LinksFilter } from '@/components/links/links-filter';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { Plus } from 'lucide-react';

export default function LinksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Meus Links</h1>
        <Button asChild>
          <Link href="/links/new">
            <Plus className="w-4 h-4 mr-2" />
            Novo Link
          </Link>
        </Button>
      </div>

      <LinksFilter />

      <Suspense fallback={<div>Carregando...</div>}>
        <LinksList />
      </Suspense>
    </div>
  );
}
```

### 5.3 Link Card

```tsx
// src/components/shared/link-card.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from './copy-button';
import { QRCodeButton } from './qr-code-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  ExternalLink,
  BarChart2,
  Edit,
  Trash
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { LinkResponse } from '@/types/links.types';

interface Props {
  link: LinkResponse;
  onDelete: (id: string) => void;
}

export function LinkCard({ link, onDelete }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline truncate"
            >
              {link.shortUrl}
            </a>
            <CopyButton text={link.shortUrl} size="sm" />
            <QRCodeButton code={link.shortCode} size="sm" />
          </div>

          <p className="text-sm text-muted-foreground truncate">
            {link.originalUrl}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Badge variant={link.isActive ? 'default' : 'secondary'}>
              {link.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
            {link.isProtected && <Badge variant="outline">🔒</Badge>}
            {link.expiresAt && (
              <span className="text-xs text-muted-foreground">
                Expira: {new Date(link.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-2xl font-bold">{link.clicksCount}</p>
            <p className="text-xs text-muted-foreground">cliques</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/links/${link.id}`}>
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/links/${link.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(link.id)}
              >
                <Trash className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
```

---

## 6. Analytics Charts

### 6.1 Clicks Chart

```tsx
// src/components/charts/clicks-chart.tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface Props {
  data: Array<{
    date: string;
    clicks: number;
    uniqueVisitors: number;
  }>;
}

export function ClicksChart({ data }: Props) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short'
              })
            }
          />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            name="Cliques"
          />
          <Line
            type="monotone"
            dataKey="uniqueVisitors"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Visitantes únicos"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 6.2 Devices Chart

```tsx
// src/components/charts/devices-chart.tsx
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

interface Props {
  data: Array<{ deviceType: string; count: number }>;
}

export function DevicesChart({ data }: Props) {
  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="deviceType"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 7. Unlock Page

```tsx
// src/app/(public)/unlock/[code]/page.tsx
import { UnlockForm } from '@/components/forms/unlock-form';

interface Props {
  params: { code: string };
}

export default function UnlockPage({ params }: Props) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Link Protegido</h1>
          <p className="text-muted-foreground">
            Este link está protegido por senha
          </p>
        </div>

        <UnlockForm code={params.code} />
      </div>
    </main>
  );
}
```

---

## 8. Admin Panel

### 8.1 Dashboard Admin

```tsx
// src/app/(admin)/admin/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminStats } from '@/lib/api-client';

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.totalLinks.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Cliques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.totalClicks.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats.totalUsers.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity, alerts, etc. */}
    </div>
  );
}
```

### 8.2 Busca de Links (Admin)

```tsx
// src/app/(admin)/admin/links/page.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { searchLinks, banLink } from '@/lib/api-client';

export default function AdminLinksPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const data = await searchLinks(query);
    setResults(data);
  };

  const handleBan = async (id: string) => {
    await banLink(id);
    handleSearch(); // Refresh
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Busca de Links</h1>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por código, URL ou ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={handleSearch}>Buscar</Button>
      </div>

      <DataTable
        columns={[
          { header: 'Código', accessorKey: 'shortCode' },
          { header: 'URL Original', accessorKey: 'originalUrl' },
          { header: 'Cliques', accessorKey: 'clicksCount' },
          { header: 'Status', accessorKey: 'isActive' },
          {
            header: 'Ações',
            cell: ({ row }) => (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBan(row.original.id)}
                disabled={row.original.isBanned}
              >
                {row.original.isBanned ? 'Banido' : 'Banir'}
              </Button>
            )
          }
        ]}
        data={results}
      />
    </div>
  );
}
```

---

## 9. Temas (Dark Mode)

```tsx
// src/app/layout.tsx
import { ThemeProvider } from 'next-themes';
import './globals.css';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 10. API Client

```typescript
// src/lib/api-client.ts
const API_BASE = '/api';

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error?.message ?? 'Request failed');
  }

  return data.data;
}

export const createLink = (body: { url: string }) =>
  fetcher('/links', {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const getLinks = (params?: URLSearchParams) =>
  fetcher(`/links?${params?.toString() ?? ''}`);

export const getLink = (id: string) => fetcher(`/links/${id}`);

export const getLinkAnalytics = (id: string) =>
  fetcher(`/links/${id}/analytics`);

export const deleteLink = (id: string) =>
  fetcher(`/links/${id}`, { method: 'DELETE' });

// Admin
export const getAdminStats = () => fetcher('/admin/stats');
export const searchLinks = (q: string) => fetcher(`/admin/links?q=${q}`);
export const banLink = (id: string) =>
  fetcher(`/admin/links/${id}/ban`, { method: 'POST' });
```

---

## 11. Custom Hooks (TanStack Query)

### 11.1 useLinks Hook

```typescript
// src/lib/hooks/use-links.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions
} from '@tanstack/react-query';
import * as api from '@/lib/api-client';
import type {
  LinkResponse,
  CreateLinkInput,
  UpdateLinkInput
} from '@/types/links.types';

// Query keys centralizadas
export const linkKeys = {
  all: ['links'] as const,
  lists: () => [...linkKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...linkKeys.lists(), filters] as const,
  details: () => [...linkKeys.all, 'detail'] as const,
  detail: (id: string) => [...linkKeys.details(), id] as const,
  analytics: (id: string) => [...linkKeys.all, 'analytics', id] as const
};

// Hook para listar links
export function useLinks(
  filters: { page?: number; status?: string; search?: string } = {},
  options?: UseQueryOptions<LinkResponse[]>
) {
  return useQuery({
    queryKey: linkKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      return api.getLinks(params);
    },
    staleTime: 30 * 1000, // 30 segundos
    ...options
  });
}

// Hook para buscar link específico
export function useLink(id: string, options?: UseQueryOptions<LinkResponse>) {
  return useQuery({
    queryKey: linkKeys.detail(id),
    queryFn: () => api.getLink(id),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minuto
    ...options
  });
}

// Hook para criar link
export function useCreateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLinkInput) => api.createLink(input),
    onSuccess: () => {
      // Invalida a lista de links
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
    }
  });
}

// Hook para atualizar link
export function useUpdateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLinkInput }) =>
      api.updateLink(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: linkKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
    }
  });
}

// Hook para deletar link
export function useDeleteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
    }
  });
}
```

### 11.2 useAnalytics Hook

```typescript
// src/lib/hooks/use-analytics.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import * as api from '@/lib/api-client';
import type {
  DailyStats,
  CountryStats,
  DeviceStats,
  ReferrerStats
} from '@/types/analytics.types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  link: (linkId: string) => [...analyticsKeys.all, 'link', linkId] as const,
  daily: (linkId: string, days: number) =>
    [...analyticsKeys.link(linkId), 'daily', days] as const,
  countries: (linkId: string) =>
    [...analyticsKeys.link(linkId), 'countries'] as const,
  devices: (linkId: string) =>
    [...analyticsKeys.link(linkId), 'devices'] as const,
  referrers: (linkId: string) =>
    [...analyticsKeys.link(linkId), 'referrers'] as const
};

// Hook para estatísticas diárias
export function useDailyStats(
  linkId: string,
  days: number = 30,
  options?: UseQueryOptions<DailyStats[]>
) {
  return useQuery({
    queryKey: analyticsKeys.daily(linkId, days),
    queryFn: () => api.getDailyStats(linkId, days),
    enabled: !!linkId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    ...options
  });
}

// Hook para estatísticas por país
export function useCountryStats(
  linkId: string,
  options?: UseQueryOptions<CountryStats[]>
) {
  return useQuery({
    queryKey: analyticsKeys.countries(linkId),
    queryFn: () => api.getCountryStats(linkId),
    enabled: !!linkId,
    staleTime: 5 * 60 * 1000,
    ...options
  });
}

// Hook para estatísticas de dispositivos
export function useDeviceStats(
  linkId: string,
  options?: UseQueryOptions<DeviceStats[]>
) {
  return useQuery({
    queryKey: analyticsKeys.devices(linkId),
    queryFn: () => api.getDeviceStats(linkId),
    enabled: !!linkId,
    staleTime: 5 * 60 * 1000,
    ...options
  });
}

// Hook para estatísticas de referrers
export function useReferrerStats(
  linkId: string,
  options?: UseQueryOptions<ReferrerStats[]>
) {
  return useQuery({
    queryKey: analyticsKeys.referrers(linkId),
    queryFn: () => api.getReferrerStats(linkId),
    enabled: !!linkId,
    staleTime: 5 * 60 * 1000,
    ...options
  });
}

// Hook combinado para analytics completo
export function useLinkAnalytics(linkId: string) {
  const daily = useDailyStats(linkId);
  const countries = useCountryStats(linkId);
  const devices = useDeviceStats(linkId);
  const referrers = useReferrerStats(linkId);

  return {
    daily,
    countries,
    devices,
    referrers,
    isLoading:
      daily.isLoading ||
      countries.isLoading ||
      devices.isLoading ||
      referrers.isLoading,
    isError:
      daily.isError || countries.isError || devices.isError || referrers.isError
  };
}
```

---

## 12. Skeleton Loading Components

```typescript
// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
    />
  );
}
```

### 12.1 Link Card Skeleton

```tsx
// src/components/shared/link-card-skeleton.tsx
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LinkCardSkeleton() {
  return (
    <Card className="p-4" aria-busy="true" aria-label="Carregando link...">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* Short URL */}
          <Skeleton className="h-5 w-40" />

          {/* Original URL */}
          <Skeleton className="h-4 w-64" />

          {/* Badges */}
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>

        {/* Click count */}
        <div className="text-right">
          <Skeleton className="h-8 w-12 mb-1" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </Card>
  );
}

export function LinkListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando links">
      {Array.from({ length: count }).map((_, i) => (
        <LinkCardSkeleton key={i} />
      ))}
      <span className="sr-only">Carregando lista de links...</span>
    </div>
  );
}
```

### 12.2 Analytics Skeleton

```tsx
// src/components/charts/analytics-skeleton.tsx
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ChartSkeleton() {
  return (
    <Card className="p-6" aria-busy="true">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-64 w-full" />
    </Card>
  );
}

export function StatsGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-4 gap-4"
      role="status"
      aria-label="Carregando estatísticas"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}
      <span className="sr-only">Carregando métricas...</span>
    </div>
  );
}

export function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatsGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <ChartSkeleton />
    </div>
  );
}
```

### 12.3 Dashboard Skeleton

```tsx
// src/components/layout/dashboard-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Links list */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      <span className="sr-only">Carregando dashboard...</span>
    </div>
  );
}
```

---

## 13. Error Boundary

```tsx
// src/components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Envia para serviço de monitoring (ex: Sentry)
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center"
          role="alert"
        >
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Algo deu errado</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Ocorreu um erro inesperado. Por favor, tente novamente.
          </p>
          <Button onClick={this.handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 text-left w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Detalhes do erro (dev only)
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 13.1 Query Error Fallback

```tsx
// src/components/query-error.tsx
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
}

export function QueryError({
  error,
  onRetry,
  title = 'Erro ao carregar dados'
}: QueryErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 border rounded-lg bg-destructive/5"
      role="alert"
    >
      <AlertCircle className="w-8 h-8 text-destructive mb-3" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 text-center">
        {error.message || 'Ocorreu um erro inesperado'}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
```

### 13.2 Uso com TanStack Query

```tsx
// src/app/(dashboard)/links/page.tsx
'use client';

import { useLinks, useDeleteLink } from '@/lib/hooks/use-links';
import { LinkCard } from '@/components/shared/link-card';
import { LinkListSkeleton } from '@/components/shared/link-card-skeleton';
import { QueryError } from '@/components/query-error';
import { ErrorBoundary } from '@/components/error-boundary';

export default function LinksPage() {
  const { data: links, isLoading, isError, error, refetch } = useLinks();
  const deleteLink = useDeleteLink();

  if (isLoading) {
    return <LinkListSkeleton count={5} />;
  }

  if (isError) {
    return (
      <QueryError
        error={error as Error}
        onRetry={() => refetch()}
        title="Erro ao carregar links"
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {links?.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            onDelete={(id) => deleteLink.mutate(id)}
          />
        ))}

        {links?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Você ainda não criou nenhum link.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
```

---

## 14. Acessibilidade (ARIA)

### 14.1 Diretrizes de Acessibilidade

| Componente         | Atributos ARIA                                          | Notas                  |
| ------------------ | ------------------------------------------------------- | ---------------------- |
| **Modais**         | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Focus trap obrigatório |
| **Formulários**    | `aria-describedby` para erros, `aria-invalid`           | Associar labels        |
| **Botões de ação** | `aria-label` quando só tem ícone                        | Descrever ação         |
| **Loading states** | `aria-busy="true"`, `role="status"`                     | Anunciar carregamento  |
| **Alertas**        | `role="alert"`, `aria-live="polite"`                    | Anunciar mudanças      |
| **Navegação**      | `role="navigation"`, `aria-current="page"`              | Indicar página atual   |
| **Tabelas**        | `scope`, `aria-sort`                                    | Headers semânticos     |
| **Tooltips**       | `aria-describedby`                                      | Associar ao trigger    |

### 14.2 Componentes Acessíveis

```tsx
// src/components/ui/accessible-button.tsx
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
}

export const AccessibleButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(({ isLoading, loadingText, children, disabled, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          <span>{loadingText || 'Carregando...'}</span>
          <span className="sr-only">Por favor, aguarde</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
});

AccessibleButton.displayName = 'AccessibleButton';
```

### 14.3 Form com Acessibilidade

```tsx
// src/components/forms/accessible-form-field.tsx
import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}

export function AccessibleFormField({
  id,
  label,
  error,
  hint,
  required,
  children
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(obrigatório)</span>}
      </Label>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}

      {children || (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          aria-required={required}
          className={cn(error && 'border-destructive')}
        />
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

### 14.4 Skip Link

```tsx
// src/components/layout/skip-link.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
    >
      Pular para o conteúdo principal
    </a>
  );
}
```

### 14.5 Live Region para Notificações

```tsx
// src/components/ui/announcer.tsx
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode
} from 'react';

interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (priority === 'assertive') {
        setAssertiveMessage('');
        setTimeout(() => setAssertiveMessage(message), 100);
      } else {
        setPoliteMessage('');
        setTimeout(() => setPoliteMessage(message), 100);
      }
    },
    []
  );

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}

      {/* Live regions para screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>

      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error('useAnnouncer must be used within AnnouncerProvider');
  }
  return context;
}
```

---

## 15. Temas (Dark Mode)

```tsx
// src/app/layout.tsx
import { ThemeProvider } from 'next-themes';
import { AnnouncerProvider } from '@/components/ui/announcer';
import { SkipLink } from '@/components/layout/skip-link';
import './globals.css';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AnnouncerProvider>
            <SkipLink />
            {children}
          </AnnouncerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 16. Testes E2E (Playwright)

```typescript
// tests/e2e/links.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Links Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new link', async ({ page }) => {
    await page.goto('/links/new');

    await page.fill('[name="url"]', 'https://example.com/test');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Link criado com sucesso')).toBeVisible();
  });

  test('should display link analytics', async ({ page }) => {
    await page.goto('/links');

    // Clica no primeiro link
    await page.click('.link-card >> nth=0');

    // Verifica se gráficos carregam
    await expect(page.getByRole('img', { name: /chart/i })).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/links');

    // Tab através dos elementos
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verifica focus visível
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    );
    expect(focused).toBeTruthy();
  });

  test('should announce loading states to screen readers', async ({ page }) => {
    await page.goto('/links');

    // Verifica live region
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
  });
});
```

---

## 17. Checklist de Implementação

### Páginas

- [ ] Landing page com form de criação rápida
- [ ] Dashboard layout com sidebar
- [ ] Lista de links com paginação
- [ ] Detalhes do link com analytics
- [ ] Formulário completo de criação/edição
- [ ] Unlock page para links protegidos
- [ ] Preview page com OG tags
- [ ] Admin dashboard com KPIs
- [ ] Admin: busca e ban de links
- [ ] Admin: gestão de usuários
- [ ] Admin: audit logs

### Data Fetching

- [ ] useLinks hook (TanStack Query)
- [ ] useLink hook (individual)
- [ ] useCreateLink mutation
- [ ] useUpdateLink mutation
- [ ] useDeleteLink mutation
- [ ] useDailyStats hook
- [ ] useCountryStats hook
- [ ] useDeviceStats hook
- [ ] useLinkAnalytics hook (combinado)

### Componentes de Loading

- [ ] Skeleton base component
- [ ] LinkCardSkeleton
- [ ] LinkListSkeleton
- [ ] ChartSkeleton
- [ ] StatsGridSkeleton
- [ ] AnalyticsDashboardSkeleton
- [ ] DashboardSkeleton

### Error Handling

- [ ] ErrorBoundary component
- [ ] QueryError component
- [ ] Integração com Sentry
- [ ] Tratamento de erros em mutations

### Acessibilidade

- [ ] SkipLink para navegação por teclado
- [ ] AccessibleButton com loading states
- [ ] AccessibleFormField com aria-describedby
- [ ] AnnouncerProvider para live regions
- [ ] useAnnouncer hook
- [ ] Tabela de diretrizes ARIA
- [ ] Atributos role e aria-\* em todos componentes

### UI/UX

- [ ] Charts de analytics (Recharts)
- [ ] Dark mode (next-themes)
- [ ] Componentes acessíveis (Shadcn)
- [ ] Responsivo (mobile-first)
- [ ] Focus visible em todos elementos interativos

### Testes

- [ ] Testes E2E básicos (Playwright)
- [ ] Testes de navegação por teclado
- [ ] Testes de screen reader announcements
