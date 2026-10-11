import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bookmark, Printer, SlidersHorizontal } from 'lucide-react';
import { db, type Note } from '../storage';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import type { DetailLevel as Detail } from '../reader/context';
import { DetailControl } from '../components/DetailControl';

export function ReaderView({
  note,
  detail,
  setDetail,
  outline,
  allowRemote,
  mainRef,
  onError,
}: {
  note: Note;
  detail: Detail;
  setDetail: (d: Detail) => void;
  outline: boolean;
  allowRemote: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  onError: (s: string) => void;
}) {
  const parsed = useMemo(() => parseLearnMD(note.source), [note.source]);
  const document = parsed;
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
          onError(`Reading position could not be saved: ${String(e)}`),
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
      <div className="reader-column">
        <div className="reader-prelude">
          <span className="eyebrow">{note.subject}</span>
          <div className="read-meta">
            {Math.max(1, Math.ceil(parsed.wordCount / 220))} MIN READ{' '}
            <span>·</span> {note.sample ? 'EXAMPLE NOTE' : 'LOCAL COPY'}
          </div>
        </div>
        <h1
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
          <p className="document-description">{note.description}</p>
        )}
        <div className="reader-settings">
          <div>
            <SlidersHorizontal size={15} />
            <span>Level of detail</span>
          </div>
          <DetailControl detail={detail} setDetail={setDetail} />
        </div>
        {parsed.diagnostics.length > 0 && (
          <details className="reader-diagnostics">
            <summary>
              {parsed.diagnostics.length} format{' '}
              {parsed.diagnostics.length === 1 ? 'notice' : 'notices'}
            </summary>
            {parsed.diagnostics.map((d, i) => (
              <p key={i}>{d.message}</p>
            ))}
          </details>
        )}
        <ReaderContent
          document={document}
          detail={detail}
          assets={assets}
          allowRemote={allowRemote}
          hideTitle
          navigationTarget={navigationTarget}
        />
        <footer className="reader-end">
          <BookOpen size={22} />
          <span>A little more understanding.</span>
          <button
            className="text-button"
            onClick={() =>
              mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }
          >
            Back to the beginning ↑
          </button>
        </footer>
      </div>
      {outline && (
        <aside className="document-outline">
          <span className="eyebrow">IN THIS NOTE</span>
          <nav aria-label="Document outline">
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
              Your place is saved
              <br />
              as you read.
            </p>
          </div>
          <button className="text-button" onClick={() => window.print()}>
            <Printer size={15} /> Print note
          </button>
        </aside>
      )}
    </div>
  );
}
