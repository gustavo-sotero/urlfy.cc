// src/components/layout/footer.tsx
'use client';

import { Github, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const t = useTranslations('Common');
  const tNav = useTranslations('Navigation');
  const tFooter = useTranslations('Footer');

  const linkClass =
    'text-muted-foreground hover:text-foreground transition-colors';

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="text-xl font-bold text-primary">
              urlfy.cc
            </Link>
            <p className="text-sm text-muted-foreground">
              {tFooter('description')}
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="font-semibold">{tFooter('product')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className={linkClass}>
                  {t('dashboard')}
                </Link>
              </li>
              <li>
                <Link href="/#features" className={linkClass}>
                  {tNav('features')}
                </Link>
              </li>
              <li>
                <a href="/api/docs" className={linkClass}>
                  {tNav('docs')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="font-semibold">{tFooter('legal')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link href="/help" className={linkClass}>
                  {t('help')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer/Project */}
          <div className="space-y-4">
            <h4 className="font-semibold">{tFooter('project')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/project" className={linkClass}>
                  {tFooter('projectNotes')}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/gustavo-sotero/urlfy.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} inline-flex items-center gap-1`}
                >
                  <Github className="h-3 w-3" />
                  {tFooter('repository')}
                </a>
              </li>
              <li>
                <a
                  href="https://gustavo-sotero.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} inline-flex items-center gap-1`}
                >
                  <Rocket className="h-3 w-3" />
                  {tFooter('portfolio')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} urlfy.cc -{' '}
            <a
              href="https://gustavo-sotero.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Gustavo Sotero
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
