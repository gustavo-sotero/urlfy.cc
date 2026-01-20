/**
 * ═════════════════════════════════════════════════════════════════════
 * HERO ACTIONS - ADAPTIVE CTA
 * ═════════════════════════════════════════════════════════════════════
 * Primary Call to Action in the hero section
 *
 * Features:
 * - Adapts to user authentication state
 * - Shows loading state to prevent CLS
 * - Responsive button sizing
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/auth.client';

export function HeroActions() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex justify-center gap-4">
        <Button size="lg" disabled className="w-full sm:w-auto">
          <Spinner className="mr-2 h-4 w-4" />
          Carregando...
        </Button>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex justify-center gap-4">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard">Ir para Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-4">
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/signup">Começar gratuitamente</Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
        <Link href="/login">Fazer login</Link>
      </Button>
    </div>
  );
}
