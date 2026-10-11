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
import { db, importNote, type Note } from '../storage';
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
function mount(notes: Note[] = []) {
  const onImported = vi.fn();
  const onGenerate = vi.fn();
  render(
    <ImportDialog
      notes={notes}
      folders={[]}
      initialFolder={null}
      onClose={() => {}}
      onImported={onImported}
      onGenerate={onGenerate}
    />,
  );
  return { onImported, onGenerate };
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
