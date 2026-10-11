import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SAMPLES } from './content/samples';
import {
  initializeLibrary,
  STARTER_FOLDER_MIGRATION_KEY,
} from './librarySetup';
import { importNote, LibraryDB } from './storage';

let database: LibraryDB;
beforeEach(() => {
  database = new LibraryDB(`learnmd-setup-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await database.delete();
});

const noteSource =
  '# My working notes\n\nPreserve this source and my reading progress.';

describe('library setup without predefined folders', () => {
  it('seeds six example notes at root and creates no folders', async () => {
    await initializeLibrary(database);
    const notes = await database.notes.toArray();
    expect(notes).toHaveLength(SAMPLES.length);
    expect(
      notes.every(
        (note) => note.folderId === null && note.sample && note.openedAt === 0,
      ),
    ).toBe(true);
    expect(notes.map((note) => note.id).sort()).toEqual(
      SAMPLES.map((sample) => sample.id).sort(),
    );
    expect(await database.folders.count()).toBe(0);
    expect(await database.settings.get('initialized')).toBeDefined();
    expect(
      await database.settings.get(STARTER_FOLDER_MIGRATION_KEY),
    ).toBeDefined();
  });

  it('moves notes and user subfolders out of untouched starter folders without losing data', async () => {
    await database.settings.put({ key: 'initialized', value: 'true' });
    await database.folders.bulkAdd([
      { id: 'sample-folder-0', name: 'Mathematics', parentId: null },
      { id: 'sample-folder-1', name: 'Computer science', parentId: null },
      { id: 'sample-folder-2', name: 'Natural sciences', parentId: null },
      { id: 'sample-folder-3', name: 'Humanities', parentId: null },
      {
        id: 'my-folder',
        name: 'Exam preparation',
        parentId: 'sample-folder-0',
        icon: 'book',
      },
      { id: 'my-child', name: 'Practice', parentId: 'my-folder' },
    ]);
    const note = await importNote(
      noteSource,
      'sample-folder-0',
      {
        assets: [
          {
            path: 'figure.png',
            blob: new Blob(['image'], { type: 'image/png' }),
          },
        ],
      },
      database,
    );
    await database.notes.update(note.id, { favorite: true, position: 325 });
    const original = await database.notes.get(note.id);
    const assets = await database.assets.toArray();

    await initializeLibrary(database);

    expect(await database.notes.get(note.id)).toEqual({
      ...original,
      folderId: null,
    });
    expect(await database.assets.toArray()).toEqual(assets);
    expect(await database.folders.toArray()).toEqual(
      expect.arrayContaining([
        {
          id: 'my-folder',
          name: 'Exam preparation',
          parentId: null,
          icon: 'book',
        },
        { id: 'my-child', name: 'Practice', parentId: 'my-folder' },
      ]),
    );
    expect(await database.folders.count()).toBe(2);
    expect(await database.notes.count()).toBe(1);
  });

  it('reparents through multiple retired starters to the nearest retained ancestor', async () => {
    await database.settings.put({ key: 'initialized', value: 'true' });
    await database.folders.bulkAdd([
      { id: 'retained', name: 'My studies', parentId: null },
      { id: 'sample-folder-0', name: 'Mathematics', parentId: 'retained' },
      {
        id: 'sample-folder-1',
        name: 'Computer science',
        parentId: 'sample-folder-0',
      },
      { id: 'project', name: 'Project', parentId: 'sample-folder-1' },
    ]);
    const note = await importNote(noteSource, 'sample-folder-1', {}, database);
    await initializeLibrary(database);
    expect((await database.notes.get(note.id))?.folderId).toBe('retained');
    expect((await database.folders.get('project'))?.parentId).toBe('retained');
    expect(await database.folders.count()).toBe(2);
  });

  it('preserves renamed starters, explicit icon choices, and similarly named user folders', async () => {
    await database.settings.put({ key: 'initialized', value: 'true' });
    const folders = [
      { id: 'sample-folder-0', name: 'My mathematics', parentId: null },
      {
        id: 'sample-folder-1',
        name: 'Computer science',
        parentId: null,
        icon: 'code' as const,
      },
      {
        id: 'sample-folder-2',
        name: 'Natural sciences',
        parentId: null,
        icon: 'folder' as const,
      },
      { id: 'user-created', name: 'Humanities', parentId: null },
    ];
    await database.folders.bulkAdd(folders);
    await initializeLibrary(database);
    expect(await database.folders.toArray()).toEqual(
      expect.arrayContaining(folders),
    );
    expect(await database.folders.count()).toBe(folders.length);
  });

  it('runs migration once and does not recreate deleted example notes', async () => {
    await initializeLibrary(database);
    await database.notes.delete(SAMPLES[0].id);
    const recreated = {
      id: 'sample-folder-0',
      name: 'Mathematics',
      parentId: null,
    };
    await database.folders.add(recreated);
    await initializeLibrary(database);
    expect(await database.notes.get(SAMPLES[0].id)).toBeUndefined();
    expect(await database.notes.count()).toBe(SAMPLES.length - 1);
    expect(await database.folders.get(recreated.id)).toEqual(recreated);
  });

  it('serializes concurrent initialization without duplicate copies', async () => {
    await Promise.all([
      initializeLibrary(database),
      initializeLibrary(database),
    ]);
    expect(await database.notes.count()).toBe(SAMPLES.length);
    expect(await database.folders.count()).toBe(0);
  });

  it('keeps colliding user records when initializing an existing unmarked library', async () => {
    const original = await importNote(
      noteSource,
      null,
      { id: SAMPLES[0].id },
      database,
    );
    await initializeLibrary(database);
    expect(await database.notes.get(original.id)).toEqual(original);
    expect(await database.notes.count()).toBe(SAMPLES.length);
  });

  it('rolls back migration, partial seeding, and markers together when setup fails', async () => {
    const originalFolder = {
      id: 'sample-folder-0',
      name: 'Mathematics',
      parentId: null,
    };
    await database.folders.add(originalFolder);
    const failSeed = (id: unknown) => {
      if (id === 'networks') throw new Error('Simulated storage failure');
    };
    database.notes.hook('creating', failSeed);
    await expect(initializeLibrary(database)).rejects.toThrow(
      'Simulated storage failure',
    );
    database.notes.hook('creating').unsubscribe(failSeed);
    expect(await database.folders.get(originalFolder.id)).toEqual(
      originalFolder,
    );
    expect(await database.notes.count()).toBe(0);
    expect(await database.settings.count()).toBe(0);
  });
});
