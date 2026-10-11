import {
  getGuide,
  GUIDE_ID,
  LEGACY_SAMPLE_IDS,
  type GuideLanguage,
} from './content/guide';
import { parseLearnMD } from './format/parser';
import {
  db,
  extractSource,
  importNote,
  type Folder,
  type LibraryDB,
  type Note,
} from './storage';

export const STARTER_FOLDER_MIGRATION_KEY =
  'migration:remove-starter-folders:v1';
export const GUIDE_MIGRATION_KEY = 'migration:single-guide:v1';
export const GUIDE_OWNERSHIP_KEY = 'builtin:guide:ownership:v1';

// User organization and reading state do not change ownership. Content edits,
// renamed notes, imported replacements, and newly created records do.
function ownershipSnapshot(note: Note): string {
  return JSON.stringify([
    note.source,
    note.title,
    note.description,
    note.subject,
    note.tags,
    note.createdAt,
  ]);
}

const originalStarterNames: Record<string, string> = {
  'sample-folder-0': 'Mathematics',
  'sample-folder-1': 'Computer science',
  'sample-folder-2': 'Natural sciences',
  'sample-folder-3': 'Humanities',
};

/** Seed one removable guide and localize only the untouched built-in record. */
export async function initializeLibrary(
  database: LibraryDB = db,
  language: GuideLanguage = 'en',
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
      if (!(await database.settings.get(GUIDE_MIGRATION_KEY))) {
        for (const id of LEGACY_SAMPLE_IDS) {
          const legacy = await database.notes.get(id);
          // Restored backups and imported replacements belong to the user.
          if (legacy?.sample !== true) continue;
          await database.assets.where('noteId').equals(id).delete();
          await database.notes.delete(id);
        }
        // A colliding user record must never be overwritten or adopted.
        if (!(await database.notes.get(GUIDE_ID))) {
          const guide = await importNote(
            getGuide(language).source,
            null,
            { sample: true, id: GUIDE_ID },
            database,
          );
          await database.settings.put({
            key: GUIDE_OWNERSHIP_KEY,
            value: ownershipSnapshot(guide),
          });
        } else {
          await database.settings.delete(GUIDE_OWNERSHIP_KEY);
        }
        await database.settings.put({ key: 'initialized', value: 'true' });
        await database.settings.put({
          key: GUIDE_MIGRATION_KEY,
          value: 'true',
        });
        return;
      }

      const ownership = await database.settings.get(GUIDE_OWNERSHIP_KEY);
      if (!ownership) return;
      const guide = await database.notes.get(GUIDE_ID);
      if (
        !guide ||
        guide.sample !== true ||
        ownershipSnapshot(guide) !== ownership.value
      ) {
        // Deletion or customization permanently ends automatic updates.
        await database.settings.delete(GUIDE_OWNERSHIP_KEY);
        return;
      }

      const source = extractSource(getGuide(language).source);
      if (source === guide.source) return;
      const parsed = parseLearnMD(source);
      if (
        parsed.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
      )
        throw new Error('The built-in LearnMD guide contains invalid source.');
      const updated: Note = {
        ...guide,
        source,
        title: parsed.metadata.title,
        description: parsed.metadata.description ?? '',
        subject: parsed.metadata.subject ?? 'Personal notes',
        tags: parsed.metadata.tags,
        updatedAt: Date.now(),
      };
      await database.notes.put(updated);
      await database.settings.put({
        key: GUIDE_OWNERSHIP_KEY,
        value: ownershipSnapshot(updated),
      });
    },
  );
}
