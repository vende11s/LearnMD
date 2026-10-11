import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Clipboard,
  FileText,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';
import { Modal } from './Modal';
import { parseLearnMD } from '../format/parser';
import {
  db,
  extractSource,
  importNote,
  MAX_FILE_BYTES,
  safeAsset,
  type Folder,
  type Note,
} from '../storage';

export function ImportDialog({
  notes,
  folders,
  initialFolder,
  onClose,
  onImported,
}: {
  notes: Note[];
  folders: Folder[];
  initialFolder: string | null;
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [source, setSource] = useState('');
  const [validation, setValidation] = useState('');
  const [files, setFiles] = useState<
    { name: string; source: string; path: string }[]
  >([]);
  const [assets, setAssets] = useState<File[]>([]);
  const [folder, setFolder] = useState(initialFolder ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState('');
  const [replaceId, setReplaceId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setValidation(source), 250);
    return () => clearTimeout(t);
  }, [source]);
  const parsed = useMemo(
    () => (validation.trim() ? parseLearnMD(extractSource(validation)) : null),
    [validation],
  );
  const duplicates = parsed
    ? notes.filter((n) => n.title === parsed.metadata.title)
    : [];
  async function readFiles(list: FileList | File[]) {
    setError('');
    const all = Array.from(list);
    if (all.length > 200) {
      setError('Import up to 200 files at a time.');
      return;
    }
    const md = all.filter((f) => /\.(learn\.md|md)$/i.test(f.name));
    if (!md.length) {
      setError(
        'Select a .learn.md or .md file. Image assets can be included with folder import.',
      );
      return;
    }
    if (md.some((f) => f.size > MAX_FILE_BYTES)) {
      setError(
        'Each note must be smaller than 2 MB. Split larger documents into chapters.',
      );
      return;
    }
    if (all.some((f) => !/\.md$/i.test(f.name) && !safeAsset(f))) {
      setError(
        'Unsupported assets were skipped. Supported images: PNG, JPEG, GIF, WebP, AVIF, up to 10 MB each.',
      );
    }
    try {
      const read = await Promise.all(
        md.map(async (f) => ({
          name: f.name,
          source: extractSource(await f.text()),
          path: f.webkitRelativePath || f.name,
        })),
      );
      setFiles(read);
      setAssets(all.filter(safeAsset));
      setTab('file');
    } catch {
      setError(
        'A selected file could not be read. Check that it is still available, then select the files again.',
      );
    }
  }
  const fileResults = useMemo(
    () => files.map((f) => ({ ...f, parsed: parseLearnMD(f.source) })),
    [files],
  );
  const bad =
    tab === 'paste'
      ? parsed?.diagnostics.some((d) => d.severity === 'error')
      : fileResults.some((f) =>
          f.parsed.diagnostics.some((d) => d.severity === 'error'),
        );
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const sources =
        tab === 'paste'
          ? [{ source, path: '' }]
          : fileResults.filter(
              (f) => !f.parsed.diagnostics.some((d) => d.severity === 'error'),
            );
      let first = '';
      await db.transaction('rw', db.notes, db.assets, db.folders, async () => {
        for (const item of sources) {
          const base = item.path.includes('/')
            ? item.path.slice(0, item.path.lastIndexOf('/') + 1)
            : '';
          const bundled = (tab === 'file' ? assets : [])
            .filter((f) => (f.webkitRelativePath || f.name).startsWith(base))
            .map((f) => ({
              path: (f.webkitRelativePath || f.name).slice(base.length),
              blob: new Blob([f], {
                type:
                  f.type ||
                  ({
                    png: 'image/png',
                    jpg: 'image/jpeg',
                    jpeg: 'image/jpeg',
                    gif: 'image/gif',
                    webp: 'image/webp',
                    avif: 'image/avif',
                  }[f.name.split('.').at(-1)!.toLowerCase()] ??
                    ''),
              }),
            }));
          const note = await importNote(item.source, folder || null, {
            replaceId:
              tab === 'paste' && mode === 'replace' ? replaceId : undefined,
            ...(bundled.length ? { assets: bundled } : {}),
          });
          first ||= note.id;
        }
      });
      onImported(first);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save this note. Check browser storage and export a backup before clearing any data.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Bring an idea into your library" onClose={onClose} wide>
      <p className="muted modal-intro">
        Import notes from anywhere. Make understanding your own.
      </p>
      <div className="segmented import-tabs">
        <button
          className={tab === 'paste' ? 'selected' : ''}
          onClick={() => setTab('paste')}
        >
          <Clipboard size={16} /> Paste source
        </button>
        <button
          className={tab === 'file' ? 'selected' : ''}
          onClick={() => setTab('file')}
        >
          <Upload size={16} /> Import files
        </button>
      </div>
      {tab === 'paste' ? (
        <>
          <label className="field-label" htmlFor="paste-source">
            LearnMD source{' '}
            <span>Markdown or a complete code-fenced document</span>
          </label>
          <textarea
            id="paste-source"
            className="source-input"
            spellCheck={false}
            value={source}
            maxLength={MAX_FILE_BYTES}
            onChange={(e) => {
              setSource(e.target.value);
              setMode('');
            }}
            placeholder={
              '---\ntitle: Your next big idea\nversion: "1"\n---\n\n# Start with a little curiosity\n\nPaste your complete .learn.md document here…'
            }
          />
          {parsed && (
            <div className={`validation ${bad ? 'invalid' : ''}`}>
              <div>
                {bad ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <strong>
                  {bad ? 'A few things need attention' : parsed.metadata.title}
                </strong>
                {!bad && (
                  <span>{parsed.wordCount} words · ready to import</span>
                )}
              </div>
              {parsed.diagnostics.length > 0 && (
                <ul>
                  {parsed.diagnostics.slice(0, 8).map((d, i) => (
                    <li key={i}>
                      {d.line ? `Line ${d.line}: ` : ''}
                      {d.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className={`dropzone ${drag ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void readFiles(e.dataTransfer.files);
            }}
          >
            <span className="upload-icon">
              <Upload size={28} />
            </span>
            <h3>A new chapter starts here</h3>
            <p>Drop your .learn.md files here, or choose them below.</p>
            <button
              className="button primary"
              onClick={() => fileInput.current?.click()}
            >
              Choose files
            </button>
            <button
              className="text-button"
              onClick={() => dirInput.current?.click()}
            >
              <FolderOpen size={15} /> Import a folder with images
            </button>
            <small>Everything is read and stored on this device.</small>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".md,.learn.md"
            multiple
            hidden
            onChange={(e) => e.target.files && void readFiles(e.target.files)}
          />
          <input
            ref={dirInput}
            type="file"
            multiple
            hidden
            {...({ webkitdirectory: '', directory: '' } as object)}
            onChange={(e) => e.target.files && void readFiles(e.target.files)}
          />
          {fileResults.map((f) => (
            <div className="file-result" key={f.path}>
              <FileText size={18} />
              <div>
                <strong>{f.parsed.metadata.title}</strong>
                <small>{f.name}</small>
                {f.parsed.diagnostics.map((d, i) => (
                  <p
                    className={d.severity === 'error' ? 'error-text' : 'muted'}
                    key={i}
                  >
                    {d.line ? `Line ${d.line}: ` : ''}
                    {d.message}
                  </p>
                ))}
              </div>
              {f.parsed.diagnostics.some((d) => d.severity === 'error') ? (
                <AlertCircle size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
            </div>
          ))}
          {files.length > 0 && (
            <p className="fineprint">
              Valid files are imported together as new copies; files with errors
              are skipped. To replace a note, use Paste source and choose
              Replace. Relative image paths resolve inside each document’s
              folder.
            </p>
          )}
        </>
      )}
      <div className="import-options">
        <label>
          Save to
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All notes</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderLabel(f, folders)}
              </option>
            ))}
          </select>
        </label>
        {tab === 'paste' && (
          <label>
            Import as
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                if (e.target.value === 'replace')
                  setReplaceId(duplicates[0]?.id ?? notes[0]?.id ?? '');
              }}
            >
              <option value="">
                {duplicates.length
                  ? 'Choose how to handle existing title'
                  : 'A new local copy'}
              </option>
              <option value="new">Create a new copy</option>
              {notes.length > 0 && (
                <option value="replace">Replace an existing note…</option>
              )}
            </select>
          </label>
        )}
      </div>
      {tab === 'paste' && mode === 'replace' && (
        <label className="field-label">
          Replace this local copy
          <select
            value={replaceId}
            onChange={(e) => setReplaceId(e.target.value)}
          >
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          <span>
            This replaces its source while preserving its favorite status.
            Export the old copy first if you need it.
          </span>
        </label>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <span>
          <span className="status-dot" /> Private by default. Local by design.
        </span>
        <button
          className="button primary"
          disabled={
            busy ||
            (tab === 'paste' && !!bad) ||
            (tab === 'paste'
              ? !source.trim() ||
                validation !== source ||
                (!mode && duplicates.length > 0) ||
                (mode === 'replace' && !replaceId)
              : !fileResults.some(
                  (f) =>
                    !f.parsed.diagnostics.some((d) => d.severity === 'error'),
                ))
          }
          onClick={() => void submit()}
        >
          {busy
            ? 'Saving…'
            : tab === 'paste' && mode === 'replace'
              ? 'Replace & open'
              : 'Import & open'}
          <ArrowRight size={16} />
        </button>
      </footer>
    </Modal>
  );
}
export function folderLabel(folder: Folder, folders: Folder[]): string {
  const parts = [folder.name];
  let p = folder.parentId;
  const seen = new Set([folder.id]);
  while (p && !seen.has(p)) {
    seen.add(p);
    const parent = folders.find((f) => f.id === p);
    if (!parent) break;
    parts.unshift(parent.name);
    p = parent.parentId;
  }
  return parts.join(' / ');
}
