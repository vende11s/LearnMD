import { describe, expect, it } from 'vitest';
import { COMPONENTS, COMPONENT_MAP } from './registry';
import {
  extractLearnMDSource,
  LIMITS,
  parseLearnMD,
  safeUrl,
  textContent,
} from './parser';
import { buildFormatReference, buildGenerationPrompt } from './prompt';

const errors = (source: string) =>
  parseLearnMD(source).diagnostics.filter((item) => item.severity === 'error');

describe('LearnMD grammar', () => {
  it('parses metadata, Markdown, GFM, math, code, and stable heading IDs', () => {
    const doc = parseLearnMD(
      '---\ntitle: Linear models\ntags: [math, geometry]\nversion: "1.0"\n---\n# A model\n\n$x^2$ and **bold** text.\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n$$x+y=2$$\n\n```python\nx = 2\n```\n\n## Repeated\n\n## Repeated',
    );
    expect(doc.diagnostics).toEqual([]);
    expect(doc.metadata.title).toBe('Linear models');
    expect(doc.metadata.tags).toEqual(['math', 'geometry']);
    expect(doc.headings.map((heading) => heading.id)).toEqual([
      'a-model',
      'repeated',
      'repeated-2',
    ]);
    expect(doc.children.map((node) => node.type)).toEqual(
      expect.arrayContaining(['heading', 'paragraph', 'table', 'code']),
    );
    expect(
      doc.children
        .flatMap((node) => node.children ?? [])
        .some((node) => node.type === 'inlineMath'),
    ).toBe(true);
    expect(doc.wordCount).toBeGreaterThan(5);
  });

  it('composes nested directives without confusing code or math with structural fences', () => {
    const source =
      ':::::tabs\n::::tab{title="Example"}\n:::definition{title="Code as data"}\n```text\n:::not-a-block\n::: \n```\n\n$x+1$\n:::\n::::\n:::::';
    const doc = parseLearnMD(source);
    expect(doc.diagnostics).toEqual([]);
    expect(doc.children[0].name).toBe('tabs');
    expect(doc.children[0].children?.[0].name).toBe('tab');
    expect(doc.children[0].children?.[0].children?.[0].name).toBe('definition');
    expect(
      errors('::::proof\n:::step\nAssume the premises.\n:::\n::::'),
    ).toEqual([]);
  });

  it('extracts only complete, unambiguous pasted document fences', () => {
    expect(
      extractLearnMDSource('\uFEFF```learn.md\r\n# Title\r\n\r\nText\r\n```'),
    ).toBe('# Title\n\nText');
    expect(
      extractLearnMDSource('````markdown\n# Title\n```js\nx\n```\n````'),
    ).toContain('```js');
    expect(extractLearnMDSource('```md\n# One\n```\nProse\n```')).toMatch(
      /^```md/,
    );
    expect(
      extractLearnMDSource('Here is your note:\n```md\n# Title\n```'),
    ).toMatch(/^Here/);
    expect(
      parseLearnMD('```learn.md\n# Pasted title\n```').metadata.title,
    ).toBe('Pasted title');
    expect(extractLearnMDSource('    indented code\n')).toBe(
      '    indented code\n',
    );
    expect(parseLearnMD('    indented code\n').children[0].type).toBe('code');
    expect(errors('   \n  ')[0].message).toContain('Paste or import');
  });

  it('reports actionable line-aware errors for malformed nesting and missing closures', () => {
    const sameFence = errors(':::tabs\n:::tab{title="One"}\nText\n:::\n:::');
    expect(
      sameFence.some(
        (error) => error.message.includes('fewer colons') && error.line === 2,
      ),
    ).toBe(true);
    expect(errors(':::definition\nText')[0]).toMatchObject({
      line: 1,
      severity: 'error',
    });
    expect(errors(':::')[0].message).toMatch(/no matching/);
    expect(
      errors('::::tabs\n:::tab{title="One"}\nText\n::::').some((error) =>
        error.message.includes('exactly 3'),
      ),
    ).toBe(true);
    expect(
      errors(':::definition{title="Unclosed}\nText\n:::')[0],
    ).toMatchObject({
      line: 1,
      message: expect.stringContaining('Unclosed quoted attribute'),
    });
  });

  it('retains unknown components as recoverable content', () => {
    const doc = parseLearnMD(':::future-component\nHelpful text.\n:::');
    expect(doc.children[0].name).toBe('future-component');
    expect(doc.diagnostics[0].severity).toBe('warning');
    expect(doc.children[0].children?.[0].type).toBe('paragraph');
  });
});

describe('component and metadata schemas', () => {
  it('validates required attributes, enums, ranges, unknown properties, and child relationships', () => {
    expect(
      errors(':::stack{direction="diagonal"}\nText\n:::')[0].message,
    ).toContain('direction');
    expect(errors(':::fill-blank\nComplete this.\n:::')[0].message).toContain(
      'answer',
    );
    expect(errors(':::columns{columns="99"}\nText\n:::')[0].message).toContain(
      'columns',
    );
    expect(errors(':::columns{columns="1.5"}\nText\n:::')[0].message).toContain(
      'integer',
    );
    expect(
      errors(':::definition{onclick="alert(1)"}\nText\n:::')[0].message,
    ).toMatch(/Unrecognized/);
    expect(errors(':::tab{title="Orphan"}\nText\n:::')[0].message).toMatch(
      /direct child/,
    );
    expect(
      errors('::::tabs\n:::step\nText\n:::\n::::').some((error) =>
        error.message.includes('accepts'),
      ),
    ).toBe(true);
  });

  it('validates document metadata without coercing arbitrary structures', () => {
    expect(errors('---\ntitle: [wrong]\n---\n# Text')[0].message).toContain(
      'title',
    );
    expect(errors('---\nversion: "2.0"\n---\n# Text')[0].message).toContain(
      'Unsupported',
    );
    expect(errors('---\ntags: not-a-list\n---\n# Text')[0].message).toContain(
      'tags',
    );
    expect(
      parseLearnMD('---\nversion: 1.0\n---\n# Title').metadata.version,
    ).toBe('1.0');
    expect(parseLearnMD('No heading here.').metadata.title).toBe(
      'Untitled note',
    );
  });

  it('requires useful choice and code comparison configurations', () => {
    expect(
      errors('::::quiz\n:::choice{correct="false"}\nNo\n:::\n::::').some(
        (error) => error.message.includes('correct choice'),
      ),
    ).toBe(true);
    expect(
      errors('::::code-diff\n:::before\nOld\n:::\n::::').some((error) =>
        error.message.includes('after'),
      ),
    ).toBe(true);
  });

  for (const component of COMPONENTS)
    it(`validates the standalone ${component.name} example`, () => {
      expect(
        errors(component.example),
        `${component.name}: ${JSON.stringify(errors(component.example))}`,
      ).toEqual([]);
    });
});

describe('semantic references and shared state', () => {
  it('resolves forward references and rejects dangling or duplicate IDs', () => {
    expect(
      errors(
        ':::reference{target="later"}\n:::\n\n:::definition{id="later"}\nA definition.\n:::',
      ),
    ).toEqual([]);
    expect(errors(':::reference{target="missing"}\n:::')[0].message).toContain(
      'does not exist',
    );
    expect(
      errors(
        ':::definition{id="same"}\nA\n:::\n\n:::definition{id="same"}\nB\n:::',
      )[0].message,
    ).toContain('Duplicate semantic');
    expect(
      errors('# 2. Limits\n\n:::reference{target="2-limits"}\n:::'),
    ).toEqual([]);
    expect(errors('# 数学\n\n:::reference{target="数学"}\n:::')).toEqual([]);
    expect(parseLearnMD(`# ${'x'.repeat(400)}`).metadata.title).toHaveLength(
      300,
    );
  });

  it('validates document-scoped string declarations and consumers', () => {
    expect(
      errors(
        ':::conditional{target="show" equals="true"}\nVisible\n:::\n\n:::variable{name="show" value="true"}\n:::',
      ),
    ).toEqual([]);
    expect(errors(':::toggle{target="missing"}\n:::')[0].message).toContain(
      'Unknown variable',
    );
    expect(
      errors(
        ':::variable{name="x" value="a"}\n:::\n\n:::variable{name="x" value="b"}\n:::',
      )[0].message,
    ).toContain('declared more than once');
    expect(
      errors(
        ':::variable{name="x" value="a"}\n:::\n\n:::toggle{target="x" on="a" off="a"}\n:::',
      )[0].message,
    ).toContain('different values');
  });

  it('limits synchronization scope to descendants of each wrapper', () => {
    const first =
      ':::::sync{group="local"}\n::::steps\n:::step\nOne\n:::\n::::\n:::::';
    const outside = '::::steps\n:::step\nOne\n:::\n:::step\nTwo\n:::\n::::';
    expect(parseLearnMD(`${first}\n\n${outside}`).diagnostics).toEqual([]);
  });

  it('scopes diagram node IDs locally and checks every connection', () => {
    const diagram =
      '::::graph\n:::node{id="a" label="A"}\nInfo\n:::\n:::node{id="b" label="B"}\nInfo\n:::\n:::edge{from="a" to="b"}\n:::\n::::';
    expect(errors(`${diagram}\n\n${diagram}`)).toEqual([]);
    expect(
      errors(diagram.replace('to="b"', 'to="missing"'))[0].message,
    ).toContain('Unknown graph node');
  });
});

describe('carousel layout', () => {
  it('keeps rich question, source-context, and summary content inside slides', () => {
    const example = COMPONENTS.find(
      (component) => component.name === 'carousel',
    )!;
    const document = parseLearnMD(example.example);
    expect(document.diagnostics).toEqual([]);
    const carousel = document.children[0];
    expect(carousel.name).toBe('carousel');
    expect(carousel.attributes?.initial).toBe('0');
    const slides =
      carousel.children?.filter((node) => node.name === 'slide') ?? [];
    expect(slides).toHaveLength(5);
    expect(slides[0].children?.some((node) => node.type === 'blockquote')).toBe(
      true,
    );
    expect(slides[1].children?.[0].name).toBe('quiz');
    expect(slides[2].children?.[0].name).toBe('quiz');
    expect(slides[3].children?.[0].name).toBe('question');
    expect(slides[4].children?.[0].name).toBe('summary');
  });

  it('requires slide children, accepts optional slide titles, and validates its properties', () => {
    expect(errors(':::carousel\n:::')[0].message).toContain(
      'at least one slide',
    );
    expect(errors(':::slide\nOrphan\n:::')[0].message).toContain(
      'direct child of carousel',
    );
    expect(
      errors('::::carousel\n:::slide\nAn untitled page.\n:::\n::::'),
    ).toEqual([]);
    expect(
      errors('::::carousel{initial="1.5"}\n:::slide\nText\n:::\n::::')[0]
        .message,
    ).toContain('integer');
    expect(
      errors('::::carousel{autoplay="true"}\n:::slide\nText\n:::\n::::')[0]
        .message,
    ).toContain('Unrecognized');
    expect(
      errors(
        '::::carousel\n:::question{answer="Two"}\nOne plus one?\n:::\n::::',
      ).some((error) =>
        error.message.includes('accepts these direct child blocks: slide'),
      ),
    ).toBe(true);
  });

  it('supports long question sets without a small fixed slide-count limit', () => {
    const slides = Array.from(
      { length: 150 },
      (_, index) =>
        `:::slide{title="Question ${index + 1}"}\nExplain concept ${index + 1}.\n:::`,
    ).join('\n\n');
    const document = parseLearnMD(
      `::::carousel{initial="149"}\n${slides}\n::::`,
    );
    expect(document.diagnostics).toEqual([]);
    expect(
      document.children[0].children?.filter((node) => node.name === 'slide'),
    ).toHaveLength(150);
  });

  it('resolves semantic references to slides and includes carousels in sync validation', () => {
    const referenced =
      '::::carousel\n:::slide{id="reasoning"}\nExplain the implication.\n:::\n::::\n\n:::reference{target="reasoning"}\n:::';
    expect(errors(referenced)).toEqual([]);
    const synced =
      ':::::sync{group="lesson"}\n::::carousel\n:::slide\nFirst\n:::\n:::slide\nSecond\n:::\n::::\n::::steps\n:::step\nOnly one\n:::\n::::\n:::::';
    expect(
      parseLearnMD(synced).diagnostics.some((item) =>
        item.message.includes('different numbers of items'),
      ),
    ).toBe(true);
  });
});

describe('untrusted-source handling', () => {
  it('strips HTML and dangerous links while preserving safe text', () => {
    const doc = parseLearnMD(
      '# Safe\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n[good](https://example.com)',
    );
    expect(doc.children.some((node) => node.type === 'html')).toBe(false);
    expect(
      doc.diagnostics.some((item) => item.message.includes('Raw HTML')),
    ).toBe(true);
    expect(
      doc.diagnostics.some((item) => item.message.includes('Unsafe URL')),
    ).toBe(true);
    const links = doc.children
      .flatMap((node) => node.children ?? [])
      .filter((node) => node.type === 'link');
    expect(links.map((node) => node.url)).toEqual(['', 'https://example.com']);
  });

  it('denies script, encoded, protocol-relative, data, traversal, and filesystem URLs', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java%0Ascript:alert(1)',
      '//evil.test/x',
      'data:image/svg+xml,test',
      'file:///secret',
      'blob:https://example.test/id',
      '../secret.png',
      '%2e%2e/secret',
      '\\evil.test\\x',
      'https://a:b@example.com',
    ])
      expect(safeUrl(url), url).toBeUndefined();
    expect(safeUrl('https://example.com/a.png', 'image')).toBeTruthy();
    expect(safeUrl('assets/a.png', 'image')).toBeTruthy();
    expect(safeUrl('#definition')).toBe('#definition');
  });

  it('rejects YAML aliases, duplicate keys, and excessive source size', () => {
    expect(
      errors('---\ntitle: &a Test\ndescription: *a\n---\n# Text')[0].message,
    ).toContain('YAML');
    expect(
      errors('---\ntitle: First\ntitle: Second\n---\n# Text')[0].message,
    ).toContain('YAML');
    const huge = parseLearnMD('x'.repeat(LIMITS.sourceCharacters + 1));
    expect(huge.children).toEqual([]);
    expect(huge.diagnostics[0].message).toContain('1 MB');
  });

  it('bounds nesting and oversized source lines before parsing', () => {
    expect(
      parseLearnMD('>'.repeat(50) + ' deep').diagnostics.some((item) =>
        item.message.includes('nesting'),
      ),
    ).toBe(true);
    expect(
      parseLearnMD('x'.repeat(LIMITS.lineCharacters + 1)).children,
    ).toEqual([]);
  });

  it('rejects diagrams too large for the renderer instead of silently truncating them', () => {
    const nodes = Array.from(
      { length: 61 },
      (_, index) =>
        `:::node{id="n${index}" label="Node ${index}"}\nExplanation\n:::`,
    ).join('\n\n');
    expect(
      errors(`::::graph\n${nodes}\n::::`).some((error) =>
        error.message.includes('at most 60'),
      ),
    ).toBe(true);
  });
});

describe('compatibility with retired density annotations', () => {
  it.each(['concise', 'standard', 'detailed'])(
    'preserves all content from an old %s wrapper as an ordinary section',
    (level) => {
      const source = `::::detail-level{level="${level}" id="legacy-section" title="Keep this explanation"}\n## Retained heading\n\n:::theorem{id="retained-theorem"}\nThe statement and its $x^2$ notation remain available.\n:::\n::::\n\n:::reference{target="legacy-section"}\n:::`;
      const document = parseLearnMD(source);
      expect(
        document.diagnostics.filter((item) => item.severity === 'error'),
      ).toEqual([]);
      expect(document.diagnostics).toEqual([
        expect.objectContaining({ severity: 'warning', line: 1 }),
      ]);
      const section = document.children[0];
      expect(section.name).toBe('section');
      expect(section.id).toBe('legacy-section');
      expect(section.attributes).toEqual({
        id: 'legacy-section',
        title: 'Keep this explanation',
      });
      expect(section.children?.map((node) => node.name ?? node.type)).toEqual([
        'heading',
        'theorem',
      ]);
      expect(textContent(section)).toContain(
        'The statement and its x^2 notation remain available.',
      );
      expect(document.headings[0].text).toBe('Retained heading');
      expect(document.source).toBe(source);
    },
  );

  it('keeps old layers as manual alternatives while discarding their retired level attribute', () => {
    const document = parseLearnMD(
      '::::layers\n:::layer{title="Overview" level="concise"}\nThe central idea.\n:::\n:::layer{title="Proof" level="detailed"}\nThe complete argument.\n:::\n::::',
    );
    expect(
      document.diagnostics.filter((item) => item.severity === 'error'),
    ).toEqual([]);
    expect(
      document.diagnostics.filter((item) => item.severity === 'warning'),
    ).toHaveLength(2);
    const layers = document.children[0];
    expect(layers.name).toBe('layers');
    expect(layers.children?.map((node) => node.attributes)).toEqual([
      { title: 'Overview' },
      { title: 'Proof' },
    ]);
    expect(textContent(layers)).toContain('The central idea.');
    expect(textContent(layers)).toContain('The complete argument.');
    expect(
      COMPONENT_MAP.get('layer')!.schema.safeParse({ level: 'detailed' })
        .success,
    ).toBe(false);
  });

  it('does not expose retired density authoring in the registry, generation prompt, or format reference', () => {
    expect(COMPONENT_MAP.has('detail-level')).toBe(false);
    expect(COMPONENT_MAP.get('layer')!.properties).not.toHaveProperty('level');
    for (const document of [buildGenerationPrompt(), buildFormatReference()]) {
      expect(document).not.toContain('detail-level');
      expect(document).not.toContain('concise-mode');
      expect(document).not.toContain('Concise, Standard, and Detailed');
      expect(document).not.toContain('Associated detail level');
      expect(document).toContain('Manually switch between named explanations');
    }
  });
});
