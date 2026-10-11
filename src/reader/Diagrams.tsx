import { useId, useMemo, useState } from 'react';
import { ArrowRight, ImageOff, RotateCcw } from 'lucide-react';
import type { LearnNode } from '../format/types';
import {
  assetSource,
  attr,
  BlockHeading,
  elementId,
  flag,
  named,
  numeric,
  rest,
  titleOf,
  useReader,
  useSelection,
} from './context';

type Point = { x: number; y: number };
type DiagramKind =
  'flowchart' | 'architecture' | 'graph' | 'concept-map' | 'state-machine';
function positions(
  kind: DiagramKind,
  nodes: LearnNode[],
  edges: LearnNode[],
): Point[] {
  const count = nodes.length;
  if (kind === 'flowchart')
    return nodes.map((_, index) => ({
      x: 50,
      y: 10 + (index / Math.max(1, count - 1)) * 80,
    }));
  if (kind === 'architecture') {
    const ranks = new Map(nodes.map((node) => [attr(node, 'id'), 0]));
    // A bounded layout pass handles cycles deterministically without recursive graph walking.
    for (let pass = 0; pass < Math.min(nodes.length, 5); pass++)
      for (const edge of edges) {
        const from = ranks.get(attr(edge, 'from')) ?? 0;
        const to = attr(edge, 'to');
        if (ranks.has(to) && attr(edge, 'from') !== to)
          ranks.set(to, Math.min(4, Math.max(ranks.get(to) ?? 0, from + 1)));
      }
    const levels = [...new Set(ranks.values())].sort((a, b) => a - b);
    return nodes.map((node) => {
      const level = ranks.get(attr(node, 'id')) ?? 0;
      const peers = nodes.filter(
        (item) => ranks.get(attr(item, 'id')) === level,
      );
      return {
        x: 15 + (levels.indexOf(level) / Math.max(1, levels.length - 1)) * 70,
        y: 20 + (peers.indexOf(node) / Math.max(1, peers.length - 1)) * 60,
      };
    });
  }
  if (count === 1) return [{ x: 50, y: 50 }];
  return nodes.map((_, index) => {
    if (kind === 'concept-map' && index === 0) return { x: 50, y: 50 };
    const position = kind === 'concept-map' ? index - 1 : index;
    const total = kind === 'concept-map' ? count - 1 : count;
    const angle = -Math.PI / 2 + (position / total) * Math.PI * 2;
    return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 34 };
  });
}

export function NetworkDiagram({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const nodes = named(node, ['node']).slice(0, 60);
  const edges = named(node, ['edge']).slice(0, 150);
  const kind = node.name as DiagramKind;
  const initial = Math.max(
    0,
    nodes.findIndex((item) => attr(item, 'id') === attr(node, 'start')),
  );
  const [selected, select] = useSelection(node, nodes.length, initial);
  const points = useMemo(
    () =>
      positions(kind, nodes, edges).map((point, index) => ({
        x: numeric(nodes[index], 'x', point.x, 8, 92),
        y: numeric(nodes[index], 'y', point.y, 6, 94),
      })),
    [kind, nodes, edges],
  );
  const id = useId().replace(/:/g, '');
  const width = 720;
  const height =
    kind === 'flowchart'
      ? Math.max(230, nodes.length * 110)
      : Math.max(320, Math.ceil(nodes.length / 6) * 140);
  const active = nodes[selected];
  const currentId = active ? attr(active, 'id') : '';
  const outgoing = edges.filter((edge) => attr(edge, 'from') === currentId);
  const directed = kind !== 'graph' || flag(node, 'directed', false);
  return (
    <figure className={`learn-diagram learn-network learn-${kind}`}>
      <BlockHeading node={node} />
      {render(rest(node, ['node', 'edge']))}
      <div className="learn-diagram-scroll">
        <div
          className="learn-network-canvas"
          style={{ height, minWidth: kind === 'flowchart' ? 320 : 510 }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="learn-network-edges"
          >
            <defs>
              <marker
                id={`${id}-arrow`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {edges.map((edge, index) => {
              const from = nodes.findIndex(
                (item) => attr(item, 'id') === attr(edge, 'from'),
              );
              const to = nodes.findIndex(
                (item) => attr(item, 'id') === attr(edge, 'to'),
              );
              if (from < 0 || to < 0) return null;
              const a = {
                x: (points[from].x / 100) * width,
                y: (points[from].y / 100) * height,
              };
              const b = {
                x: (points[to].x / 100) * width,
                y: (points[to].y / 100) * height,
              };
              const dx = b.x - a.x,
                dy = b.y - a.y;
              const distance = Math.max(1, Math.hypot(dx, dy));
              const end = {
                x: b.x - (dx / distance) * 46,
                y: b.y - (dy / distance) * 25,
              };
              const start = {
                x: a.x + (dx / distance) * 46,
                y: a.y + (dy / distance) * 25,
              };
              const activeEdge = from === selected || to === selected;
              if (from === to)
                return (
                  <path
                    key={index}
                    d={`M ${a.x - 30} ${a.y - 12} C ${a.x - 65} ${a.y - 80}, ${a.x + 65} ${a.y - 80}, ${a.x + 30} ${a.y - 12}`}
                    className={activeEdge ? 'is-active' : ''}
                    fill="none"
                    markerEnd={directed ? `url(#${id}-arrow)` : undefined}
                  />
                );
              const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              return (
                <g
                  key={index}
                  id={elementId(edge)}
                  className={activeEdge ? 'is-active' : ''}
                >
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    markerEnd={directed ? `url(#${id}-arrow)` : undefined}
                  />
                  {attr(edge, 'label') && (
                    <text
                      x={kind === 'flowchart' ? center.x + 13 : center.x}
                      y={kind === 'flowchart' ? center.y + 4 : center.y - 9}
                      textAnchor={kind === 'flowchart' ? 'start' : 'middle'}
                    >
                      {attr(edge, 'label').slice(0, 48)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {nodes.map((item, index) => (
            <button
              key={index}
              type="button"
              className={`learn-diagram-node ${selected === index ? 'is-selected' : ''}`}
              style={{
                left: `${points[index].x}%`,
                top: `${points[index].y}%`,
              }}
              aria-pressed={selected === index}
              aria-controls={`${id}-description`}
              onClick={() => select(index)}
            >
              <span>{attr(item, 'label', attr(item, 'id'))}</span>
              {kind === 'architecture' && <small>Component {index + 1}</small>}
            </button>
          ))}
        </div>
      </div>
      {active && (
        <figcaption
          className="learn-diagram-description"
          id={`${id}-description`}
          aria-live="polite"
        >
          {nodes.map((item, index) => (
            <div key={index} hidden={selected !== index}>
              <span className="learn-eyebrow">
                {kind === 'state-machine' ? 'Current state' : 'Selected'} ·{' '}
                {attr(item, 'label')}
              </span>
              {attr(item, 'description') && <p>{attr(item, 'description')}</p>}
              {render(item.children)}
            </div>
          ))}
          {outgoing.length > 0 && (
            <div className="learn-connection-list print-hide">
              {outgoing.map((edge, index) => {
                const target = nodes.findIndex(
                  (item) => attr(item, 'id') === attr(edge, 'to'),
                );
                return (
                  target >= 0 && (
                    <button
                      type="button"
                      key={index}
                      className="learn-text-button"
                      aria-label={`${attr(edge, 'label', 'Connected to')} ${attr(nodes[target], 'label')}`}
                      onClick={() => select(target)}
                    >
                      {attr(
                        edge,
                        'label',
                        kind === 'state-machine'
                          ? 'Transition'
                          : 'Connected to',
                      )}
                      <ArrowRight size={13} aria-hidden="true" />
                      {attr(nodes[target], 'label')}
                    </button>
                  )
                );
              })}
            </div>
          )}
          {kind === 'state-machine' && selected !== initial && (
            <button
              type="button"
              className="learn-text-button print-hide"
              onClick={() => select(initial)}
            >
              <RotateCcw size={13} /> Reset state
            </button>
          )}
        </figcaption>
      )}
      <div className="print-only">
        {edges.map((edge, index) => (
          <p key={index}>
            {attr(edge, 'from')} → {attr(edge, 'to')}: {attr(edge, 'label')}
          </p>
        ))}
      </div>
    </figure>
  );
}

export function Sequence({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const participants = named(node, ['participant']).slice(0, 12);
  const messages = named(node, ['message']).slice(0, 100);
  const [selected, select] = useSelection(node, messages.length);
  const id = useId().replace(/:/g, '');
  const width = Math.max(600, participants.length * 155);
  const height = Math.max(170, messages.length * 75 + 105);
  const x = (index: number) =>
    80 + (index / Math.max(1, participants.length - 1)) * (width - 160);
  return (
    <figure className="learn-diagram learn-sequence">
      <BlockHeading node={node} />
      {render(rest(node, ['participant', 'message']))}
      <div className="learn-diagram-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={titleOf(
            node,
            'Sequence of messages; select a message below to explore it.',
          )}
          style={{ width, maxWidth: 'none' }}
        >
          <defs>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {participants.map((participant, index) => (
            <g key={index}>
              <rect x={x(index) - 65} y="12" width="130" height="36" rx="5" />
              <text
                x={x(index)}
                y="35"
                textAnchor="middle"
                className="learn-sequence-participant"
              >
                {attr(participant, 'label').slice(0, 23)}
              </text>
              <line
                className="learn-lifeline"
                x1={x(index)}
                y1="49"
                x2={x(index)}
                y2={height - 15}
              />
            </g>
          ))}
          {messages.map((message, index) => {
            const from = participants.findIndex(
              (participant) =>
                attr(participant, 'id') === attr(message, 'from'),
            );
            const to = participants.findIndex(
              (participant) => attr(participant, 'id') === attr(message, 'to'),
            );
            if (from < 0 || to < 0) return null;
            const y = 105 + index * 75;
            return (
              <g key={index} className={selected === index ? 'is-active' : ''}>
                {from === to ? (
                  <path
                    d={`M ${x(from)} ${y - 18} h 45 v 36 h -45`}
                    fill="none"
                    markerEnd={`url(#${id}-arrow)`}
                  />
                ) : (
                  <line
                    x1={x(from)}
                    y1={y}
                    x2={x(to)}
                    y2={y}
                    markerEnd={`url(#${id}-arrow)`}
                  />
                )}
                <text
                  x={(x(from) + x(to)) / 2 + (from === to ? 50 : 0)}
                  y={y - 12}
                  textAnchor={from === to ? 'start' : 'middle'}
                >
                  {index + 1}. {attr(message, 'label').slice(0, 60)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div
        className="learn-message-controls print-hide"
        aria-label="Sequence messages"
      >
        {messages.map((message, index) => (
          <button
            type="button"
            key={index}
            aria-pressed={selected === index}
            aria-controls={elementId(message, `${id}-message-${index}`)}
            onClick={() => select(index)}
          >
            {index + 1}. {attr(message, 'label')}
          </button>
        ))}
      </div>
      <figcaption className="learn-diagram-description">
        {messages.map((message, index) => (
          <div
            key={index}
            id={elementId(message, `${id}-message-${index}`)}
            hidden={selected !== index}
          >
            <span className="learn-eyebrow">
              {attr(message, 'from')} → {attr(message, 'to')} ·{' '}
              {attr(message, 'label')}
            </span>
            {render(message.children)}
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function Timeline({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const events = named(node, ['event']);
  return (
    <section className="learn-timeline">
      <BlockHeading node={node} />
      {render(rest(node, ['event']))}
      <ol>
        {events.map((event, index) => (
          <li key={index} id={elementId(event)}>
            <div className="learn-timeline-date">{attr(event, 'date')}</div>
            <div>
              <h5>{titleOf(event, `Event ${index + 1}`)}</h5>
              {render(event.children)}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TreeItem({ node, depth = 0 }: { node: LearnNode; depth?: number }) {
  const { render } = useReader();
  const items = named(node, ['item']);
  const title = titleOf(node, 'Branch');
  return (
    <li id={elementId(node)}>
      {items.length ? (
        <details open={depth < 2}>
          <summary>{title}</summary>
          <div className="learn-tree-detail">
            {render(rest(node, ['item']))}
          </div>
          <ul>
            {items.map((item, index) => (
              <TreeItem node={item} depth={depth + 1} key={index} />
            ))}
          </ul>
        </details>
      ) : (
        <div className="learn-tree-leaf">
          <strong>{title}</strong>
          {render(node.children)}
        </div>
      )}
    </li>
  );
}
export function Tree({ node }: { node: LearnNode }) {
  const { render } = useReader();
  return (
    <section className="learn-tree">
      <BlockHeading node={node} />
      {render(rest(node, ['item']))}
      <ul>
        {named(node, ['item']).map((item, index) => (
          <TreeItem key={index} node={item} />
        ))}
      </ul>
    </section>
  );
}

export function Process({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const steps = named(node, ['step', 'item']);
  const [selected, select] = useSelection(node, steps.length);
  const id = useId();
  return (
    <section className="learn-process">
      <BlockHeading node={node} />
      {render(rest(node, ['step', 'item']))}
      <ol className="learn-process-stages">
        {steps.map((step, index) => (
          <li key={index}>
            <button
              type="button"
              aria-pressed={selected === index}
              aria-controls={elementId(step, `${id}-${index}`)}
              onClick={() => select(index)}
            >
              <span>{index + 1}</span>
              {titleOf(step, `Stage ${index + 1}`)}
            </button>
            {index < steps.length - 1 && (
              <ArrowRight size={16} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
      {steps.map((step, index) => (
        <div
          className="learn-process-detail"
          key={index}
          id={elementId(step, `${id}-${index}`)}
          hidden={selected !== index}
        >
          {render(step.children)}
        </div>
      ))}
    </section>
  );
}

export function SafeImage({
  src,
  alt,
  children,
}: {
  src: string;
  alt: string;
  children?: React.ReactNode;
}) {
  const { assets, allowRemote } = useReader();
  const [consent, setConsent] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = assetSource(src, assets, allowRemote || consent);
  const remote = /^https:\/\//i.test(src);
  return source && !failed ? (
    <div className="learn-image-frame">
      <img
        src={source}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      {children}
    </div>
  ) : (
    <div className="learn-image-unavailable">
      <ImageOff size={24} aria-hidden="true" />
      <div>
        <strong>{alt || 'Document image'}</strong>
        <p>
          {failed
            ? 'This image could not be loaded.'
            : remote
              ? 'This image is hosted externally.'
              : 'Bundled image unavailable. Import its folder with the note.'}
        </p>
        {remote && !source && (
          <button
            type="button"
            className="learn-text-button"
            onClick={() => setConsent(true)}
          >
            Load image from{' '}
            {(() => {
              try {
                return new URL(src).hostname;
              } catch {
                return 'external source';
              }
            })()}
          </button>
        )}
      </div>
    </div>
  );
}

export function ImageAnnotation({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const markers = named(node, ['annotation']);
  const [selected, select] = useSelection(node, markers.length);
  const id = useId();
  return (
    <figure className="learn-image-annotation">
      <BlockHeading node={node} />
      {render(rest(node, ['annotation']))}
      <SafeImage src={attr(node, 'src')} alt={attr(node, 'alt')}>
        {markers.map((marker, index) => (
          <button
            className={`learn-image-marker ${selected === index ? 'is-selected' : ''}`}
            style={{
              left: `${numeric(marker, 'x', 50, 0, 100)}%`,
              top: `${numeric(marker, 'y', 50, 0, 100)}%`,
            }}
            key={index}
            type="button"
            aria-label={attr(marker, 'label', `Annotation ${index + 1}`)}
            aria-pressed={selected === index}
            aria-controls={elementId(marker, `${id}-${index}`)}
            onClick={() => select(index)}
          >
            {index + 1}
          </button>
        ))}
      </SafeImage>
      <div className="learn-marker-legend">
        {markers.map((marker, index) => (
          <button
            type="button"
            key={index}
            aria-pressed={selected === index}
            onClick={() => select(index)}
          >
            <span>{index + 1}</span>
            {attr(marker, 'label')}
          </button>
        ))}
      </div>
      {markers.map((marker, index) => (
        <figcaption
          className="learn-diagram-description"
          id={elementId(marker, `${id}-${index}`)}
          key={index}
          hidden={selected !== index}
        >
          {render(marker.children)}
        </figcaption>
      ))}
    </figure>
  );
}
