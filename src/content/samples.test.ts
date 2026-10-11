import { describe, expect, it } from 'vitest';
import { renderToString } from 'katex';
import { parseLearnMD } from '../format/parser';
import type { LearnNode } from '../format/types';
import { SAMPLES } from './samples';

function allNodes(node: LearnNode): LearnNode[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}

describe('bundled educational chapters', () => {
  it.each(SAMPLES)(
    '$title is valid public LearnMD with valid mathematical notation',
    (sample) => {
      const document = parseLearnMD(sample.source);
      expect(
        document.diagnostics.filter(
          (diagnostic) => diagnostic.severity === 'error',
        ),
      ).toEqual([]);
      expect(document.metadata.title).toBe(sample.title);
      expect(document.wordCount).toBeGreaterThan(600);
      const nodes = document.children.flatMap(allNodes);
      expect(
        nodes.filter((node) => node.type === 'heading').length,
      ).toBeGreaterThanOrEqual(5);
      if (['calculus', 'linear-algebra', 'physics'].includes(sample.id))
        expect(nodes.some((node) => node.type === 'math')).toBe(true);
      for (const node of nodes.filter(
        (node) => node.type === 'math' || node.type === 'inlineMath',
      )) {
        expect(() =>
          renderToString(node.value ?? '', {
            throwOnError: true,
            strict: 'error',
            displayMode: node.type === 'math',
          }),
        ).not.toThrow();
      }
    },
  );
});
