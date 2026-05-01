import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

const TRADEOFF_IDS = [
  'typeSafety',
  'bunRuntime',
  'mvcPattern',
  'eventDriven',
  'monolith'
] as const;

interface TradeoffsSectionProps {
  t: (key: string) => string;
}

export function TradeoffsSection({ t }: TradeoffsSectionProps) {
  return (
    <section id="tradeoffs" className="scroll-mt-24 border-t bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('tradeoffs.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('tradeoffs.subtitle')}
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {TRADEOFF_IDS.map((id) => (
              <AccordionItem key={id} value={id}>
                <AccordionTrigger className="text-left">
                  <span className="font-semibold">
                    {t(`tradeoffs.decisions.${id}.title`)}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2 text-sm">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      {t('tradeoffs.why')}
                    </h4>
                    <p className="text-muted-foreground">
                      {t(`tradeoffs.decisions.${id}.why`)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      {t('tradeoffs.impact')}
                    </h4>
                    <p className="text-muted-foreground">
                      {t(`tradeoffs.decisions.${id}.impact`)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      {t('tradeoffs.alternatives')}
                    </h4>
                    <p className="text-muted-foreground">
                      {t(`tradeoffs.decisions.${id}.alternatives`)}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
