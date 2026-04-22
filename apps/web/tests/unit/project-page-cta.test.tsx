import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { SecurityAuthorCtaSection } from '@/app/[locale]/(public)/project/_components/security-author-cta-section';

const translations: Record<string, string> = {
  'security.title': 'Security and Operational Guardrails',
  'security.docsLink': 'Read the security docs ->',
  'security.protections.title': 'Implemented guardrails',
  'security.protections.rateLimit':
    'Rate limiting on public write and redirect surfaces',
  'security.protections.headers': 'Security headers from shared policy',
  'security.protections.csrf': 'CSRF protection on interactive form flows',
  'security.protections.sanitization':
    'Runtime validation and input sanitization near handlers',
  'security.protections.blacklist':
    'Operational review paths for suspicious destinations',
  'security.compliance.title': 'Privacy posture',
  'security.compliance.anonymization':
    'Analytics flows minimize direct IP exposure',
  'security.compliance.consent':
    'Consent-aware analytics in the public web app',
  'security.compliance.export':
    'User export and deletion remain explicit product surfaces',
  'security.compliance.forgotten':
    'Privacy-related flows stay visible instead of implied',
  'security.compliance.retention':
    'Policy details live in docs and PRD instead of this page',
  'author.title': 'Built and maintained by',
  'author.name': 'Gustavo Sotero',
  'author.role': 'Full-stack engineer',
  'author.description':
    'Project framing and runtime choices are exercised in code.',
  'author.portfolio': 'Portfolio',
  'author.github': 'Project Repository',
  'cta.title': 'Start with the README',
  'cta.description':
    'The README is the short entry point. The architecture docs go deeper, and /api/docs reflects the live API surface.',
  'cta.apiDocs': 'Open API docs',
  'cta.repository': 'Repository README'
};

describe('SecurityAuthorCtaSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('prioritizes the README before the API docs in the final CTA', () => {
    render(
      <SecurityAuthorCtaSection t={(key: string) => translations[key] ?? key} />
    );

    const readmeLink = screen.getByRole('link', { name: 'Repository README' });
    const apiDocsLink = screen.getByRole('link', { name: 'Open API docs' });

    expect(readmeLink.getAttribute('href')).toBe(
      'https://github.com/gustavo-sotero/urlfy.cc/blob/main/README.md'
    );
    expect(readmeLink.getAttribute('target')).toBe('_blank');
    expect(apiDocsLink.getAttribute('href')).toBe('/api/docs');
  });
});
