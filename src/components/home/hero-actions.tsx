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

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Link } from '@/i18n/routing';
import { useAuthState } from '@/lib/session-provider';

export function HeroActions() {
  const { isAuthenticated, isPending } = useAuthState();

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

  if (isAuthenticated) {
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
