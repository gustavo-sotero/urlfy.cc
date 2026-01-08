import { BarChart3, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { LinkForm } from "@/components/forms/link-form";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Rápido, simples e poderoso</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Encurte seus links
              <br />
              <span className="text-primary">com inteligência</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Transforme URLs longas em links curtos e memoráveis. Com analytics
              detalhados, proteção por senha e muito mais.
            </p>
          </div>

          {/* Link Form */}
          <div className="mx-auto max-w-2xl">
            <LinkForm variant="landing" />
          </div>

          <p className="text-sm text-muted-foreground">
            Gratuito e sem necessidade de cadastro
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Ultra Rápido</h3>
              <p className="text-sm text-muted-foreground">
                Redirecionamento em menos de 30ms com cache inteligente
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Analytics Completo</h3>
              <p className="text-sm text-muted-foreground">
                Veja de onde vêm seus cliques, dispositivos e muito mais
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Seguro e Privado</h3>
              <p className="text-sm text-muted-foreground">
                Proteção por senha, expiração automática e conformidade LGPD
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-bold">Pronto para mais recursos?</h2>
          <p className="text-muted-foreground">
            Crie uma conta gratuita e tenha acesso a links personalizados,
            analytics detalhados e muito mais.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/signup">Criar conta grátis</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Fazer login</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
