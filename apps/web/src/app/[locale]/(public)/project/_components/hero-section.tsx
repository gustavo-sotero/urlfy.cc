import { Code2 } from 'lucide-react';

interface HeroSectionProps {
  t: (key: string) => string;
}

export function HeroSection({ t }: HeroSectionProps) {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
            <Code2 className="h-4 w-4 text-primary" />
            <span>{t('hero.badge')}</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {t('hero.title')}
            <br />
            <span className="text-primary">{t('hero.subtitle')}</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t('hero.description')}
          </p>
        </div>
      </div>
    </section>
  );
}
