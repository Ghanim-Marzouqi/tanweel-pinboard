import { describe, expect, it } from 'vitest';
import { safeCallbackUrl } from '@/lib/utils';

describe('safeCallbackUrl', () => {
  it('keeps same-origin paths', () => {
    expect(safeCallbackUrl('/tasks/123?tab=comments')).toBe('/tasks/123?tab=comments');
  });

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'tasks'])(
    'falls back for %j',
    (value) => {
      expect(safeCallbackUrl(value)).toBe('/projects');
    },
  );
});
