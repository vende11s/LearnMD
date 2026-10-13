/** Images have a separate byte budget; these bounds cover Markdown parsing work. */
export const SHARE_SOURCE_LIMITS = Object.freeze({
  characters: 1_000_000,
  lines: 10_000,
  delimiters: 20_000,
});

export class ShareSourceLimitError extends Error {
  constructor() {
    super(
      'Shared notes exceed the combined source complexity limit. Split them into smaller shares.',
    );
    this.name = 'ShareSourceLimitError';
  }
}

// Count raw syntax even inside code/math/fences: deciding its meaning would
// require the expensive parser that this admission check must run before.
const delimiters = new Set('#*_~`[](){}<>!|:$\\&=+-');

/** Scan every source before parsing any of them, with no normalization bypass. */
export function assertShareSourceBudget(sources: readonly string[]): void {
  let characters = 0;
  for (const source of sources) {
    characters += source.length;
    if (characters > SHARE_SOURCE_LIMITS.characters)
      throw new ShareSourceLimitError();
  }

  let lines = 0;
  let syntax = 0;
  for (const source of sources) {
    if (++lines > SHARE_SOURCE_LIMITS.lines) throw new ShareSourceLimitError();
    for (let index = 0; index < source.length; index++) {
      const character = source[index];
      // CRLF is one line break, as are lone CR and LF.
      if (
        character === '\r' ||
        (character === '\n' && source[index - 1] !== '\r')
      ) {
        if (++lines > SHARE_SOURCE_LIMITS.lines)
          throw new ShareSourceLimitError();
      } else if (delimiters.has(character)) {
        if (++syntax > SHARE_SOURCE_LIMITS.delimiters)
          throw new ShareSourceLimitError();
      }
    }
  }
}
