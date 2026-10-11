import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bookmark, Printer } from 'lucide-react';
import { db, type Note } from '../storage';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import {
  CopyDocumentSource,
  CopySelectionSource,
} from '../components/SourceActions';
import { useI18n } from '../i18n';
import { sourceProps } from '../reader/source';
import { readingMinutes } from '../format/summary';

function revealFocusedOutlineItem(
  nav: HTMLElement | null,
  button: HTMLElement,
) {
  if (!nav || !button || nav.clientHeight === 0) return;
  const bounds = nav.getBoundingClientRect();
  const item = button.getBoundingClientRect();
  // Only move the outline's scrollport, never its document ancestors.
  if (item.top < bounds.top + 6) nav.scrollTop += item.top - bounds.top - 6;
  else if (item.bottom > bounds.bottom - 6)
    nav.scrollTop += item.bottom - bounds.bottom + 6;
}

export function ReaderView({
  note,
  outline,
  allowRemote,
  mainRef,
  onError,
}: {
  note: Note;
  outline: boolean;
  allowRemote: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  onError: (s: string) => void;
}) {
  const { t } = useI18n();
  const parsed = useMemo(() => parseLearnMD(note.source), [note.source]);
  const document = parsed;
  const contentRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLElement>(null);
  const outlineNavRef = useRef<HTMLElement>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [active, setActive] = useState('');
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const progress = useRef(note.position);
  const headings = useMemo(
    () => parsed.headings.filter((h) => h.depth > 1),
    [parsed],
  );
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    void db.assets
      .where('noteId')
      .equals(note.id)
      .toArray()
      .then((rows) => {
        if (!live) return;
        const map: Record<string, string> = {};
        for (const row of rows) {
          const url = URL.createObjectURL(row.blob);
          urls.push(url);
          map[row.path] = url;
        }
        if (live) setAssets(map);
      })
      .catch((e) => onError(String(e)));
    return () => {
      live = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [note.id, onError]);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTo({ top: note.position, behavior: 'instant' });
    let saveTimer: ReturnType<typeof setTimeout>;
    const save = () => {
      void db.notes
        .update(note.id, { position: progress.current })
        .catch((e) =>
          onError(
            `${t('Reading position could not be saved', 'Nie udało się zapisać miejsca w notatce')}: ${String(e)}`,
          ),
        );
    };
    const scroll = () => {
      progress.current = el.scrollTop;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 350);
    };
    el.addEventListener('scroll', scroll, { passive: true });
    return () => {
      clearTimeout(saveTimer);
      el.removeEventListener('scroll', scroll);
      save();
    };
  }, [note.id]);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const updateActive = () => {
      const eligible = headings
        .map((h) => window.document.getElementById(h.id))
        .filter(
          (element): element is HTMLElement =>
            !!element && element.getClientRects().length > 0,
        );
      const threshold = el.getBoundingClientRect().top + 115;
      setActive(
        eligible.filter((h) => h.getBoundingClientRect().top < threshold).at(-1)
          ?.id ??
          eligible[0]?.id ??
          '',
      );
    };
    updateActive();
    el.addEventListener('scroll', updateActive, { passive: true });
    return () => el.removeEventListener('scroll', updateActive);
  }, [headings, mainRef]);
  useLayoutEffect(() => {
    const workspace = mainRef.current;
    const aside = outlineRef.current;
    if (!workspace || !aside) return;
    const resize = () => {
      aside.style.setProperty(
        '--reader-viewport-height',
        `${workspace.clientHeight}px`,
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [mainRef, outline]);
  return (
    <div className={`reader-layout ${outline ? 'with-outline' : ''}`}>
      <div className="reader-column" ref={contentRef}>
        <div className="reader-prelude">
          <span className="eyebrow">{note.subject}</span>
          <div className="read-meta">
            {readingMinutes(parsed)} {t('MIN READ', 'MIN CZYTANIA')}{' '}
            <span>·</span>{' '}
            {note.sample
              ? t('GETTING STARTED', 'PRZEWODNIK')
              : t('LOCAL COPY', 'KOPIA LOKALNA')}
          </div>
        </div>
        <h1
          {...(parsed.children[0]?.type === 'heading' &&
          parsed.children[0]?.depth === 1
            ? sourceProps(parsed.children[0])
            : {
                'data-source-start': 0,
                'data-source-end': parsed.source.length,
                'data-source-kind': 'metadata',
              })}
          className="document-title"
          id={
            parsed.children[0]?.type === 'heading' &&
            parsed.children[0]?.depth === 1
              ? parsed.children[0].id
              : undefined
          }
        >
          {note.title}
        </h1>
        {note.description && (
          <p
            className="document-description"
            data-source-start={0}
            data-source-end={parsed.source.length}
            data-source-kind="metadata"
          >
            {note.description}
          </p>
        )}
        <CopyDocumentSource source={note.source} />
        {parsed.diagnostics.length > 0 && (
          <details className="reader-diagnostics">
            <summary>
              {t('Format notices', 'Uwagi do formatu')}:{' '}
              {parsed.diagnostics.length}
            </summary>
            {parsed.diagnostics.map((d, i) => (
              <p key={i}>{d.message}</p>
            ))}
          </details>
        )}
        <ReaderContent
          document={document}
          assets={assets}
          allowRemote={allowRemote}
          hideTitle
          navigationTarget={navigationTarget}
        />
        <footer className="reader-end">
          <BookOpen size={22} />
          <span>
            {t('A little more understanding.', 'Kolejny krok do zrozumienia.')}
          </span>
          <button
            className="text-button"
            onClick={() =>
              mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }
          >
            {t('Back to the beginning ↑', 'Wróć na początek ↑')}
          </button>
        </footer>
      </div>
      {outline && (
        <aside className="document-outline" ref={outlineRef}>
          <span className="eyebrow">{t('IN THIS NOTE', 'W TEJ NOTATCE')}</span>
          <nav
            ref={outlineNavRef}
            aria-label={t('Document outline', 'Spis treści')}
          >
            {headings.map((h) => (
              <button
                key={h.id}
                className={active === h.id ? 'active' : ''}
                aria-current={active === h.id ? 'location' : undefined}
                style={{ paddingLeft: (h.depth - 2) * 12 }}
                onFocus={(event) => {
                  const button = event.currentTarget;
                  // Correct partial clipping after the browser's focus scroll.
                  requestAnimationFrame(() => {
                    if (button.ownerDocument.activeElement === button)
                      revealFocusedOutlineItem(outlineNavRef.current, button);
                  });
                }}
                onClick={() => {
                  setNavigationTarget({ id: h.id, nonce: Date.now() });
                  setActive(h.id);
                }}
              >
                {h.text}
              </button>
            ))}
          </nav>
          <div className="outline-bottom">
            <Bookmark size={16} />
            <p>
              {t(
                'Your place is saved as you read.',
                'Miejsce w notatce zapisuje się podczas czytania.',
              )}
            </p>
          </div>
          <button className="text-button" onClick={() => window.print()}>
            <Printer size={15} /> {t('Print note', 'Drukuj notatkę')}
          </button>
        </aside>
      )}
      <CopySelectionSource rootRef={contentRef} source={parsed.source} />
    </div>
  );
}
