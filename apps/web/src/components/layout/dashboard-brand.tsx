import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface DashboardBrandProps {
  subtitle?: string;
  onNavigate?: () => void;
  className?: string;
}

export function DashboardBrand({
  subtitle,
  onNavigate,
  className
}: DashboardBrandProps) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={cn('flex min-w-0 items-center gap-3 font-semibold', className)}
    >
      <Image
        src="/logo.png"
        alt="urlfy.cc"
        width={733}
        height={232}
        className="h-8 w-auto max-w-36 object-contain"
      />
      {subtitle && (
        <span className="block min-w-0 truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      )}
    </Link>
  );
}
