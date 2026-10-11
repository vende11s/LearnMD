import { useState, type ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderGlyph, FolderIconPicker } from './FolderIcon';
import { ManageDialog } from './ManageDialog';
import { db, type Folder } from '../storage';
import type { FolderIconId } from '../folderIcons';
import { I18nProvider, LANGUAGE_KEY } from '../i18n';

vi.mock('./Modal', () => ({
  Modal: ({ children, title }: { children: ReactNode; title: string }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));

beforeEach(async () => {
  await db.folders.clear();
  await db.notes.clear();
  localStorage.removeItem(LANGUAGE_KEY);
});

describe('folder icons', () => {
  it('uses native accessible choices, previews changes, and supports radio arrow navigation', async () => {
    const user = userEvent.setup();
    function Picker() {
      const [value, setValue] = useState<FolderIconId>('folder');
      return <FolderIconPicker value={value} onChange={setValue} />;
    }
    const { container } = render(<Picker />);
    expect(screen.getByRole('group', { name: 'Folder icon' })).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(16);
    const book = screen.getByRole('radio', { name: 'Book' });
    await user.click(book);
    expect(book).toBeChecked();
    expect(
      container.querySelector('.folder-icon-preview [data-folder-icon]'),
    ).toHaveAttribute('data-folder-icon', 'book');
    book.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Graduation cap' })).toBeChecked();
    expect(
      container.querySelector('.folder-icon-preview [data-folder-icon]'),
    ).toHaveAttribute('data-folder-icon', 'graduation-cap');
  });

  it('localizes accessible labels and falls back safely for old or unknown icons', () => {
    localStorage.setItem(LANGUAGE_KEY, 'pl');
    const { container } = render(
      <I18nProvider>
        <FolderIconPicker value="book" onChange={() => {}} />
        <FolderGlyph icon="unknown-image" className="legacy-icon" />
      </I18nProvider>,
    );
    expect(screen.getByRole('group', { name: 'Ikona folderu' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Książka' })).toBeChecked();
    expect(container.querySelector('.legacy-icon')).toHaveAttribute(
      'data-folder-icon',
      'folder',
    );
    localStorage.removeItem(LANGUAGE_KEY);
  });

  it('saves a chosen icon when creating a nested folder', async () => {
    const user = userEvent.setup();
    const parent: Folder = {
      id: 'reading',
      name: 'My reading',
      parentId: null,
      icon: 'book',
    };
    await db.folders.add(parent);
    const onClose = vi.fn();
    render(
      <ManageDialog
        target={null}
        newFolder
        folderId={parent.id}
        notes={[]}
        folders={[parent]}
        onClose={onClose}
        onRemoved={() => {}}
        onError={() => {}}
      />,
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'Field notes',
    );
    await user.click(screen.getByRole('radio', { name: 'Globe' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = (await db.folders.toArray()).find(
      (folder) => folder.name === 'Field notes',
    );
    expect(saved).toMatchObject({ icon: 'globe', parentId: parent.id });
  });

  it('keeps an existing root folder at root when renamed from inside that folder', async () => {
    const user = userEvent.setup();
    const folder: Folder = {
      id: 'writing',
      name: 'Writing',
      parentId: null,
      icon: 'palette',
    };
    await db.folders.add(folder);
    const onClose = vi.fn();
    render(
      <ManageDialog
        target={{ type: 'folder', id: folder.id }}
        newFolder={false}
        folderId={folder.id}
        notes={[]}
        folders={[folder]}
        onClose={onClose}
        onRemoved={() => {}}
        onError={() => {}}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Parent folder' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('radio', { name: 'Palette' })).toBeChecked();
    await user.clear(screen.getByRole('textbox', { name: 'Folder name' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'Creative writing',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await db.folders.get(folder.id)).toMatchObject({
      name: 'Creative writing',
      parentId: null,
      icon: 'palette',
    });
  });

  it('preserves the selected icon while moving a folder', async () => {
    const user = userEvent.setup();
    const folders: Folder[] = [
      { id: 'parent-a', name: 'First', parentId: null },
      { id: 'parent-b', name: 'Second', parentId: null },
      { id: 'child', name: 'Experiments', parentId: 'parent-a', icon: 'flask' },
    ];
    await db.folders.bulkAdd(folders);
    const onClose = vi.fn();
    render(
      <ManageDialog
        target={{ type: 'folder', id: 'child' }}
        newFolder={false}
        folderId="parent-a"
        notes={[]}
        folders={folders}
        onClose={onClose}
        onRemoved={() => {}}
        onError={() => {}}
      />,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Parent folder' }),
      'parent-b',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await db.folders.get('child')).toMatchObject({
      parentId: 'parent-b',
      icon: 'flask',
      name: 'Experiments',
    });
  });
});
