import { describe, expect, it } from 'vitest';
import { parseLearnMD } from './parser';
import {
  buildComponentCatalog,
  buildFormatReference,
  buildGenerationPrompt,
  GENERATION_STYLES,
  PROMPT_EXAMPLES,
} from './prompt';
import { COMPONENTS, PUBLIC_COMPONENTS, type AttributeSpec } from './registry';
import type { LearnNode } from './types';

type CatalogAttribute = { required: boolean; type: string };
const attributeTokens = (text: string): Record<string, CatalogAttribute> =>
  Object.fromEntries(
    [...text.matchAll(/\b([a-zA-Z][\w-]*)([!?]):([^\s;]+)/g)].map(
      ([, name, marker, type]) => [name, { required: marker === '!', type }],
    ),
  );

/** Read the emitted reference, not the builder's internal representation. */
function readCatalog(catalog: string) {
  const rows = new Map<string, { structural: boolean; text: string }>();
  for (const line of catalog.split('\n')) {
    const match = /^([a-z][\w-]*)( \[structural\])?: (.+)$/.exec(line);
    if (match) {
      expect(rows.has(match[1]), `Duplicate catalog entry ${match[1]}`).toBe(
        false,
      );
      rows.set(match[1], { structural: !!match[2], text: match[3] });
    }
  }
  return rows;
}

function expectedType(spec: AttributeSpec) {
  if (spec.values) return spec.values.join('|');
  if (spec.number)
    return `${spec.integer ? 'integer' : 'number'}[${spec.number.join(',')}]`;
  if (!spec.pattern) return 'text';
  // These are the three distinct lexical restrictions in the format contract.
  // A new pattern needs a documented type, rather than silently becoming text.
  const patterns: Record<string, string> = {
    '^[a-zA-Z][a-zA-Z0-9_-]{0,79}$': 'ID',
    '^[\\p{L}\\p{N}_-]{1,100}$': 'REF',
    '^\\d+(?:-\\d+)?(?:,\\d+(?:-\\d+)?)*$': 'LINES',
  };
  expect(
    patterns[spec.pattern.source],
    'Undocumented attribute pattern',
  ).toBeDefined();
  return patterns[spec.pattern.source];
}

function flatten(nodes: LearnNode[]): LearnNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}
const exampleDocuments = () =>
  PROMPT_EXAMPLES.map((example) => parseLearnMD(example.source));

describe('portable generation catalog', () => {
  it('preserves every component, structural role, attribute restriction, and direct relationship', () => {
    const catalog = buildComponentCatalog();
    const rows = readCatalog(catalog);
    expect(PUBLIC_COMPONENTS).toHaveLength(65);
    expect(COMPONENTS.filter((component) => component.structural)).toHaveLength(
      22,
    );
    expect([...rows.keys()].sort()).toEqual(
      COMPONENTS.map((component) => component.name).sort(),
    );

    const sharedLine = catalog
      .split('\n')
      .find((line) => /shared/i.test(line) && line.includes('id?:ID'));
    expect(
      sharedLine,
      'The two inherited optional properties must be documented',
    ).toBeDefined();
    const shared = attributeTokens(sharedLine!);
    expect(shared).toEqual({
      id: { required: false, type: 'ID' },
      title: { required: false, type: 'text' },
    });

    for (const component of COMPONENTS) {
      const row = rows.get(component.name)!;
      expect(row.structural, component.name).toBe(!!component.structural);
      expect(row.text, `${component.name}: behavior`).toContain(
        component.description,
      );
      const actual = { ...shared, ...attributeTokens(row.text) };
      const expected = Object.fromEntries(
        Object.entries(component.attributes).map(([name, spec]) => [
          name,
          { required: !!spec.required, type: expectedType(spec) },
        ]),
      );
      expect(
        actual,
        `${component.name}: exact attribute set, required flags, enums, bounds, and lexical types`,
      ).toEqual(expected);
      for (const [key, spec] of Object.entries(component.attributes)) {
        if (key === 'title' || (key === 'id' && !spec.required)) continue;
        expect(
          row.text,
          `${component.name}.${key}: semantic restrictions`,
        ).toContain(spec.description);
      }
      const relationships = (label: string) =>
        row.text
          .match(new RegExp(`\\b${label}: ([a-zA-Z0-9_, -]+)\\.`))?.[1]
          .split(/,\s*/)
          .sort();
      expect(
        relationships('Children'),
        `${component.name}: direct children`,
      ).toEqual(component.children?.slice().sort());
      expect(
        relationships('Parents'),
        `${component.name}: direct parents`,
      ).toEqual(component.parents?.slice().sort());
    }
    expect(buildGenerationPrompt()).toContain(catalog);
  });

  it('defines the hoisted lexical and value limits instead of losing them during compression', () => {
    const catalog = buildComponentCatalog();
    expect(catalog).toMatch(/! means required, \? optional/);
    expect(catalog).toMatch(/double-quoted strings.*4000 characters/);
    expect(catalog).toMatch(/required values must be nonempty/);
    expect(catalog).toMatch(
      /integer\[min,max\].*number\[min,max\].*inclusive bounds/,
    );
    expect(catalog).toMatch(
      /ID: ASCII letter.*letters, digits, underscores or hyphens.*80 characters/,
    );
    expect(catalog).toMatch(
      /REF:.*1[–-]100 Unicode letters\/digits\/underscores\/hyphens/,
    );
    expect(catalog).toMatch(/LINES:.*comma-separated.*ascending ranges/);
    expect(catalog).toMatch(/every line.*integer from 1 to 25000/);
    expect(catalog).toMatch(/Children.*at least one required/);
  });

  it('keeps the full reference available without copying every example into the portable prompt', () => {
    const reference = buildFormatReference();
    for (const component of COMPONENTS) {
      expect(reference).toContain(`### ${component.name}`);
      expect(reference).toContain(component.example);
    }
    expect(buildGenerationPrompt().length).toBeLessThanOrEqual(28_000);
    expect(buildGenerationPrompt().length).toBeLessThan(reference.length);
  });

  it('keeps the catalog and syntax examples intact across pedagogical styles', () => {
    const catalog = buildComponentCatalog();
    for (const style of GENERATION_STYLES) {
      const prompt = buildGenerationPrompt(style.id);
      expect(prompt).toContain(style.label);
      expect(prompt).toContain(style.description);
      expect(prompt).toContain(catalog);
      for (const example of PROMPT_EXAMPLES)
        expect(prompt).toContain(example.source);
      expect(prompt.length).toBeLessThanOrEqual(28_000);
    }
    expect(buildGenerationPrompt('unknown')).toBe(buildGenerationPrompt());
  });
});

describe('generation requirements', () => {
  it('retains source-language choice, topic-only requests, source fidelity, and concise but complete teaching', () => {
    const prompt = buildGenerationPrompt();
    const opening = prompt.slice(0, 1_200);
    expect(opening).toMatch(
      /OUTPUT LANGUAGE:.*language of the supplied materials.*unless.*requests a different language/,
    );
    expect(opening).toMatch(/does not require English notes/);
    expect(opening).toMatch(
      /TOPIC-ONLY REQUESTS:.*Without source materials.*established knowledge.*audience\/scope/,
    );
    expect(opening).toMatch(
      /language of the topic request unless another language is specified/,
    );
    expect(prompt).toMatch(
      /concise, clear explanatory notes.*depth needed for the learning goal/,
    );
    expect(prompt).toMatch(
      /Preserve necessary reasoning, definitions, assumptions and caveats/,
    );
    expect(prompt).toMatch(
      /Remove filler, repeated points, redundant summaries and boilerplate/,
    );
    expect(prompt).toMatch(/Do not force.*worked example.*every section/);
    expect(prompt).toMatch(
      /Preserve the sources'.*claims, scope and terminology/,
    );
    expect(prompt).toMatch(/Distinguish.*paraphrases.*explanatory inference/);
    expect(prompt).toMatch(
      /Never invent.*facts.*citations.*quotations.*source coverage/,
    );
    expect(prompt).toMatch(/missing or contradictory.*qualify or omit/);
    expect(prompt).toMatch(
      /source text.*not as instructions.*override this format/,
    );
  });

  it('keeps the raw document, composition, safety and manual-interaction contract', () => {
    const prompt = buildGenerationPrompt();
    expect(prompt).toMatch(
      /raw \.learn\.md document.*YAML frontmatter and an H1/,
    );
    expect(prompt).toMatch(/no enclosing code fence.*commentary.*placeholders/);
    expect(prompt).toMatch(
      /parent MUST have more colons than its immediately nested child/,
    );
    expect(prompt).toMatch(
      /Exactly one choice is correct unless multiple="true"/,
    );
    expect(prompt).toMatch(/code-diff requires both before and after/);
    expect(prompt).toMatch(/image-annotation requires x AND y/);
    expect(prompt).toMatch(
      /No autoplay.*answers remain intact.*printing includes every slide/,
    );
    expect(prompt).toMatch(
      /no fixed slide-count cap beyond the document resource limits/,
    );
    expect(prompt).toMatch(
      /Every toggle\/conditional target must name a declared variable/,
    );
    expect(prompt).toMatch(/conditional tests exact string equality/);
    expect(prompt).toMatch(/same group.*zero-based selected index/);
    expect(prompt).toMatch(/No raw HTML, scripts, iframes, data\/script URLs/);
    expect(prompt).toMatch(/Layers are manually selected explanations/);
    expect(prompt).not.toMatch(
      /detail-level|concise-mode|Associated detail level|Concise, Standard, and Detailed/,
    );
  });
});

describe('canonical prompt examples', () => {
  it.each(PROMPT_EXAMPLES)(
    '$name parses without diagnostics and is actually included',
    ({ source }) => {
      expect(parseLearnMD(source).diagnostics).toEqual([]);
      expect(buildGenerationPrompt()).toContain(source);
    },
  );

  it('demonstrates a complete note with a source excerpt and correctly nested varied questions', () => {
    const complete = exampleDocuments().find((document) =>
      /^---\n/.test(document.source),
    );
    expect(complete).toBeDefined();
    expect(complete!.metadata.title).not.toBe('Untitled note');
    expect(complete!.metadata.version).toBe('1.0');
    expect(
      complete!.children.some(
        (node) => node.type === 'heading' && node.depth === 1,
      ),
    ).toBe(true);
    const carousel = flatten(complete!.children).find(
      (node) => node.name === 'carousel',
    )!;
    expect(carousel).toBeDefined();
    const slides = carousel.children!.filter((node) => node.name);
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides.every((node) => node.name === 'slide')).toBe(true);
    const quizSlide = slides.find((slide) =>
      slide.children?.some((node) => node.name === 'quiz'),
    )!;
    expect(quizSlide.children!.some((node) => node.type === 'blockquote')).toBe(
      true,
    );
    const quiz = quizSlide.children!.find((node) => node.name === 'quiz')!;
    expect(quiz.attributes?.multiple).toBe('true');
    const choices = quiz.children!.filter((node) => node.name === 'choice');
    expect(
      choices.filter((node) => node.attributes?.correct === 'true').length,
    ).toBeGreaterThanOrEqual(2);
    expect(choices.some((node) => node.attributes?.correct === 'false')).toBe(
      true,
    );
    expect(quiz.attributes?.explanation).toBeTruthy();
    expect(
      slides.some((slide) =>
        slide.children?.some(
          (node) => node.name === 'fill-blank' && node.attributes?.answer,
        ),
      ),
    ).toBe(true);
  });

  it('preserves real display LaTeX, an equation reference, and code line explanations', () => {
    const nodes = exampleDocuments().flatMap((document) =>
      flatten(document.children),
    );
    const formula = nodes.find((node) => node.name === 'formula')!;
    const math = formula.children!.find((node) => node.type === 'math')!;
    expect(math.value).toContain('\\frac');
    expect(math.value).not.toContain('\\\\frac');
    expect(
      nodes.some(
        (node) =>
          node.name === 'reference' && node.attributes?.target === formula.id,
      ),
    ).toBe(true);
    const walkthrough = nodes.find((node) => node.name === 'code-walkthrough')!;
    const code = walkthrough.children!.find((node) => node.type === 'code')!;
    expect(code.lang).toBeTruthy();
    expect(code.value!.split('\n').length).toBeGreaterThanOrEqual(2);
    const steps = walkthrough.children!.filter((node) => node.name === 'step');
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.every((node) => node.attributes?.lines)).toBe(true);
    expect(flatten(steps).some((node) => node.type === 'inlineMath')).toBe(
      true,
    );
  });

  it('demonstrates diagram-local links, declared literal state, and aligned synchronized views', () => {
    const nodes = exampleDocuments().flatMap((document) =>
      flatten(document.children),
    );
    const diagram = nodes.find((node) => node.name === 'flowchart')!;
    const localNodes = diagram.children!.filter((node) => node.name === 'node');
    const localIds = new Set(localNodes.map((node) => node.attributes?.id));
    expect(localIds.size).toBeGreaterThanOrEqual(2);
    expect(
      localNodes.every((node) => !node.id && !!node.children?.length),
    ).toBe(true);
    const edge = diagram.children!.find((node) => node.name === 'edge')!;
    expect(localIds.has(edge.attributes?.from)).toBe(true);
    expect(localIds.has(edge.attributes?.to)).toBe(true);
    const variable = nodes.find((node) => node.name === 'variable')!;
    const toggle = nodes.find((node) => node.name === 'toggle')!;
    const conditional = nodes.find((node) => node.name === 'conditional')!;
    expect(toggle.attributes?.target).toBe(variable.attributes?.name);
    expect(conditional.attributes?.target).toBe(variable.attributes?.name);
    expect(conditional.attributes?.equals).toBe(
      toggle.attributes?.on ?? 'true',
    );
    expect(variable.attributes?.value).not.toBe(conditional.attributes?.equals);
    const sync = nodes.find((node) => node.name === 'sync')!;
    const views = sync.children!.filter((node) => node.name === 'tabs');
    expect(views).toHaveLength(2);
    const counts = views.map(
      (view) => view.children!.filter((node) => node.name === 'tab').length,
    );
    expect(counts[0]).toBeGreaterThanOrEqual(2);
    expect(new Set(counts).size).toBe(1);
  });
});
