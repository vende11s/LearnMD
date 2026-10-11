import { useEffect, useId, useMemo, useState } from 'react';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Play,
} from 'lucide-react';
import type { LearnNode } from '../format/types';
import {
  assetSource,
  attr,
  BlockHeading,
  elementId,
  flag,
  hasAnchor,
  named,
  plainText,
  rest,
  safeLink,
  titleOf,
  useCopy,
  useReader,
  useSelection,
} from './context';

export function MathContent({
  value,
  display = false,
}: {
  value: string;
  display?: boolean;
}) {
  const { copy, copied, error } = useCopy();
  const output = useMemo(() => {
    if (value.length > 20000)
      return { error: 'This expression exceeds the safe rendering limit.' };
    try {
      return {
        html: katex.renderToString(value, {
          displayMode: display,
          throwOnError: true,
          strict: 'ignore',
          trust: false,
          maxExpand: 300,
          maxSize: 20,
          output: 'htmlAndMathml',
        }),
      };
    } catch {
      return { error: 'This LaTeX expression could not be rendered.' };
    }
  }, [value, display]);
  if (output.error)
    return (
      <span className="learn-math-error" title={output.error}>
        <code>{value}</code>
        <span className="learn-sr-only">{output.error}</span>
      </span>
    );
  // Only KaTeX output enters this sink. trust:false prevents HTML, URLs, and HTML-extension injection.
  if (!display)
    return (
      <span
        className="learn-math-inline"
        dangerouslySetInnerHTML={{ __html: output.html! }}
      />
    );
  return (
    <div className="learn-math-display">
      <div
        className="learn-math-scroll"
        dangerouslySetInnerHTML={{ __html: output.html! }}
      />
      <button
        type="button"
        className="learn-copy-math print-hide"
        onClick={() => copy(value)}
        aria-label={copied ? 'LaTeX copied' : 'Copy LaTeX'}
        title={
          error
            ? 'Could not copy. Select the expression instead.'
            : copied
              ? 'Copied'
              : 'Copy LaTeX'
        }
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function highlight(value: string, language?: string) {
  if (!language || !hljs.getLanguage(language) || value.length > 100000)
    return undefined;
  try {
    return hljs.highlight(value, { language, ignoreIllegals: true }).value;
  } catch {
    return undefined;
  }
}
export function CodeBlock({
  value,
  language,
  activeLines,
  changedLines,
  change,
}: {
  value: string;
  language?: string;
  activeLines?: Set<number>;
  changedLines?: Set<number>;
  change?: 'added' | 'removed';
}) {
  const { copy, copied, error } = useCopy();
  const html = useMemo(() => highlight(value, language), [value, language]);
  const lines = value.replace(/\n$/, '').split('\n');
  const lineHtml = useMemo(
    () =>
      activeLines || changedLines
        ? lines.map((line) => highlight(line, language))
        : [],
    [value, language, Boolean(activeLines), Boolean(changedLines)],
  );
  return (
    <div className="learn-code-block">
      <div className="learn-code-header">
        <span>{language || 'text'}</span>
        <button
          type="button"
          className="learn-text-button print-hide"
          onClick={() => copy(value)}
          aria-label="Copy code"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {error ? 'Copy unavailable' : copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0}>
        {activeLines || changedLines ? (
          <code>
            {lines.map((line, index) => (
              <span
                key={index}
                className={`learn-code-line ${activeLines?.has(index + 1) ? 'is-highlighted' : ''} ${changedLines?.has(index) ? `is-${change}` : ''}`}
              >
                <span className="learn-code-line-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  {lineHtml[index] ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: lineHtml[index]! }}
                    />
                  ) : (
                    line || ' '
                  )}
                </span>
              </span>
            ))}
          </code>
        ) : html ? (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code>{value}</code>
        )}
      </pre>
    </div>
  );
}

export function Formula({ node }: { node: LearnNode }) {
  const { render, numbers } = useReader();
  const label = attr(
    node,
    'number',
    attr(node, 'label', String(numbers.get(node) ?? '')),
  );
  return (
    <figure
      className={`learn-formula ${node.name === 'equation-system' ? 'learn-equation-system' : ''}`}
    >
      <BlockHeading node={node} />
      <div className="learn-formula-row">
        <div>
          {node.children?.map((child, index) =>
            child.type === 'inlineMath' ||
            (child.type === 'paragraph' &&
              child.children?.length === 1 &&
              child.children[0].type === 'inlineMath') ? (
              <MathContent
                key={index}
                value={
                  child.type === 'inlineMath'
                    ? (child.value ?? '')
                    : (child.children![0].value ?? '')
                }
                display
              />
            ) : (
              <div key={index}>{render([child])}</div>
            ),
          )}
        </div>
        {node.name === 'formula' && (
          <span
            className="learn-equation-number"
            aria-label={`Equation ${label}`}
          >
            ({label})
          </span>
        )}
      </div>
    </figure>
  );
}

export function CodeComponent({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const code = node.children?.find((child) => child.type === 'code');
  return (
    <section>
      <BlockHeading node={node} />
      {code ? (
        <>
          {render((node.children ?? []).filter((child) => child !== code))}
          <CodeBlock
            value={code.value ?? ''}
            language={attr(node, 'language', code.lang)}
          />
        </>
      ) : (
        <CodeBlock value={plainText(node)} language={attr(node, 'language')} />
      )}
    </section>
  );
}

function parseLines(value: string, total: number) {
  const lines = new Set<number>();
  for (const segment of value.split(',')) {
    const [start, rawEnd] = segment.split('-').map(Number);
    const end = rawEnd ?? start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    for (let line = Math.max(1, start); line <= Math.min(total, end); line++)
      lines.add(line);
  }
  return lines;
}
export function CodeWalkthrough({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const source = node.children?.find((child) => child.type === 'code');
  const steps = named(node, ['step']);
  const [selected, select] = useSelection(node, steps.length);
  const current = steps[selected];
  const value = source?.value ?? '';
  return (
    <section className="learn-code-walkthrough">
      <BlockHeading node={node} fallback="Read the code, one idea at a time" />
      {render(
        (node.children ?? []).filter(
          (child) => child.type !== 'code' && child.name !== 'step',
        ),
      )}
      <CodeBlock
        value={value}
        language={source?.lang}
        activeLines={parseLines(
          current ? attr(current, 'lines') : '',
          value.split('\n').length,
        )}
      />
      <div className="learn-walkthrough-steps">
        {steps.map((step, index) => (
          <button
            type="button"
            key={index}
            className={selected === index ? 'is-active' : ''}
            aria-pressed={selected === index}
            onClick={() => select(index)}
          >
            <span>{index + 1}</span>
            {titleOf(step, `Step ${index + 1}`)}
            <small>Lines {attr(step, 'lines', '—')}</small>
          </button>
        ))}
      </div>
      {steps.map((step, index) => (
        <div
          className="learn-walkthrough-explanation"
          key={index}
          id={elementId(step)}
          hidden={selected !== index}
        >
          {render(step.children)}
        </div>
      ))}
    </section>
  );
}

/** Bounded LCS comparison preserves repeated lines and avoids pathological diff costs. */
function lineChanges(before: string, after: string) {
  const a = before.split('\n'),
    b = after.split('\n');
  const removed = new Set(a.map((_, index) => index)),
    added = new Set(b.map((_, index) => index));
  if (a.length * b.length > 250000) {
    a.forEach((line, index) => {
      if (line === b[index]) {
        removed.delete(index);
        added.delete(index);
      }
    });
    return { removed, added };
  }
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      removed.delete(i);
      added.delete(j);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return { removed, added };
}
export function CodeDiff({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const before = named(node, ['before'])[0],
    after = named(node, ['after'])[0];
  const first = before?.children?.find((child) => child.type === 'code'),
    second = after?.children?.find((child) => child.type === 'code');
  const changes = useMemo(
    () => lineChanges(first?.value ?? '', second?.value ?? ''),
    [first?.value, second?.value],
  );
  return (
    <section className="learn-code-diff">
      <BlockHeading node={node} />
      {render(rest(node, ['before', 'after']))}
      <div className="learn-diff-columns">
        <div id={before ? elementId(before) : undefined}>
          <h5>
            Before <span>−{changes.removed.size}</span>
          </h5>
          {first && (
            <CodeBlock
              value={first.value ?? ''}
              language={first.lang}
              changedLines={changes.removed}
              change="removed"
            />
          )}
          {render(before?.children?.filter((child) => child.type !== 'code'))}
        </div>
        <div id={after ? elementId(after) : undefined}>
          <h5>
            After <span>+{changes.added.size}</span>
          </h5>
          {second && (
            <CodeBlock
              value={second.value ?? ''}
              language={second.lang}
              changedLines={changes.added}
              change="added"
            />
          )}
          {render(after?.children?.filter((child) => child.type !== 'code'))}
        </div>
      </div>
    </section>
  );
}

export function MarkdownTable({
  node,
  sortable = false,
}: {
  node: LearnNode;
  sortable?: boolean;
}) {
  const { render } = useReader();
  const [sort, setSort] = useState<{
    column: number;
    direction: 1 | -1;
  } | null>(null);
  const rows = node.children ?? [];
  const [header, ...body] = rows;
  const sorted = sort
    ? [...body].sort((a, b) => {
        const av = plainText(a.children?.[sort.column]),
          bv = plainText(b.children?.[sort.column]);
        return (
          av.localeCompare(bv, undefined, {
            numeric: true,
            sensitivity: 'base',
          }) * sort.direction
        );
      })
    : body;
  const alignments = Array.isArray(node.align)
    ? (node.align as ('left' | 'center' | 'right' | null)[])
    : [];
  return (
    <div className="learn-table-scroll" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {header?.children?.map((cell, index) => (
              <th
                key={index}
                style={{ textAlign: alignments[index] ?? undefined }}
                scope="col"
                aria-sort={
                  sortable
                    ? sort?.column === index
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort({
                        column: index,
                        direction:
                          sort?.column === index && sort.direction === 1
                            ? -1
                            : 1,
                      })
                    }
                  >
                    {render(cell.children)}
                    {sort?.column === index ? (
                      sort.direction === 1 ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : (
                      <span aria-hidden="true">↕</span>
                    )}
                  </button>
                ) : (
                  render(cell.children)
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={index}>
              {row.children?.map((cell, column) => (
                <td
                  key={column}
                  style={{ textAlign: alignments[column] ?? undefined }}
                >
                  {render(cell.children)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DataTable({ node }: { node: LearnNode }) {
  const { render } = useReader();
  return (
    <section className="learn-data-table">
      <BlockHeading node={node} />
      {node.children?.map((child, index) =>
        child.type === 'table' ? (
          <MarkdownTable
            node={child}
            sortable={flag(node, 'sortable', true)}
            key={index}
          />
        ) : (
          <div key={index}>{render([child])}</div>
        ),
      )}
    </section>
  );
}

export function Glossary({ node }: { node: LearnNode }) {
  const { render, navigation } = useReader();
  const [query, setQuery] = useState('');
  const terms = named(node, ['term', 'symbol']);
  useEffect(() => {
    if (navigation && hasAnchor(node, navigation.id)) setQuery('');
  }, [navigation]);
  const filtered = terms.filter((term) =>
    `${attr(term, 'symbol')} ${attr(term, 'meaning')} ${plainText(term)}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const id = useId();
  return (
    <section className="learn-glossary">
      <BlockHeading node={node} fallback="Symbols & notation" />
      {render(rest(node, ['term', 'symbol']))}
      {terms.length > 3 && (
        <div className="learn-glossary-search print-hide">
          <label className="learn-sr-only" htmlFor={id}>
            Filter symbols
          </label>
          <input
            id={id}
            placeholder="Find a symbol or meaning…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      <dl>
        {filtered.map((term, index) => (
          <div key={index} id={elementId(term)}>
            <dt>
              {attr(term, 'symbol').startsWith('$') ? (
                <MathContent
                  value={attr(term, 'symbol').replace(/^\$|\$$/g, '')}
                />
              ) : (
                attr(term, 'symbol')
              )}
            </dt>
            <dd>
              <strong>{attr(term, 'meaning')}</strong>
              {render(term.children)}
            </dd>
          </div>
        ))}
      </dl>
      {!filtered.length && <p className="learn-empty">No matching symbols.</p>}
    </section>
  );
}

export function Reference({ node }: { node: LearnNode }) {
  const { references } = useReader();
  const target = attr(node, 'target');
  const reference = references.get(target);
  const label = attr(node, 'label') || reference?.title || target;
  return reference ? (
    <a
      className="learn-reference"
      href={`#${target}`}
      title={`${reference.name}${reference.number ? ` ${reference.number}` : ''}: ${reference.title}`}
    >
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  ) : (
    <span
      className="learn-missing-reference"
      title={`No heading or component has the ID “${target}”.`}
    >
      {label} <small>(reference unavailable)</small>
    </span>
  );
}

export function Embed({ node }: { node: LearnNode }) {
  const { render, assets } = useReader();
  const [loaded, setLoaded] = useState(false);
  const src = attr(node, 'src');
  const kind = attr(node, 'kind', attr(node, 'type', 'link'));
  const local = assetSource(src, assets, false);
  const url = safeLink(src);
  const source = local || (loaded ? assetSource(src, assets, true) : undefined);
  return (
    <section className="learn-embed">
      <BlockHeading node={node} />
      {render(node.children)}
      {['audio', 'video'].includes(kind) && source ? (
        kind === 'audio' ? (
          <audio controls preload="none" src={source}>
            Audio playback is not supported in this browser.
          </audio>
        ) : (
          <video controls preload="none" src={source}>
            Video playback is not supported in this browser.
          </video>
        )
      ) : ['audio', 'video'].includes(kind) && /^https:\/\//i.test(src) ? (
        <button
          type="button"
          className="learn-resource-button"
          onClick={() => setLoaded(true)}
        >
          <Play size={18} />
          Load external {kind}
          <span>
            {attr(
              node,
              'label',
              (() => {
                try {
                  return new URL(src).hostname;
                } catch {
                  return src;
                }
              })(),
            )}
          </span>
        </button>
      ) : url ? (
        <a
          className="learn-resource-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={17} />
          <span>
            {attr(node, 'label', 'Open resource')}
            <small>{new URL(url).hostname || url}</small>
          </span>
          <ArrowRight size={16} />
        </a>
      ) : (
        <p className="learn-empty">
          This resource URL is not supported. Use an HTTPS link or a bundled
          media asset.
        </p>
      )}
    </section>
  );
}
