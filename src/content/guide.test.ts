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
    '%s is a substantive valid LearnMD document with consistent metadata',
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
      expect(document.wordCount).toBeGreaterThan(900);
      const nodes = document.children.flatMap(allNodes);
      expect(
        nodes.filter((node) => node.type === 'heading').length,
      ).toBeGreaterThanOrEqual(7);
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
      ).toHaveLength(6);
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
        expect(quiz.attributes?.explanation?.length).toBeGreaterThan(80);
      }
      const blank = exercises.find((node) => node.name === 'fill-blank');
      expect(blank?.attributes?.answer?.split('|')).toContain('learn.md');
      expect(exercises.filter((node) => node.name === 'pair')).toHaveLength(4);
      expect(
        exercises.some(
          (node) => node.name === 'question' && node.attributes?.answer,
        ),
      ).toBe(true);
      expect(exercises.some((node) => node.name === 'scratchpad')).toBe(true);
      expect(nodes.some((node) => node.name === 'tabs')).toBe(true);
      expect(nodes.some((node) => node.name === 'steps')).toBe(true);
      expect(nodes.some((node) => node.name === 'reveal')).toBe(true);
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
