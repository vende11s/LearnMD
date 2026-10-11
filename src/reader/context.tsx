import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { LearnNode } from '../format/types';

export type ReaderContextValue = {
  assets: Record<string, string>;
  allowRemote: boolean;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  render: (nodes?: LearnNode[]) => ReactNode;
  references: Map<string, { title: string; number?: number; name: string }>;
  numbers: Map<LearnNode, number>;
  navigation: { id: string; nonce: number } | null;
};
export const ReaderContext = createContext<ReaderContextValue | null>(null);
export const SyncContext = createContext<string | undefined>(undefined);
export function useReader() {
  const context = useContext(ReaderContext);
  if (!context) throw new Error('Reader components must be inside a document.');
  return context;
}
export function useSelection(node: LearnNode, count: number, initial = 0) {
  const { values, setValue, navigation } = useReader();
  const inheritedGroup = useContext(SyncContext);
  const group = node.attributes?.group || inheritedGroup;
  const defaultIndex = numeric(
    node,
    'initial',
    initial,
    0,
    Math.max(0, count - 1),
  );
  const [local, setLocal] = useState(defaultIndex);
  const raw = group ? Number(values[`sync:${group}`] ?? defaultIndex) : local;
  const selected = Math.max(
    0,
    Math.min(count - 1, Number.isFinite(raw) ? raw : 0),
  );
  const select = (next: number) => {
    const safe = Math.max(0, Math.min(count - 1, next));
    if (group) setValue(`sync:${group}`, String(safe));
    else setLocal(safe);
  };
  useEffect(() => {
    if (!navigation) return;
    const entries = named(node, [
      'step',
      'slide',
      'item',
      'tab',
      'variant',
      'layer',
      'option',
      'case',
      'node',
      'message',
      'annotation',
    ]);
    const matching = entries.findIndex((entry) =>
      hasAnchor(entry, navigation.id),
    );
    if (matching >= 0) select(matching);
    // Navigation is an event, not a subscription to authored content or active index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);
  return [selected, select] as const;
}
export const attr = (node: LearnNode, key: string, fallback = '') =>
  node.attributes?.[key] ?? fallback;
export const flag = (node: LearnNode, key: string, fallback = false) =>
  node.attributes?.[key] === undefined
    ? fallback
    : node.attributes[key] === 'true';
export const numeric = (
  node: LearnNode,
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const value = Number(attr(node, key, String(fallback)));
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
};
export const plainText = (node?: LearnNode): string =>
  !node ? '' : (node.value ?? node.children?.map(plainText).join('') ?? '');
export const named = (node: LearnNode, names: string[]) =>
  (node.children ?? []).filter((child) => names.includes(child.name ?? ''));
export const rest = (node: LearnNode, names: string[]) =>
  (node.children ?? []).filter((child) => !names.includes(child.name ?? ''));
export const titleOf = (node: LearnNode, fallback: string) =>
  attr(node, 'title', attr(node, 'label', fallback));
export const elementId = (node: LearnNode, fallback?: string) =>
  node.id || attr(node, 'id') || fallback;
export const hasAnchor = (node: LearnNode, id: string): boolean =>
  node.id === id ||
  (node.name !== 'node' &&
    node.name !== 'participant' &&
    attr(node, 'id') === id) ||
  Boolean(node.children?.some((child) => hasAnchor(child, id)));

/** Only explicit safe protocols and local document anchors become links. */
export function safeLink(value: string | undefined): string | undefined {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return undefined;
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol))
      return url.href;
  } catch {
    /* Relative hyperlinks cannot access the host filesystem. */
  }
  return undefined;
}
export function assetSource(
  value: string,
  assets: Record<string, string>,
  remote: boolean,
): string | undefined {
  const normalized = value.replace(/^\.\//, '').replace(/\\/g, '/');
  if (Object.hasOwn(assets, normalized)) {
    const source = assets[normalized];
    if (
      /^blob:/.test(source) ||
      /^data:(image\/(png|jpeg|webp|gif|avif)|audio\/(mpeg|ogg|wav|mp4)|video\/(mp4|webm|ogg));base64,/i.test(
        source,
      )
    )
      return source;
  }
  if (remote && /^https:\/\//i.test(value)) return safeLink(value);
  return undefined;
}
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied && !error) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setError(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copied, error]);
  return {
    copied,
    error,
    copy: async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setError(false);
      } catch {
        setError(true);
      }
    },
  };
}

export function BlockHeading({
  node,
  fallback,
  eyebrow,
}: {
  node: LearnNode;
  fallback?: string;
  eyebrow?: string;
}) {
  const title = attr(node, 'title', fallback);
  if (!title && !eyebrow) return null;
  return (
    <header className="learn-block-heading">
      {eyebrow && <span className="learn-eyebrow">{eyebrow}</span>}
      {title && <h4>{title}</h4>}
    </header>
  );
}
export function EmptyBlock({ label }: { label: string }) {
  return <p className="learn-empty">{label}</p>;
}
