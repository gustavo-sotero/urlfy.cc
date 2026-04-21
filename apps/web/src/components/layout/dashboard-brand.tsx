import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import logoSrc from '@/public/logo.png';

interface DashboardBrandProps {
  subtitle: string;
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
      className={cn('flex items-center gap-3 font-semibold', className)}
    >
      <Image
        src={logoSrc}
        alt="urlfy.cc"
        height={400}
        quality={100}
        className="h-24 w-auto"
      />
      <span className="block text-xs text-muted-foreground">{subtitle}</span>
    </Link>
  );
}
