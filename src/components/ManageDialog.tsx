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
import { useI18n } from '../i18n';
import { FolderIconPicker } from './FolderIcon';
import { normalizeFolderIcon } from '../folderIcons';

export function ManageDialog({
  target,
  newFolder,
  folderId,
  notes,
  folders,
  onClose,
  onRemoved,
  onError,
  initialConfirm = false,
}: {
  target: { type: 'note' | 'folder'; id: string } | null;
  newFolder: boolean;
  folderId: string | null;
  notes: Note[];
  folders: Folder[];
  onClose: () => void;
  onRemoved: () => void;
  onError: (s: string) => void;
  initialConfirm?: boolean;
}) {
  const { t } = useI18n();
  const isNote = target?.type === 'note';
  const note = notes.find((n) => n.id === target?.id);
  const folder = folders.find((f) => f.id === target?.id);
  const [name, setName] = useState(
    isNote ? (note?.title ?? '') : (folder?.name ?? ''),
  );
  const [parent, setParent] = useState(
    isNote
      ? (note?.folderId ?? '')
      : folder
        ? (folder.parentId ?? '')
        : (folderId ?? ''),
  );
  const [icon, setIcon] = useState(normalizeFolderIcon(folder?.icon));
  const [confirm, setConfirm] = useState(initialConfirm);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  async function save() {
    setBusy(true);
    try {
      if (!name.trim())
        throw new Error(t('Please enter a name.', 'Wpisz nazwę.'));
      if (newFolder)
        await db.folders.add({
          id: crypto.randomUUID(),
          name: name.trim(),
          parentId: parent || null,
          icon,
        });
      else if (isNote && target)
        await db.notes.update(target.id, {
          title: name.trim(),
          folderId: parent || null,
          updatedAt: Date.now(),
        });
      else if (target) {
        await moveFolder(target.id, parent || null);
        await db.folders.update(target.id, { name: name.trim(), icon });
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
          ? t('A place for connected ideas', 'Miejsce na powiązane pomysły')
          : isNote
            ? t('Manage your note', 'Zarządzaj notatką')
            : t('Manage your folder', 'Zarządzaj folderem')
      }
      onClose={onClose}
    >
      <label className="field-label">
        {isNote
          ? t('Display title', 'Tytuł w bibliotece')
          : t('Folder name', 'Nazwa folderu')}
        <input
          autoFocus={!initialConfirm}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {!isNote && (
        <FolderIconPicker value={icon} onChange={setIcon} disabled={busy} />
      )}
      <label className="field-label">
        {isNote
          ? t('In folder', 'W folderze')
          : t('Parent folder', 'Folder nadrzędny')}
        <select value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">
            {t('All notes / root', 'Wszystkie notatki / katalog główny')}
          </option>
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
          {t(
            'This changes the library label. The imported source remains read-only.',
            'Zmienia to nazwę w bibliotece. Zaimportowana treść pozostaje tylko do odczytu.',
          )}
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
              {isNote
                ? t('Delete note', 'Usuń notatkę')
                : t('Delete folder', 'Usuń folder')}
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
              {t('Export source', 'Eksportuj źródło')}
            </button>
          )}
          <button
            className="button primary"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            {t('Save changes', 'Zapisz zmiany')}
          </button>
        </div>
      </div>
      {isNote && (
        <p className="fineprint">
          {t(
            'Source export excludes bundled images. Use Settings → Export library to preserve all assets.',
            'Eksport źródła nie zawiera dołączonych obrazów. Aby zachować wszystkie pliki, wybierz Ustawienia → Eksportuj bibliotekę.',
          )}
        </p>
      )}
      {confirm && (
        <div className="delete-confirm">
          <h3>
            {isNote
              ? t('Delete this local copy?', 'Usunąć tę lokalną kopię?')
              : t('Delete this folder?', 'Usunąć ten folder?')}
          </h3>
          <p className="delete-target">{isNote ? note?.title : folder?.name}</p>
          <p>
            {isNote
              ? t(
                  'This removes the note and its bundled images from this browser. The original file is unchanged.',
                  'Usuwa to notatkę i dołączone obrazy z przeglądarki. Plik źródłowy pozostaje bez zmian.',
                )
              : t(
                  'Notes and subfolders will move into the parent folder. No notes will be deleted.',
                  'Notatki i podfoldery zostaną przeniesione do folderu nadrzędnego. Żadna notatka nie zostanie usunięta.',
                )}
          </p>
          <button
            className="button danger-button"
            autoFocus={initialConfirm}
            disabled={busy}
            onClick={() => void remove()}
          >
            {t('Confirm delete', 'Potwierdź usunięcie')}
          </button>
          <button className="text-button" onClick={() => setConfirm(false)}>
            {t('Keep it', 'Zachowaj')}
          </button>
        </div>
      )}
    </Modal>
  );
}
