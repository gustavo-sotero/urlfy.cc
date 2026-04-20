import { Shield } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface DashboardBrandProps {
  subtitle: string;
  onNavigate?: () => void;
  className?: string;
  iconClassName?: string;
}

export function DashboardBrand({
  subtitle,
  onNavigate,
  className,
  iconClassName
}: DashboardBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={cn('flex items-center gap-3 font-semibold', className)}
    >
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15',
          iconClassName
        )}
      >
        <Shield className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight">
          urlfy.cc
        </span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}
