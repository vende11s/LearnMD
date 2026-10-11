import { describe, expect, it } from 'vitest';
import { COMPONENTS, PUBLIC_COMPONENTS } from './registry';
import { extractLearnMDSource, LIMITS, parseLearnMD, safeUrl } from './parser';
import { buildGenerationPrompt } from './prompt';

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
      errors(':::detail-level{level="extra"}\nText\n:::')[0].message,
    ).toContain('level');
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

describe('generation prompt consistency', () => {
  it('includes at least 65 public components and all registered attributes and examples', () => {
    expect(PUBLIC_COMPONENTS.length).toBeGreaterThanOrEqual(65);
    expect(new Set(COMPONENTS.map((component) => component.name)).size).toBe(
      COMPONENTS.length,
    );
    const prompt = buildGenerationPrompt();
    for (const component of COMPONENTS) {
      expect(prompt).toContain(`### ${component.name}`);
      expect(prompt).toContain(component.example);
      for (const key of Object.keys(component.properties))
        expect(prompt).toContain(`- ${key}:`);
    }
    expect(prompt).toContain('outer fence MUST be longer');
    expect(prompt).toContain('Do not invent facts');
    expect(prompt).toContain('STRING value');
  });

  it('changes pedagogical style while keeping syntax constant', () => {
    expect(buildGenerationPrompt('rigorous')).toContain(
      'GENERATION STYLE: Rigorous',
    );
    expect(buildGenerationPrompt('unknown')).toBe(buildGenerationPrompt());
  });
});
