import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import {
  db,
  download,
  deleteNote,
  deleteFolder,
  moveFolder,
  type Note,
  type Folder,
} from '../storage';
import { Modal } from './Modal';
import { folderLabel } from './ImportDialog';

export function ManageDialog({
  target,
  newFolder,
  folderId,
  notes,
  folders,
  onClose,
  onRemoved,
  onError,
}: {
  target: { type: 'note' | 'folder'; id: string } | null;
  newFolder: boolean;
  folderId: string | null;
  notes: Note[];
  folders: Folder[];
  onClose: () => void;
  onRemoved: () => void;
  onError: (s: string) => void;
}) {
  const isNote = target?.type === 'note';
  const note = notes.find((n) => n.id === target?.id);
  const folder = folders.find((f) => f.id === target?.id);
  const [name, setName] = useState(
    isNote ? (note?.title ?? '') : (folder?.name ?? ''),
  );
  const [parent, setParent] = useState(
    isNote ? (note?.folderId ?? '') : (folder?.parentId ?? folderId ?? ''),
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  async function save() {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error('Please enter a name.');
      if (newFolder)
        await db.folders.add({
          id: crypto.randomUUID(),
          name: name.trim(),
          parentId: parent || null,
        });
      else if (isNote && target)
        await db.notes.update(target.id, {
          title: name.trim(),
          folderId: parent || null,
          updatedAt: Date.now(),
        });
      else if (target) {
        await moveFolder(target.id, parent || null);
        await db.folders.update(target.id, { name: name.trim() });
      }
      onClose();
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      if (!target) return;
      if (isNote) await deleteNote(target.id);
      else await deleteFolder(target.id);
      onClose();
      onRemoved();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        newFolder
          ? 'A place for connected ideas'
          : isNote
            ? 'Manage your note'
            : 'Manage your folder'
      }
      onClose={onClose}
    >
      <label className="field-label">
        {isNote ? 'Display title' : 'Folder name'}
        <input
          autoFocus
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field-label">
        {isNote ? 'In folder' : 'Parent folder'}
        <select value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">All notes / root</option>
          {folders
            .filter((f) => newFolder || isNote || f.id !== target?.id)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {folderLabel(f, folders)}
              </option>
            ))}
        </select>
      </label>
      {isNote && (
        <p className="fineprint">
          This changes the library label. The imported source remains read-only.
        </p>
      )}
      {localError && (
        <p className="error-banner" role="alert">
          {localError}
        </p>
      )}
      <div className="modal-footer">
        <div>
          {!newFolder && (
            <button
              className="text-button danger"
              onClick={() => setConfirm(true)}
            >
              Delete {isNote ? 'note' : 'folder'}
            </button>
          )}
        </div>
        <div className="button-row">
          {isNote && note && (
            <button
              className="button secondary"
              onClick={() =>
                download(
                  note.source,
                  `${note.title.replace(/[<>:"/\\|?*]/g, '-')}.learn.md`,
                )
              }
            >
              <ArrowDownToLine size={15} />
              Export source
            </button>
          )}
          <button
            className="button primary"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            Save changes
          </button>
        </div>
      </div>
      {isNote && (
        <p className="fineprint">
          Source export excludes bundled images. Use Settings → Export library
          to preserve all assets.
        </p>
      )}
      {confirm && (
        <div className="delete-confirm">
          <h3>Delete this {isNote ? 'local copy' : 'folder'}?</h3>
          <p>
            {isNote
              ? 'This removes the note and its bundled images from this browser. The original file is unchanged.'
              : 'Notes and subfolders will move into the parent folder. No notes will be deleted.'}
          </p>
          <button
            className="button danger-button"
            disabled={busy}
            onClick={() => void remove()}
          >
            Confirm delete
          </button>
          <button className="text-button" onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </div>
      )}
    </Modal>
  );
}
