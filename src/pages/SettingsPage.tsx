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
import { useI18n, type Language } from '../i18n';

export function SettingsPage({
  theme,
  setTheme,
  remote,
  setRemote,
  onError,
  onToast,
  noteCount,
}: {
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
  remote: boolean;
  setRemote: (v: boolean) => void;
  onError: (s: string) => void;
  onToast: (s: string) => void;
  noteCount: number;
}) {
  const { language, setLanguage, t } = useI18n();
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
      onToast(
        t('Library backup exported.', 'Wyeksportowano kopię biblioteki.'),
      );
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
        throw new Error(
          t('Backup exceeds 100 MB.', 'Kopia zapasowa przekracza 100 MB.'),
        );
      setBusy(true);
      const count = await restoreLibrary(await file.text());
      onToast(
        t(
          `Restored ${count} ${count === 1 ? 'note' : 'notes'} as ${count === 1 ? 'a new copy' : 'new copies'}.`,
          `Przywrócono notatki jako nowe kopie: ${count}.`,
        ),
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
      if (restore.current) restore.current.value = '';
    }
  }
  return (
    <div className="page settings-page">
      <div className="eyebrow">{t('MAKE YOURSELF AT HOME', 'ROZGOŚĆ SIĘ')}</div>
      <h1>
        {t('A space that feels like you.', 'Przestrzeń na Twoich zasadach.')}
      </h1>
      <p className="page-description">
        {t(
          'A few thoughtful choices for your reading experience.',
          'Kilka ustawień, dzięki którym czytanie będzie wygodniejsze.',
        )}
      </p>
      <section className="settings-section">
        <div className="setting-row">
          <div>
            <h3>{t('Interface language', 'Język interfejsu')}</h3>
            <p>
              {t(
                'Starts with your browser language. Your choice is saved on this device.',
                'Domyślnie zgodny z językiem przeglądarki. Twój wybór jest zapisywany na tym urządzeniu.',
              )}
            </p>
          </div>
          <select
            className="language-select"
            aria-label={t('Interface language', 'Język interfejsu')}
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            <option value="en">English</option>
            <option value="pl">Polski</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <h3>{t('Appearance', 'Wygląd')}</h3>
            <p>
              {t(
                'A comfortable backdrop for every idea.',
                'Wygodne tło dla każdej myśli.',
              )}
            </p>
          </div>
          <div className="segmented">
            <button
              className={theme === 'light' ? 'selected' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun size={15} />
              {t('Light', 'Jasny')}
            </button>
            <button
              className={theme === 'dark' ? 'selected' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon size={15} />
              {t('Dark', 'Ciemny')}
            </button>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>{t('External images', 'Obrazy zewnętrzne')}</h3>
            <p>
              {t(
                'Allow imported notes to load HTTPS images from other sites.',
                'Zezwalaj notatkom na wczytywanie obrazów HTTPS z innych stron.',
              )}
              <br />
              {t(
                'This sends a request to the image host.',
                'Powoduje to wysłanie zapytania do serwera obrazu.',
              )}
            </p>
          </div>
          <input
            type="checkbox"
            className="switch"
            aria-label={t(
              'Allow external images',
              'Zezwalaj na obrazy zewnętrzne',
            )}
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
          />
        </div>
      </section>
      <section className="settings-section">
        <h2>{t('Your local library', 'Twoja lokalna biblioteka')}</h2>
        <div className="storage-summary">
          <HardDrive size={25} />
          <div>
            <strong>
              {t(
                `${noteCount} notes, entirely yours.`,
                `Twoje notatki: ${noteCount}. Tylko Twoje.`,
              )}
            </strong>
            <p>
              {storage.usage !== undefined
                ? t(
                    `${(storage.usage / 1024 / 1024).toFixed(1)} MB used on this device`,
                    `${(storage.usage / 1024 / 1024).toFixed(1)} MB zajęte na tym urządzeniu`,
                  )
                : t(
                    'Stored in this browser using IndexedDB',
                    'Zapisano w tej przeglądarce przy użyciu IndexedDB',
                  )}{' '}
              ·{' '}
              {persistent
                ? t(
                    'Persistent storage granted',
                    'Przyznano trwałe przechowywanie',
                  )
                : t(
                    'Standard browser storage',
                    'Standardowa pamięć przeglądarki',
                  )}
            </p>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>
              {t('Keep a portable backup', 'Zachowaj przenośną kopię zapasową')}
            </h3>
            <p>
              {t(
                'Export all notes, folders, favorites, and bundled images.',
                'Eksportuj notatki, foldery, ulubione i dołączone obrazy.',
              )}
              <br />
              {t(
                'Browser data can be removed; keep a backup somewhere safe.',
                'Dane przeglądarki mogą zostać usunięte — przechowuj kopię w bezpiecznym miejscu.',
              )}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void backup()}
          >
            <ArrowDownToLine size={16} />
            {t('Export library', 'Eksportuj bibliotekę')}
          </button>
        </div>
        <div className="setting-row">
          <div>
            <h3>{t('Restore a library', 'Przywróć bibliotekę')}</h3>
            <p>
              {t(
                'Import a LearnMD JSON backup as new copies.',
                'Importuj kopię JSON LearnMD jako nowe egzemplarze notatek.',
              )}
              <br />
              {t(
                'Existing notes are preserved.',
                'Istniejące notatki zostaną zachowane.',
              )}
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => restore.current?.click()}
          >
            <Upload size={16} />
            {t('Restore backup', 'Przywróć kopię')}
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
              <h3>
                {t(
                  'Ask the browser to retain your notes',
                  'Poproś przeglądarkę o zachowanie notatek',
                )}
              </h3>
              <p>
                {t(
                  'Persistent storage reduces automatic eviction.',
                  'Trwałe przechowywanie ogranicza automatyczne usuwanie danych.',
                )}
                <br />
                {t(
                  'Your browser decides whether to grant this request.',
                  'Przeglądarka decyduje, czy przyznać to uprawnienie.',
                )}
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
                        ? t(
                            'Persistent storage granted.',
                            'Przyznano trwałe przechowywanie.',
                          )
                        : t(
                            'Your browser has not granted persistent storage. Keep regular backups.',
                            'Przeglądarka nie przyznała trwałego przechowywania. Regularnie twórz kopie zapasowe.',
                          ),
                    );
                  })
                  .catch((e) => onError(String(e)))
              }
            >
              {t('Request storage', 'Poproś o zachowanie danych')}
            </button>
          </div>
        )}
      </section>
      <div className="privacy-note">
        <ShieldCheck size={22} />
        <div>
          <h3>
            {t(
              'A local copy, a lasting idea.',
              'Lokalna kopia, trwała wiedza.',
            )}
          </h3>
          <p>
            {t(
              'Imported documents are independent copies. Renaming, moving, or deleting them here never changes the original files on your computer. Note bodies are read-only; revise externally and reimport.',
              'Importowane dokumenty są niezależnymi kopiami. Zmiana nazwy, przeniesienie lub usunięcie ich tutaj nie zmienia plików źródłowych na komputerze. Treść notatek jest tylko do odczytu — popraw ją zewnętrznie i zaimportuj ponownie.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
