import { useEffect, useId, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';
import { useCopy } from '../reader/context';
import { useI18n } from '../i18n';
import { sourceForSelection } from './selectionSource';
import './source-actions.css';

export function CopyDocumentSource({ source }: { source: string }) {
  const { t } = useI18n();
  const { copy, copied, error } = useCopy();
  const description = useId();
  return (
    <div className="document-source-action">
      <button
        className="button secondary"
        aria-describedby={description}
        onClick={() => void copy(source)}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? t('Copied', 'Skopiowano') : t('Copy source', 'Kopiuj źródło')}
      </button>
      <p id={description}>
        {t(
          'Paste the source into your LLM to give it context and ask follow-up questions.',
          'Wklej źródło do swojego LLM-a, aby przekazać mu kontekst i dopytać o to, czego nie rozumiesz.',
        )}
      </p>
      {error && (
        <span role="alert">
          {t(
            'Could not copy. Check clipboard permissions and try again.',
            'Nie udało się skopiować. Sprawdź uprawnienia schowka i spróbuj ponownie.',
          )}
        </span>
      )}
    </div>
  );
}

export function CopySelectionSource({
  rootRef,
  source,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  source: string;
}) {
  const { t } = useI18n();
  const { copy, copied, error } = useCopy();
  const [lastCopiedSource, setLastCopiedSource] = useState<string | null>(null);
  const [target, setTarget] = useState<{
    source: string;
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        const selection = window.getSelection();
        const selected =
          root && selection
            ? sourceForSelection(root, selection, source)
            : null;
        if (!selected || !selection || !root) {
          setTarget(null);
          return;
        }
        const rects = Array.from(selection.getRangeAt(0).getClientRects());
        const viewport = root.closest('.workspace')?.getBoundingClientRect();
        const visible = rects.filter(
          (rect) =>
            rect.width > 0 &&
            rect.bottom > (viewport?.top ?? 0) &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth,
        );
        // KaTeX's last DOM rectangle need not be the lowest one (fractions,
        // subscripts). Anchor below the visual selection, not its DOM order.
        const rect = visible.sort((a, b) => a.bottom - b.bottom).at(-1);
        if (!rect) {
          setTarget(null);
          return;
        }
        const left = Math.max(
          12,
          Math.min(rect.left + rect.width / 2 - 96, window.innerWidth - 204),
        );
        const top =
          rect.bottom + 52 < window.innerHeight
            ? Math.max(viewport?.top ?? 0, rect.bottom) + 8
            : Math.max(8, rect.top - 48);
        setTarget({ source: selected, left, top });
      });
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTarget(null);
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('pointerup', update);
    document.addEventListener('scroll', update, true);
    document.addEventListener('keydown', dismiss);
    window.addEventListener('resize', update);
    setTarget(null);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('pointerup', update);
      document.removeEventListener('scroll', update, true);
      document.removeEventListener('keydown', dismiss);
      window.removeEventListener('resize', update);
    };
  }, [rootRef, source]);
  if (!target) return null;
  const explanation = t(
    'Copies the original LearnMD blocks covered by your selection, including formatting and formulas, for context in your LLM.',
    'Kopiuje źródło zaznaczonych bloków LearnMD, wraz z formatowaniem i wzorami, jako kontekst dla LLM-a.',
  );
  return createPortal(
    <div
      className="selection-source-action"
      style={{ left: target.left, top: target.top }}
    >
      <button
        className="button primary"
        title={explanation}
        aria-label={t('Copy source of selection', 'Kopiuj źródło zaznaczenia')}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          setLastCopiedSource(target.source);
          void copy(target.source);
        }}
      >
        {copied && lastCopiedSource === target.source ? (
          <Check size={15} />
        ) : (
          <Copy size={15} />
        )}
        {copied && lastCopiedSource === target.source
          ? t('Copied', 'Skopiowano')
          : t('Copy source', 'Kopiuj źródło')}
      </button>
      {error && lastCopiedSource === target.source && (
        <span className="selection-copy-error" role="alert">
          {t(
            'Could not copy. Check clipboard permissions.',
            'Nie udało się skopiować. Sprawdź uprawnienia schowka.',
          )}
        </span>
      )}
    </div>,
    document.body,
  );
}
