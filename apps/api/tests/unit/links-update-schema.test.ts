import { describe, expect, test } from 'bun:test';
import { LinkUpdateBody } from '@/server/modules/links/links.schema';

describe('LinkUpdateBody schema', () => {
  test('does not expose destination URL mutation', () => {
    expect(Object.keys(LinkUpdateBody.properties)).not.toContain('url');
    expect(Object.keys(LinkUpdateBody.properties)).not.toContain('originalUrl');
  });
});
