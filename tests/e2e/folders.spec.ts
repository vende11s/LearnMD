import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ locale: 'en-US' });

type StoredFolder = {
  id: string;
  name: string;
  parentId: string | null;
  icon?: string;
};

async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.note-card')).toHaveCount(1);
}

async function openMobileNavigation(page: Page) {
  const button = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  if (await button.isVisible()) await button.click();
}

async function createFolder(
  page: Page,
  name: string,
  icon: string,
  parent?: string,
) {
  await page
    .getByRole('button', { name: 'Create folder', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Folder name', { exact: true }).fill(name);
  await dialog.getByRole('radio', { name: icon, exact: true }).check();
  if (parent)
    await dialog
      .getByRole('combobox', { name: 'Parent folder', exact: true })
      .selectOption({ label: parent });
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: `Manage folder ${name}`, exact: true }),
  ).toBeVisible();
}

function rowFor(page: Page, name: string) {
  return page.locator('.folder-row').filter({
    has: page.getByRole('button', {
      name: `Manage folder ${name}`,
      exact: true,
    }),
  });
}

async function readFolders(page: Page): Promise<StoredFolder[]> {
  return page.evaluate(
    () =>
      new Promise<StoredFolder[]>((resolve, reject) => {
        const request = indexedDB.open('learnmd-library');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const read = database
            .transaction('folders')
            .objectStore('folders')
            .getAll();
          read.onsuccess = () => {
            resolve(read.result as StoredFolder[]);
            database.close();
          };
          read.onerror = () => {
            reject(read.error);
            database.close();
          };
        };
      }),
  );
}

test('a fresh library has one root-level guide and offers an empty custom-folder area', async ({
  page,
}, testInfo) => {
  await start(page);
  const folders = page.getByRole('navigation', {
    name: 'Folders',
    exact: true,
  });
  await expect(folders.locator('.folder-row')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create folder', exact: true }),
  ).toBeVisible();
  const emptyAction = page.getByRole('button', {
    name: 'Create your first folder',
    exact: true,
  });
  await expect(emptyAction).toBeVisible();
  expect(await readFolders(page)).toEqual([]);
  const noteFolders = await page.evaluate(
    () =>
      new Promise<(string | null)[]>((resolve, reject) => {
        const request = indexedDB.open('learnmd-library');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const read = database
            .transaction('notes')
            .objectStore('notes')
            .getAll();
          read.onsuccess = () => {
            resolve(
              read.result.map(
                (note: { folderId: string | null }) => note.folderId,
              ),
            );
            database.close();
          };
          read.onerror = () => {
            reject(read.error);
            database.close();
          };
        };
      }),
  );
  expect(noteFolders).toEqual([null]);

  await emptyAction.click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('group', { name: 'Folder icon', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('radio', { name: 'Folder', exact: true }),
  ).toBeChecked();
  await expect(dialog.getByRole('radio')).toHaveCount(16);
  await dialog
    .getByLabel('Folder name', { exact: true })
    .fill('My own subject');
  await dialog.getByRole('radio', { name: 'Book', exact: true }).check();
  await page.screenshot({
    path: testInfo.outputPath('folder-picker-desktop.png'),
  });
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await expect(emptyAction).toBeVisible();
  expect(await readFolders(page)).toEqual([]);
});

test('custom folder icons persist, can be changed, and survive nested backup restoration', async ({
  page,
}, testInfo) => {
  await start(page);
  await createFolder(page, 'My study collection', 'Book');
  await expect(
    rowFor(page, 'My study collection').locator('[data-folder-icon="book"]'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create your first folder', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    rowFor(page, 'My study collection').locator('[data-folder-icon="book"]'),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Manage folder My study collection',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('radio', { name: 'Book', exact: true }),
  ).toBeChecked();
  await dialog.getByRole('radio', { name: 'Globe', exact: true }).check();
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    rowFor(page, 'My study collection').locator('[data-folder-icon="globe"]'),
  ).toBeVisible();

  await createFolder(page, 'Week one', 'Code', 'My study collection');
  await expect(
    rowFor(page, 'Week one').locator('[data-folder-icon="code"]'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Collapse My study collection', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Manage folder Week one', exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole('button', { name: 'Expand My study collection', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Manage folder Week one', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export library', exact: true })
    .click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('folder-icons-backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
    format: string;
    folders: StoredFolder[];
  };
  expect(backup.format).toBe('learnmd-backup');
  expect(backup.folders).toHaveLength(2);
  const parent = backup.folders.find(
    (folder) => folder.name === 'My study collection',
  )!;
  const child = backup.folders.find((folder) => folder.name === 'Week one')!;
  expect(parent).toMatchObject({ icon: 'globe', parentId: null });
  expect(child).toMatchObject({ icon: 'code', parentId: parent.id });

  await page
    .locator('.settings-page input[type=file]')
    .setInputFiles(backupPath);
  await expect(
    page.getByText('Restored 1 note as a new copy.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.folder-row')).toHaveCount(4);
  await expect(
    page.locator('.folder-nav [data-folder-icon="globe"]'),
  ).toHaveCount(2);
  await expect(
    page.locator('.folder-nav [data-folder-icon="code"]'),
  ).toHaveCount(2);
  const restored = await readFolders(page);
  expect(restored).toHaveLength(4);
  expect(
    restored.filter((folder) => folder.name === 'My study collection'),
  ).toHaveLength(2);
  for (const restoredChild of restored.filter(
    (folder) => folder.name === 'Week one',
  )) {
    expect(restoredChild.icon).toBe('code');
    expect(
      restored.find((folder) => folder.id === restoredChild.parentId),
    ).toMatchObject({ name: 'My study collection', icon: 'globe' });
  }
  expect(restored.find((folder) => folder.id === parent.id)).toMatchObject({
    icon: 'globe',
  });
  expect(restored.find((folder) => folder.id === child.id)).toMatchObject({
    icon: 'code',
    parentId: parent.id,
  });
  await page.reload();
  await expect(
    page.locator('.folder-nav [data-folder-icon="globe"]'),
  ).toHaveCount(2);
  await expect(
    page.locator('.folder-nav [data-folder-icon="code"]'),
  ).toHaveCount(2);
});

test('the folder icon picker remains usable on a narrow screen', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await openMobileNavigation(page);
  await page
    .getByRole('button', { name: 'Create folder', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Folder name', { exact: true })
    .fill('Notes on the move');
  await dialog.getByRole('radio', { name: 'Book', exact: true }).check();
  await expect(
    dialog.getByRole('radio', { name: 'Book', exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole('button', { name: 'Save changes', exact: true }),
  ).toBeVisible();
  expect(
    await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.left >= 0 &&
        bounds.right <= window.innerWidth &&
        element.scrollWidth <= element.clientWidth
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('folder-picker-mobile.png'),
  });
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    rowFor(page, 'Notes on the move').locator('[data-folder-icon="book"]'),
  ).toBeVisible();
  await page.reload();
  await openMobileNavigation(page);
  await expect(
    rowFor(page, 'Notes on the move').locator('[data-folder-icon="book"]'),
  ).toBeVisible();
  expect(await readFolders(page)).toEqual([
    expect.objectContaining({
      name: 'Notes on the move',
      icon: 'book',
      parentId: null,
    }),
  ]);
});
