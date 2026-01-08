-- Migration: Create links and reserved_slugs tables
-- Created: 2026-01-08
-- Module: 03-links

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: reserved_slugs
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reserved_slugs (
  slug VARCHAR(50) PRIMARY KEY,
  reason VARCHAR(255) NOT NULL
);

-- Seed de slugs reservados
INSERT INTO reserved_slugs (slug, reason) VALUES
  -- Sistema
  ('api', 'system_route'),
  ('auth', 'system_route'),
  ('dashboard', 'system_route'),
  ('admin', 'system_route'),
  ('login', 'system_route'),
  ('signup', 'system_route'),
  ('logout', 'system_route'),
  ('settings', 'system_route'),
  ('health', 'system_route'),
  ('metrics', 'system_route'),
  ('docs', 'system_route'),
  ('help', 'system_route'),
  ('support', 'system_route'),
  ('status', 'system_route'),
  ('about', 'system_route'),
  ('pricing', 'system_route'),
  ('blog', 'system_route'),
  -- SEO/Browser
  ('favicon.ico', 'browser'),
  ('robots.txt', 'seo'),
  ('sitemap.xml', 'seo'),
  ('.well-known', 'browser'),
  -- Legal
  ('privacy', 'legal'),
  ('terms', 'legal'),
  ('tos', 'legal'),
  ('legal', 'legal'),
  ('dmca', 'legal'),
  ('abuse', 'legal'),
  ('cookies', 'legal')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- TABLE: links
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,

  -- Core
  original_url TEXT NOT NULL,
  short_code VARCHAR(20) NOT NULL UNIQUE,
  redirect_type SMALLINT NOT NULL DEFAULT 302,

  -- Contadores
  clicks_count INTEGER NOT NULL DEFAULT 0,
  max_clicks INTEGER,

  -- Proteção
  password_hash VARCHAR(255),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  banned_at TIMESTAMPTZ,
  banned_reason VARCHAR(255),

  -- Validade
  expires_at TIMESTAMPTZ,

  -- Meta tags (OG)
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_image VARCHAR(500),

  -- UTM tracking
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Analytics
  last_clicked_at TIMESTAMPTZ,
  qr_generated_at TIMESTAMPTZ,

  -- Audit
  created_by_ip_hash VARCHAR(64),

  -- Organização
  tags VARCHAR(50)[],
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- Lookup principal (mais importante - usado em TODOS os redirects)
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);

-- Listagem de links do usuário (excluindo deletados)
CREATE INDEX IF NOT EXISTS idx_links_user_active 
  ON links(user_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- Ordenação por data de criação
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);

-- Validação no redirect (is_active, is_banned, expires_at)
CREATE INDEX IF NOT EXISTS idx_links_validation 
  ON links(is_active, is_banned, expires_at)
  WHERE deleted_at IS NULL;

-- Job de cleanup de links expirados
CREATE INDEX IF NOT EXISTS idx_links_expires 
  ON links(expires_at) 
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- Busca por tags (GIN para array)
CREATE INDEX IF NOT EXISTS idx_links_tags 
  ON links USING GIN(tags)
  WHERE tags IS NOT NULL;

-- Analytics: último clique
CREATE INDEX IF NOT EXISTS idx_links_last_clicked 
  ON links(last_clicked_at DESC NULLS LAST);

-- User ID (FK lookup)
CREATE INDEX IF NOT EXISTS idx_links_user_id 
  ON links(user_id)
  WHERE user_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at na tabela links
DROP TRIGGER IF EXISTS links_updated_at ON links;
CREATE TRIGGER links_updated_at
  BEFORE UPDATE ON links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- COMMENTS (Documentação)
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON TABLE links IS 'URLs encurtadas com features premium';
COMMENT ON COLUMN links.short_code IS 'Código curto único (7 chars alfanuméricos)';
COMMENT ON COLUMN links.redirect_type IS '301 (permanente) ou 302 (temporário)';
COMMENT ON COLUMN links.clicks_count IS 'Contador denormalizado (atualizado via UPDATE atômico)';
COMMENT ON COLUMN links.max_clicks IS 'Limite de cliques (link desativa quando atingido)';
COMMENT ON COLUMN links.password_hash IS 'Senha criptografada com Argon2id (opcional)';
COMMENT ON COLUMN links.is_banned IS 'Link banido por admin (phishing, spam, etc)';
COMMENT ON COLUMN links.expires_at IS 'Data de expiração (link desativa após esta data)';
COMMENT ON COLUMN links.created_by_ip_hash IS 'Hash SHA-256 do IP do criador (LGPD compliance)';
COMMENT ON COLUMN links.tags IS 'Tags para organização pessoal (array)';
COMMENT ON COLUMN links.deleted_at IS 'Soft delete (pode ser restaurado em 30 dias)';

COMMENT ON TABLE reserved_slugs IS 'Slugs reservados do sistema (api, auth, etc)';

-- ═══════════════════════════════════════════════════════════════════
-- GRANTS (se necessário em produção)
-- ═══════════════════════════════════════════════════════════════════

-- GRANT SELECT, INSERT, UPDATE, DELETE ON links TO urlfy_app;
-- GRANT SELECT ON reserved_slugs TO urlfy_app;
