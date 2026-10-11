import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGuide, GUIDE_ID, LEGACY_SAMPLE_IDS } from './content/guide';
import * as guideContent from './content/guide';
import {
  GUIDE_MIGRATION_KEY,
  GUIDE_OWNERSHIP_KEY,
  initializeLibrary,
  STARTER_FOLDER_MIGRATION_KEY,
} from './librarySetup';
import {
  deleteNote,
  exportLibrary,
  extractSource,
  importNote,
  LibraryDB,
  restoreLibrary,
} from './storage';

let database: LibraryDB;
beforeEach(() => {
  database = new LibraryDB(`learnmd-setup-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await database.delete();
});

const noteSource =
  '# My working notes\n\nPreserve this source and my reading progress.';

describe('a single removable localized guide', () => {
  it.each(['en', 'pl'] as const)(
    'seeds one %s guide at root and creates no folders',
    async (language) => {
      await initializeLibrary(database, language);
      const notes = await database.notes.toArray();
      expect(notes).toHaveLength(1);
      expect(
        notes.every(
          (note) =>
            note.folderId === null && note.sample && note.openedAt === 0,
        ),
      ).toBe(true);
      expect(notes[0].id).toBe(GUIDE_ID);
      expect(notes[0].source).toBe(extractSource(getGuide(language).source));
      expect(notes[0].title).toBe(getGuide(language).title);
      expect(await database.folders.count()).toBe(0);
      expect(await database.settings.get('initialized')).toBeDefined();
      expect(
        await database.settings.get(STARTER_FOLDER_MIGRATION_KEY),
      ).toBeDefined();
      expect(await database.settings.get(GUIDE_MIGRATION_KEY)).toBeDefined();
      expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeDefined();
    },
  );

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
    expect(await database.notes.count()).toBe(2);
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

  it('runs migration once and does not recreate a deleted guide on reload or language change', async () => {
    await initializeLibrary(database);
    await deleteNote(GUIDE_ID, database);
    const recreated = {
      id: 'sample-folder-0',
      name: 'Mathematics',
      parentId: null,
    };
    await database.folders.add(recreated);
    database.close();
    await database.open();
    await initializeLibrary(database, 'pl');
    await initializeLibrary(database, 'en');
    expect(await database.notes.get(GUIDE_ID)).toBeUndefined();
    expect(await database.notes.count()).toBe(0);
    expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeUndefined();
    expect(await database.folders.get(recreated.id)).toEqual(recreated);
  });

  it('serializes concurrent initialization without duplicate copies', async () => {
    const otherConnection = new LibraryDB(database.name);
    try {
      await Promise.all([
        initializeLibrary(database, 'pl'),
        initializeLibrary(otherConnection, 'pl'),
        initializeLibrary(database, 'pl'),
      ]);
    } finally {
      otherConnection.close();
    }
    expect(await database.notes.count()).toBe(1);
    expect((await database.notes.get(GUIDE_ID))?.source).toBe(
      extractSource(getGuide('pl').source),
    );
    expect(await database.folders.count()).toBe(0);
  });

  it('migrates the old six built-in records once while preserving imports and unrelated records', async () => {
    await database.settings.put({ key: 'initialized', value: 'true' });
    await database.folders.add({
      id: 'mine',
      name: 'My work',
      parentId: null,
      icon: 'book',
    });
    for (const id of LEGACY_SAMPLE_IDS) {
      await importNote(
        `# Old sample ${id}`,
        null,
        { id, sample: true },
        database,
      );
    }
    const importedReplacement = await importNote(
      noteSource,
      'mine',
      {
        replaceId: LEGACY_SAMPLE_IDS[0],
        assets: [
          {
            path: 'my-image.png',
            blob: new Blob(['mine'], { type: 'image/png' }),
          },
        ],
      },
      database,
    );
    const custom = await importNote(
      noteSource,
      'mine',
      { id: 'my-custom-note', sample: true },
      database,
    );
    const imported = await importNote('# Imported copy', null, {}, database);
    await database.assets.add({
      id: 'legacy-image',
      noteId: LEGACY_SAMPLE_IDS[1],
      path: 'old.png',
      blob: new Blob(['old'], { type: 'image/png' }),
    });
    const retainedAssets = await database.assets
      .where('noteId')
      .equals(importedReplacement.id)
      .toArray();

    await initializeLibrary(database, 'pl');

    expect(await database.notes.count()).toBe(4);
    expect(await database.notes.get(importedReplacement.id)).toEqual(
      importedReplacement,
    );
    expect(await database.notes.get(custom.id)).toEqual(custom);
    expect(await database.notes.get(imported.id)).toEqual(imported);
    for (const id of LEGACY_SAMPLE_IDS.slice(1))
      expect(await database.notes.get(id)).toBeUndefined();
    expect(await database.assets.toArray()).toEqual(retainedAssets);
    expect(await database.folders.get('mine')).toEqual({
      id: 'mine',
      name: 'My work',
      parentId: null,
      icon: 'book',
    });
    expect((await database.notes.get(GUIDE_ID))?.source).toBe(
      extractSource(getGuide('pl').source),
    );

    // User-created records using a retired ID after migration are untouched.
    const later = await importNote(
      '# My later note',
      null,
      { id: LEGACY_SAMPLE_IDS[1], sample: true },
      database,
    );
    await initializeLibrary(database, 'en');
    expect(await database.notes.get(later.id)).toEqual(later);
  });

  it('updates the guide language while retaining user organization and reading state', async () => {
    await initializeLibrary(database);
    await database.folders.add({
      id: 'mine',
      name: 'Keep here',
      parentId: null,
    });
    await database.notes.update(GUIDE_ID, {
      folderId: 'mine',
      favorite: true,
      openedAt: 123,
      position: 456,
    });
    const original = (await database.notes.get(GUIDE_ID))!;

    await initializeLibrary(database, 'pl');

    const polish = (await database.notes.get(GUIDE_ID))!;
    expect(polish).toMatchObject({
      id: original.id,
      folderId: 'mine',
      favorite: true,
      openedAt: 123,
      position: 456,
      createdAt: original.createdAt,
      sample: true,
      source: extractSource(getGuide('pl').source),
      title: getGuide('pl').title,
      description: getGuide('pl').description,
      subject: getGuide('pl').subject,
    });
    await initializeLibrary(database, 'pl');
    expect(await database.notes.get(GUIDE_ID)).toEqual(polish);
    await initializeLibrary(database, 'en');
    expect((await database.notes.get(GUIDE_ID))?.source).toBe(original.source);
    expect((await database.notes.get(GUIDE_ID))?.folderId).toBe('mine');
    expect(await database.notes.count()).toBe(1);
  });

  it('upgrades an untouched earlier guide revision in the same language while retaining personal state', async () => {
    const currentGuide = getGuide('en');
    const previousGuide = {
      ...currentGuide,
      source:
        '---\ntitle: "An earlier LearnMD guide"\nversion: "1.0"\n---\n\n# An earlier LearnMD guide\n\nThis is the older shipped introduction.',
    };
    // Seed through the real initializer to persist the previous release's
    // ownership snapshot, rather than constructing its private representation.
    const oldRelease = vi
      .spyOn(guideContent, 'getGuide')
      .mockReturnValue(previousGuide);
    try {
      await initializeLibrary(database, 'en');
    } finally {
      oldRelease.mockRestore();
    }
    await database.folders.add({
      id: 'guide-folder',
      name: 'My useful notes',
      parentId: null,
      icon: 'book',
    });
    await database.notes.update(GUIDE_ID, {
      folderId: 'guide-folder',
      favorite: true,
      openedAt: 987,
      position: 321,
    });
    const original = (await database.notes.get(GUIDE_ID))!;
    const personalCopy = await importNote(
      previousGuide.source,
      'guide-folder',
      {},
      database,
    );
    expect(original.source).toBe(extractSource(previousGuide.source));
    database.close();
    await database.open();

    await initializeLibrary(database, 'en');

    const updated = (await database.notes.get(GUIDE_ID))!;
    expect(updated).toMatchObject({
      id: original.id,
      source: extractSource(currentGuide.source),
      title: currentGuide.title,
      description: currentGuide.description,
      subject: currentGuide.subject,
      folderId: 'guide-folder',
      favorite: true,
      openedAt: 987,
      position: 321,
      createdAt: original.createdAt,
      sample: true,
    });
    expect(await database.notes.get(personalCopy.id)).toEqual(personalCopy);
    expect(await database.notes.count()).toBe(2);
    await initializeLibrary(database, 'en');
    expect(await database.notes.get(GUIDE_ID)).toEqual(updated);
  });

  it.each([
    ['source', { source: noteSource }],
    ['title', { title: 'My personal guide' }],
    ['description', { description: 'My own annotation' }],
    ['subject', { subject: 'My subject' }],
    ['tags', { tags: ['personal'] }],
  ])(
    'preserves a customized guide %s and permanently relinquishes ownership',
    async (_field, changes) => {
      await initializeLibrary(database);
      const original = (await database.notes.get(GUIDE_ID))!;
      await database.notes.update(GUIDE_ID, changes);
      const customized = await database.notes.get(GUIDE_ID);
      await initializeLibrary(database, 'pl');
      expect(await database.notes.get(GUIDE_ID)).toEqual(customized);
      expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeUndefined();
      await database.notes.put(original);
      await initializeLibrary(database, 'pl');
      expect(await database.notes.get(GUIDE_ID)).toEqual(original);
    },
  );

  it('does not localize an imported replacement even when its source matches the original guide', async () => {
    await initializeLibrary(database);
    const replacement = await importNote(
      getGuide('en').source,
      null,
      { replaceId: GUIDE_ID },
      database,
    );
    await initializeLibrary(database, 'pl');
    expect(await database.notes.get(GUIDE_ID)).toEqual(replacement);
    expect(replacement.sample).toBe(false);
    expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeUndefined();
  });

  it('does not adopt a preexisting colliding record merely because it has a sample flag', async () => {
    const original = await importNote(
      getGuide('en').source,
      null,
      { id: GUIDE_ID, sample: true },
      database,
    );
    await initializeLibrary(database, 'pl');
    await initializeLibrary(database, 'pl');
    expect(await database.notes.get(GUIDE_ID)).toEqual(original);
    expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeUndefined();
  });

  it('preserves backup-restored sample copies as user notes and does not restore a deleted guide', async () => {
    const backupDatabase = new LibraryDB(
      `learnmd-backup-${crypto.randomUUID()}`,
    );
    let backup: string;
    try {
      await importNote(
        '# Retained old sample copy',
        null,
        { id: LEGACY_SAMPLE_IDS[0], sample: true },
        backupDatabase,
      );
      await importNote(
        getGuide('en').source,
        null,
        { id: GUIDE_ID, sample: true },
        backupDatabase,
      );
      backup = await exportLibrary(backupDatabase);
    } finally {
      await backupDatabase.delete();
    }
    await restoreLibrary(backup, database);
    const restored = await database.notes.toArray();
    expect(restored.every((note) => !note.sample)).toBe(true);
    await initializeLibrary(database, 'pl');
    await deleteNote(GUIDE_ID, database);
    await initializeLibrary(database, 'en');
    expect(await database.notes.toArray()).toEqual(restored);
  });

  it('keeps colliding user records when initializing an existing unmarked library', async () => {
    const original = await importNote(
      noteSource,
      null,
      { id: GUIDE_ID },
      database,
    );
    await initializeLibrary(database, 'pl');
    await initializeLibrary(database, 'en');
    expect(await database.notes.get(original.id)).toEqual(original);
    expect(await database.notes.count()).toBe(1);
    expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toBeUndefined();
    await deleteNote(GUIDE_ID, database);
    await initializeLibrary(database);
    expect(await database.notes.count()).toBe(0);
  });

  it('rolls back migration, partial seeding, and markers together when setup fails', async () => {
    const originalFolder = {
      id: 'sample-folder-0',
      name: 'Mathematics',
      parentId: null,
    };
    await database.folders.add(originalFolder);
    const legacy = await importNote(
      '# Old sample',
      originalFolder.id,
      {
        id: LEGACY_SAMPLE_IDS[0],
        sample: true,
        assets: [
          { path: 'old.png', blob: new Blob(['old'], { type: 'image/png' }) },
        ],
      },
      database,
    );
    const originalAssets = await database.assets.toArray();
    const failSeed = (id: unknown) => {
      if (id === GUIDE_ID) throw new Error('Simulated storage failure');
    };
    database.notes.hook('creating', failSeed);
    await expect(initializeLibrary(database)).rejects.toThrow(
      'Simulated storage failure',
    );
    database.notes.hook('creating').unsubscribe(failSeed);
    expect(await database.folders.get(originalFolder.id)).toEqual(
      originalFolder,
    );
    expect(await database.notes.toArray()).toEqual([legacy]);
    expect(await database.assets.toArray()).toEqual(originalAssets);
    expect(await database.settings.count()).toBe(0);
  });

  it('rolls back localized source and ownership together when an update fails', async () => {
    await initializeLibrary(database);
    const original = await database.notes.get(GUIDE_ID);
    const ownership = await database.settings.get(GUIDE_OWNERSHIP_KEY);
    const failOwnershipUpdate = (_changes: unknown, key: unknown) => {
      if (key === GUIDE_OWNERSHIP_KEY)
        throw new Error('Simulated ownership write failure');
    };
    database.settings.hook('updating', failOwnershipUpdate);
    await expect(initializeLibrary(database, 'pl')).rejects.toThrow(
      'Simulated ownership write failure',
    );
    database.settings.hook('updating').unsubscribe(failOwnershipUpdate);
    expect(await database.notes.get(GUIDE_ID)).toEqual(original);
    expect(await database.settings.get(GUIDE_OWNERSHIP_KEY)).toEqual(ownership);
    await initializeLibrary(database, 'pl');
    expect((await database.notes.get(GUIDE_ID))?.source).toBe(
      extractSource(getGuide('pl').source),
    );
  });
});
