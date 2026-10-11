import {
  ArrowRight,
  BookOpen,
  Plus,
  ChevronRight,
  SlidersHorizontal,
  Grid2X2,
  List,
  Star,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Note, Folder } from '../storage';
import { useStored } from '../hooks/useStored';
import { useI18n } from '../i18n';
import { FolderGlyph } from '../components/FolderIcon';

export function LibraryPage({
  notes,
  folders,
  route,
  query,
  folderId,
  sort,
  setSort,
  openNote,
  onImport,
  onManage,
  onDelete,
  onFavorite,
  onGenerate,
  onFolder,
}: {
  notes: Note[];
  folders: Folder[];
  route: string;
  query: string;
  folderId: string | null;
  sort: string;
  setSort: (s: string) => void;
  openNote: (id: string) => void;
  onImport: () => void;
  onManage: (id: string) => void;
  onDelete: (id: string) => void;
  onFavorite: (n: Note) => void;
  onGenerate: () => void;
  onFolder: (id: string) => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useStored<'grid' | 'list'>('learnmd-view', 'grid');
  const visible = notes
    .filter(
      (n) =>
        (!folderId || n.folderId === folderId) &&
        (route !== 'favorites' || n.favorite) &&
        (route !== 'recent' || n.openedAt > 0) &&
        (!query ||
          `${n.title} ${n.source}`.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'created'
          ? b.createdAt - a.createdAt
          : b.openedAt - a.openedAt,
    );
  const featured =
    notes.find((n) => n.id === 'calculus') ??
    notes.find((n) => n.subject.toLowerCase().includes('calculus')) ??
    notes[0];
  const home = route === 'library' && !query;
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const childFolders = folders.filter((folder) => folder.parentId === folderId);
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t('A SPACE FOR CURIOUS MINDS', 'PRZESTRZEŃ DLA CIEKAWYCH ŚWIATA')}
          </div>
          <h1>
            {query
              ? t('Find a little clarity.', 'Znajdź to, co rozjaśnia myśli.')
              : folderId
                ? (folderById.get(folderId)?.name ?? '')
                : route === 'favorites'
                  ? t(
                      'Keep the good ideas close.',
                      'Dobre pomysły zawsze pod ręką.',
                    )
                  : route === 'recent'
                    ? t(
                        'Pick up where you left off.',
                        'Wróć tam, gdzie skończyłeś.',
                      )
                    : t(
                        'Your library of understanding.',
                        'Twoja biblioteka zrozumienia.',
                      )}
          </h1>
          <p className="page-description">
            {query
              ? t(`Notes matching “${query}”`, `Notatki pasujące do „${query}”`)
              : home
                ? t(
                    'Big ideas, made a little clearer. Settle in and explore.',
                    'Wielkie idee, nieco jaśniejsze. Rozgość się i odkrywaj.',
                  )
                : t(
                    `${visible.length} ${visible.length === 1 ? 'note' : 'notes'} to come back to.`,
                    `Notatki, do których możesz wrócić: ${visible.length}.`,
                  )}
          </p>
        </div>
        <button className="button secondary desktop-add" onClick={onImport}>
          <Plus size={16} />
          {t('Add note', 'Dodaj notatkę')}
        </button>
      </div>
      {home && featured && (
        <section className="featured-note">
          <div className="featured-copy">
            <span className="eyebrow">
              <span className="status-dot" />
              {t('A GOOD PLACE TO BEGIN', 'DOBRE MIEJSCE NA POCZĄTEK')}
            </span>
            <h2>{featured.title}</h2>
            <p>
              {featured.description ||
                t(
                  'Explore an idea, follow the reasoning, and make the connections that matter.',
                  'Poznaj ideę, prześledź rozumowanie i dostrzeż ważne powiązania.',
                )}
            </p>
            <button
              className="button primary"
              onClick={() => openNote(featured.id)}
            >
              {t('Open the notes', 'Otwórz notatkę')}
              <ArrowRight size={16} />
            </button>
            <span className="featured-meta">
              {featured.subject} <span>·</span>{' '}
              {Math.max(
                1,
                Math.ceil(featured.source.split(/\s+/).length / 220),
              )}{' '}
              {t('min read', 'min czytania')}
              <span>·</span>
              {t('Interactive notes', 'Interaktywne notatki')}
            </span>
          </div>
          <div className="calculus-art" aria-hidden="true">
            <svg viewBox="0 0 360 230">
              <defs>
                <pattern
                  id="dot-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="1"
                    cy="1"
                    r="1"
                    fill="currentColor"
                    opacity=".14"
                  />
                </pattern>
              </defs>
              <rect width="360" height="230" fill="url(#dot-grid)" />
              <path d="M28 180H327 M65 205V28" className="axis" />
              <path
                d="M50 179 C105 180 140 165 180 132 S250 74 302 29"
                className="curve"
              />
              <path d="M107 192L285 43" className="tangent" />
              <path d="M188 179V125H65" className="guideline" />
              <circle cx="188" cy="125" r="6" className="point" />
              <text x="285" y="115" className="math-label">
                f′(x)
              </text>
              <text x="316" y="201" className="axis-label">
                x
              </text>
              <text x="42" y="32" className="axis-label">
                y
              </text>
              <text x="102" y="56" className="small-math">
                {t('a new way to see change', 'nowe spojrzenie na zmianę')}
              </text>
            </svg>
            <span className="art-caption">
              {t(
                'SMALL STEPS. BEAUTIFUL CONNECTIONS.',
                'MAŁE KROKI. WAŻNE POWIĄZANIA.',
              )}
            </span>
          </div>
        </section>
      )}
      {!query && (folderId || home) && childFolders.length > 0 && (
        <div className="subfolders">
          {childFolders.map((f) => (
            <button
              className="button secondary"
              key={f.id}
              onClick={() => onFolder(f.id)}
            >
              <FolderGlyph icon={f.icon} size={17} />
              {f.name}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
      <div className="library-toolbar">
        <div className="library-tabs">
          <span className="selected">
            {query
              ? t('Search results', 'Wyniki wyszukiwania')
              : route === 'favorites'
                ? t('Favorite notes', 'Ulubione notatki')
                : route === 'recent'
                  ? t('Recent notes', 'Ostatnie notatki')
                  : t('All notes', 'Wszystkie notatki')}
            <span>{visible.length}</span>
          </span>
        </div>
        <div className="library-controls">
          <SlidersHorizontal size={14} />
          <select
            aria-label={t('Sort notes', 'Sortuj notatki')}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">
              {t('Recently opened', 'Ostatnio otwierane')}
            </option>
            <option value="created">{t('Date added', 'Data dodania')}</option>
            <option value="title">{t('Title, A–Z', 'Tytuł, A–Z')}</option>
          </select>
          <span className="toolbar-divider" />
          <button
            className={`icon-button ${view === 'grid' ? 'selected' : ''}`}
            aria-label={t('Grid view', 'Widok siatki')}
            onClick={() => setView('grid')}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            className={`icon-button ${view === 'list' ? 'selected' : ''}`}
            aria-label={t('List view', 'Widok listy')}
            onClick={() => setView('list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {visible.length ? (
        <div className={`notes-${view}`}>
          {visible.map((n, i) => (
            <article className="note-card" key={n.id}>
              <div className="note-card-top">
                <span className={`note-symbol subject-${i % 6}`}>
                  <BookOpen size={20} strokeWidth={1.5} />
                </span>
                <div>
                  <button
                    className={`icon-button ${n.favorite ? 'is-favorite' : ''}`}
                    aria-label={
                      n.favorite
                        ? t(
                            `Unfavorite ${n.title}`,
                            `Usuń z ulubionych: ${n.title}`,
                          )
                        : t(
                            `Favorite ${n.title}`,
                            `Dodaj do ulubionych: ${n.title}`,
                          )
                    }
                    onClick={() => onFavorite(n)}
                  >
                    <Star
                      size={15}
                      fill={n.favorite ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t(`Manage ${n.title}`, `Zarządzaj: ${n.title}`)}
                    onClick={() => onManage(n.id)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <button
                    className="icon-button note-trash"
                    aria-label={t(`Delete ${n.title}`, `Usuń ${n.title}`)}
                    title={t('Delete note', 'Usuń notatkę')}
                    onClick={() => onDelete(n.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <button className="note-open" onClick={() => openNote(n.id)}>
                <span className="note-subject">{n.subject}</span>
                <h3>{n.title}</h3>
                <p>
                  {n.description ||
                    n.source.replace(/[#*`]/g, '').slice(0, 130)}
                </p>
              </button>
              <div className="note-card-footer">
                <span>
                  <FolderGlyph
                    icon={folderById.get(n.folderId ?? '')?.icon}
                    size={13}
                  />
                  {folderById.get(n.folderId ?? '')?.name ??
                    t('No folder', 'Bez folderu')}
                </span>
                <span>
                  {Math.max(1, Math.ceil(n.source.split(/\s+/).length / 220))}{' '}
                  {t('min read', 'min czytania')}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={38} />
          <h2>
            {query
              ? t('No notes found.', 'Nie znaleziono notatek.')
              : t('Room for a new idea.', 'Miejsce na nowy pomysł.')}
          </h2>
          <p>
            {query
              ? t(
                  'Try a different word or phrase.',
                  'Spróbuj innego słowa lub wyrażenia.',
                )
              : t(
                  'Bring a .learn.md document into your library to get started.',
                  'Na początek dodaj dokument .learn.md do biblioteki.',
                )}
          </p>
          <button className="button primary" onClick={onImport}>
            <Plus size={16} />
            {t('Add a note', 'Dodaj notatkę')}
          </button>
        </div>
      )}
      {home && (
        <footer className="library-tip">
          <span className="tip-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <strong>
              {t(
                'Turn your materials into something that clicks.',
                'Zamień swoje materiały w coś, co łatwo zrozumieć.',
              )}
            </strong>
            <p>
              {t(
                'Get a ready-to-use prompt for thoughtful, interactive notes.',
                'Skorzystaj z gotowego promptu do tworzenia przemyślanych, interaktywnych notatek.',
              )}
            </p>
          </div>
          <button className="text-button" onClick={onGenerate}>
            {t('Generate notes', 'Generuj notatki')}
            <ArrowRight size={15} />
          </button>
        </footer>
      )}
      <div className="page-footnote">
        <span className="status-dot" />
        {t(
          'Stored on this device. A quiet place to think.',
          'Zapisane na tym urządzeniu. Spokojne miejsce do myślenia.',
        )}
      </div>
    </div>
  );
}
