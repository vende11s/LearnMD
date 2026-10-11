import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [active, setActive] = useState('');
  const [navigationTarget, setNavigationTarget] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const progress = useRef(note.position);
  const headings = parsed.headings.filter((h) => h.depth > 1);
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
      const eligible = headings
        .map((h) => window.document.getElementById(h.id))
        .filter(
          (element): element is HTMLElement =>
            !!element && element.getClientRects().length > 0,
        );
      setActive(
        eligible.filter((h) => h.getBoundingClientRect().top < 180).at(-1)
          ?.id ??
          headings[0]?.id ??
          '',
      );
    };
    el.addEventListener('scroll', scroll, { passive: true });
    return () => {
      clearTimeout(saveTimer);
      el.removeEventListener('scroll', scroll);
      save();
    };
  }, [note.id]);
  return (
    <div className={`reader-layout ${outline ? 'with-outline' : ''}`}>
      <div className="reader-column" ref={contentRef}>
        <div className="reader-prelude">
          <span className="eyebrow">{note.subject}</span>
          <div className="read-meta">
            {Math.max(1, Math.ceil(parsed.wordCount / 220))}{' '}
            {t('MIN READ', 'MIN CZYTANIA')} <span>·</span>{' '}
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
        <aside className="document-outline">
          <span className="eyebrow">{t('IN THIS NOTE', 'W TEJ NOTATCE')}</span>
          <nav aria-label={t('Document outline', 'Spis treści')}>
            {headings.map((h) => (
              <button
                key={h.id}
                className={active === h.id ? 'active' : ''}
                style={{ paddingLeft: (h.depth - 2) * 12 }}
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
