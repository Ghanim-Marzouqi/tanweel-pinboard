import { describe, expect, it } from 'vitest';
import { extractMentions, splitMentions } from '@/lib/mentions';

describe('extractMentions', () => {
  it('finds unique, lower-cased usernames', () => {
    expect(extractMentions('@Sara and @omar.k, then @sara again')).toEqual(['sara', 'omar.k']);
  });

  it('drops sentence punctuation after a name', () => {
    expect(extractMentions('Thanks @sara.')).toEqual(['sara']);
  });

  it('ignores email addresses and too-short names', () => {
    expect(extractMentions('mail ali@tanweel.om or @ab')).toEqual([]);
  });

  it('works next to Arabic text', () => {
    expect(extractMentions('شكراً @laila على المراجعة')).toEqual(['laila']);
  });
});

describe('splitMentions', () => {
  it('highlights only known usernames', () => {
    const parts = splitMentions('Hi @sara and @nobody!', new Set(['sara']));
    expect(parts).toEqual([
      { text: 'Hi ', mention: false },
      { text: '@sara', mention: true },
      { text: ' and @nobody!', mention: false },
    ]);
  });
});
