import type { LearnNode } from '../format/types';

/** Offsets refer to ParsedDocument.source (UTF-16, end exclusive), never DOM text. */
export function sourceProps(node?: LearnNode, kind?: string) {
  const position = node?.position as
    { start?: { offset?: number }; end?: { offset?: number } } | undefined;
  const start = position?.start?.offset;
  const end = position?.end?.offset;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start! < 0 ||
    end! < start!
  )
    return {};
  return {
    'data-source-start': start,
    'data-source-end': end,
    'data-source-kind': kind ?? (node?.name ? 'directive' : node?.type),
  };
}
