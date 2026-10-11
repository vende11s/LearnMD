import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import { sourceForSelection } from './selectionSource';

function select(first: Element, last = first) {
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}
function show(source: string) {
  const parsed = parseLearnMD(source);
  const { container } = render(<ReaderContent document={parsed} />);
  return { root: container, source: parsed.source };
}

describe('copying selected original source', () => {
  it('preserves Markdown emphasis and TeX rather than flattened visual math', () => {
    const source = 'Keep **this idea** and $\\frac{1}{2}$ together.';
    const { root } = show(source);
    expect(
      sourceForSelection(root, select(root.querySelector('strong')!), source),
    ).toBe(source);
  });
  it('includes the complete quiz context when a choice is selected', () => {
    const source =
      '::::quiz{title="Choose"}\n:::choice{correct="true"}\nThe **right** answer.\n:::\n:::choice{correct="false"}\nAnother answer.\n:::\n::::';
    const { root } = show(source);
    expect(
      sourceForSelection(root, select(root.querySelector('strong')!), source),
    ).toBe(source);
  });
  it('copies one nested block without copying its entire outer layout', () => {
    const block = ':::callout\nSelected **context**.\n:::';
    const source = `::::section\n${block}\n\nUnselected context.\n::::`;
    const { root } = show(source);
    expect(
      sourceForSelection(root, select(root.querySelector('strong')!), source),
    ).toBe(block);
  });
  it('includes enclosing fences when selection crosses a container boundary', () => {
    const source =
      'Before the component.\n\n::::section\n:::callout\nSelected **context**.\n:::\n\nMore context.\n::::';
    const { root } = show(source);
    const selected = sourceForSelection(
      root,
      select(root.querySelector('p')!, root.querySelector('strong')!),
      source,
    );
    expect(selected).toBe(source);
    expect(parseLearnMD(selected!).diagnostics).toEqual([]);
  });
  it('refuses empty selections and selections outside the document', () => {
    const { root, source } = show('Read this paragraph.');
    const selection = select(root.querySelector('p')!);
    selection.collapseToStart();
    expect(sourceForSelection(root, selection, source)).toBeNull();
    const outside = document.createElement('p');
    outside.textContent = 'Other application content';
    document.body.append(outside);
    expect(sourceForSelection(root, select(outside), source)).toBeNull();
    outside.remove();
  });
  it('uses normalized source offsets for Windows line endings', () => {
    const { root, source } = show(
      '## Intro\r\n\r\nA **selected** paragraph.\r\n',
    );
    expect(
      sourceForSelection(root, select(root.querySelector('strong')!), source),
    ).toBe('A **selected** paragraph.');
  });
});
