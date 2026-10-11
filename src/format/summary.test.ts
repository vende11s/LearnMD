import { describe, expect, it } from 'vitest';
import { parseLearnMD } from './parser';
import { documentExcerpt, readingMinutes } from './summary';

describe('source presentation summaries', () => {
  it('uses parsed words rather than frontmatter and directive configuration for reading time', () => {
    const source = `---\ntitle: "A short note"\ntags: [reading, context]\nversion: "1.0"\n---\n\n# A short note\n\n:::callout{title="${'configuration '.repeat(250).trim()}"}\nA useful explanation.\n:::`;
    const parsed = parseLearnMD(source);
    expect(parsed.diagnostics).toEqual([]);
    expect(Math.ceil(source.split(/\s+/u).length / 220)).toBe(2);
    expect(readingMinutes(parsed)).toBe(1);
    expect(readingMinutes({ wordCount: 220 })).toBe(1);
    expect(readingMinutes({ wordCount: 221 })).toBe(2);
    expect(readingMinutes({ wordCount: 0 })).toBe(1);
  });

  it('extracts prose and inline labels without leaking YAML, headings, links or fenced code', () => {
    const parsed = parseLearnMD(`---
title: "Private metadata title"
description: "Metadata is not the fallback body."
subject: "Metadata subject"
tags: [metadata]
version: "1.0"
---

# Repeated title

~~~js
const internalCode = "Do not show this block";
~~~

Read **the idea**, then [follow the reasoning](https://example.com/private-path "Link metadata").
Use \u0060mean()\u0060 with *care* and $x$ as the input.

## Another heading

The result matters.`);
    expect(parsed.diagnostics).toEqual([]);
    expect(documentExcerpt(parsed, 300)).toBe(
      'Read the idea, then follow the reasoning. Use mean() with care and x as the input.',
    );
  });

  it('finds the first paragraph inside nested layouts without appending later content', () => {
    const parsed = parseLearnMD(`:::::tabs{title="A title that must not leak"}
::::tab{title="First view"}
:::callout{title="Another configuration value"}
Start with **context**.
:::

> A quoted explanation.

- A supporting point.
::::

::::tab{title="Second view"}
Then inspect the consequence.
::::
:::::`);
    expect(parsed.diagnostics).toEqual([]);
    expect(documentExcerpt(parsed)).toBe('Start with context.');
    expect(documentExcerpt(parseLearnMD('> A quoted explanation.'))).toBe(
      'A quoted explanation.',
    );
    expect(documentExcerpt(parseLearnMD('- A supporting point.'))).toBe(
      'A supporting point.',
    );
  });

  it('normalizes line breaks and truncates at a word boundary only when necessary', () => {
    const parsed = parseLearnMD('A useful\nexplanation with  several words.');
    expect(documentExcerpt(parsed, 100)).toBe(
      'A useful explanation with several words.',
    );
    expect(documentExcerpt(parsed, 40)).toBe(
      'A useful explanation with several words.',
    );
    expect(documentExcerpt(parsed, 24)).toBe('A useful explanation…');
    expect(documentExcerpt(parseLearnMD('alpha beta gamma'), 11)).toBe(
      'alpha beta…',
    );
    expect(documentExcerpt(parsed, 0)).toBe('');
    expect(documentExcerpt(parsed, 1)).toBe('…');
    expect(documentExcerpt(parseLearnMD('📖📖📖📖'), 3)).toBe('📖📖…');
  });

  it('returns an empty fallback for notes with only metadata, headings, images or code', () => {
    const parsed = parseLearnMD(`---
title: "No body prose"
version: "1.0"
---

# Only a heading

![Diagram description](diagram.png)

~~~text
Raw code is not an excerpt.
~~~

$$
x^2
$$`);
    expect(parsed.diagnostics).toEqual([]);
    expect(documentExcerpt(parsed)).toBe('');
    expect(documentExcerpt(parseLearnMD(''))).toBe('');
  });
});
