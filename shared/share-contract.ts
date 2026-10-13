/** Portable snapshots; the hosting service must never receive library state. */
export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SHARE_BYTES = 20 * 1024 * 1024;
export const SHARE_ENTRY_LIMITS = Object.freeze({
  notes: 500,
  folders: 500,
  assets: 1000,
});

export interface ShareBundle {
  format: 'learnmd-share';
  version: 1;
  kind: 'note' | 'folder';
  title: string;
  notes: {
    id: string;
    title: string;
    source: string;
    folderId: string | null;
  }[];
  folders: {
    id: string;
    name: string;
    parentId: string | null;
    icon?: string;
  }[];
  assets: {
    noteId: string;
    path: string;
    type: string;
    /** Standard base64 without a data URL prefix. */
    data: string;
  }[];
}

export interface ShareTarget {
  type: 'note' | 'folder';
  id: string;
}
