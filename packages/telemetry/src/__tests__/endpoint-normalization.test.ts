import { describe, expect, it } from 'bun:test';
import {
  isSignalEndpointBase,
  normalizeBaseEndpoint,
  parseOtlpHeaders,
  resolveSignalEndpoint,
  resolveSignalHeaders
} from '../init';

describe('normalizeBaseEndpoint', () => {
  it('strips a single trailing slash', () => {
    expect(normalizeBaseEndpoint('https://collector.urlfy.cc/')).toBe(
      'https://collector.urlfy.cc'
    );
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeBaseEndpoint('https://collector.urlfy.cc///')).toBe(
      'https://collector.urlfy.cc'
    );
  });

  it('leaves endpoints without trailing slashes unchanged', () => {
    expect(normalizeBaseEndpoint('https://collector.urlfy.cc')).toBe(
      'https://collector.urlfy.cc'
    );
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeBaseEndpoint('  http://localhost:4318/  ')).toBe(
      'http://localhost:4318'
    );
  });

  it('handles localhost with port and trailing slash', () => {
    expect(normalizeBaseEndpoint('http://localhost:4318/')).toBe(
      'http://localhost:4318'
    );
  });

  it('handles empty string', () => {
    expect(normalizeBaseEndpoint('')).toBe('');
  });
});

describe('isSignalEndpointBase', () => {
  it('detects when the base endpoint already includes /v1/logs', () => {
    expect(isSignalEndpointBase('https://collector.urlfy.cc/v1/logs')).toBe(
      true
    );
  });

  it('detects when the base endpoint already includes /v1/traces with trailing slash', () => {
    expect(isSignalEndpointBase('https://collector.urlfy.cc/v1/traces/')).toBe(
      true
    );
  });

  it('does not flag a plain collector base endpoint', () => {
    expect(isSignalEndpointBase('https://collector.urlfy.cc/')).toBe(false);
  });
});

describe('resolveSignalEndpoint', () => {
  describe('trailing-slash base endpoint regression (Hypothesis B)', () => {
    it('produces /v1/logs without double-slash when base has trailing slash', () => {
      const result = resolveSignalEndpoint(
        'https://collector.urlfy.cc/',
        '',
        '/v1/logs'
      );
      expect(result).toBe('https://collector.urlfy.cc/v1/logs');
      expect(result).not.toContain('//v1/');
    });

    it('produces /v1/metrics without double-slash when base has trailing slash', () => {
      const result = resolveSignalEndpoint(
        'https://collector.urlfy.cc/',
        '',
        '/v1/metrics'
      );
      expect(result).toBe('https://collector.urlfy.cc/v1/metrics');
      expect(result).not.toContain('//v1/');
    });

    it('produces /v1/traces without double-slash when base has trailing slash', () => {
      const result = resolveSignalEndpoint(
        'https://collector.urlfy.cc/',
        '',
        '/v1/traces'
      );
      expect(result).toBe('https://collector.urlfy.cc/v1/traces');
      expect(result).not.toContain('//v1/');
    });

    it('handles multiple trailing slashes on base', () => {
      const result = resolveSignalEndpoint(
        'https://collector.urlfy.cc///',
        '',
        '/v1/logs'
      );
      expect(result).toBe('https://collector.urlfy.cc/v1/logs');
    });
  });

  describe('per-signal endpoint override (Workstream 2)', () => {
    it('uses per-signal override as-is without appending suffix', () => {
      const result = resolveSignalEndpoint(
        'https://base.example.com/',
        'https://logs.example.com/v1/logs',
        '/v1/logs'
      );
      expect(result).toBe('https://logs.example.com/v1/logs');
    });

    it('uses per-signal override even when base endpoint is empty', () => {
      const result = resolveSignalEndpoint(
        '',
        'https://logs.example.com/v1/logs',
        '/v1/logs'
      );
      expect(result).toBe('https://logs.example.com/v1/logs');
    });

    it('does not append /v1/logs suffix to per-signal override that already has it', () => {
      const override = 'https://collector.urlfy.cc/v1/logs';
      const result = resolveSignalEndpoint(
        'https://collector.urlfy.cc/',
        override,
        '/v1/logs'
      );
      // Should return exact override, not 'https://collector.urlfy.cc/v1/logs/v1/logs'
      expect(result).toBe(override);
      expect(result).not.toContain('/v1/logs/v1/logs');
    });

    it('trims whitespace from per-signal override', () => {
      const result = resolveSignalEndpoint(
        '',
        '  https://logs.example.com/v1/logs  ',
        '/v1/logs'
      );
      expect(result).toBe('https://logs.example.com/v1/logs');
    });
  });

  describe('base endpoint without trailing slash', () => {
    it('appends /v1/logs correctly', () => {
      expect(
        resolveSignalEndpoint('http://localhost:4318', '', '/v1/logs')
      ).toBe('http://localhost:4318/v1/logs');
    });

    it('appends /v1/metrics correctly', () => {
      expect(
        resolveSignalEndpoint('http://localhost:4318', '', '/v1/metrics')
      ).toBe('http://localhost:4318/v1/metrics');
    });

    it('appends /v1/traces correctly', () => {
      expect(
        resolveSignalEndpoint('http://localhost:4318', '', '/v1/traces')
      ).toBe('http://localhost:4318/v1/traces');
    });
  });

  describe('partial signal configuration', () => {
    it('returns undefined when both base and per-signal override are absent', () => {
      expect(resolveSignalEndpoint('', '', '/v1/logs')).toBeUndefined();
    });
  });
});

describe('parseOtlpHeaders', () => {
  it('returns empty object for empty string', () => {
    expect(parseOtlpHeaders('')).toEqual({});
  });

  it('parses a single key=value pair', () => {
    expect(parseOtlpHeaders('Authorization=Bearer token123')).toEqual({
      Authorization: 'Bearer token123'
    });
  });

  it('parses multiple key=value pairs', () => {
    expect(parseOtlpHeaders('X-Api-Key=abc,X-Tenant=urlfy')).toEqual({
      'X-Api-Key': 'abc',
      'X-Tenant': 'urlfy'
    });
  });

  it('handles values containing = characters', () => {
    expect(parseOtlpHeaders('Authorization=Bearer tok=en')).toEqual({
      Authorization: 'Bearer tok=en'
    });
  });

  it('trims whitespace around keys and values', () => {
    expect(parseOtlpHeaders('  X-Key  =  val  ,  Y-Key  =  yyy  ')).toEqual({
      'X-Key': 'val',
      'Y-Key': 'yyy'
    });
  });

  it('handles key without value (no = sign) as empty string', () => {
    expect(parseOtlpHeaders('X-Flag')).toEqual({ 'X-Flag': '' });
  });

  it('ignores empty segments', () => {
    expect(parseOtlpHeaders('X-A=1,,X-B=2')).toEqual({
      'X-A': '1',
      'X-B': '2'
    });
  });
});

describe('resolveSignalHeaders', () => {
  it('returns shared headers when signal-specific headers are absent', () => {
    expect(resolveSignalHeaders('X-Shared=1,X-Common=base', '')).toEqual({
      'X-Shared': '1',
      'X-Common': 'base'
    });
  });

  it('merges shared and signal-specific headers', () => {
    expect(resolveSignalHeaders('X-Shared=1', 'X-Logs=enabled')).toEqual({
      'X-Shared': '1',
      'X-Logs': 'enabled'
    });
  });

  it('lets signal-specific headers override shared keys', () => {
    expect(
      resolveSignalHeaders(
        'Authorization=base,X-Tenant=common',
        'Authorization=logs'
      )
    ).toEqual({
      Authorization: 'logs',
      'X-Tenant': 'common'
    });
  });
});
