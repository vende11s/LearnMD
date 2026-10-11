import { useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  HardDrive,
  ArrowDownToLine,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { download, exportLibrary, restoreLibrary } from '../storage';
import type { DetailLevel as Detail } from '../reader/context';
import { DetailControl } from '../components/DetailControl';

export function SettingsPage({
  theme,
  setTheme,
  remote,
  setRemote,
  detail,
  setDetail,
  onError,
  onToast,
  noteCount,
}: {
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
  remote: boolean;
  setRemote: (v: boolean) => void;
  detail: Detail;
  setDetail: (d: Detail) => void;
  onError: (s: string) => void;
  onToast: (s: string) => void;
  noteCount: number;
}) {
  const restore = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>(
    {},
  );
  const [persistent, setPersistent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(setStorage)
      .catch(() => {});
    void navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
  }, []);
  async function backup() {
    try {
      setBusy(true);
      download(
        await exportLibrary(),
        `learnmd-library-${new Date().toISOString().slice(0, 10)}.json`,
      );
      onToast('Library backup exported.');
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function restoreFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error('Backup exceeds 100 MB.');
      setBusy(true);
      const count = await restoreLibrary(await file.text());
      onToast(`Restored ${count} notes as new copies.`);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
      if (restore.current) restore.current.value = '';
    }
  }
  return (
    <div className="page settings-page">
      <div className="eyebrow">MAKE YOURSELF AT HOME</div>
      <h1>A space that feels like you.</h1>
      <p className="page-description">
        A few thoughtful choices for your reading experience.
      </p>
      <section className="settings-section">
        <h2>Reading</h2>
        <div className="setting-row">
          <div>
            <h3>Appearance</h3>
            <p>A comfortable backdrop for every idea.</p>
          </div>
          <div className="segmented">
            <button
              className={theme === 'light' ? 'selected' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun size={15} />
              Light
            </button>
            <button
              className={theme === 'dark' ? 'selected' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon size={15} />
              Dark
            </button>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>Default detail level</h3>
            <p>Choose how much explanation to show.</p>
          </div>
          <DetailControl detail={detail} setDetail={setDetail} />
        </div>
        <div className="setting-row">
          <div>
            <h3>External images</h3>
            <p>
              Allow imported notes to load HTTPS images from other sites.
              <br />
              This sends a request to the image host.
            </p>
          </div>
          <input
            type="checkbox"
            className="switch"
            aria-label="Allow external images"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
          />
        </div>
      </section>
      <section className="settings-section">
        <h2>Your local library</h2>
        <div className="storage-summary">
          <HardDrive size={25} />
          <div>
            <strong>{noteCount} notes, entirely yours.</strong>
            <p>
              {storage.usage !== undefined
                ? `${(storage.usage / 1024 / 1024).toFixed(1)} MB used on this device`
                : 'Stored in this browser using IndexedDB'}{' '}
              ·{' '}
              {persistent
                ? 'Persistent storage granted'
                : 'Standard browser storage'}
            </p>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>Keep a portable backup</h3>
            <p>
              Export all notes, folders, favorites, and bundled images.
              <br />
              Browser data can be removed; keep a backup somewhere safe.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void backup()}
          >
            <ArrowDownToLine size={16} />
            Export library
          </button>
        </div>
        <div className="setting-row">
          <div>
            <h3>Restore a library</h3>
            <p>
              Import a LearnMD JSON backup as new copies.
              <br />
              Existing notes are preserved.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => restore.current?.click()}
          >
            <Upload size={16} />
            Restore backup
          </button>
          <input
            ref={restore}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => void restoreFile(e.target.files?.[0])}
          />
        </div>
        {!persistent && (
          <div className="setting-row">
            <div>
              <h3>Ask the browser to retain your notes</h3>
              <p>
                Persistent storage reduces automatic eviction.
                <br />
                Your browser decides whether to grant this request.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                void navigator.storage
                  ?.persist?.()
                  .then((ok) => {
                    setPersistent(ok);
                    onToast(
                      ok
                        ? 'Persistent storage granted.'
                        : 'Your browser has not granted persistent storage. Keep regular backups.',
                    );
                  })
                  .catch((e) => onError(String(e)))
              }
            >
              Request storage
            </button>
          </div>
        )}
      </section>
      <div className="privacy-note">
        <ShieldCheck size={22} />
        <div>
          <h3>A local copy, a lasting idea.</h3>
          <p>
            Imported documents are independent copies. Renaming, moving, or
            deleting them here never changes the original files on your
            computer. Note bodies are read-only; revise externally and reimport.
          </p>
        </div>
      </div>
    </div>
  );
}
