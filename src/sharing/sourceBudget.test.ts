import { describe, expect, it } from 'vitest';
import {
  assertShareSourceBudget,
  SHARE_SOURCE_LIMITS,
  ShareSourceLimitError,
} from './sourceBudget';

describe('shared Markdown work admission', () => {
  it('bounds total characters across sources, including wrappers and whitespace', () => {
    const half = 'a'.repeat(SHARE_SOURCE_LIMITS.characters / 2);
    expect(() => assertShareSourceBudget([half, half])).not.toThrow();
    expect(() => assertShareSourceBudget([half, half, 'x'])).toThrow(
      ShareSourceLimitError,
    );
    expect(() =>
      assertShareSourceBudget(['```md\n', half, half, '\n```']),
    ).toThrow(ShareSourceLimitError);
  });

  it.each(['\n', '\r', '\r\n'])(
    'counts logical lines with %j endings and per-note first lines',
    (ending) => {
      const first = `text${ending}`.repeat(SHARE_SOURCE_LIMITS.lines - 2);
      expect(() => assertShareSourceBudget([first, 'last'])).not.toThrow();
      expect(() =>
        assertShareSourceBudget([first, `last${ending}extra`]),
      ).toThrow(ShareSourceLimitError);
    },
  );

  it('bounds dense inline syntax across notes even without line breaks', () => {
    const half = '[]'.repeat(SHARE_SOURCE_LIMITS.delimiters / 4);
    expect(() => assertShareSourceBudget([half, half])).not.toThrow();
    expect(() => assertShareSourceBudget([half, half, '*'])).toThrow(
      ShareSourceLimitError,
    );
  });
});
