import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { COMPONENT_MAP, DIAGRAM_LIMITS, FORMAT_VERSION } from './registry';
import type {
  Diagnostic,
  DocumentMetadata,
  LearnNode,
  ParsedDocument,
} from './types';

export const LIMITS = Object.freeze({
  sourceCharacters: 1_000_000,
  lineCharacters: 20_000,
  lines: 25_000,
  nodes: 20_000,
  depth: 40,
  frontmatterCharacters: 32_000,
});
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkFrontmatter, ['yaml']);
const metadataSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    subject: z.string().max(120).optional(),
    author: z.string().max(300).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    version: z.union([z.string(), z.number()]).optional(),
  })
  .strict();
const diagrams = new Set([
  'flowchart',
  'architecture',
  'sequence',
  'graph',
  'state-machine',
  'concept-map',
  'decision-tree',
]);
const localIdNodes = new Set(['node', 'participant']);
const navigation = new Set([
  'steps',
  'derivation',
  'tabs',
  'layers',
  'variants',
  'spotlight',
]);

/** Extract only an unambiguous outer fence around a complete pasted document. */
export function extractLearnMDSource(input: string): string {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.trim().split('\n');
  if (lines.length < 3) return normalized;
  const opening =
    /^(\u0060{3,}|~{3,})(?:learn(?:\.md|md)?|markdown|md)?\s*$/i.exec(lines[0]);
  if (!opening) return normalized;
  const fence = opening[1];
  if (lines[lines.length - 1].trim() !== fence) return normalized;
  // An exact intermediate closing fence makes the enclosing boundary ambiguous.
  if (lines.slice(1, -1).some((line) => line.trim() === fence))
    return normalized;
  return lines.slice(1, -1).join('\n').trim();
}

export function textContent(node: LearnNode): string {
  if (typeof node.value === 'string') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  return (node.children ?? []).map(textContent).join('');
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/[\s_]+/g, '-');
  return slug.slice(0, 80).replace(/-$/, '') || 'section';
}

/** Author URLs never receive script, data, protocol-relative, file, or blob privileges. */
export function safeUrl(
  value: string,
  kind: 'link' | 'image' | 'media' = 'link',
): string | undefined {
  const candidate = value.trim();
  if (
    !candidate ||
    /[\u0000-\u0020\u007f\\]/.test(candidate) ||
    candidate.startsWith('//')
  )
    return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return undefined;
  }
  if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith('//'))
    return undefined;
  if (candidate.startsWith('#')) return kind === 'link' ? candidate : undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    try {
      const url = new URL(candidate);
      if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && kind === 'link')
      )
        return url.username || url.password ? undefined : candidate;
      if (url.protocol === 'mailto:' && kind === 'link') return candidate;
      return undefined;
    } catch {
      return undefined;
    }
  }
  if (decoded.split(/[/?#]/).includes('..') || decoded.startsWith('/'))
    return undefined;
  return candidate;
}

function lineOf(node: LearnNode): number | undefined {
  return (node.position as { start?: { line?: number } } | undefined)?.start
    ?.line;
}

type Fence = { width: number; name: string; line: number };
/** Lexical fence checking supplements remark's recovery. Nested structure is parsed by remark, never regex. */
function inspectFences(source: string): {
  diagnostics: Diagnostic[];
  unsafe: boolean;
  openings: Map<number, string>;
} {
  const diagnostics: Diagnostic[] = [];
  const openings = new Map<number, string>();
  const stack: Fence[] = [];
  let codeFence: { char: string; width: number } | undefined;
  let inFrontmatter = false;
  let unsafe = false;
  const lines = source.split('\n');
  if (lines.length > LIMITS.lines)
    return {
      diagnostics: [
        {
          severity: 'error',
          message: `Document exceeds ${LIMITS.lines.toLocaleString()} lines.`,
        },
      ],
      unsafe: true,
      openings,
    };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.length > LIMITS.lineCharacters) {
      diagnostics.push({
        severity: 'error',
        message: `Line exceeds ${LIMITS.lineCharacters.toLocaleString()} characters. Split long source lines.`,
        line: index + 1,
      });
      unsafe = true;
      break;
    }
    if (index === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---' || line.trim() === '...') inFrontmatter = false;
      continue;
    }
    const fenceMatch = /^\s{0,3}(\u0060{3,}|~{3,})(.*)$/.exec(line);
    if (codeFence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === codeFence.char &&
        fenceMatch[1].length >= codeFence.width &&
        !fenceMatch[2].trim()
      )
        codeFence = undefined;
      continue;
    }
    if (fenceMatch) {
      codeFence = { char: fenceMatch[1][0], width: fenceMatch[1].length };
      continue;
    }
    // Guard deeply indented Markdown before invoking recursive parser internals.
    if (/^[ \t]{160,}\S/.test(line) || /^(?:\s{0,3}>){41}/.test(line)) {
      diagnostics.push({
        severity: 'error',
        message: 'Markdown nesting is too deep. Keep nesting below 40 levels.',
        line: index + 1,
      });
      unsafe = true;
      break;
    }
    const token = /^\s{0,3}(:{3,})(.*)$/.exec(line);
    if (!token) continue;
    const width = token[1].length;
    const tail = token[2].trim();
    if (!tail) {
      if (!stack.length) {
        diagnostics.push({
          severity: 'error',
          message: 'Closing directive fence has no matching opening block.',
          line: index + 1,
        });
        continue;
      }
      const current = stack[stack.length - 1];
      if (width !== current.width) {
        diagnostics.push({
          severity: 'error',
          message: `Close ${current.name} from line ${current.line} with exactly ${current.width} colons before closing its parent.`,
          line: index + 1,
        });
        let matching = -1;
        for (let i = stack.length - 1; i >= 0; i--)
          if (stack[i].width === width) {
            matching = i;
            break;
          }
        if (matching >= 0) stack.splice(matching);
      } else stack.pop();
      continue;
    }
    const name = /^([a-zA-Z][\w-]*)(?:\[.*?\])?(?:\{.*\})?\s*$/.exec(tail)?.[1];
    if (!name) {
      diagnostics.push({
        severity: 'error',
        message:
          'Malformed directive. Use :::name{key="value"}, with one opening or closing fence per line.',
        line: index + 1,
      });
      continue;
    }
    let quote: string | undefined;
    let inAttributes = false;
    for (let cursor = 0; cursor < tail.length; cursor++) {
      const char = tail[cursor];
      if (!inAttributes) {
        if (char === '{') inAttributes = true;
        continue;
      }
      if (quote) {
        if (char === quote) quote = undefined;
      } else if (char === '"' || char === "'") quote = char;
    }
    if (quote)
      diagnostics.push({
        severity: 'error',
        message: `Unclosed quoted attribute in ${name}. Close the ${quote} before the final }.`,
        line: index + 1,
      });
    openings.set(index + 1, name);
    const parent = stack[stack.length - 1];
    if (parent && width >= parent.width)
      diagnostics.push({
        severity: 'error',
        message: `Nested ${name} needs fewer colons than parent ${parent.name} (line ${parent.line}). Increase the outer fence length.`,
        line: index + 1,
      });
    stack.push({ width, name, line: index + 1 });
    if (stack.length > LIMITS.depth) {
      diagnostics.push({
        severity: 'error',
        message: `Directive nesting exceeds ${LIMITS.depth} levels.`,
        line: index + 1,
      });
      unsafe = true;
      break;
    }
  }
  for (const fence of stack)
    diagnostics.push({
      severity: 'error',
      message: `Unclosed ${fence.name} block. Add a closing line with ${fence.width} colons.`,
      line: fence.line,
    });
  if (inFrontmatter)
    diagnostics.push({
      severity: 'error',
      message: 'Unclosed YAML frontmatter. Add a closing --- line.',
      line: 1,
    });
  return { diagnostics, unsafe, openings };
}

function readMetadata(
  node: LearnNode | undefined,
  diagnostics: Diagnostic[],
): Partial<DocumentMetadata> {
  if (!node?.value) return {};
  if (node.value.length > LIMITS.frontmatterCharacters) {
    diagnostics.push({
      severity: 'error',
      message: 'YAML frontmatter exceeds 32,000 characters.',
      line: 1,
    });
    return {};
  }
  try {
    const document = parseDocument(node.value, {
      uniqueKeys: true,
      merge: false,
      strict: true,
    });
    if (document.errors.length) throw new Error(document.errors[0].message);
    const value: unknown = document.toJS({ maxAliasCount: 0 });
    const result = metadataSchema.safeParse(value ?? {});
    if (!result.success) {
      for (const issue of result.error.issues)
        diagnostics.push({
          severity: 'error',
          message: `Frontmatter ${issue.path.join('.') || 'fields'}: ${issue.message}`,
          line: 1,
        });
      return {};
    }
    const version = String(result.data.version ?? FORMAT_VERSION);
    if (!['1', '1.0'].includes(version))
      diagnostics.push({
        severity: 'error',
        message: `Unsupported LearnMD version "${version}". This reader supports 1.0.`,
        line: 1,
      });
    return { ...result.data, version: version === '1' ? '1.0' : version };
  } catch (error) {
    diagnostics.push({
      severity: 'error',
      message: `Invalid YAML frontmatter: ${error instanceof Error ? error.message : 'Cannot parse metadata.'}`,
      line: 1,
    });
    return {};
  }
}

export function parseLearnMD(input: string): ParsedDocument {
  const source = extractLearnMDSource(input);
  const result: ParsedDocument = {
    source,
    metadata: { title: 'Untitled note', tags: [], version: FORMAT_VERSION },
    children: [],
    diagnostics: [],
    headings: [],
    wordCount: 0,
  };
  if (!source.trim()) {
    result.diagnostics.push({
      severity: 'error',
      message: 'Paste or import a document before continuing.',
    });
    return result;
  }
  if (source.length > LIMITS.sourceCharacters) {
    result.diagnostics.push({
      severity: 'error',
      message:
        'Document exceeds the 1 MB source limit. Split it into smaller notes.',
    });
    return result;
  }
  const fenceCheck = inspectFences(source);
  result.diagnostics.push(...fenceCheck.diagnostics);
  if (fenceCheck.unsafe) return result;
  try {
    const tree = processor.parse(source) as unknown as LearnNode;
    const yaml = tree.children?.find((node) => node.type === 'yaml');
    const parsedMetadata = readMetadata(yaml, result.diagnostics);
    result.metadata = { ...result.metadata, ...parsedMetadata };
    result.children = (tree.children ?? []).filter(
      (node) => node.type !== 'yaml',
    );
    const semanticIds = new Map<string, LearnNode>();
    const variables = new Map<string, LearnNode>();
    const references: LearnNode[] = [];
    const consumers: LearnNode[] = [];
    const syncGroups = new Map<string, number[]>();
    const parsedDirectiveLines = new Set<number>();
    const counts = new Map<string, number>();
    let firstTitle = '';
    let visited = 0;
    let words = '';
    let discardedHtml = false;
    const diagnose = (
      node: LearnNode,
      message: string,
      severity: Diagnostic['severity'] = 'error',
    ) => result.diagnostics.push({ severity, message, line: lineOf(node) });
    const claimId = (id: string, node: LearnNode) => {
      if (semanticIds.has(id))
        diagnose(
          node,
          `Duplicate semantic ID "${id}". Give each heading or component a unique ID.`,
        );
      else semanticIds.set(id, node);
      node.id = id;
    };
    const walk = (
      nodes: LearnNode[],
      depth: number,
      parent?: LearnNode,
      group?: string,
    ): LearnNode[] => {
      if (depth > LIMITS.depth)
        throw new Error(`Content nesting exceeds ${LIMITS.depth} levels.`);
      return nodes.filter((node) => {
        let nodeGroup = group;
        if (++visited > LIMITS.nodes)
          throw new Error(
            `Document exceeds ${LIMITS.nodes.toLocaleString()} content nodes.`,
          );
        if (node.type === 'html') {
          discardedHtml = true;
          return false;
        }
        if (
          ['text', 'math', 'inlineMath', 'code'].includes(node.type) &&
          node.value
        )
          words += ` ${node.value}`;
        if (node.type === 'heading') {
          const title = textContent(node);
          if (!firstTitle && node.depth === 1) firstTitle = title;
          let slug = slugify(title);
          const base = slug;
          let suffix = 1;
          while (semanticIds.has(slug)) slug = `${base}-${++suffix}`;
          claimId(slug, node);
          result.headings.push({
            id: slug,
            text: title,
            depth: node.depth ?? 2,
          });
        }
        if (node.name && node.type.endsWith('Directive')) {
          const directiveLine = lineOf(node);
          if (directiveLine) parsedDirectiveLines.add(directiveLine);
          const component = COMPONENT_MAP.get(node.name);
          // remark uses null for bare shorthand attributes. Normalize without trusting prototypes.
          node.attributes = Object.fromEntries(
            Object.entries(node.attributes ?? {}).map(([key, value]) => [
              key,
              value == null ? '' : String(value),
            ]),
          );
          const attrs = node.attributes;
          if (!component)
            diagnose(
              node,
              `Unknown component "${node.name}". Its content is shown as ordinary Markdown.`,
              'warning',
            );
          else {
            const checked = component.schema.safeParse(attrs);
            if (!checked.success)
              for (const issue of checked.error.issues)
                diagnose(
                  node,
                  `${node.name}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`,
                );
            if (
              component.parents &&
              !component.parents.includes(parent?.name ?? '')
            )
              diagnose(
                node,
                `${node.name} must be a direct child of ${component.parents.join(', ')}.`,
              );
            if (component.children) {
              const childBlocks = (node.children ?? []).filter(
                (child) => child.name,
              );
              for (const childNode of childBlocks)
                if (!component.children.includes(childNode.name!))
                  diagnose(
                    childNode,
                    `${node.name} accepts these direct child blocks: ${component.children.join(', ')}.`,
                  );
              if (!childBlocks.length)
                diagnose(
                  node,
                  `${node.name} needs at least one ${component.children.join(' or ')} child block.`,
                );
            }
          }
          if (!localIdNodes.has(node.name)) {
            const count = (counts.get(node.name) ?? 0) + 1;
            counts.set(node.name, count);
            if (attrs.id) claimId(attrs.id, node);
            else {
              let generated = `${node.name}-${count}`;
              while (semanticIds.has(generated)) generated += '-block';
              claimId(generated, node);
            }
            if (['theorem', 'lemma', 'formula'].includes(node.name))
              node.number = count;
          }
          if (
            node.name === 'reference' ||
            (node.name === 'item' && attrs.target)
          )
            references.push(node);
          if (node.name === 'variable' && attrs.name) {
            if (variables.has(attrs.name))
              diagnose(
                node,
                `Variable "${attrs.name}" is declared more than once. Variables have document scope.`,
              );
            else variables.set(attrs.name, node);
          }
          if (['toggle', 'conditional'].includes(node.name))
            consumers.push(node);
          if (
            node.name === 'toggle' &&
            (attrs.on ?? 'true') === (attrs.off ?? 'false')
          )
            diagnose(
              node,
              'toggle.on and toggle.off must be different values.',
            );
          if (attrs.lines)
            for (const range of attrs.lines.split(',')) {
              const [start, end = start] = range.split('-').map(Number);
              if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 1 ||
                end < start ||
                end > LIMITS.lines
              )
                diagnose(
                  node,
                  `Invalid code line range "${range}". Use ascending lines from 1 to ${LIMITS.lines}.`,
                );
            }
          if (node.name === 'sync' && attrs.group) nodeGroup = attrs.group;
          if (navigation.has(node.name) && nodeGroup) {
            const length = (node.children ?? []).filter(
              (child) => child.name,
            ).length;
            syncGroups.set(nodeGroup, [
              ...(syncGroups.get(nodeGroup) ?? []),
              length,
            ]);
          }
          if (diagrams.has(node.name)) {
            const localNodes = (node.children ?? []).filter((child) =>
              localIdNodes.has(child.name ?? ''),
            );
            const nodeLimit =
              node.name === 'sequence'
                ? DIAGRAM_LIMITS.participants
                : DIAGRAM_LIMITS.nodes;
            const edges = (node.children ?? []).filter((child) =>
              ['edge', 'message'].includes(child.name ?? ''),
            );
            const edgeLimit =
              node.name === 'sequence'
                ? DIAGRAM_LIMITS.messages
                : DIAGRAM_LIMITS.edges;
            if (localNodes.length > nodeLimit)
              diagnose(
                node,
                `${node.name} supports at most ${nodeLimit} ${node.name === 'sequence' ? 'participants' : 'nodes'}. Split the diagram into smaller views.`,
              );
            if (edges.length > edgeLimit)
              diagnose(
                node,
                `${node.name} supports at most ${edgeLimit} ${node.name === 'sequence' ? 'messages' : 'edges'}. Split the diagram into smaller views.`,
              );
            const localIds = new Set<string>();
            for (const localNode of localNodes) {
              const localId = localNode.attributes?.id;
              if (localId) {
                if (localIds.has(localId))
                  diagnose(
                    localNode,
                    `Duplicate diagram-local ID "${localId}".`,
                  );
                localIds.add(localId);
              }
            }
            if (!localNodes.length)
              diagnose(
                node,
                `${node.name} requires at least one ${node.name === 'sequence' ? 'participant' : 'node'}.`,
              );
            for (const childNode of node.children ?? []) {
              const keys = ['edge', 'message'].includes(childNode.name ?? '')
                ? ['from', 'to']
                : childNode.name === 'node'
                  ? ['next', 'yes', 'no']
                  : [];
              for (const key of keys) {
                const target = childNode.attributes?.[key];
                if (target && !localIds.has(target))
                  diagnose(
                    childNode,
                    `Unknown ${node.name} node "${target}" in ${key}. IDs are local to this diagram.`,
                  );
              }
            }
            for (const key of ['start', 'root'])
              if (attrs[key] && !localIds.has(attrs[key]))
                diagnose(node, `Unknown initial diagram node "${attrs[key]}".`);
          }
          if (node.name === 'quiz') {
            const choices = (node.children ?? []).filter(
              (child) => child.name === 'choice',
            );
            const correct = choices.filter(
              (child) => child.attributes?.correct === 'true',
            );
            if (
              !correct.length ||
              (attrs.multiple !== 'true' && correct.length !== 1)
            )
              diagnose(
                node,
                'A single-answer quiz needs exactly one correct choice; a multiple-answer quiz needs at least one.',
              );
            if (choices.length < 2)
              diagnose(node, 'A quiz needs at least two choices.');
          }
          if (node.name === 'code-diff')
            for (const part of ['before', 'after'])
              if (!(node.children ?? []).some((child) => child.name === part))
                diagnose(node, `code-diff requires a ${part} child.`);
          if (node.name === 'image-annotation')
            for (const childNode of node.children ?? [])
              if (
                childNode.name === 'annotation' &&
                (!childNode.attributes?.x || !childNode.attributes?.y)
              )
                diagnose(
                  childNode,
                  'Image annotations need x and y percentage coordinates.',
                );
          if (
            attrs.src &&
            !safeUrl(attrs.src, node.name === 'embed' ? 'media' : 'image')
          )
            diagnose(
              node,
              'Unsafe resource URL. Use an HTTPS URL or a relative asset path without parent-directory traversal.',
            );
        }
        if (
          node.url &&
          !safeUrl(node.url, node.type === 'image' ? 'image' : 'link')
        ) {
          diagnose(
            node,
            'Unsafe URL removed. Use a safe relative path, HTTPS URL, or document anchor.',
            'warning',
          );
          node.url = '';
        }
        if (node.children)
          node.children = walk(
            node.children,
            depth + 1,
            node.name ? node : parent,
            nodeGroup,
          );
        return true;
      });
    };
    result.children = walk(result.children, 0);
    for (const [line, name] of fenceCheck.openings)
      if (!parsedDirectiveLines.has(line))
        result.diagnostics.push({
          severity: 'error',
          message: `Could not parse ${name} as a directive. Check its quoted attributes and place blank lines around the block.`,
          line,
        });
    for (const node of references)
      if (node.attributes?.target && !semanticIds.has(node.attributes.target))
        diagnose(
          node,
          `Reference target "${node.attributes.target}" does not exist in this document.`,
        );
    for (const node of consumers)
      if (node.attributes?.target && !variables.has(node.attributes.target))
        diagnose(
          node,
          `Unknown variable "${node.attributes.target}". Declare it with a variable block.`,
        );
    for (const [group, sizes] of syncGroups)
      if (new Set(sizes).size > 1)
        result.diagnostics.push({
          severity: 'warning',
          message: `Synchronization group "${group}" has blocks with different numbers of items. Shorter blocks clamp their active item.`,
        });
    if (discardedHtml)
      result.diagnostics.push({
        severity: 'warning',
        message:
          'Raw HTML is not supported and was removed. Use Markdown or LearnMD components.',
      });
    if (!parsedMetadata.title)
      result.metadata.title = firstTitle.slice(0, 300) || 'Untitled note';
    result.wordCount = words.trim() ? words.trim().split(/\s+/).length : 0;
  } catch (error) {
    result.children = [];
    result.headings = [];
    result.diagnostics.push({
      severity: 'error',
      message: `Cannot safely parse document: ${error instanceof Error ? error.message : 'Unexpected parser error.'}`,
    });
  }
  return result;
}
