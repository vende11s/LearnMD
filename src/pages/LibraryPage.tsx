import {
  ArrowRight,
  BookOpen,
  Plus,
  Folder as FolderIcon,
  ChevronRight,
  SlidersHorizontal,
  Grid2X2,
  List,
  Star,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import type { Note, Folder } from '../storage';
import { useStored } from '../hooks/useStored';

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
  onFavorite: (n: Note) => void;
  onGenerate: () => void;
  onFolder: (id: string) => void;
}) {
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
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SPACE FOR CURIOUS MINDS</div>
          <h1>
            {query
              ? 'Find a little clarity.'
              : folderId
                ? folders.find((f) => f.id === folderId)?.name
                : route === 'favorites'
                  ? 'Keep the good ideas close.'
                  : route === 'recent'
                    ? 'Pick up where you left off.'
                    : 'Your library of understanding.'}
          </h1>
          <p className="page-description">
            {query
              ? `Notes matching “${query}”`
              : home
                ? 'Big ideas, made a little clearer. Settle in and explore.'
                : `${visible.length} ${visible.length === 1 ? 'note' : 'notes'} to come back to.`}
          </p>
        </div>
        <button className="button secondary desktop-add" onClick={onImport}>
          <Plus size={16} /> Add note
        </button>
      </div>
      {home && featured && (
        <section className="featured-note">
          <div className="featured-copy">
            <span className="eyebrow">
              <span className="status-dot" /> A GOOD PLACE TO BEGIN
            </span>
            <h2>{featured.title}</h2>
            <p>
              {featured.description ||
                'Explore an idea, follow the reasoning, and make the connections that matter.'}
            </p>
            <button
              className="button primary"
              onClick={() => openNote(featured.id)}
            >
              Open the notes <ArrowRight size={16} />
            </button>
            <span className="featured-meta">
              {featured.subject} <span>·</span>{' '}
              {Math.max(
                1,
                Math.ceil(featured.source.split(/\s+/).length / 220),
              )}{' '}
              min read <span>·</span> Interactive notes
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
                a new way to see change
              </text>
            </svg>
            <span className="art-caption">
              SMALL STEPS. BEAUTIFUL CONNECTIONS.
            </span>
          </div>
        </section>
      )}
      {folderId && folders.some((f) => f.parentId === folderId) && (
        <div className="subfolders">
          {folders
            .filter((f) => f.parentId === folderId)
            .map((f) => (
              <button
                className="button secondary"
                key={f.id}
                onClick={() => onFolder(f.id)}
              >
                <FolderIcon size={17} />
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
              ? 'Search results'
              : route === 'favorites'
                ? 'Favorite notes'
                : route === 'recent'
                  ? 'Recent notes'
                  : 'All notes'}
            <span>{visible.length}</span>
          </span>
        </div>
        <div className="library-controls">
          <SlidersHorizontal size={14} />
          <select
            aria-label="Sort notes"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently opened</option>
            <option value="created">Date added</option>
            <option value="title">Title, A–Z</option>
          </select>
          <span className="toolbar-divider" />
          <button
            className={`icon-button ${view === 'grid' ? 'selected' : ''}`}
            aria-label="Grid view"
            onClick={() => setView('grid')}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            className={`icon-button ${view === 'list' ? 'selected' : ''}`}
            aria-label="List view"
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
                    aria-label={`${n.favorite ? 'Unfavorite' : 'Favorite'} ${n.title}`}
                    onClick={() => onFavorite(n)}
                  >
                    <Star
                      size={15}
                      fill={n.favorite ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Manage ${n.title}`}
                    onClick={() => onManage(n.id)}
                  >
                    <MoreHorizontal size={18} />
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
                  <FolderIcon size={13} />
                  {folders.find((f) => f.id === n.folderId)?.name ??
                    'Personal notes'}
                </span>
                <span>
                  {Math.max(1, Math.ceil(n.source.split(/\s+/).length / 220))}{' '}
                  min read
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={38} />
          <h2>{query ? 'No notes found.' : 'Room for a new idea.'}</h2>
          <p>
            {query
              ? 'Try a different word or phrase.'
              : 'Bring a .learn.md document into your library to get started.'}
          </p>
          <button className="button primary" onClick={onImport}>
            <Plus size={16} />
            Add a note
          </button>
        </div>
      )}
      {home && (
        <footer className="library-tip">
          <span className="tip-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <strong>Turn your materials into something that clicks.</strong>
            <p>Get a ready-to-use prompt for thoughtful, interactive notes.</p>
          </div>
          <button className="text-button" onClick={onGenerate}>
            Generate notes <ArrowRight size={15} />
          </button>
        </footer>
      )}
      <div className="page-footnote">
        <span className="status-dot" /> Stored on this device. A quiet place to
        think.
      </div>
    </div>
  );
}
