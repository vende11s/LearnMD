import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { Note, Folder } from '../storage';
import { useI18n } from '../i18n';
import { FolderGlyph } from './FolderIcon';

export function FolderBranch({
  folder,
  folders,
  notes,
  selected,
  onSelect,
  onManage,
  depth = 0,
}: {
  folder: Folder;
  folders: Folder[];
  notes: Note[];
  selected: string | null;
  onSelect: (id: string) => void;
  onManage: (id: string) => void;
  depth?: number;
}) {
  const { t } = useI18n();
  const displayName = folder.name;
  const [expanded, setExpanded] = useState(true);
  const children = folders.filter((f) => f.parentId === folder.id);
  if (depth > 24) return null;
  return (
    <div>
      <div
        className={`folder-row ${selected === folder.id ? 'active' : ''}`}
        style={{ paddingLeft: 10 + depth * 13 }}
      >
        {children.length > 0 ? (
          <button
            className="folder-chevron"
            aria-label={
              expanded
                ? t(`Collapse ${displayName}`, `Zwiń ${displayName}`)
                : t(`Expand ${displayName}`, `Rozwiń ${displayName}`)
            }
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="folder-spacer" />
        )}
        <button className="folder-link" onClick={() => onSelect(folder.id)}>
          <FolderGlyph icon={folder.icon} size={17} />
          <span>{displayName}</span>
          <small>{notes.filter((n) => n.folderId === folder.id).length}</small>
        </button>
        <button
          className="folder-more"
          aria-label={t(
            `Manage folder ${displayName}`,
            `Zarządzaj folderem ${displayName}`,
          )}
          onClick={() => onManage(folder.id)}
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
      {expanded &&
        children.map((f) => (
          <FolderBranch
            key={f.id}
            folder={f}
            folders={folders}
            notes={notes}
            selected={selected}
            onSelect={onSelect}
            onManage={onManage}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
