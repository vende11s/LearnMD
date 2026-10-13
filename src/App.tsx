import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Github,
  Grid2X2,
  HardDrive,
  Library,
  List,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Moon,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { db, exportLibrary, download } from './storage';
import { initializeLibrary } from './librarySetup';
import { buildGenerationPrompt } from './format/prompt';
import { ImportDialog } from './components/ImportDialog';
import { LearnMDSkillPanel } from './components/LearnMDSkillPanel';
import { ManageDialog } from './components/ManageDialog';
import { ShareDialog } from './components/ShareDialog';
import { SharedPage } from './pages/SharedPage';
import { getSharingConfig } from './sharing/client';
import type { ShareTarget } from '../shared/share-contract';
import { FolderBranch } from './components/FolderBranch';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderView } from './pages/ReaderView';
import { Showcase } from './pages/Showcase';
import { SettingsPage } from './pages/SettingsPage';
import { useStored } from './hooks/useStored';
import { I18nProvider, useI18n } from './i18n';
import { PUBLIC_COMPONENTS } from './format/registry';

function AppInner() {
  const { language, t } = useI18n();
  const [route, setRoute] = useState(
    () => decodeURI(location.hash.slice(1)) || 'library',
  );
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useStored<'light' | 'dark'>(
    'learnmd-theme',
    'light',
  );
  const [sort, setSort] = useStored('learnmd-sort', 'recent');
  const [remote, setRemote] = useStored('learnmd-remote', true);
  const [sidebar, setSidebar] = useState(false);
  const [focus, setFocus] = useState(false);
  const [outline, setOutline] = useState(true);
  const [importing, setImporting] = useState(false);
  const [manage, setManage] = useState<{
    type: 'note' | 'folder';
    id: string;
    confirmDelete?: boolean;
  } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const main = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const navigate = useCallback((path: string) => {
    location.hash = path;
    setRoute(path);
    setQuery('');
    setSidebar(false);
    setFocus(false);
    main.current?.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const fn = () => {
      setRoute(decodeURI(location.hash.slice(1)) || 'library');
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : t(
                'The operation failed. Your existing library has been kept.',
                'Operacja nie powiodła się. Twoja biblioteka została zachowana.',
              ),
        );
      }
    },
    [t],
  );
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await initializeLibrary(db, language);
        const currentPath = decodeURI(location.hash.slice(1));
        if (
          live &&
          ((currentPath.startsWith('folder/') &&
            !(await db.folders.get(currentPath.slice(7)))) ||
            (currentPath.startsWith('note/') &&
              !(await db.notes.get(currentPath.slice(5)))))
        )
          navigate('library');
        if (live) setReady(true);
      } catch (e) {
        if (live) {
          setError(
            t(
              `Could not open local storage: ${e instanceof Error ? e.message : 'unknown error'}. Check whether your browser allows storage for this site.`,
              `Nie można otworzyć pamięci lokalnej: ${e instanceof Error ? e.message : 'nieznany błąd'}. Sprawdź, czy przeglądarka pozwala tej stronie zapisywać dane.`,
            ),
          );
          setReady(true);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [language, navigate, t]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSidebar(true);
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setFocus(false);
        setSidebar(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const noteId = route.startsWith('note/') ? route.slice(5) : null;
  const note = notes.find((n) => n.id === noteId);
  const folderId = route.startsWith('folder/') ? route.slice(7) : null;
  const shareId = route.startsWith('share/') ? route.slice(6) : null;
  const pageName =
    shareId !== null
      ? t('Shared notes', 'Udostępnione notatki')
      : note
        ? note.title
        : route === 'generate'
          ? t('Generate notes', 'Generuj notatki')
          : route === 'showcase'
            ? t('Component guide', 'Komponenty')
            : route === 'settings'
              ? t('Settings', 'Ustawienia')
              : route === 'favorites'
                ? t('Favorites', 'Ulubione')
                : route === 'recent'
                  ? t('Recently opened', 'Ostatnio otwierane')
                  : folderId
                    ? (folders.find((f) => f.id === folderId)?.name ??
                      t('Folder', 'Folder'))
                    : t('All notes', 'Wszystkie notatki');
  async function openNote(id: string) {
    await run(async () => {
      await db.notes.update(id, { openedAt: Date.now() });
      navigate(`note/${id}`);
    });
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildGenerationPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        t(
          'Clipboard access is unavailable. Select and copy the prompt below.',
          'Schowek jest niedostępny. Zaznacz i skopiuj prompt poniżej.',
        ),
      );
    }
  }
  const countFavorites = notes.filter((n) => n.favorite).length;
  return (
    <div
      className={`app-shell ${focus ? 'focus-mode' : ''} ${sidebar ? 'sidebar-open' : ''}`}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        {t('Skip to content', 'Przejdź do treści')}
      </a>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label={t('Close navigation', 'Zamknij nawigację')}
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className="sidebar">
        <a
          className="brand"
          href="#library"
          onClick={(e) => {
            e.preventDefault();
            navigate('library');
          }}
        >
          <span className="brand-icon">
            <BookOpen size={23} strokeWidth={1.7} />
          </span>
          <span>
            Learn<span className="brand-md">MD</span>
            <small>
              {t('A LITTLE MORE UNDERSTANDING', 'ODROBINĘ WIĘCEJ ZROZUMIENIA')}
            </small>
          </span>
        </a>
        <button
          className="button primary add-note"
          onClick={() => setImporting(true)}
        >
          <Plus size={18} />
          {t('Add note', 'Dodaj notatkę')}
          <span>＋</span>
        </button>
        <div className="search-box">
          <Search size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (
                noteId ||
                shareId !== null ||
                ['generate', 'settings', 'showcase'].includes(route)
              ) {
                location.hash = 'library';
                setRoute('library');
              }
            }}
            placeholder={t('Search your notes', 'Szukaj w notatkach')}
            aria-label={t('Search notes', 'Szukaj notatek')}
          />
          <kbd>⌘ K</kbd>
        </div>
        <nav aria-label={t('Main navigation', 'Nawigacja główna')}>
          <button
            className={route === 'library' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('library')}
          >
            <Library size={18} />
            {t('All notes', 'Wszystkie notatki')}
            <span>{notes.length}</span>
          </button>
          <button
            className={route === 'recent' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('recent')}
          >
            <Clock3 size={18} />
            {t('Recently opened', 'Ostatnio otwierane')}
          </button>
          <button
            className={route === 'favorites' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('favorites')}
          >
            <Star size={18} />
            {t('Favorites', 'Ulubione')}
            {countFavorites > 0 && <span>{countFavorites}</span>}
          </button>
        </nav>
        <div className="sidebar-label">
          {t('YOUR FOLDERS', 'TWOJE FOLDERY')}
          <button
            className="icon-button"
            aria-label={t('Create folder', 'Utwórz folder')}
            onClick={() => setNewFolder(true)}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="folder-nav" aria-label={t('Folders', 'Foldery')}>
          {ready && folders.length === 0 && (
            <button
              className="folder-empty-action"
              onClick={() => setNewFolder(true)}
            >
              {t('Create your first folder', 'Utwórz pierwszy folder')}
            </button>
          )}
          {folders
            .filter((f) => f.parentId === null)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => (
              <FolderBranch
                key={f.id}
                folder={f}
                folders={folders}
                notes={notes}
                selected={folderId}
                onSelect={(id) => navigate(`folder/${id}`)}
                onManage={(id) => setManage({ type: 'folder', id })}
              />
            ))}
        </nav>
        <div className="sidebar-label resources-label">
          {t('WORKSPACE', 'PRZESTRZEŃ ROBOCZA')}
        </div>
        <nav aria-label={t('Resources', 'Narzędzia')}>
          <button
            className={route === 'generate' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('generate')}
          >
            <Sparkles size={18} />
            {t('Generate notes', 'Generuj notatki')}
            <ArrowRight size={14} />
          </button>
          <button
            className={route === 'showcase' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('showcase')}
          >
            <Grid2X2 size={18} />
            {t('Component guide', 'Komponenty')}
            <span className="tiny-pill">{PUBLIC_COMPONENTS.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-message">
            <span className="local-icon">
              <HardDrive size={17} />
            </span>
            <div>
              {t(
                'All notes are stored on this device.',
                'Wszystkie notatki są na tym urządzeniu.',
              )}
              {getSharingConfig().apiUrl && (
                <small>
                  {t(
                    'Sharing only when you choose.',
                    'Udostępniasz tylko, gdy chcesz.',
                  )}
                </small>
              )}
            </div>
            <span className="status-dot" />
          </div>
          <div className="sidebar-footer">
            <button
              className="text-button"
              onClick={() => navigate('settings')}
            >
              <Settings2 size={16} />
              {t('Settings', 'Ustawienia')}
            </button>
            <button
              className="icon-button"
              aria-label={
                theme === 'light'
                  ? t('Switch to dark theme', 'Włącz ciemny motyw')
                  : t('Switch to light theme', 'Włącz jasny motyw')
              }
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label={t('Open navigation', 'Otwórz nawigację')}
              onClick={() => setSidebar(true)}
            >
              <Menu size={19} />
            </button>
            {focus && (
              <button
                className="icon-button"
                aria-label={t('Exit focus mode', 'Wyłącz tryb skupienia')}
                onClick={() => setFocus(false)}
              >
                <PanelLeftClose size={18} />
              </button>
            )}
            <span className="breadcrumb-root">
              {t('Your workspace', 'Twoja przestrzeń')}
            </span>
            <ChevronRight size={13} />
            <span>{pageName}</span>
          </div>
          <div className="topbar-actions">
            {note && (
              <>
                <button
                  className={`icon-button ${note.favorite ? 'is-favorite' : ''}`}
                  aria-label={
                    note.favorite
                      ? t('Remove from favorites', 'Usuń z ulubionych')
                      : t('Add to favorites', 'Dodaj do ulubionych')
                  }
                  onClick={() =>
                    void run(() =>
                      db.notes.update(note.id, { favorite: !note.favorite }),
                    )
                  }
                >
                  <Star
                    size={17}
                    fill={note.favorite ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    focus
                      ? t('Exit focus mode', 'Wyłącz tryb skupienia')
                      : t('Enter focus mode', 'Włącz tryb skupienia')
                  }
                  onClick={() => setFocus(!focus)}
                >
                  {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={t(
                    'Toggle document outline',
                    'Pokaż lub ukryj spis treści',
                  )}
                  onClick={() => setOutline(!outline)}
                >
                  <List size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t('Share a copy', 'Udostępnij kopię')}
                  title={t('Share a copy', 'Udostępnij kopię')}
                  onClick={() => setSharing({ type: 'note', id: note.id })}
                >
                  <Share2 size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t('Manage note', 'Zarządzaj notatką')}
                  onClick={() => setManage({ type: 'note', id: note.id })}
                >
                  <MoreHorizontal size={20} />
                </button>
              </>
            )}
            <a
              className="icon-button"
              href="https://github.com/vende11s/LearnMD"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('LearnMD on GitHub', 'LearnMD na GitHubie')}
              title={t('LearnMD on GitHub', 'LearnMD na GitHubie')}
            >
              <Github size={18} aria-hidden="true" />
            </a>
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label={t('Dismiss error', 'Zamknij komunikat')}
              onClick={() => setError('')}
            >
              <X size={17} />
            </button>
          </div>
        )}
        <main className="workspace" id="main-content" ref={main} tabIndex={-1}>
          {!ready ? (
            <div className="loading">
              {t('Opening your library…', 'Otwieranie biblioteki…')}
            </div>
          ) : shareId !== null ? (
            <SharedPage
              key={shareId}
              shareId={shareId}
              folders={folders}
              allowRemote={remote}
              onNavigate={navigate}
            />
          ) : note ? (
            <ReaderView
              key={note.id}
              note={note}
              outline={outline && !focus}
              allowRemote={remote}
              mainRef={main}
              onError={setError}
              onShare={() => setSharing({ type: 'note', id: note.id })}
            />
          ) : noteId ? (
            <div className="empty-state">
              <BookOpen size={36} />
              <h1>
                {t(
                  'That note is no longer here.',
                  'Tej notatki już tutaj nie ma.',
                )}
              </h1>
              <button
                className="button primary"
                onClick={() => navigate('library')}
              >
                {t('Return to your library', 'Wróć do biblioteki')}
              </button>
            </div>
          ) : route === 'generate' ? (
            <div className="page generate-page">
              <div className="eyebrow">
                {t(
                  'FROM INFORMATION TO UNDERSTANDING',
                  'OD INFORMACJI DO ZROZUMIENIA',
                )}
              </div>
              <h1>
                {t('Better notes.', 'Lepsze notatki.')}
                <br />
                <em>{t('Deeper understanding.', 'Głębsze zrozumienie.')}</em>
              </h1>
              <p className="page-description">
                {t(
                  'Your materials, your favorite AI, a more thoughtful way to learn.',
                  'Twoje materiały, ulubione AI i nauka ze zrozumieniem.',
                )}
                <br />
                {t(
                  'Copy the prompt, or install the LearnMD skill in your AI agent.',
                  'Skopiuj prompt lub zainstaluj skill LearnMD w swoim agencie AI.',
                )}
              </p>
              <div className="generation-steps">
                <div>
                  <span>01</span>
                  <h3>{t('Copy the prompt', 'Skopiuj prompt')}</h3>
                  <p>
                    {t(
                      'It teaches your AI the LearnMD format and how to write genuinely useful notes.',
                      'Wyjaśnia AI format LearnMD i zasady tworzenia przydatnych notatek.',
                    )}
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <h3>{t('Bring your materials', 'Dodaj swoje materiały')}</h3>
                  <p>
                    {t(
                      'Paste it into ChatGPT, Claude, Gemini, or another LLM with your slides, PDFs, exercise sets, or notes — or simply describe the topic you want to learn.',
                      'Wklej go do ChatGPT, Claude, Gemini lub innego modelu wraz ze slajdami, PDF-ami, zestawami zadań lub notatkami — albo po prostu opisz temat, którego chcesz się nauczyć.',
                    )}
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <h3>{t('Make yourself at home', 'Rozgość się')}</h3>
                  <p>
                    {t(
                      'Import the generated .learn.md file, or paste its source directly into your library.',
                      'Zaimportuj wygenerowany plik .learn.md albo wklej jego treść bezpośrednio do biblioteki.',
                    )}
                  </p>
                </div>
              </div>
              <div className="prompt-panel">
                <div className="prompt-heading">
                  <div>
                    <Sparkles size={20} />
                    <div>
                      <h3>
                        {t(
                          'The LearnMD generation prompt',
                          'Prompt do generowania notatek LearnMD',
                        )}
                      </h3>
                      <p>
                        {t(
                          `Compact format guide · ${PUBLIC_COMPONENTS.length} components · concise notes`,
                          `Skrócony opis formatu · ${PUBLIC_COMPONENTS.length} elementów · zwięzłe notatki`,
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => void copyPrompt()}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                    {copied
                      ? t('Copied to clipboard', 'Skopiowano do schowka')
                      : t('Copy prompt', 'Kopiuj prompt')}
                  </button>
                </div>
                <details className="prompt-preview">
                  <summary>
                    {t('Read the complete prompt', 'Przeczytaj cały prompt')}
                    <ChevronDown size={16} />
                  </summary>
                  <pre tabIndex={0}>{buildGenerationPrompt()}</pre>
                </details>
              </div>
              <LearnMDSkillPanel />
              <div className="privacy-note">
                <ShieldCheck size={21} />
                <div>
                  <h3>
                    {t(
                      'Choose where your materials go.',
                      'Ty decydujesz, dokąd trafiają materiały.',
                    )}
                  </h3>
                  <p>
                    {t(
                      'LearnMD makes no AI calls. You decide which provider receives your materials. Imported notes stay in this browser.',
                      'LearnMD nie wysyła zapytań do AI. Ty wybierasz dostawcę, któremu udostępniasz materiały. Zaimportowane notatki pozostają w tej przeglądarce.',
                    )}
                  </p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => setImporting(true)}
              >
                {t(
                  'Already have your notes? Import them',
                  'Masz już notatki? Zaimportuj je',
                )}
                <ArrowRight size={16} />
              </button>
            </div>
          ) : route === 'showcase' ? (
            <Showcase />
          ) : route === 'settings' ? (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
              remote={remote}
              setRemote={setRemote}
              onError={setError}
              onToast={setToast}
              noteCount={notes.length}
            />
          ) : (
            <LibraryPage
              notes={notes}
              folders={folders}
              route={route}
              query={query}
              folderId={folderId}
              sort={sort}
              setSort={setSort}
              openNote={(id) => void openNote(id)}
              onImport={() => setImporting(true)}
              onManage={(id) => setManage({ type: 'note', id })}
              onDelete={(id) =>
                setManage({ type: 'note', id, confirmDelete: true })
              }
              onFavorite={(n) =>
                void run(() => db.notes.update(n.id, { favorite: !n.favorite }))
              }
              onGenerate={() => navigate('generate')}
              onFolder={(id) => navigate(`folder/${id}`)}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {importing && (
        <ImportDialog
          notes={notes}
          folders={folders}
          initialFolder={folderId}
          onClose={() => setImporting(false)}
          onGenerate={() => {
            setImporting(false);
            navigate('generate');
          }}
          onImported={(id) => {
            setImporting(false);
            navigate(`note/${id}`);
            setToast(
              t(
                'Your note is at home in the library.',
                'Notatka jest już w Twojej bibliotece.',
              ),
            );
          }}
        />
      )}
      {(manage || newFolder) && (
        <ManageDialog
          initialConfirm={manage?.confirmDelete}
          target={manage}
          newFolder={newFolder}
          folderId={folderId}
          notes={notes}
          folders={folders}
          onClose={() => {
            setManage(null);
            setNewFolder(false);
          }}
          onRemoved={() => navigate('library')}
          onError={setError}
          onShare={(target) => {
            setManage(null);
            setSharing(target);
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          key={`${sharing.type}/${sharing.id}`}
          target={sharing}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}

class AppBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error('LearnMD rendering error', e, info);
  }
  render() {
    return this.state.error ? (
      <FailureScreen error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}
function FailureScreen({ error }: { error: string }) {
  const { t } = useI18n();
  return (
    <div className="fatal-error">
      <BookOpen size={40} />
      <h1>
        {t(
          'Something interrupted the page.',
          'Coś przerwało wyświetlanie strony.',
        )}
      </h1>
      <p>
        {t(
          'Your stored library has not been deleted.',
          'Zapisana biblioteka nie została usunięta.',
        )}
      </p>
      <pre>{error}</pre>
      <button className="button primary" onClick={() => location.reload()}>
        {t('Reload LearnMD', 'Odśwież LearnMD')}
      </button>
      <button
        className="button secondary"
        onClick={() =>
          void exportLibrary().then((data) =>
            download(data, 'learnmd-recovery.json'),
          )
        }
      >
        {t('Export recovery backup', 'Eksportuj kopię ratunkową')}
      </button>
    </div>
  );
}
export default function App() {
  return (
    <I18nProvider>
      <AppBoundary>
        <AppInner />
      </AppBoundary>
    </I18nProvider>
  );
}
