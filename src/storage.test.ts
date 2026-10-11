import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteFolder,
  deleteNote,
  exportLibrary,
  extractSource,
  importNote,
  LibraryDB,
  MAX_ASSET_BYTES,
  MAX_FILE_BYTES,
  moveFolder,
  normalizeAssetPath,
  restoreLibrary,
  safeAsset,
} from './storage';

const source = (title = 'A local chapter', body = 'A clear explanation.') =>
  `---\nversion: "1.0"\ntitle: "${title}"\nsubject: Testing\ntags: [local]\n---\n\n## An idea\n\n${body}`;
let database: LibraryDB;
beforeEach(() => {
  database = new LibraryDB(`learnmd-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await database.delete();
});

describe('local note transactions', () => {
  it('imports a fenced source as an independent local copy with metadata', async () => {
    const note = await importNote(
      `\uFEFF\n\n\`\`\`learn.md\n${source()}\n\`\`\``,
      null,
      {},
      database,
    );
    expect(note.title).toBe('A local chapter');
    expect(note.tags).toEqual(['local']);
    expect(note.source).toBe(source());
    expect(await database.notes.get(note.id)).toEqual(note);
  });

  it('creates two independent copies for equal titles without replacement authorization', async () => {
    const first = await importNote(source(), null, {}, database);
    const second = await importNote(source(), null, {}, database);
    expect(first.id).not.toBe(second.id);
    expect(await database.notes.count()).toBe(2);
  });

  it('a caller-supplied ID cannot overwrite an existing note without replacement authorization', async () => {
    const first = await importNote(
      source(),
      null,
      { id: 'stable-id' },
      database,
    );
    await expect(
      importNote(
        source('An accidental collision'),
        null,
        { id: 'stable-id' },
        database,
      ),
    ).rejects.toThrow();
    expect(await database.notes.get('stable-id')).toEqual(first);
  });

  it('explicit replacement preserves identity, creation time, and favorite status', async () => {
    const first = await importNote(source(), null, {}, database);
    await database.notes.update(first.id, { favorite: true, position: 250 });
    const revised = await importNote(
      source('Revised chapter', 'A corrected explanation.'),
      null,
      { replaceId: first.id },
      database,
    );
    expect(revised.id).toBe(first.id);
    expect(revised.createdAt).toBe(first.createdAt);
    expect(revised.favorite).toBe(true);
    expect(revised.position).toBe(0);
    expect(revised.source).toContain('A corrected explanation.');
    expect(await database.notes.count()).toBe(1);
  });

  it('rejects invalid source before mutating an existing copy', async () => {
    const first = await importNote(source(), null, {}, database);
    await expect(
      importNote(
        source('Invalid', ':::fill-blank\nMissing the required answer.\n:::'),
        null,
        { replaceId: first.id },
        database,
      ),
    ).rejects.toThrow();
    expect(await database.notes.get(first.id)).toEqual(first);
  });

  it('rejects stale destination and replacement selections', async () => {
    await expect(
      importNote(source(), 'missing-folder', {}, database),
    ).rejects.toThrow('destination folder');
    await expect(
      importNote(source(), null, { replaceId: 'missing-note' }, database),
    ).rejects.toThrow('replacement');
    expect(await database.notes.count()).toBe(0);
  });

  it('rolls back the note and all assets when a later asset is invalid', async () => {
    await expect(
      importNote(
        source(),
        null,
        {
          assets: [
            {
              path: 'valid.png',
              blob: new Blob(['image'], { type: 'image/png' }),
            },
            {
              path: '../escape.png',
              blob: new Blob(['image'], { type: 'image/png' }),
            },
          ],
        },
        database,
      ),
    ).rejects.toThrow('relative');
    expect(await database.notes.count()).toBe(0);
    expect(await database.assets.count()).toBe(0);
  });

  it('deletes a local note together with its assets without affecting other copies', async () => {
    const first = await importNote(
      source(),
      null,
      {
        assets: [
          {
            path: 'plot.png',
            blob: new Blob(['image'], { type: 'image/png' }),
          },
        ],
      },
      database,
    );
    const second = await importNote(source(), null, {}, database);
    await deleteNote(first.id, database);
    expect(await database.notes.get(first.id)).toBeUndefined();
    expect(await database.assets.count()).toBe(0);
    expect(await database.notes.get(second.id)).toBeDefined();
  });

  it('enforces the source byte limit before parsing a very large input', async () => {
    await expect(
      importNote('x'.repeat(MAX_FILE_BYTES + 1), null, {}, database),
    ).rejects.toThrow('2 MB');
    expect(await database.notes.count()).toBe(0);
  });
});

describe('folder integrity', () => {
  beforeEach(async () => {
    await database.folders.bulkAdd([
      { id: 'parent', name: 'Parent', parentId: null },
      { id: 'child', name: 'Child', parentId: 'parent' },
      { id: 'grandchild', name: 'Grandchild', parentId: 'child' },
      { id: 'other', name: 'Other', parentId: null },
    ]);
  });

  it('moves a subtree while preserving its internal relationships', async () => {
    await moveFolder('child', 'other', database);
    expect((await database.folders.get('child'))?.parentId).toBe('other');
    expect((await database.folders.get('grandchild'))?.parentId).toBe('child');
  });

  it('prevents self-parenting, descendant cycles, and missing destinations', async () => {
    await expect(moveFolder('parent', 'parent', database)).rejects.toThrow(
      'itself',
    );
    await expect(moveFolder('parent', 'grandchild', database)).rejects.toThrow(
      'descendants',
    );
    await expect(moveFolder('child', 'missing', database)).rejects.toThrow(
      'Destination',
    );
    expect((await database.folders.get('parent'))?.parentId).toBeNull();
  });

  it('deleting a folder reparents immediate children and preserves notes', async () => {
    const note = await importNote(source(), 'child', {}, database);
    await deleteFolder('child', database);
    expect(await database.folders.get('child')).toBeUndefined();
    expect((await database.folders.get('grandchild'))?.parentId).toBe('parent');
    expect((await database.notes.get(note.id))?.folderId).toBe('parent');
    expect(await database.notes.count()).toBe(1);
  });
});

describe('portable backup recovery', () => {
  it('restores a backup as new copies and remaps nested folders', async () => {
    await database.folders.bulkAdd([
      { id: 'root', name: 'Root', parentId: null },
      { id: 'nested', name: 'Nested', parentId: 'root' },
    ]);
    const original = await importNote(source(), 'nested', {}, database);
    await database.notes.update(original.id, {
      favorite: true,
      title: 'My library label',
    });
    const backup = await exportLibrary(database);
    expect(await restoreLibrary(backup, database)).toBe(1);
    const notes = await database.notes.toArray();
    expect(notes).toHaveLength(2);
    const restored = notes.find((note) => note.id !== original.id)!;
    expect(restored.title).toBe('My library label');
    expect(restored.favorite).toBe(true);
    expect(restored.source).toBe(original.source);
    expect(restored.folderId).not.toBe('nested');
    const nested = await database.folders.get(restored.folderId!);
    expect(nested?.name).toBe('Nested');
    expect((await database.folders.get(nested!.parentId!))?.name).toBe('Root');
  });

  it('rejects folder cycles and leaves the library unchanged', async () => {
    const original = await importNote(source(), null, {}, database);
    const bad = {
      format: 'learnmd-backup',
      version: 1,
      notes: [],
      assets: [],
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
    };
    await expect(restoreLibrary(JSON.stringify(bad), database)).rejects.toThrow(
      'cycle',
    );
    expect(await database.notes.get(original.id)).toEqual(original);
    expect(await database.folders.count()).toBe(0);
  });

  it('rejects malformed source and orphan assets before restoring any records', async () => {
    const original = await importNote(source(), null, {}, database);
    const backup = JSON.parse(await exportLibrary(database));
    backup.notes[0].source = source(
      'Bad',
      ':::fill-blank\nMissing the required answer.\n:::',
    );
    await expect(
      restoreLibrary(JSON.stringify(backup), database),
    ).rejects.toThrow('invalid note');
    const orphan = {
      format: 'learnmd-backup',
      version: 1,
      notes: [],
      folders: [],
      assets: [
        {
          noteId: 'absent',
          path: 'image.png',
          type: 'image/png',
          data: 'AA==',
        },
      ],
    };
    await expect(
      restoreLibrary(JSON.stringify(orphan), database),
    ).rejects.toThrow('invalid asset');
    expect(await database.notes.get(original.id)).toEqual(original);
    expect(await database.notes.count()).toBe(1);
  });

  it('checks the decoded asset byte size rather than only the encoded string length', async () => {
    const original = await importNote(source(), null, {}, database);
    const backup = JSON.parse(await exportLibrary(database));
    backup.assets = [
      {
        noteId: original.id,
        path: 'large.png',
        type: 'image/png',
        data: btoa('x'.repeat(MAX_ASSET_BYTES + 1)),
      },
    ];
    await expect(
      restoreLibrary(JSON.stringify(backup), database),
    ).rejects.toThrow('10 MB');
    expect(await database.notes.count()).toBe(1);
    expect(await database.assets.count()).toBe(0);
  });
});

describe('import boundaries', () => {
  it('keeps ordinary code blocks intact when they are part of a document', () => {
    const document = source('Code', '~~~ts\nconst answer = 42;\n~~~');
    expect(extractSource(document)).toBe(document);
  });

  it('does not strip an ambiguous surrounding code fence', () => {
    const ambiguous =
      '```markdown\n' + source() + '\n```\nUnrelated prose\n```';
    expect(extractSource(ambiguous)).toBe(ambiguous);
  });

  it('normalizes relative asset paths and rejects traversal and active formats', () => {
    expect(normalizeAssetPath('./figures\\plot.png')).toBe('figures/plot.png');
    expect(() => normalizeAssetPath('../plot.png')).toThrow();
    expect(() => normalizeAssetPath('https://host/plot.png')).toThrow();
    expect(
      safeAsset(new File(['<svg/>'], 'plot.svg', { type: 'image/svg+xml' })),
    ).toBe(false);
    expect(
      safeAsset(new File(['image'], 'plot.png', { type: 'text/html' })),
    ).toBe(false);
    expect(
      safeAsset(new File(['image'], 'plot.png', { type: 'image/png' })),
    ).toBe(true);
  });
});
