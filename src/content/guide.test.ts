import { describe, expect, it } from 'vitest';
import { renderToString } from 'katex';
import { parseLearnMD } from '../format/parser';
import type { LearnNode } from '../format/types';
import { getGuide, GUIDE_ID, type GuideLanguage } from './guide';

const languages: GuideLanguage[] = ['en', 'pl'];
function allNodes(node: LearnNode): LearnNode[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}
function nodesFor(language: GuideLanguage) {
  return parseLearnMD(getGuide(language).source).children.flatMap(allNodes);
}

describe('the localized LearnMD welcome guide', () => {
  it.each(languages)(
    '%s is a short valid LearnMD welcome with consistent metadata',
    (language) => {
      const guide = getGuide(language);
      const document = parseLearnMD(guide.source);
      expect(document.diagnostics).toEqual([]);
      expect(guide.id).toBe(GUIDE_ID);
      expect(document.metadata).toMatchObject({
        title: guide.title,
        description: guide.description,
        subject: guide.subject,
        tags: ['guide', 'workflow'],
      });
      const nodes = document.children.flatMap(allNodes);
      // Include authored UI titles and feedback, which the parser's prose count
      // omits, so brevity cannot be bypassed by moving paragraphs into attrs.
      const authoredWords = nodes
        .flatMap((node) => [
          node.value ?? '',
          ...[
            'title',
            'label',
            'explanation',
            'prompt',
            'answer',
            'left',
            'right',
          ].map((key) => node.attributes?.[key] ?? ''),
        ])
        .join(' ')
        .trim()
        .split(/\s+/u);
      expect(authoredWords.length).toBeLessThanOrEqual(400);
      expect(
        nodes.filter((node) => node.type === 'heading' && node.depth === 1),
      ).toHaveLength(1);
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

  it.each(languages)(
    '%s includes usable single/multiple answers and varied carousel practice',
    (language) => {
      const nodes = nodesFor(language);
      const carousel = nodes.find((node) => node.name === 'carousel')!;
      expect(
        carousel.children?.filter((node) => node.name === 'slide'),
      ).toHaveLength(4);
      const exercises = allNodes(carousel);
      const quizzes = exercises.filter((node) => node.name === 'quiz');
      expect(quizzes).toHaveLength(2);
      for (const quiz of quizzes) {
        const choices =
          quiz.children?.filter((node) => node.name === 'choice') ?? [];
        const correct = choices.filter(
          (choice) => choice.attributes?.correct === 'true',
        );
        expect(correct).toHaveLength(
          quiz.attributes?.multiple === 'true' ? 2 : 1,
        );
        expect(choices.length).toBeGreaterThan(correct.length);
        expect(quiz.attributes?.explanation?.trim()).toBeTruthy();
      }
      const blank = exercises.find((node) => node.name === 'fill-blank');
      expect(blank?.attributes?.answer?.split('|')).toContain('25');
      const pairs = exercises.filter((node) => node.name === 'pair');
      expect(pairs).toHaveLength(3);
      expect(
        pairs.every((node) => node.attributes?.left && node.attributes?.right),
      ).toBe(true);
      expect(new Set(pairs.map((node) => node.attributes?.right)).size).toBe(3);
      const steps = nodes.find((node) => node.name === 'steps')!;
      expect(
        steps.children?.filter((node) => node.name === 'step'),
      ).toHaveLength(3);
      const reveal = nodes.find((node) => node.name === 'reveal')!;
      expect(reveal.attributes?.label).toBeTruthy();
      expect(reveal.children?.length).toBeGreaterThan(0);
    },
  );

  it('keeps both translations structurally equivalent with one shared guide identity', () => {
    const english = getGuide('en');
    const polish = getGuide('pl');
    expect(english.id).toBe(polish.id);
    expect(english.title).not.toBe(polish.title);
    expect(english.description).not.toBe(polish.description);
    expect(english.subject).not.toBe(polish.subject);
    const structure = (language: GuideLanguage) =>
      nodesFor(language)
        .filter((node) => node.name)
        .map((node) => ({
          name: node.name,
          multiple: node.attributes?.multiple,
          correct: node.attributes?.correct,
        }));
    expect(structure('en')).toEqual(structure('pl'));
  });
});
