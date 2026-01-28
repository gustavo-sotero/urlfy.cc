import { Github, Linkedin, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/contact-form';
import { RevealSection } from '@/components/shared/reveal-section';

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Entre em contato com a equipe urlfy.cc. Estamos aqui para ajudar!'
};

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 scroll-smooth">
      {/* Header */}
      <RevealSection>
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            Entre em Contato
          </h1>
          <p className="text-lg text-muted-foreground">
            Tem alguma dúvida ou sugestão? Adoraríamos ouvir você.
          </p>
        </div>
      </RevealSection>

      <RevealSection delay={200}>
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-semibold">
                Envie-nos uma mensagem
              </h2>
              <ContactForm />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Social Links */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-semibold">Conecte-se conosco</h3>
              <div className="space-y-3">
                <a
                  href="https://github.com/yourusername/urlfy.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Github className="h-5 w-5" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Linkedin className="h-5 w-5" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://t.me/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Telegram</span>
                </a>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold">Links Rápidos</h3>
              <div className="space-y-2">
                <a
                  href="/help"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Central de Ajuda
                </a>
                <a
                  href="/about"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Sobre Nós
                </a>
                <a
                  href="/terms"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Termos de Serviço
                </a>
                <a
                  href="/privacy"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Política de Privacidade
                </a>
              </div>
            </div>

            {/* Response Time Notice */}
            <div className="rounded-lg border bg-muted/50 p-6">
              <p className="text-sm text-muted-foreground">
                Normalmente respondemos em até 24-48 horas durante dias úteis.
              </p>
            </div>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
