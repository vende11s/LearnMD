/** Stable IDs stored in local folders and LearnMD v1 backups. */
export const FOLDER_ICON_IDS = [
  'folder',
  'book',
  'graduation-cap',
  'lightbulb',
  'flask',
  'code',
  'calculator',
  'globe',
  'leaf',
  'music',
  'palette',
  'briefcase',
  'heart',
  'star',
  'target',
  'bookmark',
] as const;

export type FolderIconId = (typeof FOLDER_ICON_IDS)[number];

export function isFolderIcon(value: unknown): value is FolderIconId {
  return (
    typeof value === 'string' &&
    (FOLDER_ICON_IDS as readonly string[]).includes(value)
  );
}

/** Legacy folders and unexpected local values retain a usable folder glyph. */
export function normalizeFolderIcon(value: unknown): FolderIconId {
  return isFolderIcon(value) ? value : 'folder';
}
