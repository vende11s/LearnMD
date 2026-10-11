import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from './ReaderContent';
import { sourceProps } from './source';

describe('reader source ranges', () => {
  it('maps standalone paragraphs, headings, lists, fenced code and display math to exact Markdown', () => {
    const snippets = [
      '## Zażółć gęślą jaźń',
      'Text with **emphasis** and $x^2$.',
      '- First item\n- Second item',
      '```js\nconst answer = 42;\n```',
      '$$\n\\int_0^1 x^2\\,dx\n$$',
    ];
    const document = parseLearnMD(snippets.join('\n\n'));
    const { container } = render(<ReaderContent document={document} />);
    const mapped = [
      ...container.querySelectorAll<HTMLElement>('[data-source-start]'),
    ].map((element) =>
      document.source.slice(
        Number(element.dataset.sourceStart),
        Number(element.dataset.sourceEnd),
      ),
    );
    for (const snippet of snippets) expect(mapped).toContain(snippet);
    expect(container.querySelector('p')!.dataset.sourceKind).toBe('paragraph');
    expect(
      container
        .querySelector('.learn-math-display')!
        .getAttribute('data-source-kind'),
    ).toBe('math');
  });

  it('distinguishes complete public directives from their structural child wrappers', () => {
    const source =
      ':::::carousel\n::::slide{title="Question"}\n:::question{answer="Because it follows."}\nWhy?\n:::\n::::\n:::::';
    const document = parseLearnMD(source);
    const { container } = render(<ReaderContent document={document} />);
    const question = container.querySelector<HTMLElement>(
      '.learn-wrapper-question',
    )!;
    const slide = container.querySelector<HTMLElement>(
      '.learn-carousel-slide',
    )!;
    expect(question.dataset.sourceKind).toBe('directive');
    expect(slide.dataset.sourceKind).toBe('structural');
    expect(
      document.source.slice(
        Number(question.dataset.sourceStart),
        Number(question.dataset.sourceEnd),
      ),
    ).toBe(':::question{answer="Because it follows."}\nWhy?\n:::');
  });

  it('omits invalid or missing offsets instead of inventing source positions', () => {
    expect(sourceProps({ type: 'paragraph' })).toEqual({});
    expect(
      sourceProps({
        type: 'paragraph',
        position: { start: { offset: 20 }, end: { offset: 2 } },
      }),
    ).toEqual({});
  });
});
