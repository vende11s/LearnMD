import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SHARE_BYTES,
  SHARE_ENTRY_LIMITS,
  SHARE_TTL_MS,
  type ShareBundle,
} from '../../shared/share-contract';
import {
  deleteFolder,
  deleteNote,
  importNote,
  LibraryDB,
  MAX_ASSET_BYTES,
} from '../storage';
import {
  buildShareBundle,
  getSharedImport,
  importShareBundle,
  validateShareBundle,
} from './bundle';

let database: LibraryDB;
beforeEach(() => {
  database = new LibraryDB(`sharing-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await database.delete();
});

function noteBundle(): ShareBundle {
  return {
    format: 'learnmd-share',
    version: 1,
    kind: 'note',
    title: 'Shared title',
    notes: [
      {
        id: 'note-1',
        title: 'Shared title',
        source: '# Source title\n\n![Plot](images/plot.png)',
        folderId: null,
      },
    ],
    folders: [],
    assets: [
      {
        noteId: 'note-1',
        path: 'images/plot.png',
        type: 'image/png',
        data: 'aW1hZ2U=',
      },
    ],
  };
}

function folderBundle(): ShareBundle {
  const bundle = noteBundle();
  return {
    ...bundle,
    kind: 'folder',
    title: 'A folder',
    folders: [
      { id: 'folder-1', name: 'A folder', parentId: null, icon: 'book' },
      {
        id: 'folder-2',
        name: 'Nested',
        parentId: 'folder-1',
        icon: 'calculator',
      },
    ],
    notes: [{ ...bundle.notes[0], folderId: 'folder-2' }],
  };
}

describe('portable share export', () => {
  it('sets the shared lifetime to exactly seven days', () => {
    expect(SHARE_TTL_MS).toBe(604_800_000);
  });

  it('exports one note without its parent, local IDs, private state, or unused assets', async () => {
    await database.folders.add({
      id: 'private-parent',
      name: 'Private parent',
      parentId: null,
    });
    const original = await importNote(
      '# Source title\n\n![Plot](images/plot.png)',
      'private-parent',
      {},
      database,
    );
    await database.notes.update(original.id, {
      title: 'Library label',
      favorite: true,
      openedAt: 42,
      position: 50,
      sample: true,
    });
    // Keep real Blobs out of fake-indexeddb's structuredClone when testing reads.
    database.assets.hook('reading', (asset) => ({
      ...asset,
      blob: new Blob(['image'], { type: 'image/png' }),
    }));
    await database.assets.bulkAdd([
      {
        id: 'asset-private-1',
        noteId: original.id,
        path: 'images/plot.png',
        blob: new Blob(),
      },
      {
        id: 'asset-private-2',
        noteId: original.id,
        path: 'unused.png',
        blob: new Blob(),
      },
    ]);
    const bundle = await buildShareBundle(
      { type: 'note', id: original.id },
      database,
    );
    expect(bundle.title).toBe('Library label');
    expect(bundle.folders).toEqual([]);
    expect(bundle.notes).toEqual([
      {
        id: 'note-1',
        title: 'Library label',
        source: original.source,
        folderId: null,
      },
    ]);
    expect(bundle.assets).toEqual([
      {
        noteId: 'note-1',
        path: 'images/plot.png',
        type: 'image/png',
        data: 'aW1hZ2U=',
      },
    ]);
    expect(JSON.stringify(bundle)).not.toContain(original.id);
    expect(JSON.stringify(bundle)).not.toMatch(
      /private-parent|favorite|openedAt|position|sample|createdAt/,
    );
  });

  it('re-roots only the selected subtree and preserves names, empty folders, and icons', async () => {
    await database.folders.bulkAdd([
      { id: 'outside', name: 'Private ancestor', parentId: null },
      { id: 'selected', name: 'Shared', parentId: 'outside', icon: 'book' },
      { id: 'child', name: 'Empty child', parentId: 'selected', icon: 'leaf' },
      { id: 'sibling', name: 'Private sibling', parentId: 'outside' },
    ]);
    await importNote('# Included', 'selected', {}, database);
    await importNote('# Excluded', 'sibling', {}, database);
    const bundle = await buildShareBundle(
      { type: 'folder', id: 'selected' },
      database,
    );
    expect(bundle.folders).toEqual([
      { id: 'folder-1', name: 'Shared', parentId: null, icon: 'book' },
      {
        id: 'folder-2',
        name: 'Empty child',
        parentId: 'folder-1',
        icon: 'leaf',
      },
    ]);
    expect(bundle.notes).toHaveLength(1);
    expect(bundle.notes[0].folderId).toBe('folder-1');
    expect(JSON.stringify(bundle)).not.toMatch(
      /Private|Excluded|outside|selected/,
    );
  });

  it('includes reference-style images and image annotations but excludes code, links, and unused definitions', () => {
    const bundle = noteBundle();
    bundle.notes[0].source =
      '# Images\n\n![Plot][p]\n\n[p]: images/plot.png\n\n[unused]: unused.png\n\n[Download](link.png)\n\n```md\n![Hidden](code.png)\n```\n\n::::image-annotation{src="annotation.png" alt="A plot"}\n\n:::annotation{label="Point" x="25" y="30"}\nA point\n:::\n\n::::';
    bundle.assets.push({
      noteId: 'note-1',
      path: 'annotation.png',
      type: 'image/png',
      data: 'aW1hZ2U=',
    });
    expect(validateShareBundle(bundle).assets).toHaveLength(2);
    for (const path of ['unused.png', 'link.png', 'code.png']) {
      expect(() =>
        validateShareBundle({
          ...bundle,
          assets: [
            ...bundle.assets,
            { noteId: 'note-1', path, type: 'image/png', data: 'aW1hZ2U=' },
          ],
        }),
      ).toThrow('unreferenced');
    }
  });

  it('rejects stale selections and corrupt folder cycles', async () => {
    await expect(
      buildShareBundle({ type: 'note', id: 'missing' }, database),
    ).rejects.toThrow('no longer exists');
    await database.folders.bulkAdd([
      { id: 'a', name: 'A', parentId: 'b' },
      { id: 'b', name: 'B', parentId: 'a' },
    ]);
    await expect(
      buildShareBundle({ type: 'folder', id: 'a' }, database),
    ).rejects.toThrow('cycle');
  });

  it('uses the same last reference definition as the reader', () => {
    const bundle = noteBundle();
    bundle.notes[0].source =
      '# Image\n\n![Plot][p]\n\n[p]: private.png\n\n[p]: images/plot.png';
    expect(validateShareBundle(bundle).assets).toHaveLength(1);
    bundle.assets[0].path = 'private.png';
    expect(() => validateShareBundle(bundle)).toThrow('unreferenced');
  });
});

describe('shared package validation', () => {
  it('normalizes portable fields and drops injected library state', () => {
    const input = noteBundle();
    const output = validateShareBundle({
      ...input,
      secret: 'private',
      notes: input.notes.map((note) => ({
        ...note,
        favorite: true,
        position: 10,
      })),
    });
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });

  it('rejects duplicates, orphans, disconnected roots, malformed sources, and unsupported icons', () => {
    const mutations: ((bundle: ShareBundle) => void)[] = [
      (bundle) => bundle.notes.push(bundle.notes[0]),
      (bundle) => {
        bundle.notes[0].folderId = 'missing';
      },
      (bundle) => {
        bundle.folders[1].parentId = 'missing';
      },
      (bundle) => {
        bundle.folders[1].parentId = null;
      },
      (bundle) => {
        bundle.folders[0].parentId = 'folder-2';
      },
      (bundle) => bundle.folders.push(bundle.folders[0]),
      (bundle) => {
        bundle.folders[0].icon = 'unknown';
      },
      (bundle) => {
        bundle.notes[0].source = ':::fill-blank\nMissing answer\n:::';
      },
      (bundle) => {
        bundle.assets[0].noteId = 'missing';
      },
      (bundle) => {
        bundle.notes[0].source = ' ';
      },
    ];
    for (const mutate of mutations) {
      const bundle = folderBundle();
      mutate(bundle);
      expect(() => validateShareBundle(bundle)).toThrow();
    }
  });

  it('enforces count, UTF-8 package size, and per-note source limits', () => {
    const tooMany = folderBundle();
    tooMany.notes = Array.from(
      { length: SHARE_ENTRY_LIMITS.notes + 1 },
      (_, index) => ({ ...tooMany.notes[0], id: `n-${index}` }),
    );
    expect(() => validateShareBundle(tooMany)).toThrow('entry count');
    expect(() =>
      validateShareBundle({
        ...noteBundle(),
        extra: 'ą'.repeat(MAX_SHARE_BYTES / 2),
      }),
    ).toThrow('20 MB');
    const hugeNote = noteBundle();
    hugeNote.notes[0].source = '😀'.repeat(600_000);
    expect(() => validateShareBundle(hugeNote)).toThrow('2 MB');
  });

  it('rejects duplicate normalized paths, unsafe paths, active MIME types, invalid base64, and oversized images', () => {
    const duplicate = noteBundle();
    duplicate.assets.push({
      ...duplicate.assets[0],
      path: './images/plot.png',
    });
    expect(() => validateShareBundle(duplicate)).toThrow(
      'duplicate image path',
    );
    for (const path of [
      '../plot.png',
      '/plot.png',
      'https://host/plot.png',
      'images/%2e%2e/plot.png',
    ]) {
      const bundle = noteBundle();
      bundle.assets[0].path = path;
      expect(() => validateShareBundle(bundle)).toThrow();
    }
    const mime = noteBundle();
    mime.assets[0].type = 'image/svg+xml';
    expect(() => validateShareBundle(mime)).toThrow('unsupported image');
    for (const data of ['', 'not base64', 'a===', '====', 'AA=A', 'aaa']) {
      const bundle = noteBundle();
      bundle.assets[0].data = data;
      expect(() => validateShareBundle(bundle)).toThrow();
    }
    const large = noteBundle();
    large.assets[0].data = btoa('x'.repeat(MAX_ASSET_BYTES + 1));
    expect(() => validateShareBundle(large)).toThrow('10 MB');
  });

  it('allows an empty selected folder and notes whose original local images are missing', () => {
    const folder = folderBundle();
    folder.notes = [];
    folder.assets = [];
    expect(validateShareBundle(folder).notes).toEqual([]);
    const missing = noteBundle();
    missing.assets = [];
    expect(validateShareBundle(missing).assets).toEqual([]);
  });
});

describe('atomic shared imports', () => {
  it('imports new copies into a destination with fresh identities, source metadata, and reset private state', async () => {
    await database.folders.add({
      id: 'destination',
      name: 'Destination',
      parentId: null,
    });
    const result = await importShareBundle(
      folderBundle(),
      'destination',
      'shared-id',
      database,
    );
    const root = await database.folders.get(result.folderId!);
    expect(root).toMatchObject({
      name: 'A folder',
      parentId: 'destination',
      icon: 'book',
    });
    expect(root?.id).not.toBe('folder-1');
    const [note] = await database.notes.toArray();
    expect(note).toMatchObject({
      title: 'Shared title',
      favorite: false,
      position: 0,
      openedAt: 0,
      sample: false,
      subject: 'Personal notes',
      tags: [],
    });
    expect(note.id).not.toBe('note-1');
    expect(await database.folders.get(note.folderId!)).toMatchObject({
      name: 'Nested',
      parentId: root?.id,
      icon: 'calculator',
    });
    expect((await database.assets.toArray())[0]).toMatchObject({
      noteId: note.id,
      id: `${note.id}:images/plot.png`,
    });
    expect(await getSharedImport('shared-id', database)).toEqual(result);
  });

  it('allows an explicit second import without overwriting equal titles and updates the duplicate marker', async () => {
    const first = await importShareBundle(
      noteBundle(),
      null,
      'shared-id',
      database,
    );
    const second = await importShareBundle(
      noteBundle(),
      null,
      'shared-id',
      database,
    );
    expect(second.noteId).not.toBe(first.noteId);
    expect(await database.notes.count()).toBe(2);
    expect(await getSharedImport('shared-id', database)).toEqual(second);
    await deleteNote(second.noteId!, database);
    expect(await getSharedImport('shared-id', database)).toBeNull();
    expect(await database.notes.get(first.noteId!)).toBeDefined();
  });

  it('ignores markers for deleted folders and malformed local marker values', async () => {
    const result = await importShareBundle(
      folderBundle(),
      null,
      'shared-folder',
      database,
    );
    await deleteFolder(result.folderId!, database);
    expect(await getSharedImport('shared-folder', database)).toBeNull();
    await database.settings.put({
      key: 'share-import:broken',
      value: 'not json',
    });
    expect(await getSharedImport('broken', database)).toBeNull();
  });

  it('does not partially import when the destination disappears or the final marker write fails', async () => {
    await expect(
      importShareBundle(folderBundle(), 'missing', 'share-a', database),
    ).rejects.toThrow('destination folder');
    database.settings.hook('creating', () => {
      throw new Error('Storage full');
    });
    await expect(
      importShareBundle(folderBundle(), null, 'share-a', database),
    ).rejects.toThrow('Storage full');
    expect(await database.notes.count()).toBe(0);
    expect(await database.folders.count()).toBe(0);
    expect(await database.assets.count()).toBe(0);
    expect(await database.settings.count()).toBe(0);
  });
});
