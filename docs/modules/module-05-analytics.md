# Módulo 5: Analytics & Processamento de Dados

> 📖 [← Módulo 4: Redirect Engine](./module-04-redirect.md) | [Módulo 6: Security & Compliance →](./module-06-security.md)

**Requisitos Cobertos:** RF-17 a RF-21, RNF-07, RNF-11, DB Schema (analytics_events, link_clicks_daily)

---

## 1. Visão Geral

Este módulo implementa o **sistema de analytics** do urlfy.cc, responsável por:

- Processamento assíncrono de eventos de clique via BullMQ
- Enriquecimento de dados (GeoIP, User-Agent parsing)
- Anonimização de IPs (LGPD/GDPR compliant)
- Agregação diária para dashboards
- Retenção de dados e cleanup automático

---

## 2. Arquitetura

```
┌─────────────────┐
│ Redirect Engine │
│  (Módulo 4)     │
└────────┬────────┘
         │ enqueue
         ▼
┌─────────────────────────────────────────────────────┐
│                    BullMQ                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ analytics:  │  │ analytics:  │  │ analytics:  │ │
│  │   clicks    │  │ aggregation │  │   cleanup   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │         │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐ │
│  │   Worker    │  │   Worker    │  │   Worker    │ │
│  │   (click)   │  │  (daily)    │  │  (cleanup)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼───────────────┼───────────────┼──────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────┐
│               PostgreSQL                            │
│  ┌───────────────────┐  ┌───────────────────────┐  │
│  │  analytics_events │  │  link_clicks_daily    │  │
│  │   (partitioned)   │  │    (aggregated)       │  │
│  └───────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
          ▲
          │ GeoIP lookup
┌─────────┴─────────┐
│  MaxMind GeoLite2 │
│   (offline DB)    │
└───────────────────┘
```

---

## 3. Estrutura de Diretórios

```
src/
├── server/
│   ├── services/
│   │   ├── analytics.service.ts      # Lógica de analytics
│   │   ├── geoip.service.ts          # GeoIP lookup
│   │   └── useragent.service.ts      # UA parsing
│   ├── workers/
│   │   ├── click.worker.ts           # Processa cliques
│   │   ├── aggregation.worker.ts     # Agregação diária
│   │   └── cleanup.worker.ts         # Cleanup de dados
│   ├── jobs/
│   │   └── scheduler.ts              # Cron jobs
│   └── lib/
│       └── queue.ts                  # Configuração BullMQ
├── db/
│   └── schema/
│       └── analytics.ts              # Schema analytics
└── types/
    └── analytics.types.ts            # Tipos
```

---

## 4. Schema do Banco de Dados

### 4.1 Tabela de Eventos (Particionada)

```typescript
// src/db/schema/analytics.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  date,
  pgEnum
} from 'drizzle-orm/pg-core';

export const deviceTypeEnum = pgEnum('device_type', [
  'desktop',
  'mobile',
  'tablet'
]);

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  linkId: uuid('link_id')
    .notNull()
    .references(() => links.id),
  visitorHash: varchar('visitor_hash', { length: 64 }).notNull(),
  country: varchar('country', { length: 2 }),
  city: varchar('city', { length: 100 }),
  browser: varchar('browser', { length: 50 }),
  browserVersion: varchar('browser_version', { length: 20 }),
  os: varchar('os', { length: 50 }),
  osVersion: varchar('os_version', { length: 20 }),
  deviceType: deviceTypeEnum('device_type'),
  referrer: text('referrer'),
  referrerDomain: varchar('referrer_domain', { length: 255 }),
  utmSource: varchar('utm_source', { length: 100 }),
  utmMedium: varchar('utm_medium', { length: 100 }),
  utmCampaign: varchar('utm_campaign', { length: 100 }),
  isBot: boolean('is_bot').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabela de agregação diária
export const linkClicksDaily = pgTable(
  'link_clicks_daily',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => links.id),
    date: date('date').notNull(),
    clicks: integer('clicks').default(0).notNull(),
    uniqueVisitors: integer('unique_visitors').default(0).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.linkId, table.date] })
  })
);
```

### 4.2 SQL de Particionamento

```sql
-- Particionamento por range mensal
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES links(id),
  visitor_hash VARCHAR(64) NOT NULL,
  country VARCHAR(2),
  city VARCHAR(100),
  browser VARCHAR(50),
  browser_version VARCHAR(20),
  os VARCHAR(50),
  os_version VARCHAR(20),
  device_type device_type,
  referrer TEXT,
  referrer_domain VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  is_bot BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
) PARTITION BY RANGE (created_at);

-- Criação automática de partições (script)
CREATE TABLE analytics_events_2026_01
  PARTITION OF analytics_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 4.3 Índices para Performance

```sql
-- Índice para consultas por link_id (mais comum)
CREATE INDEX idx_analytics_link_id ON analytics_events (link_id);

-- Índice para consultas por período
CREATE INDEX idx_analytics_created_at ON analytics_events (created_at DESC);

-- Índice composto para filtros combinados
CREATE INDEX idx_analytics_link_time ON analytics_events (link_id, created_at DESC);

-- Índice para análise por país
CREATE INDEX idx_analytics_country ON analytics_events (country) WHERE country IS NOT NULL;

-- Índice para filtro de bots
CREATE INDEX idx_analytics_not_bot ON analytics_events (link_id, created_at) WHERE is_bot = FALSE;

-- Índice para referrer domain
CREATE INDEX idx_analytics_referrer ON analytics_events (referrer_domain) WHERE referrer_domain IS NOT NULL;

-- Índice para UTM tracking
CREATE INDEX idx_analytics_utm ON analytics_events (utm_source, utm_medium, utm_campaign)
  WHERE utm_source IS NOT NULL;

-- Índice para agregação diária
CREATE INDEX idx_clicks_daily_date ON link_clicks_daily (date DESC);
CREATE INDEX idx_clicks_daily_link ON link_clicks_daily (link_id, date DESC);
```

### 4.4 Script de Criação Automática de Partições

```typescript
// src/db/scripts/partition-manager.ts
import { sql } from 'drizzle-orm';
import { db } from '@/db';

interface PartitionInfo {
  name: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Gerencia partições da tabela analytics_events
 * - Cria partições futuras automaticamente
 * - Remove partições antigas baseado na política de retenção
 */
export class PartitionManager {
  private readonly tableName = 'analytics_events';
  private readonly retentionMonths = 12; // Política de retenção
  private readonly lookaheadMonths = 3; // Criar partições futuras

  /**
   * Executa manutenção completa de partições
   */
  async runMaintenance(): Promise<void> {
    console.log('[PartitionManager] Iniciando manutenção de partições...');

    const existingPartitions = await this.listPartitions();
    console.log(
      `[PartitionManager] ${existingPartitions.length} partições existentes`
    );

    // Cria partições futuras
    await this.createFuturePartitions(existingPartitions);

    // Remove partições antigas
    await this.dropOldPartitions(existingPartitions);

    console.log('[PartitionManager] Manutenção concluída');
  }

  /**
   * Lista partições existentes
   */
  async listPartitions(): Promise<PartitionInfo[]> {
    const result = await db.execute(sql`
      SELECT 
        c.relname AS partition_name,
        pg_get_expr(c.relpartbound, c.oid, true) AS partition_bounds
      FROM pg_class c
      JOIN pg_inherits i ON c.oid = i.inhrelid
      JOIN pg_class p ON i.inhparent = p.oid
      WHERE p.relname = ${this.tableName}
      ORDER BY c.relname
    `);

    return result.rows.map((row: any) => {
      const bounds = this.parsePartitionBounds(row.partition_bounds);
      return {
        name: row.partition_name,
        startDate: bounds.start,
        endDate: bounds.end
      };
    });
  }

  /**
   * Cria partições para os próximos N meses
   */
  async createFuturePartitions(existing: PartitionInfo[]): Promise<void> {
    const existingNames = new Set(existing.map((p) => p.name));
    const now = new Date();

    for (let i = 0; i <= this.lookaheadMonths; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const partitionName = this.getPartitionName(targetDate);

      if (existingNames.has(partitionName)) {
        continue;
      }

      const startDate = this.formatDate(targetDate);
      const endDate = this.formatDate(
        new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1)
      );

      console.log(`[PartitionManager] Criando partição: ${partitionName}`);

      await db.execute(
        sql.raw(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF ${this.tableName}
        FOR VALUES FROM ('${startDate}') TO ('${endDate}')
      `)
      );

      // Cria índices locais na nova partição
      await this.createPartitionIndexes(partitionName);
    }
  }

  /**
   * Remove partições mais antigas que a política de retenção
   */
  async dropOldPartitions(existing: PartitionInfo[]): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - this.retentionMonths);

    for (const partition of existing) {
      if (partition.endDate < cutoffDate) {
        console.log(
          `[PartitionManager] Removendo partição antiga: ${partition.name}`
        );

        // Primeiro detach, depois drop (mais seguro)
        await db.execute(
          sql.raw(`
          ALTER TABLE ${this.tableName} 
          DETACH PARTITION ${partition.name}
        `)
        );

        await db.execute(
          sql.raw(`
          DROP TABLE ${partition.name}
        `)
        );
      }
    }
  }

  /**
   * Cria índices locais em uma partição
   */
  private async createPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS ${partitionName}_link_id_idx ON ${partitionName} (link_id)`,
      `CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at DESC)`
    ];

    for (const idx of indexes) {
      await db.execute(sql.raw(idx));
    }
  }

  /**
   * Gera nome da partição baseado na data
   */
  private getPartitionName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${this.tableName}_${year}_${month}`;
  }

  /**
   * Formata data para SQL
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse bounds da partição
   */
  private parsePartitionBounds(bounds: string): { start: Date; end: Date } {
    // Format: FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    const matches = bounds.match(/FROM \('([^']+)'\) TO \('([^']+)'\)/);
    if (!matches) {
      throw new Error(`Invalid partition bounds: ${bounds}`);
    }
    return {
      start: new Date(matches[1]),
      end: new Date(matches[2])
    };
  }
}

// CLI para execução manual
if (import.meta.main) {
  const manager = new PartitionManager();
  await manager.runMaintenance();
  process.exit(0);
}
```

### 4.5 Job Agendado de Manutenção de Partições

```typescript
// src/server/jobs/partition.scheduler.ts
import { CronJob } from 'cron';
import { PartitionManager } from '@/db/scripts/partition-manager';

const partitionManager = new PartitionManager();

// Executa diariamente às 3:00 AM
export const partitionMaintenanceJob = new CronJob(
  '0 3 * * *',
  async () => {
    console.log('[Scheduler] Iniciando manutenção de partições');
    try {
      await partitionManager.runMaintenance();
      console.log('[Scheduler] Manutenção de partições concluída');
    } catch (error) {
      console.error('[Scheduler] Erro na manutenção de partições:', error);
    }
  },
  null,
  false,
  'America/Sao_Paulo'
);

// Inicia o job
partitionMaintenanceJob.start();
```

---

## 5. Tipos TypeScript

```typescript
// src/types/analytics.types.ts
export interface ClickEvent {
  shortCode: string;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  acceptLanguage: string | null;
  timestamp: string;
}

export interface EnrichedClickEvent extends ClickEvent {
  linkId: string;
  visitorHash: string;
  country: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  referrerDomain: string | null;
  isBot: boolean;
}

export interface GeoData {
  country: string | null;
  city: string | null;
}

export interface UserAgentData {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
  isBot: boolean;
}

export interface DailyStats {
  linkId: string;
  date: string;
  clicks: number;
  uniqueVisitors: number;
}
```

---

## 6. Configuração do BullMQ

```typescript
// src/server/lib/queue.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
import { redis } from './redis';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379')
};

// Queue principal de analytics
export const analyticsQueue = new Queue('analytics:clicks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000 // 1s, 2s, 4s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false // Mantém para DLQ
  }
});

// Queue de agregação
export const aggregationQueue = new Queue('analytics:aggregation', {
  connection
});

// Queue de cleanup
export const cleanupQueue = new Queue('analytics:cleanup', {
  connection
});

// Dead Letter Queue
export const deadLetterQueue = new Queue('analytics:dead', {
  connection
});

// Scheduler para cron jobs
new QueueScheduler('analytics:aggregation', { connection });
new QueueScheduler('analytics:cleanup', { connection });
```

---

## 7. Workers

### 7.1 Click Worker

```typescript
// src/server/workers/click.worker.ts
import { Worker, Job } from 'bullmq';
import { db } from '@/db';
import { analyticsEvents, links } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { geoipService } from '@/server/services/geoip.service';
import { userAgentService } from '@/server/services/useragent.service';
import { hashVisitor } from '@/server/lib/privacy';
import type { ClickEvent, EnrichedClickEvent } from '@/types/analytics.types';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379')
};

export const clickWorker = new Worker<ClickEvent>(
  'analytics:clicks',
  async (job: Job<ClickEvent>) => {
    const event = job.data;

    // 1. Busca link_id pelo shortCode
    const link = await db.query.links.findFirst({
      where: eq(links.shortCode, event.shortCode),
      columns: { id: true }
    });

    if (!link) {
      throw new Error(`Link not found: ${event.shortCode}`);
    }

    // 2. Enriquece dados
    const enriched = await enrichEvent(event, link.id);

    // 3. Insere evento
    await db.insert(analyticsEvents).values({
      linkId: enriched.linkId,
      visitorHash: enriched.visitorHash,
      country: enriched.country,
      city: enriched.city,
      browser: enriched.browser,
      browserVersion: enriched.browserVersion,
      os: enriched.os,
      osVersion: enriched.osVersion,
      deviceType: enriched.deviceType,
      referrer: event.referer,
      referrerDomain: enriched.referrerDomain,
      isBot: enriched.isBot,
      createdAt: new Date(event.timestamp)
    });

    // 4. Incrementa contador (atômico)
    await db
      .update(links)
      .set({
        clicksCount: sql`${links.clicksCount} + 1`,
        lastClickedAt: new Date()
      })
      .where(eq(links.id, link.id));

    return { processed: true, linkId: link.id };
  },
  {
    connection,
    concurrency: 10,
    limiter: { max: 100, duration: 1000 } // 100 jobs/s
  }
);

async function enrichEvent(
  event: ClickEvent,
  linkId: string
): Promise<EnrichedClickEvent> {
  // GeoIP lookup
  const geo = event.ip ? await geoipService.lookup(event.ip) : null;

  // User-Agent parsing
  const ua = event.userAgent ? userAgentService.parse(event.userAgent) : null;

  // Hash do visitante (LGPD compliant)
  const visitorHash = hashVisitor(event.ip, linkId);

  // Extrai domínio do referrer
  const referrerDomain = event.referer ? extractDomain(event.referer) : null;

  return {
    ...event,
    linkId,
    visitorHash,
    country: geo?.country ?? null,
    city: geo?.city ?? null,
    browser: ua?.browser ?? null,
    browserVersion: ua?.browserVersion ?? null,
    os: ua?.os ?? null,
    osVersion: ua?.osVersion ?? null,
    deviceType: ua?.deviceType ?? null,
    referrerDomain,
    isBot: ua?.isBot ?? false
  };
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Event handlers
clickWorker.on('completed', (job) => {
  console.log(`[ClickWorker] Job ${job.id} completed`);
});

clickWorker.on('failed', (job, err) => {
  console.error(`[ClickWorker] Job ${job?.id} failed:`, err.message);
});
```

### 7.2 Aggregation Worker

```typescript
// src/server/workers/aggregation.worker.ts
import { Worker, Job } from 'bullmq';
import { db } from '@/db';
import { analyticsEvents, linkClicksDaily } from '@/db/schema';
import { sql, eq, and, gte, lt } from 'drizzle-orm';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379')
};

interface AggregationJob {
  date: string; // YYYY-MM-DD
}

export const aggregationWorker = new Worker<AggregationJob>(
  'analytics:aggregation',
  async (job: Job<AggregationJob>) => {
    const { date } = job.data;
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Agrega dados do dia
    const aggregated = await db
      .select({
        linkId: analyticsEvents.linkId,
        clicks: sql<number>`COUNT(*)`,
        uniqueVisitors: sql<number>`COUNT(DISTINCT ${analyticsEvents.visitorHash})`
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.createdAt, startOfDay),
          lt(analyticsEvents.createdAt, endOfDay),
          eq(analyticsEvents.isBot, false)
        )
      )
      .groupBy(analyticsEvents.linkId);

    // Upsert na tabela de agregação
    for (const row of aggregated) {
      await db
        .insert(linkClicksDaily)
        .values({
          linkId: row.linkId,
          date: date,
          clicks: row.clicks,
          uniqueVisitors: row.uniqueVisitors
        })
        .onConflictDoUpdate({
          target: [linkClicksDaily.linkId, linkClicksDaily.date],
          set: {
            clicks: row.clicks,
            uniqueVisitors: row.uniqueVisitors
          }
        });
    }

    return { aggregated: aggregated.length, date };
  },
  { connection, concurrency: 1 }
);
```

### 7.3 Cleanup Worker

```typescript
// src/server/workers/cleanup.worker.ts
import { Worker, Job } from 'bullmq';
import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { lt, sql } from 'drizzle-orm';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379')
};

const RETENTION_DAYS = 90;

export const cleanupWorker = new Worker(
  'analytics:cleanup',
  async (job: Job) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Remove eventos antigos (dados agregados são mantidos)
    const result = await db
      .delete(analyticsEvents)
      .where(lt(analyticsEvents.createdAt, cutoffDate));

    // Drop partições antigas (mensal)
    const oldPartition = getOldPartitionName(cutoffDate);
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(oldPartition)}`);

    return {
      deletedBefore: cutoffDate.toISOString(),
      droppedPartition: oldPartition
    };
  },
  { connection, concurrency: 1 }
);

function getOldPartitionName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `analytics_events_${year}_${month}`;
}
```

---

## 8. Serviços Auxiliares

### 8.1 GeoIP Service

```typescript
// src/server/services/geoip.service.ts
import { Reader } from '@maxmind/geoip2-node';
import type { GeoData } from '@/types/analytics.types';

class GeoIPService {
  private reader: Reader | null = null;
  private readonly dbPath = '/app/geoip/GeoLite2-City.mmdb';

  async initialize(): Promise<void> {
    try {
      this.reader = await Reader.open(this.dbPath);
      console.log('[GeoIP] Database loaded');
    } catch (error) {
      console.error('[GeoIP] Failed to load database:', error);
    }
  }

  async lookup(ip: string): Promise<GeoData | null> {
    if (!this.reader) return null;

    try {
      const response = this.reader.city(ip);
      return {
        country: response.country?.isoCode ?? null,
        city: response.city?.names?.en ?? null
      };
    } catch {
      return null;
    }
  }
}

export const geoipService = new GeoIPService();
```

### 8.2 User-Agent Service

```typescript
// src/server/services/useragent.service.ts
import { UAParser } from 'ua-parser-js';
import type { UserAgentData } from '@/types/analytics.types';

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebot/i,
  /ia_archiver/i
];

class UserAgentService {
  parse(userAgent: string): UserAgentData {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const isBot = BOT_PATTERNS.some((pattern) => pattern.test(userAgent));

    return {
      browser: result.browser.name ?? null,
      browserVersion: result.browser.version ?? null,
      os: result.os.name ?? null,
      osVersion: result.os.version ?? null,
      deviceType: this.mapDeviceType(result.device.type),
      isBot
    };
  }

  private mapDeviceType(type?: string): 'desktop' | 'mobile' | 'tablet' | null {
    switch (type) {
      case 'mobile':
        return 'mobile';
      case 'tablet':
        return 'tablet';
      default:
        return 'desktop';
    }
  }
}

export const userAgentService = new UserAgentService();
```

### 8.3 Privacy (Hash de Visitante)

```typescript
// src/server/lib/privacy.ts
import { createHash } from 'crypto';

/**
 * Gera hash do visitante com salt rotativo semanal
 * Compliance: LGPD/GDPR - IP nunca é armazenado
 */
export function hashVisitor(ip: string | null, linkId: string): string {
  if (!ip) {
    return createHash('sha256')
      .update(`anonymous:${linkId}:${Date.now()}`)
      .digest('hex');
  }

  // Salt semanal para anonimização temporal
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  const salt = `${year}-W${week}`;

  return createHash('sha256').update(`${ip}:${linkId}:${salt}`).digest('hex');
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - firstDayOfYear.getTime()) / 86400000
  );
  return Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
}
```

---

## 9. Scheduler (Cron Jobs)

```typescript
// src/server/jobs/scheduler.ts
import { aggregationQueue, cleanupQueue } from '@/server/lib/queue';

export async function setupScheduler(): Promise<void> {
  // Agregação diária às 02:00 UTC
  await aggregationQueue.add(
    'daily-aggregation',
    { date: getYesterday() },
    {
      repeat: { cron: '0 2 * * *' },
      jobId: 'daily-aggregation'
    }
  );

  // Cleanup semanal (domingos às 03:00 UTC)
  await cleanupQueue.add(
    'weekly-cleanup',
    {},
    {
      repeat: { cron: '0 3 * * 0' },
      jobId: 'weekly-cleanup'
    }
  );

  console.log('[Scheduler] Jobs scheduled');
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
```

---

## 10. Dead Letter Queue

```typescript
// src/server/workers/dlq.handler.ts
import { deadLetterQueue, analyticsQueue } from '@/server/lib/queue';

// Move jobs falhos para DLQ após 3 tentativas
analyticsQueue.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= 3) {
    await deadLetterQueue.add('failed-click', {
      originalJob: job.data,
      error: err.message,
      failedAt: new Date().toISOString()
    });
    console.error(`[DLQ] Job ${job.id} moved to dead letter queue`);
  }
});

// Processar DLQ manualmente ou com alertas
export async function processDLQ(): Promise<void> {
  const jobs = await deadLetterQueue.getJobs(['waiting']);
  console.log(`[DLQ] ${jobs.length} jobs in dead letter queue`);
  // Implementar lógica de retry manual ou alertas
}
```

---

## 11. Analytics Service (API)

```typescript
// src/server/services/analytics.service.ts
import { db } from '@/db';
import { linkClicksDaily, analyticsEvents } from '@/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export class AnalyticsService {
  async getDailyStats(linkId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return db
      .select()
      .from(linkClicksDaily)
      .where(
        and(
          eq(linkClicksDaily.linkId, linkId),
          gte(linkClicksDaily.date, startDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(linkClicksDaily.date));
  }

  async getTopCountries(linkId: string, limit: number = 10) {
    return db
      .select({
        country: analyticsEvents.country,
        count: sql<number>`COUNT(*)`
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.linkId, linkId))
      .groupBy(analyticsEvents.country)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);
  }

  async getDeviceBreakdown(linkId: string) {
    return db
      .select({
        deviceType: analyticsEvents.deviceType,
        count: sql<number>`COUNT(*)`
      })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.linkId, linkId))
      .groupBy(analyticsEvents.deviceType);
  }
}

export const analyticsService = new AnalyticsService();
```

---

## 12. Observabilidade

### 12.1 Métricas OpenTelemetry

```typescript
// src/server/lib/analytics-telemetry.ts
import { metrics, trace } from '@opentelemetry/api';

const meter = metrics.getMeter('analytics-engine');
const tracer = trace.getTracer('analytics-engine');

// Métricas de Queue
export const jobsEnqueued = meter.createCounter('analytics.jobs.enqueued', {
  description: 'Total de jobs enfileirados'
});

export const jobsProcessed = meter.createCounter('analytics.jobs.processed', {
  description: 'Total de jobs processados'
});

export const jobsFailed = meter.createCounter('analytics.jobs.failed', {
  description: 'Total de jobs que falharam'
});

export const jobProcessingTime = meter.createHistogram(
  'analytics.job.processing_time',
  {
    description: 'Tempo de processamento de jobs em ms',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [10, 25, 50, 100, 250, 500, 1000, 2500]
    }
  }
);

export const queueDepth = meter.createObservableGauge('analytics.queue.depth', {
  description: 'Profundidade atual da fila'
});

// Métricas de GeoIP
export const geoipLookups = meter.createCounter('analytics.geoip.lookups', {
  description: 'Total de lookups GeoIP'
});

export const geoipErrors = meter.createCounter('analytics.geoip.errors', {
  description: 'Erros de lookup GeoIP'
});

// Métricas de Database
export const dbInserts = meter.createCounter('analytics.db.inserts', {
  description: 'Total de inserts no banco'
});

export const dbInsertTime = meter.createHistogram('analytics.db.insert_time', {
  description: 'Tempo de insert em ms',
  unit: 'ms'
});
```

### 12.2 Dashboard de Métricas

```json
{
  "title": "Analytics Engine Dashboard",
  "panels": [
    {
      "title": "Jobs Processados/min",
      "type": "stat",
      "query": "sum(rate(analytics_jobs_processed[1m]))"
    },
    {
      "title": "Queue Depth",
      "type": "gauge",
      "query": "analytics_queue_depth"
    },
    {
      "title": "Tempo de Processamento P95",
      "type": "graph",
      "query": "histogram_quantile(0.95, sum(rate(analytics_job_processing_time_bucket[5m])) by (le))"
    },
    {
      "title": "Taxa de Falhas",
      "type": "stat",
      "query": "sum(rate(analytics_jobs_failed[5m])) / sum(rate(analytics_jobs_processed[5m])) * 100"
    },
    {
      "title": "GeoIP Success Rate",
      "type": "gauge",
      "query": "(sum(rate(analytics_geoip_lookups[5m])) - sum(rate(analytics_geoip_errors[5m]))) / sum(rate(analytics_geoip_lookups[5m])) * 100"
    }
  ]
}
```

---

## 13. Testes

### 13.1 Testes Unitários de Workers

```typescript
// src/server/workers/__tests__/click.worker.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { processClick } from '../click.worker';
import type { ClickEvent } from '@/types/analytics.types';

// Mocks
const mockDb = {
  insert: mock(() => ({ values: mock(() => Promise.resolve()) }))
};

const mockGeoIP = {
  lookup: mock(() => ({ country: 'BR', city: 'São Paulo' }))
};

const mockUA = {
  parse: mock(() => ({
    browser: 'Chrome',
    browserVersion: '120.0',
    os: 'Windows',
    osVersion: '11',
    deviceType: 'desktop',
    isBot: false
  }))
};

describe('Click Worker', () => {
  beforeEach(() => {
    mockDb.insert.mockClear();
    mockGeoIP.lookup.mockClear();
    mockUA.parse.mockClear();
  });

  const baseEvent: ClickEvent = {
    shortCode: 'abc123',
    requestId: 'req-001',
    ip: '200.200.200.200',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    referer: 'https://twitter.com/post/123',
    acceptLanguage: 'pt-BR,pt;q=0.9',
    timestamp: '2026-01-15T10:30:00Z'
  };

  it('should enrich and insert click event', async () => {
    const result = await processClick(baseEvent);

    expect(result.success).toBe(true);
    expect(mockGeoIP.lookup).toHaveBeenCalledWith('200.200.200.200');
    expect(mockUA.parse).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should hash IP instead of storing raw', async () => {
    await processClick(baseEvent);

    const insertCall = mockDb.insert.mock.calls[0];
    const insertedData = insertCall[0];

    expect(insertedData.visitorHash).toBeDefined();
    expect(insertedData.visitorHash.length).toBe(64); // SHA256
    expect(insertedData.ip).toBeUndefined();
  });

  it('should extract referrer domain', async () => {
    await processClick(baseEvent);

    const insertCall = mockDb.insert.mock.calls[0];
    expect(insertCall[0].referrerDomain).toBe('twitter.com');
  });

  it('should handle null IP gracefully', async () => {
    const eventNoIp = { ...baseEvent, ip: null };
    const result = await processClick(eventNoIp);

    expect(result.success).toBe(true);
    expect(mockGeoIP.lookup).not.toHaveBeenCalled();
  });

  it('should detect and flag bots', async () => {
    mockUA.parse.mockReturnValue({
      browser: 'Googlebot',
      isBot: true
    });

    const botEvent = {
      ...baseEvent,
      userAgent: 'Googlebot/2.1'
    };

    await processClick(botEvent);

    const insertCall = mockDb.insert.mock.calls[0];
    expect(insertCall[0].isBot).toBe(true);
  });

  it('should handle GeoIP lookup failure', async () => {
    mockGeoIP.lookup.mockImplementation(() => {
      throw new Error('GeoIP database not loaded');
    });

    const result = await processClick(baseEvent);

    expect(result.success).toBe(true);
    expect(result.enriched.country).toBeNull();
  });

  it('should extract UTM parameters from referer', async () => {
    const eventWithUtm = {
      ...baseEvent,
      referer: 'https://example.com?utm_source=twitter&utm_medium=social'
    };

    await processClick(eventWithUtm);

    const insertCall = mockDb.insert.mock.calls[0];
    expect(insertCall[0].utmSource).toBe('twitter');
    expect(insertCall[0].utmMedium).toBe('social');
  });
});
```

### 13.2 Testes de Integração

```typescript
// tests/integration/analytics.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db } from '@/db';
import { analyticsEvents, linkClicksDaily, links } from '@/db/schema';
import { analyticsQueue } from '@/server/lib/queue';
import { eq } from 'drizzle-orm';

describe('Analytics Integration', () => {
  const testLinkId = 'test-link-uuid-001';

  beforeAll(async () => {
    // Setup: criar link de teste
    await db.insert(links).values({
      id: testLinkId,
      shortCode: 'test-analytics',
      originalUrl: 'https://example.com',
      userId: 'test-user-001'
    });
  });

  afterAll(async () => {
    // Cleanup
    await db
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.linkId, testLinkId));
    await db
      .delete(linkClicksDaily)
      .where(eq(linkClicksDaily.linkId, testLinkId));
    await db.delete(links).where(eq(links.id, testLinkId));
  });

  it('should process click event end-to-end', async () => {
    // Enqueue evento
    const job = await analyticsQueue.add('click', {
      shortCode: 'test-analytics',
      requestId: 'int-test-001',
      ip: '8.8.8.8',
      userAgent: 'Mozilla/5.0',
      referer: 'https://google.com',
      timestamp: new Date().toISOString()
    });

    // Aguarda processamento
    await job.waitUntilFinished(analyticsQueue.createQueueEvents(), 5000);

    // Verifica inserção
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.linkId, testLinkId));

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].country).toBe('US'); // 8.8.8.8 é Google DNS
  });

  it('should aggregate clicks correctly', async () => {
    // Insere 5 eventos
    for (let i = 0; i < 5; i++) {
      await analyticsQueue.add('click', {
        shortCode: 'test-analytics',
        requestId: `agg-test-${i}`,
        ip: `192.168.1.${i}`,
        userAgent: 'Test Agent',
        referer: null,
        timestamp: new Date().toISOString()
      });
    }

    // Aguarda processamento
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Dispara agregação manual
    await analyticsQueue.add('aggregate', {
      linkId: testLinkId,
      date: new Date().toISOString().split('T')[0]
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verifica agregação
    const daily = await db
      .select()
      .from(linkClicksDaily)
      .where(eq(linkClicksDaily.linkId, testLinkId));

    expect(daily.length).toBeGreaterThan(0);
    expect(daily[0].clicks).toBeGreaterThanOrEqual(5);
  });
});
```

### 13.3 Testes de Performance

```typescript
// tests/perf/analytics.perf.test.ts
import { describe, it, expect } from 'bun:test';
import { analyticsQueue } from '@/server/lib/queue';

describe('Analytics Performance', () => {
  it('should handle 1000 events in under 5 seconds', async () => {
    const startTime = performance.now();
    const jobs: Promise<any>[] = [];

    for (let i = 0; i < 1000; i++) {
      jobs.push(
        analyticsQueue.add('click', {
          shortCode: 'perf-test',
          requestId: `perf-${i}`,
          ip: `10.0.${Math.floor(i / 255)}.${i % 255}`,
          userAgent: 'Performance Test',
          referer: null,
          timestamp: new Date().toISOString()
        })
      );
    }

    await Promise.all(jobs);
    const enqueueTime = performance.now() - startTime;

    console.log(`[Perf] 1000 jobs enqueued in ${enqueueTime.toFixed(2)}ms`);
    expect(enqueueTime).toBeLessThan(1000); // 1s para enqueue

    // Aguarda processamento
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const stats = await analyticsQueue.getJobCounts();
    expect(stats.waiting + stats.active).toBeLessThan(100); // Maioria processada
  });
});
```

---

## 14. Checklist de Implementação

- [ ] Schema de analytics com particionamento
- [ ] Script de criação automática de partições (PartitionManager)
- [ ] Índices otimizados para queries comuns
- [ ] Job agendado de manutenção de partições
- [ ] BullMQ queues configuradas
- [ ] Click Worker com enriquecimento
- [ ] Aggregation Worker (cron diário)
- [ ] Cleanup Worker (cron semanal)
- [ ] GeoIP Service com MaxMind
- [ ] User-Agent parsing com detecção de bots
- [ ] Hash de visitante LGPD compliant
- [ ] Dead Letter Queue
- [ ] Analytics Service para API
- [ ] Métricas OpenTelemetry configuradas
- [ ] Dashboard de métricas (SigNoz)
- [ ] Testes unitários de workers
- [ ] Testes de integração end-to-end
- [ ] Testes de performance

