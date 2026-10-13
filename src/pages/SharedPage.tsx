import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  Folder as FolderSymbol,
  Link2,
} from 'lucide-react';
import type { ShareBundle } from '../../shared/share-contract';
import type { Folder } from '../storage';
import { getSharedImport, importShareBundle } from '../sharing/bundle';
import { ShareSourceLimitError } from '../sharing/sourceBudget';
import {
  deleteShare,
  fetchShare,
  getOwnedShare,
  shareErrorText,
  ShareError,
  type SharedContent,
} from '../sharing/client';
import { useShareCooldown } from '../sharing/useShareCooldown';
import { useI18n } from '../i18n';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from '../reader/ReaderContent';
import { folderLabel } from '../components/ImportDialog';
import './shared-page.css';

type ImportResult = Awaited<ReturnType<typeof importShareBundle>>;
function importRoute(result: ImportResult) {
  return result.folderId
    ? `folder/${result.folderId}`
    : result.noteId
      ? `note/${result.noteId}`
      : 'library';
}

function SharedPreview({
  note,
  bundle,
}: {
  note: ShareBundle['notes'][number];
  bundle: ShareBundle;
}) {
  const parsed = useMemo(() => parseLearnMD(note.source), [note.source]);
  const assets = useMemo(() => {
    const map: Record<string, string> = Object.create(null);
    for (const asset of bundle.assets) {
      if (asset.noteId === note.id)
        map[asset.path] = `data:${asset.type};base64,${asset.data}`;
    }
    return map;
  }, [note.id, bundle]);
  return (
    <ReaderContent document={parsed} assets={assets} allowRemote={false} />
  );
}

export function SharedPage({
  shareId,
  folders,
  onNavigate,
}: {
  shareId: string;
  folders: Folder[];
  onNavigate: (path: string) => void;
}) {
  const { t, language } = useI18n();
  const [content, setContent] = useState<SharedContent | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [destination, setDestination] = useState('');
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [allowAnother, setAllowAnother] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [owner, setOwner] = useState(() => getOwnedShare(shareId));
  const [now, setNow] = useState(Date.now);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const { remaining, monthlyBlock, monthlyMessage, handleRateLimit } =
    useShareCooldown();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setContent(null);
    setImported(null);
    setAllowAnother(false);
    setRemoved(false);
    setOwner(getOwnedShare(shareId));
    void fetchShare(shareId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setContent(result);
        setSelectedId(result.bundle.notes[0]?.id || '');
        setNow(Date.now());
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof ShareError &&
              failure.code === 'monthly_limit' &&
              failure.resetAt
              ? ''
              : shareErrorText(failure, t),
          );
          handleRateLimit(failure);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // Reading the import marker never writes or imports the shared content.
    void getSharedImport(shareId)
      .then((result) => {
        if (!controller.signal.aborted) setImported(result);
      })
      .catch(() => {
        /* Preview remains available when local storage is unavailable. */
      });
    return () => controller.abort();
    // Rate-limit state is independent of request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, attempt, t]);
  useEffect(() => {
    if (!content) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(1, content.expiresAt - Date.now()), 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [content]);
  const expired = Boolean(content && content.expiresAt <= now);
  async function add() {
    if (!content || content.expiresAt <= Date.now() || lock.current || removed)
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await importShareBundle(
        content.bundle,
        destination || null,
        shareId,
      );
      if (alive.current) {
        setImported(result);
        onNavigate(importRoute(result));
      }
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error &&
            !(failure instanceof ShareSourceLimitError)
            ? failure.message
            : shareErrorText(failure, t),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function disable() {
    if (!owner || lock.current || remaining) return;
    lock.current = true;
    setBusy(true);
    setError('');
    request.current = new AbortController();
    try {
      await deleteShare(shareId, owner.deleteToken, request.current.signal);
      if (alive.current) {
        setRemoved(true);
        setContent(null);
        setOwner(null);
      }
    } catch (failure) {
      if (alive.current && !request.current.signal.aborted) {
        setError(shareErrorText(failure, t));
        handleRateLimit(failure);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const bundle = content?.bundle;
  const selected = bundle?.notes.find((note) => note.id === selectedId);
  function tree(parentId: string | null) {
    if (!bundle) return null;
    const childFolders = bundle.folders.filter(
      (folder) => folder.parentId === parentId,
    );
    const childNotes = bundle.notes.filter(
      (note) => note.folderId === parentId,
    );
    return (
      <ul>
        {childFolders.map((folder) => (
          <li key={folder.id}>
            <div className="shared-folder-label">
              <FolderSymbol size={16} />
              <span>{folder.name}</span>
            </div>
            {tree(folder.id)}
          </li>
        ))}
        {childNotes.map((note) => (
          <li key={note.id}>
            <button
              className={note.id === selectedId ? 'selected' : ''}
              aria-pressed={note.id === selectedId}
              onClick={() => setSelectedId(note.id)}
            >
              <BookOpen size={15} />
              <span>{note.title}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="page shared-page">
      <div className="eyebrow">{t('SHARED COPY', 'UDOSTĘPNIONA KOPIA')}</div>
      <h1>{bundle?.title || t('Shared notes', 'Udostępnione notatki')}</h1>
      <p className="shared-lifetime">
        <Link2 size={17} />
        {t('Link valid for 7 days', 'Link ważny przez 7 dni')}
        {content && (
          <>
            {' '}
            · {t('Expires:', 'Wygasa:')}{' '}
            <time dateTime={new Date(content.expiresAt).toISOString()}>
              {new Date(content.expiresAt).toLocaleString(
                language === 'pl' ? 'pl-PL' : 'en-GB',
              )}
            </time>
          </>
        )}
      </p>
      {loading && (
        <p role="status">
          {t('Loading shared copy…', 'Wczytywanie udostępnionej kopii…')}
        </p>
      )}
      {removed && (
        <p role="status">
          {t(
            'Link disabled. Copies already imported remain in their recipients’ libraries.',
            'Link wyłączony. Wcześniej zaimportowane kopie pozostają w bibliotekach odbiorców.',
          )}
        </p>
      )}
      {expired && (
        <p className="error-banner" role="alert">
          {t(
            'This link has expired. Ask the author for a new link.',
            'Ten link wygasł. Poproś autora o nowy link.',
          )}
        </p>
      )}
      {monthlyMessage && (
        <p className="error-banner" role="status">
          {monthlyMessage}
        </p>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {remaining > 0 && (
        <p className="fineprint" role="status">
          {t(
            `Try again in ${remaining} seconds.`,
            `Spróbuj ponownie za ${remaining} s.`,
          )}
        </p>
      )}
      {!loading && !content && !removed && (
        <div className="button-row">
          <button
            className="button secondary"
            disabled={remaining > 0 || Boolean(monthlyBlock)}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('Try again', 'Spróbuj ponownie')}
          </button>
          <button className="text-button" onClick={() => onNavigate('library')}>
            {t('Go to your library', 'Przejdź do biblioteki')}
          </button>
        </div>
      )}
      {owner && (
        <div className="shared-owner">
          <p className="fineprint">
            {t(
              'You created this link in this browser. Disabling it does not remove copies already imported.',
              'Ten link powstał w tej przeglądarce. Wyłączenie go nie usuwa już zaimportowanych kopii.',
            )}
          </p>
          <button
            className="text-button danger"
            disabled={busy || remaining > 0}
            onClick={() => void disable()}
          >
            {t('Disable link', 'Wyłącz link')}
          </button>
        </div>
      )}
      {imported && !allowAnother && (
        <div className="shared-imported" role="status">
          <strong>
            {t('Already in your library', 'Już w Twojej bibliotece')}
          </strong>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => onNavigate(importRoute(imported))}
            >
              {t('Open imported copy', 'Otwórz zaimportowaną kopię')}
            </button>
            {bundle && !expired && (
              <button
                className="button secondary"
                onClick={() => setAllowAnother(true)}
              >
                {t('Add another copy', 'Dodaj kolejną kopię')}
              </button>
            )}
          </div>
        </div>
      )}
      {bundle && !expired && (
        <>
          <div className="shared-import-panel">
            <div>
              <h2>
                {t(
                  'Make it part of your library',
                  'Dodaj do swojej biblioteki',
                )}
              </h2>
              <p>
                {t(
                  'Browse the copy below. Importing keeps the folder structure and images, and creates independent local notes that remain after the link expires.',
                  'Przejrzyj kopię poniżej. Import zachowuje strukturę folderów i obrazy oraz tworzy niezależne lokalne notatki, które pozostaną po wygaśnięciu linku.',
                )}
              </p>
            </div>
            {(!imported || allowAnother) && (
              <div className="shared-import-controls">
                <label className="field-label">
                  {t('Destination folder', 'Folder docelowy')}
                  <select
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">
                      {t(
                        'All notes / root',
                        'Wszystkie notatki / katalog główny',
                      )}
                    </option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folderLabel(folder, folders)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void add()}
                >
                  <Download size={17} />
                  {busy
                    ? t('Importing…', 'Importowanie…')
                    : t('Add to my library', 'Dodaj do mojej biblioteki')}
                </button>
              </div>
            )}
          </div>
          <div className="shared-layout">
            <nav
              className="shared-tree"
              aria-label={t('Shared contents', 'Udostępniona zawartość')}
            >
              <h2>{t('Contents', 'Zawartość')}</h2>
              <p className="fineprint">
                {t('Notes', 'Notatki')}: {bundle.notes.length} ·{' '}
                {t('Images', 'Obrazy')}: {bundle.assets.length}
              </p>
              {tree(null)}
            </nav>
            <section
              className="shared-preview"
              aria-label={t('Note preview', 'Podgląd notatki')}
            >
              {selected ? (
                <>
                  <p className="eyebrow">{selected.title}</p>
                  <SharedPreview
                    key={selected.id}
                    note={selected}
                    bundle={bundle}
                  />
                </>
              ) : (
                <p>
                  {t(
                    'This folder contains no notes.',
                    'Ten folder nie zawiera notatek.',
                  )}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
