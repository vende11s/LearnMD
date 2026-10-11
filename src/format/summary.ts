import type { LearnNode, ParsedDocument } from './types';

/** Use the parser's word count everywhere a reading estimate is displayed. */
export function readingMinutes(
  document: Pick<ParsedDocument, 'wordCount'>,
): number {
  return Number.isFinite(document.wordCount)
    ? Math.max(1, Math.ceil(document.wordCount / 220))
    : 1;
}

function inlineText(node: LearnNode): string {
  if (['text', 'inlineCode', 'inlineMath'].includes(node.type))
    return node.value ?? '';
  if (node.type === 'break') return ' ';
  // Read labels and formatting children, never destinations, attributes or HTML.
  return (node.children ?? []).map(inlineText).join('');
}

/** A fallback from the first body paragraph, without metadata or code blocks. */
export function documentExcerpt(
  parsed: ParsedDocument,
  maxLength = 130,
): string {
  const limit = Number.isFinite(maxLength)
    ? Math.max(0, Math.floor(maxLength))
    : 130;
  if (!limit) return '';

  const firstParagraph = (nodes: LearnNode[]): string => {
    for (const node of nodes) {
      if (['heading', 'yaml', 'code', 'html', 'math'].includes(node.type))
        continue;
      const text =
        node.type === 'paragraph'
          ? inlineText(node).replace(/\s+/gu, ' ').trim()
          : firstParagraph(node.children ?? []);
      if (text) return text;
    }
    return '';
  };
  const text = firstParagraph(parsed.children);
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  if (limit === 1) return '…';

  const prefix = characters.slice(0, limit - 1).join('');
  // Prefer complete words. A single long word still gets a bounded preview.
  const boundary = prefix.lastIndexOf(' ');
  const endsAtWord = characters[limit - 1] === ' ' || prefix.endsWith(' ');
  return `${(!endsAtWord && boundary > 0 ? prefix.slice(0, boundary) : prefix).trimEnd()}…`;
}
