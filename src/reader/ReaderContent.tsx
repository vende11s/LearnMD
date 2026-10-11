import { useI18n } from '../i18n';
import {
  Component,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, BookOpen, Check, Lightbulb } from 'lucide-react';
import type { LearnNode, ParsedDocument } from '../format/types';
import {
  Accordion,
  Annotated,
  Disclosure,
  Progression,
  Spotlight,
  Tabs,
} from './Disclosure';
import {
  Checklist,
  DecisionTree,
  FillBlank,
  Match,
  Question,
  Quiz,
  Scratchpad,
  Sort,
} from './Exercises';
import {
  ImageAnnotation,
  NetworkDiagram,
  Process,
  SafeImage,
  Sequence,
  Timeline,
  Tree,
} from './Diagrams';
import {
  CodeBlock,
  CodeComponent,
  CodeDiff,
  CodeWalkthrough,
  DataTable,
  Embed,
  Formula,
  Glossary,
  MarkdownTable,
  MathContent,
  Reference,
} from './Technical';
import {
  attr,
  BlockHeading,
  elementId,
  named,
  numeric,
  plainText,
  ReaderContext,
  rest,
  safeLink,
  SyncContext,
  titleOf,
  useReader,
} from './context';
import 'katex/dist/katex.min.css';
import './reader.css';
import { Carousel } from './Carousel';
import { sourceProps } from './source';
import { componentLabel } from './labels';

export interface ReaderContentProps {
  document: ParsedDocument;
  assets?: Record<string, string>;
  allowRemote?: boolean;
  /** The application renders the title itself and preserves that heading's semantic ID. */
  hideTitle?: boolean;
  navigationTarget?: { id: string; nonce: number } | null;
}

const educational = new Set([
  'definition',
  'theorem',
  'lemma',
  'example',
  'counterexample',
  'callout',
  'warning',
  'intuition',
  'summary',
]);
const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

function Educational({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render, numbers } = useReader();
  const name = node.name ?? 'callout';
  const number = numbers.get(node);
  const icon =
    name === 'intuition' ? (
      <Lightbulb size={16} />
    ) : name === 'warning' || name === 'counterexample' ? (
      <AlertTriangle size={16} />
    ) : name === 'definition' ? (
      <BookOpen size={16} />
    ) : name === 'summary' ? (
      <Check size={16} />
    ) : null;
  return (
    <aside
      className={`learn-educational learn-${name}`}
      data-tone={attr(node, 'tone', 'note')}
    >
      <div className="learn-educational-heading">
        {icon}
        <span>
          {componentLabel(name, t)}
          {number ? ` ${number}` : ''}
        </span>
        {attr(node, 'title') && <h4>{attr(node, 'title')}</h4>}
      </div>
      <div className="learn-educational-content">{render(node.children)}</div>
    </aside>
  );
}

function Layout({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const name = node.name ?? 'section';
  const columns = numeric(
    node,
    'columns',
    numeric(node, 'count', 2, 1, 4),
    1,
    4,
  );
  const style = { '--learn-columns': Math.round(columns) } as CSSProperties;
  if (name === 'divider') return <hr className="learn-divider" />;
  if (name === 'comparison' || name === 'split-view') {
    const panels = named(node, ['panel', 'item']);
    return (
      <section className={`learn-${name}`}>
        <BlockHeading node={node} />
        {render(rest(node, ['panel', 'item']))}
        <div className="learn-comparison-panels">
          {panels.map((panel, index) => (
            <div
              key={index}
              id={elementId(panel)}
              className="learn-comparison-panel"
            >
              <h5>
                {titleOf(
                  panel,
                  t(`Perspective ${index + 1}`, `Perspektywa ${index + 1}`),
                )}
              </h5>
              {render(panel.children)}
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section
      className={`learn-layout learn-${name} ${name === 'stack' ? `is-${attr(node, 'direction', 'vertical')}` : ''}`}
      style={style}
    >
      <BlockHeading node={node} />
      <div className="learn-layout-content">{render(node.children)}</div>
    </section>
  );
}

function SharedValue({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { values, setValue, render } = useReader();
  const name = attr(node, 'target');
  const known = Object.hasOwn(values, name);
  if (node.name === 'variable') return null;
  if (node.name === 'conditional')
    return (
      <div
        className="learn-conditional"
        hidden={!known || values[name] !== attr(node, 'equals')}
      >
        {render(node.children)}
      </div>
    );
  const on = attr(node, 'on', 'true'),
    off = attr(node, 'off', 'false');
  const active = known && values[name] === on;
  return (
    <div className="learn-toggle-wrapper">
      <button
        className="learn-toggle"
        type="button"
        role="switch"
        aria-checked={active}
        disabled={!known}
        onClick={() => setValue(name, active ? off : on)}
      >
        <span className="learn-switch-track">
          <span />
        </span>
        {attr(node, 'label', attr(node, 'title', name))}
      </button>
      {!known && (
        <span className="learn-help">
          {t(
            `The state “${name}” has not been declared.`,
            `Stan „${name}” nie został zadeklarowany.`,
          )}
        </span>
      )}
      {render(node.children)}
    </div>
  );
}

function Prerequisites({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const items = named(node, ['item']);
  return (
    <aside className="learn-prerequisites">
      <BlockHeading
        node={node}
        fallback={t('Before you begin', 'Zanim zaczniesz')}
        eyebrow={t('Prerequisites', 'Wymagana wiedza')}
      />
      {render(rest(node, ['item']))}
      {items.length > 0 && (
        <ul>
          {items.map((item, index) => (
            <li key={index} id={elementId(item)}>
              {attr(item, 'target') ? (
                <Reference
                  node={{
                    ...item,
                    attributes: {
                      ...item.attributes,
                      label: titleOf(item, attr(item, 'target')),
                    },
                  }}
                />
              ) : (
                <strong>{titleOf(item, '')}</strong>
              )}
              {render(item.children)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function CustomComponent({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const name = node.name ?? '';
  if (educational.has(name)) return <Educational node={node} />;
  switch (name) {
    case 'columns':
    case 'grid':
    case 'stack':
    case 'card':
    case 'section':
    case 'divider':
    case 'split-view':
    case 'comparison':
      return <Layout node={node} />;
    case 'tabs':
    case 'variants':
    case 'layers':
    case 'branch':
    case 'scenario':
      return <Tabs node={node} mode={name} />;
    case 'accordion':
      return <Accordion node={node} />;
    case 'carousel':
      return <Carousel node={node} />;
    case 'steps':
    case 'derivation':
      return <Progression node={node} />;
    case 'proof':
    case 'reveal':
    case 'hint':
    case 'popover':
      return <Disclosure node={node} />;
    case 'spotlight':
      return <Spotlight node={node} />;
    case 'annotated':
      return <Annotated node={node} />;
    case 'quiz':
      return <Quiz node={node} />;
    case 'fill-blank':
      return <FillBlank node={node} />;
    case 'match':
      return <Match node={node} />;
    case 'sort':
      return <Sort node={node} />;
    case 'question':
    case 'predict':
      return <Question node={node} />;
    case 'decision-tree':
      return <DecisionTree node={node} />;
    case 'checklist':
      return <Checklist node={node} />;
    case 'scratchpad':
      return <Scratchpad node={node} />;
    case 'flowchart':
    case 'architecture':
    case 'graph':
    case 'state-machine':
    case 'concept-map':
      return <NetworkDiagram node={node} />;
    case 'sequence':
      return <Sequence node={node} />;
    case 'timeline':
      return <Timeline node={node} />;
    case 'tree':
      return <Tree node={node} />;
    case 'process':
      return <Process node={node} />;
    case 'image-annotation':
      return <ImageAnnotation node={node} />;
    case 'formula':
    case 'equation-system':
      return <Formula node={node} />;
    case 'code':
      return <CodeComponent node={node} />;
    case 'code-walkthrough':
      return <CodeWalkthrough node={node} />;
    case 'code-diff':
      return <CodeDiff node={node} />;
    case 'data-table':
      return <DataTable node={node} />;
    case 'symbol-glossary':
      return <Glossary node={node} />;
    case 'reference':
      return <Reference node={node} />;
    case 'prerequisites':
      return <Prerequisites node={node} />;
    case 'embed':
      return <Embed node={node} />;
    case 'sync':
      return (
        <SyncContext.Provider value={attr(node, 'group')}>
          <section className="learn-sync">
            <BlockHeading node={node} />
            {render(node.children)}
          </section>
        </SyncContext.Provider>
      );
    case 'variable':
    case 'toggle':
    case 'conditional':
      return <SharedValue node={node} />;
    // Structural blocks keep readable content if error recovery leaves one outside its expected parent.
    default:
      return (
        <div className="learn-structural-fallback">
          <BlockHeading node={node} />
          {node.value}
          {render(node.children)}
        </div>
      );
  }
}

class BlockErrorBoundary extends Component<
  { children: ReactNode; node: LearnNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) return <RenderFailure node={this.props.node} />;
    return this.props.children;
  }
}

function RenderFailure({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  return (
    <aside className="learn-render-error">
      <strong>
        {t(
          'This block could not be displayed.',
          'Nie udało się wyświetlić tego bloku.',
        )}{' '}
      </strong>
      <p>
        {t(
          'The rest of your note is available. Source content:',
          'Pozostała część notatki jest dostępna. Treść źródłowa:',
        )}{' '}
      </p>
      <pre>{plainText(node)}</pre>
    </aside>
  );
}

function collect(
  document: ParsedDocument,
  t: (english: string, polish: string) => string,
) {
  const references = new Map<
    string,
    { title: string; number?: number; name: string }
  >();
  const definitions = new Map<string, LearnNode>();
  const numbers = new Map<LearnNode, number>();
  const values: Record<string, string> = Object.create(null);
  const counts: Record<string, number> = Object.create(null);
  const visit = (nodes: LearnNode[], group?: string) =>
    nodes.forEach((node) => {
      const name = node.name ?? node.type;
      if (['theorem', 'lemma', 'formula'].includes(name)) {
        counts[name] = (counts[name] ?? 0) + 1;
        numbers.set(
          node,
          typeof node.number === 'number' ? node.number : counts[name],
        );
      }
      const id =
        node.id ||
        (node.name !== 'node' && node.name !== 'participant'
          ? attr(node, 'id')
          : '');
      if (id)
        references.set(id, {
          title: attr(
            node,
            'title',
            node.type === 'heading'
              ? plainText(node)
              : `${componentLabel(name, t)}${numbers.has(node) ? ` ${numbers.get(node)}` : ''}`,
          ),
          number: numbers.get(node),
          name: componentLabel(name, t),
        });
      if (node.type === 'definition' && node.identifier)
        definitions.set(node.identifier.toLowerCase(), node);
      if (
        node.name === 'variable' &&
        !Object.hasOwn(values, attr(node, 'name'))
      )
        values[attr(node, 'name')] = attr(node, 'value');
      const inheritedGroup = node.name === 'sync' ? attr(node, 'group') : group;
      if (
        inheritedGroup &&
        [
          'steps',
          'carousel',
          'derivation',
          'tabs',
          'layers',
          'variants',
          'spotlight',
          'scenario',
          'branch',
          'code-walkthrough',
          'process',
          'flowchart',
          'architecture',
          'graph',
          'state-machine',
          'concept-map',
          'sequence',
          'image-annotation',
        ].includes(name) &&
        !Object.hasOwn(values, `sync:${inheritedGroup}`)
      )
        values[`sync:${inheritedGroup}`] = attr(node, 'initial', '0');
      if (node.children) visit(node.children, inheritedGroup);
    });
  visit(document.children);
  return { references, definitions, numbers, values };
}

function ReaderInstance({
  document,
  assets = {},
  allowRemote = false,
  hideTitle = false,
  navigationTarget,
}: ReaderContentProps) {
  const { t } = useI18n();
  const info = useMemo(() => collect(document, t), [document, t]);
  const [values, setValues] = useState(info.values);
  const [navigation, setNavigation] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const article = useRef<HTMLElement>(null);
  const setValue = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [
        ...(article.current?.querySelectorAll<HTMLDetailsElement>(
          'details:not([open])',
        ) ?? []),
      ];
      opened.forEach((element) => {
        element.open = true;
      });
    };
    const after = () => {
      opened.forEach((element) => {
        element.open = false;
      });
      opened = [];
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  const navigateToId = (id: string) => {
    if (!article.current) return;
    setNavigation({ id, nonce: Date.now() });
    // Selection effects reveal the containing step or tab before moving focus.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!article.current) return;
        const target =
          [...article.current.querySelectorAll<HTMLElement>('[id]')].find(
            (element) => element.id === id,
          ) ?? article.current.ownerDocument.getElementById(id);
        if (!target) return;
        for (
          let ancestor: HTMLElement | null = target;
          ancestor && ancestor !== article.current;
          ancestor = ancestor.parentElement
        )
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        target.scrollIntoView?.({
          block: 'start',
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : 'smooth',
        });
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }),
    );
  };
  useEffect(() => {
    if (navigationTarget) navigateToId(navigationTarget.id);
  }, [navigationTarget]);
  const navigate = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      'a[href^="#"]',
    );
    if (!link || !article.current?.contains(link)) return;
    event.preventDefault();
    try {
      navigateToId(decodeURIComponent(link.getAttribute('href')!.slice(1)));
    } catch {
      /* Malformed fragments are inert. */
    }
  };
  function render(nodes?: LearnNode[]): ReactNode {
    return nodes?.map((node, index) => (
      <Fragment key={`${index}-${node.id ?? node.name ?? node.type}`}>
        {renderNode(node)}
      </Fragment>
    ));
  }
  function renderNode(node: LearnNode): ReactNode {
    if (node.name) {
      const content = (
        <BlockErrorBoundary node={node}>
          <CustomComponent node={node} />
        </BlockErrorBoundary>
      );
      if (node.name === 'variable')
        return (
          <span
            {...sourceProps(node)}
            id={elementId(node)}
            className="learn-variable-anchor"
            aria-hidden="true"
          />
        );
      if (node.type === 'textDirective' && node.name === 'reference')
        return (
          <span id={node.id} {...sourceProps(node)}>
            {content}
          </span>
        );
      return (
        <div
          {...sourceProps(node)}
          className={`learn-block-wrapper learn-wrapper-${node.name}`}
          id={node.id || attr(node, 'id') || undefined}
        >
          {content}
        </div>
      );
    }
    switch (node.type) {
      case 'root':
        return render(node.children);
      case 'text':
        return node.value;
      case 'paragraph':
        return node.children?.some(
          (child) =>
            child.type === 'image' ||
            (child.name && child.name !== 'reference'),
        ) ? (
          <div className="learn-paragraph" {...sourceProps(node)}>
            {render(node.children)}
          </div>
        ) : (
          <p {...sourceProps(node)}>{render(node.children)}</p>
        );
      case 'heading': {
        const Tag = `h${Math.max(1, Math.min(6, node.depth ?? 2))}` as
          'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
        return (
          <Tag id={node.id} {...sourceProps(node)}>
            {render(node.children)}
            {node.id && (
              <a
                className="learn-heading-anchor print-hide"
                href={`#${node.id}`}
                aria-label={t(
                  `Link to ${plainText(node)}`,
                  `Łącze do: ${plainText(node)}`,
                )}
              >
                #
              </a>
            )}
          </Tag>
        );
      }
      case 'emphasis':
        return <em>{render(node.children)}</em>;
      case 'strong':
        return <strong>{render(node.children)}</strong>;
      case 'delete':
        return <del>{render(node.children)}</del>;
      case 'inlineCode':
        return <code className="learn-inline-code">{node.value}</code>;
      case 'code':
        return (
          <CodeBlock
            value={node.value ?? ''}
            language={node.lang}
            source={node}
          />
        );
      case 'math':
        return <MathContent value={node.value ?? ''} display source={node} />;
      case 'inlineMath':
        return <MathContent value={node.value ?? ''} />;
      case 'break':
        return <br />;
      case 'thematicBreak':
        return <hr {...sourceProps(node)} />;
      case 'blockquote':
        return (
          <blockquote {...sourceProps(node)}>
            {render(node.children)}
          </blockquote>
        );
      case 'list':
        return node.ordered ? (
          <ol start={node.start} {...sourceProps(node)}>
            {render(node.children)}
          </ol>
        ) : (
          <ul
            {...sourceProps(node)}
            className={
              node.children?.some(
                (child) =>
                  child.checked !== null && child.checked !== undefined,
              )
                ? 'learn-task-list'
                : undefined
            }
          >
            {render(node.children)}
          </ul>
        );
      case 'listItem':
        return (
          <li {...sourceProps(node)}>
            {typeof node.checked === 'boolean' && (
              <input
                type="checkbox"
                checked={node.checked}
                readOnly
                disabled
                aria-label={plainText(node)}
              />
            )}
            {render(node.children)}
          </li>
        );
      case 'table':
        return <MarkdownTable node={node} />;
      case 'link': {
        const url = safeLink(node.url);
        return url ? (
          <a
            href={url}
            target={url.startsWith('#') ? undefined : '_blank'}
            rel={url.startsWith('#') ? undefined : 'noopener noreferrer'}
            title={typeof node.title === 'string' ? node.title : undefined}
          >
            {render(node.children)}
          </a>
        ) : (
          <span>{render(node.children)}</span>
        );
      }
      case 'image':
        return <SafeImage src={node.url ?? ''} alt={node.alt ?? ''} />;
      case 'linkReference': {
        const definition = info.definitions.get(
          node.identifier?.toLowerCase() ?? '',
        );
        const url = safeLink(definition?.url);
        return url ? (
          <a
            href={url}
            target={url.startsWith('#') ? undefined : '_blank'}
            rel="noopener noreferrer"
          >
            {render(node.children)}
          </a>
        ) : (
          render(node.children)
        );
      }
      case 'imageReference': {
        const definition = info.definitions.get(
          node.identifier?.toLowerCase() ?? '',
        );
        return <SafeImage src={definition?.url ?? ''} alt={node.alt ?? ''} />;
      }
      case 'footnoteReference':
        return (
          <sup>
            <a
              href={`#fn-${node.identifier}`}
              id={`fnref-${node.identifier}`}
              aria-label={t(
                `Footnote ${node.identifier}`,
                `Przypis ${node.identifier}`,
              )}
            >
              {(node.label as string) || node.identifier}
            </a>
          </sup>
        );
      case 'footnoteDefinition':
        return (
          <aside
            className="learn-footnote"
            id={`fn-${node.identifier}`}
            {...sourceProps(node)}
          >
            <span>{node.identifier}.</span>
            <div>{render(node.children)}</div>
            <a
              href={`#fnref-${node.identifier}`}
              aria-label={t('Back to text', 'Wróć do tekstu')}
            >
              ↩
            </a>
          </aside>
        );
      case 'definition':
      case 'yaml':
        return null;
      case 'html':
        return <code className="learn-inert-html">{node.value}</code>;
      default:
        return node.children ? render(node.children) : node.value || null;
    }
  }
  const contents = hideTitle
    ? document.children.filter(
        (node, index) =>
          !(index === 0 && node.type === 'heading' && node.depth === 1),
      )
    : document.children;
  return (
    <ReaderContext.Provider
      value={{
        assets,
        allowRemote,
        values,
        setValue,
        render,
        references: info.references,
        numbers: info.numbers,
        navigation,
      }}
    >
      <article ref={article} className="learn-reader" onClickCapture={navigate}>
        {render(contents)}
      </article>
    </ReaderContext.Provider>
  );
}

/** A source change resets document-scoped interactions. */
export function ReaderContent(props: ReaderContentProps) {
  return <ReaderInstance key={props.document.source} {...props} />;
}

export default ReaderContent;
