import { SAMPLES } from './content/samples';
import { db, importNote, type Folder, type LibraryDB } from './storage';

export const STARTER_FOLDER_MIGRATION_KEY =
  'migration:remove-starter-folders:v1';

const originalStarterNames: Record<string, string> = {
  'sample-folder-0': 'Mathematics',
  'sample-folder-1': 'Computer science',
  'sample-folder-2': 'Natural sciences',
  'sample-folder-3': 'Humanities',
};

/** Initialize example notes at root and retire untouched legacy starter folders. */
export async function initializeLibrary(
  database: LibraryDB = db,
): Promise<void> {
  await database.transaction(
    'rw',
    database.notes,
    database.folders,
    database.assets,
    database.settings,
    async () => {
      if (!(await database.settings.get(STARTER_FOLDER_MIGRATION_KEY))) {
        const folders = await database.folders.toArray();
        const byId = new Map<string, Folder>(
          folders.map((folder) => [folder.id, folder]),
        );
        const removed = new Set(
          folders
            .filter(
              (folder) =>
                Object.hasOwn(originalStarterNames, folder.id) &&
                originalStarterNames[folder.id] === folder.name &&
                // Original starters had no icon. An explicit choice is a customization.
                folder.icon === undefined,
            )
            .map((folder) => folder.id),
        );
        const retainedParent = (
          parentId: string | null,
          childId?: string,
        ): string | null => {
          const seen = new Set<string>();
          let cursor = parentId;
          while (cursor) {
            if (cursor === childId || seen.has(cursor)) return null;
            seen.add(cursor);
            const parent = byId.get(cursor);
            if (!parent) return null;
            if (!removed.has(cursor)) return cursor;
            cursor = parent.parentId;
          }
          return null;
        };
        for (const id of removed) {
          const destination = retainedParent(byId.get(id)!.parentId);
          await database.notes
            .where('folderId')
            .equals(id)
            .modify({ folderId: destination });
        }
        for (const folder of folders) {
          if (
            !removed.has(folder.id) &&
            folder.parentId &&
            removed.has(folder.parentId)
          ) {
            await database.folders.update(folder.id, {
              parentId: retainedParent(folder.parentId, folder.id),
            });
          }
        }
        await database.folders.bulkDelete([...removed]);
        await database.settings.put({
          key: STARTER_FOLDER_MIGRATION_KEY,
          value: 'true',
        });
      }
      if (!(await database.settings.get('initialized'))) {
        for (const sample of SAMPLES) {
          // A user record with the same ID must never be overwritten during setup.
          if (await database.notes.get(sample.id)) continue;
          await importNote(
            sample.source,
            null,
            { sample: true, id: sample.id },
            database,
          );
        }
        await database.settings.put({ key: 'initialized', value: 'true' });
      }
    },
  );
}
