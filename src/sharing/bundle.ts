import {
  MAX_SHARE_BYTES,
  SHARE_ENTRY_LIMITS,
  type ShareBundle,
  type ShareTarget,
} from '../../shared/share-contract';
import { isFolderIcon } from '../folderIcons';
import { parseLearnMD, safeUrl } from '../format/parser';
import type { LearnNode } from '../format/types';
import {
  db,
  MAX_ASSET_BYTES,
  MAX_FILE_BYTES,
  normalizeAssetPath,
  type Asset,
  type Folder,
  type Note,
} from '../storage';

export type { ShareBundle, ShareTarget } from '../../shared/share-contract';
export interface SharedImportResult {
  noteId?: string;
  folderId?: string;
  count: number;
}

function invalid(message: string): never {
  throw new Error(`Invalid shared notes: ${message}`);
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    invalid('expected an object.');
  return value as Record<string, unknown>;
}
function label(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    invalid('invalid title or name.');
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    invalid('invalid entry ID.');
  return value;
}
function assetPath(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 500)
    invalid('invalid image path.');
  const path = normalizeAssetPath(value);
  if (!path || !safeUrl(path, 'image') || /[?#]/.test(path))
    invalid('invalid image path.');
  return path;
}

/** Follow the image nodes the reader actually displays, including references. */
function imagePaths(nodes: LearnNode[]): Set<string> {
  const definitions = new Map<string, string>();
  const stack = [...nodes].reverse();
  const all: LearnNode[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    all.push(node);
    if (node.type === 'definition' && node.identifier && node.url)
      definitions.set(node.identifier.toLowerCase(), node.url);
    if (node.children) stack.push(...[...node.children].reverse());
  }
  const paths = new Set<string>();
  for (const node of all) {
    const url =
      node.type === 'image'
        ? node.url
        : node.type === 'imageReference'
          ? definitions.get(node.identifier?.toLowerCase() ?? '')
          : node.name === 'image-annotation'
            ? node.attributes?.src
            : undefined;
    if (!url || !safeUrl(url, 'image') || /^https?:/i.test(url)) continue;
    try {
      paths.add(assetPath(url));
    } catch {
      // Unsupported local URLs stay unavailable, just as they do in the reader.
    }
  }
  return paths;
}

function decodedAsset(data: string): Uint8Array<ArrayBuffer> {
  // A strict encoding check avoids ignored characters and ambiguous padding.
  if (
    !data ||
    data.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4 ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
  )
    invalid('invalid image encoding or image exceeds 10 MB.');
  const decoded = atob(data);
  if (decoded.length > MAX_ASSET_BYTES) invalid('image exceeds 10 MB.');
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

/** Validate untrusted downloads and return only the portable, public fields. */
export function validateShareBundle(value: unknown): ShareBundle {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid('unserializable package.');
  }
  if (!serialized || new Blob([serialized]).size > MAX_SHARE_BYTES)
    invalid('package exceeds the 20 MB limit.');
  const data = record(value);
  if (data.format !== 'learnmd-share' || data.version !== 1)
    invalid('unsupported package format.');
  if (data.kind !== 'note' && data.kind !== 'folder')
    invalid('unsupported sharing kind.');
  if (
    !Array.isArray(data.notes) ||
    !Array.isArray(data.folders) ||
    !Array.isArray(data.assets) ||
    data.notes.length > SHARE_ENTRY_LIMITS.notes ||
    data.folders.length > SHARE_ENTRY_LIMITS.folders ||
    data.assets.length > SHARE_ENTRY_LIMITS.assets
  )
    invalid('invalid or excessive entry count.');
  const title = label(data.title, 300);
  const folders: ShareBundle['folders'] = [];
  const folderMap = new Map<string, ShareBundle['folders'][number]>();
  for (const raw of data.folders) {
    const entry = record(raw);
    const id = identifier(entry.id);
    if (folderMap.has(id)) invalid('duplicate folder.');
    if (entry.icon !== undefined && !isFolderIcon(entry.icon))
      invalid('unsupported folder icon.');
    const folder = {
      id,
      name: label(entry.name, 200),
      parentId: entry.parentId === null ? null : identifier(entry.parentId),
      ...(entry.icon !== undefined ? { icon: entry.icon as string } : {}),
    };
    folderMap.set(id, folder);
    folders.push(folder);
  }
  const checked = new Set<string>();
  for (const folder of folders) {
    const visiting = new Set<string>();
    let cursor: string | null = folder.id;
    while (cursor !== null && !checked.has(cursor)) {
      if (visiting.has(cursor)) invalid('folder cycle.');
      visiting.add(cursor);
      const current = folderMap.get(cursor);
      if (!current) invalid('missing parent folder.');
      cursor = current.parentId;
    }
    for (const id of visiting) checked.add(id);
  }
  const roots = folders.filter((folder) => folder.parentId === null);
  if (
    (data.kind === 'note' &&
      (folders.length !== 0 || data.notes.length !== 1)) ||
    (data.kind === 'folder' && (roots.length !== 1 || roots[0].name !== title))
  )
    invalid('package must contain one selected note or folder.');

  const notes: ShareBundle['notes'] = [];
  const references = new Map<string, Set<string>>();
  for (const raw of data.notes) {
    const entry = record(raw);
    const id = identifier(entry.id);
    if (references.has(id)) invalid('duplicate note.');
    if (
      typeof entry.source !== 'string' ||
      new Blob([entry.source]).size > MAX_FILE_BYTES
    )
      invalid('note source exceeds 2 MB or is missing.');
    const parsed = parseLearnMD(entry.source);
    if (
      parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    )
      invalid('note source cannot be parsed.');
    const folderId =
      entry.folderId === null ? null : identifier(entry.folderId);
    if (
      (data.kind === 'note' && folderId !== null) ||
      (data.kind === 'folder' &&
        (folderId === null || !folderMap.has(folderId)))
    )
      invalid('missing note folder.');
    const note = {
      id,
      title: label(entry.title, 300),
      source: parsed.source,
      folderId,
    };
    if (data.kind === 'note' && title !== note.title)
      invalid('package title does not match its note.');
    notes.push(note);
    references.set(id, imagePaths(parsed.children));
  }
  const assets: ShareBundle['assets'] = [];
  const assetIds = new Set<string>();
  for (const raw of data.assets) {
    const entry = record(raw);
    const noteId = identifier(entry.noteId);
    const path = assetPath(entry.path);
    if (!references.get(noteId)?.has(path))
      invalid('unreferenced image asset.');
    if (
      typeof entry.type !== 'string' ||
      !/^image\/(png|jpeg|gif|webp|avif)$/.test(entry.type) ||
      typeof entry.data !== 'string'
    )
      invalid('unsupported image asset.');
    const assetId = `${noteId}:${path}`;
    if (assetIds.has(assetId)) invalid('duplicate image path.');
    assetIds.add(assetId);
    decodedAsset(entry.data);
    assets.push({ noteId, path, type: entry.type, data: entry.data });
  }
  return {
    format: 'learnmd-share',
    version: 1,
    kind: data.kind,
    title,
    notes,
    folders,
    assets,
  };
}

function encodeBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Cannot read image.'));
    reader.readAsDataURL(blob);
  });
}

export async function buildShareBundle(
  target: ShareTarget,
  database = db,
): Promise<ShareBundle> {
  const snapshot = await database.transaction(
    'r',
    database.notes,
    database.folders,
    database.assets,
    async () => {
      let notes: Note[];
      let folders: Folder[] = [];
      let title: string;
      if (target.type === 'note') {
        const note = await database.notes.get(target.id);
        if (!note) throw new Error('The selected note no longer exists.');
        notes = [note];
        title = note.title;
      } else if (target.type === 'folder') {
        const selected = await database.folders.get(target.id);
        if (!selected) throw new Error('The selected folder no longer exists.');
        title = selected.name;
        const allFolders = await database.folders.toArray();
        const children = new Map<string, Folder[]>();
        for (const folder of allFolders) {
          if (folder.parentId !== null)
            children.set(folder.parentId, [
              ...(children.get(folder.parentId) ?? []),
              folder,
            ]);
        }
        const pending = [selected];
        const seen = new Set<string>();
        while (pending.length) {
          const folder = pending.shift()!;
          if (seen.has(folder.id)) invalid('folder cycle.');
          seen.add(folder.id);
          folders.push(folder);
          if (folders.length > SHARE_ENTRY_LIMITS.folders)
            invalid('too many folders.');
          pending.push(...(children.get(folder.id) ?? []));
        }
        notes = await database.notes
          .where('folderId')
          .anyOf([...seen])
          .toArray();
      } else {
        throw new Error('Choose a note or folder to share.');
      }
      if (notes.length > SHARE_ENTRY_LIMITS.notes) invalid('too many notes.');
      const assets = notes.length
        ? await database.assets
            .where('noteId')
            .anyOf(notes.map((note) => note.id))
            .toArray()
        : [];
      return { title, notes, folders, assets };
    },
  );
  const noteIds = new Map(
    snapshot.notes.map((note, index) => [note.id, `note-${index + 1}`]),
  );
  const folderIds = new Map(
    snapshot.folders.map((folder, index) => [folder.id, `folder-${index + 1}`]),
  );
  const references = new Map(
    snapshot.notes.map((note) => [
      note.id,
      imagePaths(parseLearnMD(note.source).children),
    ]),
  );
  const selectedAssets = snapshot.assets.filter((asset) =>
    references.get(asset.noteId)?.has(assetPath(asset.path)),
  );
  if (selectedAssets.length > SHARE_ENTRY_LIMITS.assets)
    invalid('too many images.');
  // Bound total work before constructing base64 strings and the final JSON.
  const estimatedBytes =
    snapshot.notes.reduce(
      (sum, note) => sum + new Blob([note.source]).size,
      0,
    ) +
    selectedAssets.reduce(
      (sum, asset) => sum + Math.ceil(asset.blob.size / 3) * 4,
      0,
    );
  if (estimatedBytes > MAX_SHARE_BYTES)
    invalid('package exceeds the 20 MB limit.');
  const assets = await Promise.all(
    selectedAssets.map(async (asset) => ({
      noteId: noteIds.get(asset.noteId)!,
      path: assetPath(asset.path),
      type: asset.blob.type,
      data: await encodeBlob(asset.blob),
    })),
  );
  return validateShareBundle({
    format: 'learnmd-share',
    version: 1,
    kind: target.type,
    title: snapshot.title,
    notes: snapshot.notes.map((note) => ({
      id: noteIds.get(note.id)!,
      title: note.title,
      source: note.source,
      folderId: target.type === 'note' ? null : folderIds.get(note.folderId!)!,
    })),
    folders: snapshot.folders.map((folder) => ({
      id: folderIds.get(folder.id)!,
      name: folder.name,
      parentId:
        folder.id === target.id ? null : folderIds.get(folder.parentId!)!,
      ...(folder.icon !== undefined ? { icon: folder.icon } : {}),
    })),
    assets,
  });
}

export async function importShareBundle(
  input: ShareBundle,
  destinationFolderId: string | null,
  shareId: string,
  database = db,
): Promise<SharedImportResult> {
  const bundle = validateShareBundle(input);
  identifier(shareId);
  const folders = new Map(
    bundle.folders.map((folder) => [folder.id, crypto.randomUUID()]),
  );
  const notes = new Map(
    bundle.notes.map((note) => [note.id, crypto.randomUUID()]),
  );
  const now = Date.now();
  const importedFolders: Folder[] = bundle.folders.map((folder) => ({
    id: folders.get(folder.id)!,
    name: folder.name,
    parentId:
      folder.parentId === null
        ? destinationFolderId
        : folders.get(folder.parentId)!,
    ...(isFolderIcon(folder.icon) ? { icon: folder.icon } : {}),
  }));
  const importedNotes: Note[] = bundle.notes.map((note) => {
    const metadata = parseLearnMD(note.source).metadata;
    return {
      id: notes.get(note.id)!,
      title: note.title,
      source: note.source,
      description: metadata.description ?? '',
      subject: metadata.subject ?? 'Personal notes',
      tags: metadata.tags,
      folderId:
        note.folderId === null
          ? destinationFolderId
          : folders.get(note.folderId)!,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      openedAt: 0,
      position: 0,
      sample: false,
    };
  });
  const importedAssets: Asset[] = bundle.assets.map((asset) => {
    const noteId = notes.get(asset.noteId)!;
    return {
      id: `${noteId}:${asset.path}`,
      noteId,
      path: asset.path,
      blob: new Blob([decodedAsset(asset.data)], { type: asset.type }),
    };
  });
  const result: SharedImportResult = {
    ...(bundle.kind === 'note'
      ? { noteId: importedNotes[0].id }
      : {
          folderId: folders.get(
            bundle.folders.find((folder) => folder.parentId === null)!.id,
          )!,
        }),
    count: importedNotes.length,
  };
  await database.transaction(
    'rw',
    database.notes,
    database.folders,
    database.assets,
    database.settings,
    async () => {
      if (
        destinationFolderId !== null &&
        !(await database.folders.get(destinationFolderId))
      )
        throw new Error('The destination folder no longer exists.');
      await database.folders.bulkAdd(importedFolders);
      await database.notes.bulkAdd(importedNotes);
      await database.assets.bulkAdd(importedAssets);
      await database.settings.put({
        key: `share-import:${shareId}`,
        value: JSON.stringify(result),
      });
    },
  );
  return result;
}

export async function getSharedImport(
  shareId: string,
  database = db,
): Promise<SharedImportResult | null> {
  const stored = await database.settings.get(`share-import:${shareId}`);
  if (!stored) return null;
  try {
    const result = record(JSON.parse(stored.value));
    if (
      typeof result.count !== 'number' ||
      !Number.isInteger(result.count) ||
      result.count < 0
    )
      return null;
    if (
      typeof result.noteId === 'string' &&
      (await database.notes.get(result.noteId))
    )
      return { noteId: result.noteId, count: result.count };
    if (
      typeof result.folderId === 'string' &&
      (await database.folders.get(result.folderId))
    )
      return { folderId: result.folderId, count: result.count };
  } catch {
    // A malformed or obsolete local marker must never block a fresh import.
  }
  return null;
}
