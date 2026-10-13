import type { ReactNode } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from './ImportDialog';
import { db, importNote, type Folder, type Note } from '../storage';
import { I18nProvider, LANGUAGE_KEY } from '../i18n';

vi.mock('./Modal', () => ({
  Modal: ({ children, title }: { children: ReactNode; title: string }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));

beforeEach(async () => {
  await db.notes.clear();
  await db.assets.clear();
  await db.folders.clear();
  localStorage.removeItem(LANGUAGE_KEY);
});

const source = (title: string, body = 'An explanation to remember.') =>
  `---\ntitle: "${title}"\nversion: "1.0"\n---\n\n${body}`;
function mount(
  notes: Note[] = [],
  folders: Folder[] = [],
  initialFolder: string | null = null,
) {
  const onImported = vi.fn();
  const onGenerate = vi.fn();
  const { container } = render(
    <ImportDialog
      notes={notes}
      folders={folders}
      initialFolder={initialFolder}
      onClose={() => {}}
      onImported={onImported}
      onGenerate={onGenerate}
    />,
  );
  return { onImported, onGenerate, container };
}
async function paste(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /LearnMD source/ }), {
    target: { value },
  });
  await screen.findByText(/words · ready to import/);
}

describe('import choices', () => {
  it('offers direct navigation to generation and a plain import introduction', async () => {
    const user = userEvent.setup();
    const { onGenerate } = mount();
    expect(screen.getByText('Import notes from anywhere.')).toBeVisible();
    expect(
      screen.queryByText(/Make understanding your own/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate notes' }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('defaults a unique title to New note with no redundant copy option', async () => {
    const user = userEvent.setup();
    const existing = await importNote(source('Existing chapter'), null);
    const { onImported } = mount([existing]);
    await paste(source('A new chapter'));
    const choice = screen.getByRole('combobox', { name: 'Import as' });
    expect(choice).toHaveValue('new');
    expect(
      within(choice)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['New note', 'Replace existing note…']);
    await user.click(screen.getByRole('button', { name: 'Import & open' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(await db.notes.count()).toBe(2);
    expect((await db.notes.get(existing.id))?.source).toBe(existing.source);
  });

  it('requires an explicit duplicate-title choice and creates a separate note when New note is chosen', async () => {
    const user = userEvent.setup();
    const existing = await importNote(
      source('Repeated title', 'Original explanation.'),
      null,
    );
    const { onImported } = mount([existing]);
    await paste(source('Repeated title', 'Second explanation.'));
    const choice = screen.getByRole('combobox', { name: 'Import as' });
    expect(choice).toHaveValue('');
    expect(
      within(choice).getByRole('option', { name: 'Choose an import action' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Import & open' }),
    ).toBeDisabled();
    await user.selectOptions(choice, 'new');
    await user.click(screen.getByRole('button', { name: 'Import & open' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(await db.notes.count()).toBe(2);
    expect((await db.notes.get(existing.id))?.source).toBe(existing.source);
    expect(onImported.mock.calls[0][0]).not.toBe(existing.id);
  });

  it('requires a replacement target again after any source edit and only replaces the chosen note', async () => {
    const user = userEvent.setup();
    const existing = await importNote(
      source('Repeated title', 'Original explanation.'),
      null,
    );
    existing.favorite = true;
    await db.notes.put(existing);
    const other = await importNote(source('Another chapter'), null);
    const { onImported } = mount([existing, other]);
    await paste(source('Repeated title', 'Replacement draft.'));
    const choice = screen.getByRole('combobox', { name: 'Import as' });
    await user.selectOptions(choice, 'replace');
    expect(
      screen.getByRole('combobox', { name: /Note to replace/ }),
    ).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Replace & open' }),
    ).toBeDisabled();
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Note to replace/ }),
      existing.id,
    );
    expect(
      screen.getByRole('button', { name: 'Replace & open' }),
    ).toBeEnabled();
    const finalSource = source('Repeated title', 'Revised replacement draft.');
    fireEvent.change(screen.getByRole('textbox', { name: /LearnMD source/ }), {
      target: { value: finalSource },
    });
    expect(
      screen.queryByRole('combobox', { name: /Note to replace/ }),
    ).not.toBeInTheDocument();
    expect(choice).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Import & open' }),
    ).toBeDisabled();
    await user.selectOptions(choice, 'replace');
    expect(
      screen.getByRole('combobox', { name: /Note to replace/ }),
    ).toHaveValue('');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Note to replace/ }),
      existing.id,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Replace & open' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Replace & open' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(existing.id));
    expect(await db.notes.count()).toBe(2);
    expect(await db.notes.get(existing.id)).toMatchObject({
      source: finalSource,
      favorite: true,
    });
    expect(await db.notes.get(other.id)).toEqual(other);
  });

  it('localizes the generation and import actions into Polish', () => {
    localStorage.setItem(LANGUAGE_KEY, 'pl');
    render(
      <I18nProvider>
        <ImportDialog
          notes={[]}
          folders={[]}
          initialFolder={null}
          onClose={() => {}}
          onImported={() => {}}
          onGenerate={() => {}}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Generuj notatki' }),
    ).toBeVisible();
    const choice = screen.getByRole('combobox', { name: 'Importuj jako' });
    expect(
      within(choice).getByRole('option', { name: 'Nowa notatka' }),
    ).toBeVisible();
    expect(
      within(choice).getByRole('option', {
        name: 'Zastąp istniejącą notatkę…',
      }),
    ).toBeDisabled();
    localStorage.removeItem(LANGUAGE_KEY);
  });
});

describe('folders created during import', () => {
  it('creates a trimmed root folder together with the pasted note', async () => {
    const user = userEvent.setup();
    const { onImported } = mount();
    await paste(source('Cell structure'));
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const destination = screen.getByRole('combobox', { name: 'Save to' });
    expect(
      within(destination).getByRole('option', { selected: true }),
    ).toHaveTextContent('New folder');
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      '  Biology  ',
    );
    expect(
      within(destination).getByRole('option', { selected: true }),
    ).toHaveTextContent('Biology');
    await user.clear(screen.getByRole('textbox', { name: 'Folder name' }));
    expect(
      within(destination).getByRole('option', { selected: true }),
    ).toHaveTextContent('New folder');
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      '  Cell biology  ',
    );
    expect(
      within(destination).getByRole('option', { selected: true }),
    ).toHaveTextContent('Cell biology');
    expect(await db.folders.count()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Import & open' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());

    const folders = await db.folders.toArray();
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({
      name: 'Cell biology',
      parentId: null,
      icon: 'folder',
    });
    expect(await db.notes.get(onImported.mock.calls[0][0])).toMatchObject({
      title: 'Cell structure',
      folderId: folders[0].id,
    });
  });

  it('imports every selected file into one new nested folder', async () => {
    const user = userEvent.setup();
    const parent: Folder = {
      id: 'biology',
      name: 'Biology',
      parentId: null,
    };
    await db.folders.add(parent);
    const { onImported, container } = mount([], [parent], parent.id);
    await user.click(screen.getByRole('button', { name: 'Import files' }));
    const files = ['Cells', 'Tissues'].map((title) => {
      const contents = source(title);
      const file = new File([contents], `${title}.learn.md`, {
        type: 'text/markdown',
      });
      Object.defineProperty(file, 'text', {
        value: async () => contents,
      });
      return file;
    });
    fireEvent.change(container.querySelector('input[type="file"][accept]')!, {
      target: { files },
    });
    await screen.findByText('Tissues.learn.md');
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    expect(screen.getByRole('combobox', { name: 'Parent folder' })).toHaveValue(
      parent.id,
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'First semester',
    );
    await user.click(screen.getByRole('button', { name: 'Import & open' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());

    const folders = await db.folders.toArray();
    expect(folders).toHaveLength(2);
    const created = folders.find((folder) => folder.id !== parent.id)!;
    expect(created).toMatchObject({
      name: 'First semester',
      parentId: parent.id,
    });
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(2);
    expect(notes.map((note) => note.title).sort()).toEqual([
      'Cells',
      'Tissues',
    ]);
    expect(notes.every((note) => note.folderId === created.id)).toBe(true);
  });

  it('blocks a blank folder name and can cancel creation without losing the destination', async () => {
    const user = userEvent.setup();
    const parent: Folder = {
      id: 'biology',
      name: 'Biology',
      parentId: null,
    };
    await db.folders.add(parent);
    const { onImported } = mount([], [parent], parent.id);
    await paste(source('Cell structure'));
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const importButton = screen.getByRole('button', { name: 'Import & open' });
    expect(importButton).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      '   ',
    );
    expect(importButton).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'Discarded draft',
    );
    expect(importButton).toBeEnabled();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Parent folder' }),
      '',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('textbox', { name: 'Folder name' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Save to' })).toHaveValue(
      parent.id,
    );
    expect(
      screen.queryByRole('option', { name: 'Discarded draft' }),
    ).not.toBeInTheDocument();
    await user.click(importButton);
    await waitFor(() => expect(onImported).toHaveBeenCalledOnce());
    expect(await db.folders.toArray()).toEqual([parent]);
    expect(await db.notes.get(onImported.mock.calls[0][0])).toMatchObject({
      folderId: parent.id,
    });
  });

  it('rolls back the new folder when the selected replacement note has been removed', async () => {
    const user = userEvent.setup();
    const existing = await importNote(source('Cell structure'), null);
    const { onImported } = mount([existing]);
    await paste(source('Cell structure', 'A revised explanation.'));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Import as' }),
      'replace',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Note to replace/ }),
      existing.id,
    );
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'Biology',
    );
    await db.notes.delete(existing.id);
    await user.click(screen.getByRole('button', { name: 'Replace & open' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The document selected for replacement no longer exists.',
    );
    expect(await db.folders.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('does not create an orphan folder when its selected parent has been removed', async () => {
    const user = userEvent.setup();
    const parent: Folder = {
      id: 'biology',
      name: 'Biology',
      parentId: null,
    };
    await db.folders.add(parent);
    const { onImported } = mount([], [parent], parent.id);
    await paste(source('Cell structure'));
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'First semester',
    );
    await db.folders.delete(parent.id);
    await user.click(screen.getByRole('button', { name: 'Import & open' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /folder.*no longer exists/i,
    );
    expect(await db.folders.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(onImported).not.toHaveBeenCalled();
  });
});
