import Dexie, { type Table } from 'dexie';
import { parseLearnMD, extractLearnMDSource } from './format/parser';

export interface Note {
  id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  source: string;
  folderId: string | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
  position: number;
  sample: boolean;
}
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}
export interface Asset {
  id: string;
  noteId: string;
  path: string;
  blob: Blob;
}
export class LibraryDB extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  assets!: Table<Asset, string>;
  settings!: Table<{ key: string; value: string }, string>;
  constructor(name = 'learnmd-library') {
    super(name);
    this.version(1).stores({
      notes: 'id,folderId,favorite,openedAt,updatedAt',
      folders: 'id,parentId',
      assets: 'id,noteId',
      settings: 'key',
    });
  }
}
export const db = new LibraryDB();
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export function normalizeAssetPath(path: string) {
  const parts = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p !== '.' && p !== '');
  if (
    parts.some((p) => p === '..') ||
    path.startsWith('/') ||
    /^[a-z]+:/i.test(path)
  )
    throw new Error('Asset paths must be relative and cannot contain ..');
  return parts.join('/');
}
export function safeAsset(file: File) {
  return (
    /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name) &&
    (!file.type || /^image\/(png|jpeg|gif|webp|avif)$/.test(file.type)) &&
    file.size <= MAX_ASSET_BYTES
  );
}
export const extractSource = extractLearnMDSource;
export async function importNote(
  source: string,
  folderId: string | null,
  options: {
    replaceId?: string;
    assets?: { path: string; blob: Blob }[];
    sample?: boolean;
    id?: string;
  } = {},
  database = db,
): Promise<Note> {
  const clean = extractSource(source);
  if (new Blob([clean]).size > MAX_FILE_BYTES)
    throw new Error(
      'This note exceeds the 2 MB limit. Split it into chapters.',
    );
  const parsed = parseLearnMD(clean);
  const errors = parsed.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length)
    throw new Error(
      errors
        .map((d) => `${d.line ? `Line ${d.line}: ` : ''}${d.message}`)
        .join('\n'),
    );
  if (!clean) throw new Error('Paste or select a document first.');
  const now = Date.now();
  return database.transaction(
    'rw',
    database.notes,
    database.assets,
    database.folders,
    async () => {
      if (folderId && !(await database.folders.get(folderId)))
        throw new Error('The destination folder no longer exists.');
      const previous = options.replaceId
        ? await database.notes.get(options.replaceId)
        : undefined;
      if (options.replaceId && !previous)
        throw new Error(
          'The document selected for replacement no longer exists.',
        );
      const note: Note = {
        id: previous?.id ?? options.id ?? crypto.randomUUID(),
        title: parsed.metadata.title,
        description: parsed.metadata.description ?? '',
        subject: parsed.metadata.subject ?? 'Personal notes',
        tags: parsed.metadata.tags,
        source: clean,
        folderId,
        favorite: previous?.favorite ?? false,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        openedAt: options.sample ? 0 : now,
        position: 0,
        sample: options.sample ?? false,
      };
      if (previous) await database.notes.put(note);
      else await database.notes.add(note);
      if (options.assets) {
        await database.assets.where('noteId').equals(note.id).delete();
        for (const asset of options.assets) {
          const path = normalizeAssetPath(asset.path);
          if (
            asset.blob.size > MAX_ASSET_BYTES ||
            !/^image\/(png|jpeg|gif|webp|avif)$/.test(asset.blob.type)
          )
            throw new Error(
              'Only raster image assets up to 10 MB are supported.',
            );
          await database.assets.put({
            id: `${note.id}:${path}`,
            noteId: note.id,
            path,
            blob: asset.blob,
          });
        }
      }
      return note;
    },
  );
}
export async function moveFolder(
  id: string,
  parentId: string | null,
  database = db,
) {
  await database.transaction('rw', database.folders, async () => {
    const seen = new Set([id]);
    let cursor = parentId;
    while (cursor) {
      if (seen.has(cursor))
        throw new Error(
          'A folder cannot be moved into itself or its descendants.',
        );
      seen.add(cursor);
      const folder = await database.folders.get(cursor);
      if (!folder) throw new Error('Destination folder not found.');
      cursor = folder.parentId;
    }
    if (!(await database.folders.get(id))) throw new Error('Folder not found.');
    await database.folders.update(id, { parentId });
  });
}
export async function deleteFolder(id: string, database = db) {
  await database.transaction(
    'rw',
    database.folders,
    database.notes,
    async () => {
      const folder = await database.folders.get(id);
      if (!folder) return;
      await database.notes
        .where('folderId')
        .equals(id)
        .modify({ folderId: folder.parentId });
      await database.folders
        .where('parentId')
        .equals(id)
        .modify({ parentId: folder.parentId });
      await database.folders.delete(id);
    },
  );
}
export async function deleteNote(id: string, database = db) {
  await database.transaction(
    'rw',
    database.notes,
    database.assets,
    async () => {
      await database.assets.where('noteId').equals(id).delete();
      await database.notes.delete(id);
    },
  );
}
export function download(content: Blob | string, name: string) {
  const url = URL.createObjectURL(
    typeof content === 'string'
      ? new Blob([content], { type: 'text/plain;charset=utf-8' })
      : content,
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export async function exportLibrary(database = db) {
  const [notes, folders, assets] = await database.transaction(
    'r',
    database.notes,
    database.folders,
    database.assets,
    () =>
      Promise.all([
        database.notes.toArray(),
        database.folders.toArray(),
        database.assets.toArray(),
      ]),
  );
  const encoded = await Promise.all(
    assets.map(async (a) => ({
      ...a,
      blob: undefined,
      type: a.blob.type,
      data: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(a.blob);
      }),
    })),
  );
  return JSON.stringify(
    {
      format: 'learnmd-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
      folders,
      assets: encoded,
    },
    null,
    2,
  );
}
export async function restoreLibrary(text: string, database = db) {
  if (text.length > 100 * 1024 * 1024)
    throw new Error('Backup exceeds the 100 MB limit.');
  const data = JSON.parse(text);
  if (
    data.format !== 'learnmd-backup' ||
    data.version !== 1 ||
    !Array.isArray(data.notes) ||
    !Array.isArray(data.folders) ||
    !Array.isArray(data.assets)
  )
    throw new Error('This is not a LearnMD v1 library backup.');
  if (
    data.notes.length > 2000 ||
    data.folders.length > 2000 ||
    data.assets.length > 5000
  )
    throw new Error('This backup contains too many entries.');
  const folderIds = new Map<string, string>();
  const noteIds = new Map<string, string>();
  for (const f of data.folders) {
    if (
      typeof f.id !== 'string' ||
      typeof f.name !== 'string' ||
      !f.name.trim() ||
      f.name.length > 200 ||
      folderIds.has(f.id)
    )
      throw new Error('Invalid or duplicate folder.');
    folderIds.set(f.id, crypto.randomUUID());
  }
  const foldersById = new Map<string, Folder>(
    data.folders.map((f: Folder) => [f.id, f]),
  );
  const checkedFolders = new Set<string>();
  for (const f of data.folders) {
    const seen = new Set<string>();
    let cursor: string | null = f.id;
    while (cursor && !checkedFolders.has(cursor)) {
      if (seen.has(cursor)) throw new Error('Backup contains a folder cycle.');
      seen.add(cursor);
      const parent = foldersById.get(cursor);
      if (!parent) throw new Error('Missing parent folder.');
      if (parent.parentId !== null && typeof parent.parentId !== 'string')
        throw new Error('Invalid parent folder.');
      cursor = parent.parentId;
    }
    for (const id of seen) checkedFolders.add(id);
  }
  for (const n of data.notes) {
    if (
      typeof n.id !== 'string' ||
      noteIds.has(n.id) ||
      typeof n.title !== 'string' ||
      !n.title.trim() ||
      n.title.length > 300 ||
      typeof n.source !== 'string' ||
      n.source.length > MAX_FILE_BYTES ||
      parseLearnMD(n.source).diagnostics.some((d) => d.severity === 'error') ||
      (n.folderId && !folderIds.has(n.folderId))
    )
      throw new Error('Backup contains an invalid note.');
    noteIds.set(n.id, crypto.randomUUID());
  }
  const assets: Asset[] = data.assets.map(
    (a: { noteId: string; path: string; type: string; data: string }) => {
      const noteId = noteIds.get(a.noteId);
      if (
        !noteId ||
        typeof a.path !== 'string' ||
        typeof a.data !== 'string' ||
        a.data.length > MAX_ASSET_BYTES * 1.4 ||
        !/^image\/(png|jpeg|gif|webp|avif)$/.test(a.type)
      )
        throw new Error('Backup contains an invalid asset.');
      const path = normalizeAssetPath(a.path);
      const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
      if (bytes.byteLength > MAX_ASSET_BYTES)
        throw new Error('Backup asset exceeds 10 MB.');
      return {
        id: `${noteId}:${path}`,
        noteId,
        path,
        blob: new Blob([bytes], { type: a.type }),
      };
    },
  );
  await database.transaction(
    'rw',
    database.notes,
    database.folders,
    database.assets,
    async () => {
      await database.folders.bulkAdd(
        data.folders.map((f: Folder) => ({
          id: folderIds.get(f.id)!,
          name: f.name,
          parentId: f.parentId ? folderIds.get(f.parentId)! : null,
        })),
      );
      await database.notes.bulkAdd(
        data.notes.map((n: Note) => {
          const meta = parseLearnMD(n.source).metadata;
          return {
            id: noteIds.get(n.id)!,
            title: n.title,
            description: meta.description ?? '',
            subject: meta.subject ?? 'Personal notes',
            tags: meta.tags,
            source: n.source,
            folderId: n.folderId ? folderIds.get(n.folderId)! : null,
            favorite: n.favorite === true,
            createdAt: Number.isFinite(n.createdAt) ? n.createdAt : Date.now(),
            updatedAt: Date.now(),
            openedAt: 0,
            position: 0,
            sample: false,
          };
        }),
      );
      await database.assets.bulkAdd(assets);
    },
  );
  return data.notes.length;
}
