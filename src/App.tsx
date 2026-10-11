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
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Moon,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { db, importNote, exportLibrary, download } from './storage';
import { SAMPLES } from './content/samples';
import { buildGenerationPrompt } from './format/prompt';
import { ImportDialog } from './components/ImportDialog';
import { ManageDialog } from './components/ManageDialog';
import { FolderBranch } from './components/FolderBranch';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderView } from './pages/ReaderView';
import { Showcase } from './pages/Showcase';
import { SettingsPage } from './pages/SettingsPage';
import { useStored } from './hooks/useStored';
type Detail = 'concise' | 'standard' | 'detailed';

function AppInner() {
  const [route, setRoute] = useState(
    () => decodeURI(location.hash.slice(1)) || 'library',
  );
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useStored<'light' | 'dark'>(
    'learnmd-theme',
    'light',
  );
  const [detail, setDetail] = useStored<Detail>('learnmd-detail', 'standard');
  const [sort, setSort] = useStored('learnmd-sort', 'recent');
  const [remote, setRemote] = useStored('learnmd-remote', false);
  const [sidebar, setSidebar] = useState(false);
  const [focus, setFocus] = useState(false);
  const [outline, setOutline] = useState(true);
  const [importing, setImporting] = useState(false);
  const [manage, setManage] = useState<{
    type: 'note' | 'folder';
    id: string;
  } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
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
  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The operation failed. Your existing library has been kept.',
      );
    }
  }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await db.transaction(
          'rw',
          db.notes,
          db.folders,
          db.assets,
          db.settings,
          async () => {
            if (await db.settings.get('initialized')) return;
            const subjects = [
              'Mathematics',
              'Computer science',
              'Natural sciences',
              'Humanities',
            ];
            await db.folders.bulkPut(
              subjects.map((name, i) => ({
                id: `sample-folder-${i}`,
                name,
                parentId: null,
              })),
            );
            for (let i = 0; i < SAMPLES.length; i++) {
              const sample = SAMPLES[i];
              await importNote(
                sample.source,
                `sample-folder-${i < 2 ? 0 : i < 4 ? 1 : i === 4 ? 2 : 3}`,
                { sample: true, id: sample.id },
              );
            }
            await db.settings.put({ key: 'initialized', value: 'true' });
          },
        );
        if (live) setReady(true);
      } catch (e) {
        if (live) {
          setError(
            `Could not open local storage: ${e instanceof Error ? e.message : 'unknown error'}. Check whether your browser allows storage for this site.`,
          );
          setReady(true);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
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
  const pageName = note
    ? note.title
    : route === 'generate'
      ? 'Generate notes'
      : route === 'showcase'
        ? 'Component guide'
        : route === 'settings'
          ? 'Settings'
          : route === 'favorites'
            ? 'Favorites'
            : route === 'recent'
              ? 'Recently opened'
              : folderId
                ? (folders.find((f) => f.id === folderId)?.name ?? 'Folder')
                : 'All notes';
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
        'Clipboard access is unavailable. Select and copy the prompt below.',
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
        Skip to content
      </a>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
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
            <small>A LITTLE MORE UNDERSTANDING</small>
          </span>
        </a>
        <button
          className="button primary add-note"
          onClick={() => setImporting(true)}
        >
          <Plus size={18} /> Add note <span>＋</span>
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
                ['generate', 'settings', 'showcase'].includes(route)
              ) {
                location.hash = 'library';
                setRoute('library');
              }
            }}
            placeholder="Search your notes"
            aria-label="Search notes"
          />
          <kbd>⌘ K</kbd>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={route === 'library' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('library')}
          >
            <Library size={18} />
            All notes<span>{notes.length}</span>
          </button>
          <button
            className={route === 'recent' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('recent')}
          >
            <Clock3 size={18} />
            Recently opened
          </button>
          <button
            className={route === 'favorites' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('favorites')}
          >
            <Star size={18} />
            Favorites{countFavorites > 0 && <span>{countFavorites}</span>}
          </button>
        </nav>
        <div className="sidebar-label">
          YOUR FOLDERS
          <button
            className="icon-button"
            aria-label="Create folder"
            onClick={() => setNewFolder(true)}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="folder-nav" aria-label="Folders">
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
        <div className="sidebar-label resources-label">WORKSPACE</div>
        <nav aria-label="Resources">
          <button
            className={route === 'generate' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('generate')}
          >
            <Sparkles size={18} />
            Generate notes
            <ArrowRight size={14} />
          </button>
          <button
            className={route === 'showcase' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('showcase')}
          >
            <Grid2X2 size={18} />
            Component guide<span className="tiny-pill">65</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-message">
            <span className="local-icon">
              <HardDrive size={17} />
            </span>
            <div>
              Yours. On this device.
              <small>No account. Just your curiosity.</small>
            </div>
            <span className="status-dot" />
          </div>
          <div className="sidebar-footer">
            <button
              className="text-button"
              onClick={() => navigate('settings')}
            >
              <Settings2 size={16} /> Settings
            </button>
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
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
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={19} />
            </button>
            {focus && (
              <button
                className="icon-button"
                aria-label="Exit focus mode"
                onClick={() => setFocus(false)}
              >
                <PanelLeftClose size={18} />
              </button>
            )}
            <span className="breadcrumb-root">Your workspace</span>
            <ChevronRight size={13} />
            <span>{pageName}</span>
          </div>
          <div className="topbar-actions">
            {note ? (
              <>
                <button
                  className={`icon-button ${note.favorite ? 'is-favorite' : ''}`}
                  aria-label={
                    note.favorite ? 'Remove from favorites' : 'Add to favorites'
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
                  aria-label={focus ? 'Exit focus mode' : 'Enter focus mode'}
                  onClick={() => setFocus(!focus)}
                >
                  {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Toggle document outline"
                  onClick={() => setOutline(!outline)}
                >
                  <List size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Manage note"
                  onClick={() => setManage({ type: 'note', id: note.id })}
                >
                  <MoreHorizontal size={20} />
                </button>
              </>
            ) : (
              <span className="local-badge">
                <ShieldCheck size={14} /> LOCAL WORKSPACE
              </span>
            )}
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              <X size={17} />
            </button>
          </div>
        )}
        <main className="workspace" id="main-content" ref={main} tabIndex={-1}>
          {!ready ? (
            <div className="loading">Opening your library…</div>
          ) : note ? (
            <ReaderView
              key={note.id}
              note={note}
              detail={detail}
              setDetail={setDetail}
              outline={outline && !focus}
              allowRemote={remote}
              mainRef={main}
              onError={setError}
            />
          ) : noteId ? (
            <div className="empty-state">
              <BookOpen size={36} />
              <h1>That note is no longer here.</h1>
              <button
                className="button primary"
                onClick={() => navigate('library')}
              >
                Return to your library
              </button>
            </div>
          ) : route === 'generate' ? (
            <div className="page generate-page">
              <div className="eyebrow">FROM INFORMATION TO UNDERSTANDING</div>
              <h1>
                Better notes.
                <br />
                <em>Deeper understanding.</em>
              </h1>
              <p className="page-description">
                Your materials, your favorite AI, a more thoughtful way to
                learn.
                <br />
                One prompt is all you need to get started.
              </p>
              <div className="generation-steps">
                <div>
                  <span>01</span>
                  <h3>Copy the prompt</h3>
                  <p>
                    It teaches your AI the LearnMD format and how to write
                    genuinely useful notes.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <h3>Bring your materials</h3>
                  <p>
                    Paste it into ChatGPT, Claude, or any LLM with your slides,
                    chapters, or source notes.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <h3>Make yourself at home</h3>
                  <p>
                    Import the generated .learn.md file, or paste its source
                    directly into your library.
                  </p>
                </div>
              </div>
              <div className="prompt-panel">
                <div className="prompt-heading">
                  <div>
                    <Sparkles size={20} />
                    <div>
                      <h3>The LearnMD generation prompt</h3>
                      <p>
                        Complete format reference · 65 components · teaching
                        guidance
                      </p>
                    </div>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => void copyPrompt()}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                    {copied ? 'Copied to clipboard' : 'Copy prompt'}
                  </button>
                </div>
                <details className="prompt-preview">
                  <summary>
                    Read the complete prompt <ChevronDown size={16} />
                  </summary>
                  <pre tabIndex={0}>{buildGenerationPrompt()}</pre>
                </details>
              </div>
              <div className="privacy-note">
                <ShieldCheck size={21} />
                <div>
                  <h3>Choose where your materials go.</h3>
                  <p>
                    LearnMD makes no AI calls. You decide which provider
                    receives your materials. Imported notes stay in this
                    browser.
                  </p>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => setImporting(true)}
              >
                Already have your notes? Import them <ArrowRight size={16} />
              </button>
            </div>
          ) : route === 'showcase' ? (
            <Showcase detail={detail} setDetail={setDetail} />
          ) : route === 'settings' ? (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
              remote={remote}
              setRemote={setRemote}
              detail={detail}
              setDetail={setDetail}
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
          onImported={(id) => {
            setImporting(false);
            navigate(`note/${id}`);
            setToast('Your note is at home in the library.');
          }}
        />
      )}
      {(manage || newFolder) && (
        <ManageDialog
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
      <div className="fatal-error">
        <BookOpen size={40} />
        <h1>Something interrupted the page.</h1>
        <p>Your stored library has not been deleted.</p>
        <pre>{this.state.error}</pre>
        <button className="button primary" onClick={() => location.reload()}>
          Reload LearnMD
        </button>
        <button
          className="button secondary"
          onClick={() =>
            void exportLibrary().then((data) =>
              download(data, 'learnmd-recovery.json'),
            )
          }
        >
          Export recovery backup
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <AppBoundary>
      <AppInner />
    </AppBoundary>
  );
}
