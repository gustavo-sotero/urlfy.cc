// tests/helpers/test-logger.ts

export type TestLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const levelOrder: Record<Exclude<TestLogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getCurrentLevel(): TestLogLevel {
  const raw = (process.env.TEST_LOG_LEVEL || 'info').toLowerCase();
  if (raw === 'silent') return 'silent';
  if (raw === 'debug') return 'debug';
  if (raw === 'warn') return 'warn';
  if (raw === 'error') return 'error';
  return 'info';
}

function shouldLog(level: Exclude<TestLogLevel, 'silent'>): boolean {
  const current = getCurrentLevel();
  if (current === 'silent') return false;
  return levelOrder[level] >= levelOrder[current];
}

function write(level: Exclude<TestLogLevel, 'silent'>, message: string) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString()
  };
  const output = `${JSON.stringify(payload)}\n`;

  if (level === 'warn' || level === 'error') {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
}

export const testLogger = {
  debug(message: string) {
    if (shouldLog('debug')) write('debug', message);
  },
  info(message: string) {
    if (shouldLog('info')) write('info', message);
  },
  warn(message: string) {
    if (shouldLog('warn')) write('warn', message);
  },
  error(message: string) {
    if (shouldLog('error')) write('error', message);
  }
};
