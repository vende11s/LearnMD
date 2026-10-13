import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShareBundle } from '../../shared/share-contract';
import * as parser from '../format/parser';
import { LibraryDB } from '../storage';
import {
  buildShareBundle,
  importShareBundle,
  validateShareBundle,
} from './bundle';
import { SHARE_SOURCE_LIMITS, ShareSourceLimitError } from './sourceBudget';

function pack(sources: string[]): ShareBundle {
  return {
    format: 'learnmd-share',
    version: 1,
    kind: 'folder',
    title: 'Course',
    folders: [{ id: 'course', name: 'Course', parentId: null }],
    assets: [],
    notes: sources.map((source, index) => ({
      id: `n${index}`,
      title: `Chapter ${index}`,
      folderId: 'course',
      source,
    })),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('combined bundle limits before Markdown parsing', () => {
  it('rejects the 450 KB repeated-heading attack without parsing any note', () => {
    const parse = vi.spyOn(parser, 'parseLearnMD');
    const source = '# Repeat\n\n'.repeat(9000);
    const attack = pack(Array(5).fill(source));
    expect(
      attack.notes.reduce((sum, note) => sum + note.source.length, 0),
    ).toBe(450_000);
    expect(() => validateShareBundle(attack)).toThrow(ShareSourceLimitError);
    expect(parse).not.toHaveBeenCalled();
  });

  it.each(['characters', 'lines', 'delimiters'] as const)(
    'checks all notes before parsing when only the final note exceeds %s',
    (limit) => {
      const source =
        limit === 'characters'
          ? 'a'.repeat(SHARE_SOURCE_LIMITS.characters / 2)
          : limit === 'lines'
            ? '# x\r'.repeat(SHARE_SOURCE_LIMITS.lines / 2 - 1)
            : '[]'.repeat(SHARE_SOURCE_LIMITS.delimiters / 4);
      const extra = limit === 'lines' ? 'a\rb' : '*';
      const parse = vi.spyOn(parser, 'parseLearnMD');
      expect(() => validateShareBundle(pack([source, source, extra]))).toThrow(
        ShareSourceLimitError,
      );
      expect(parse).not.toHaveBeenCalled();
    },
  );

  it('does not count bundled image bytes as Markdown complexity', () => {
    const bundle = pack(['# Graph\n\n![Graph](graph.png)']);
    bundle.assets = [
      {
        noteId: 'n0',
        path: 'graph.png',
        type: 'image/png',
        data: 'AAAA'.repeat(300_000),
      },
    ];
    expect(validateShareBundle(bundle).assets[0].data.length).toBe(1_200_000);
  });

  it('rejects before reference parsing on export and before writes on import', async () => {
    const database = new LibraryDB(`budget-test-${crypto.randomUUID()}`);
    try {
      const attack = pack(Array(5).fill('# Repeat\n\n'.repeat(9000)));
      const { id, name, parentId } = attack.folders[0];
      await database.folders.add({ id, name, parentId });
      await database.notes.bulkAdd(
        attack.notes.map((note) => ({
          ...note,
          description: '',
          subject: '',
          tags: [],
          favorite: false,
          sample: false,
          createdAt: 1,
          updatedAt: 1,
          openedAt: 0,
          position: 0,
        })),
      );
      const parse = vi.spyOn(parser, 'parseLearnMD');
      await expect(
        buildShareBundle({ type: 'folder', id: 'course' }, database),
      ).rejects.toThrow(ShareSourceLimitError);
      await expect(
        importShareBundle(attack, null, 'test-share', database),
      ).rejects.toThrow(ShareSourceLimitError);
      expect(parse).not.toHaveBeenCalled();
      expect(await database.notes.count()).toBe(5);
      expect(await database.folders.count()).toBe(1);
      expect(await database.settings.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });
});
