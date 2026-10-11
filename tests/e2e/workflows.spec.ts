import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { COMPONENTS } from '../../src/format/registry';

const chapter = (
  title = 'An imported understanding',
  ending = 'The original conclusion.',
) => `---
version: "1.0"
title: "${title}"
description: "A complete browser workflow, from an external source to a local note."
subject: "Personal study"
tags: [example]
---

## A useful idea

This source is imported as a local copy and remains read-only.

::::derivation{title="A short argument"}
:::step{title="Begin"}
Start with the premise.
:::
:::step{title="Conclude"}
${ending}
:::
::::

:::detail-level{level="detailed"}
An additional detail for careful readers.
:::

::::quiz{title="What stays on this device?" explanation="The imported note is stored in the browser's local library."}
:::choice{correct="true"}
The local note
:::
:::choice{correct="false"}
Nothing
:::
::::

## Continue thinking

${'A longer paragraph makes reading position meaningful. Understanding grows when an explanation connects assumptions, reasoning, and evidence.\n\n'.repeat(18)}
`;

async function openImport(page: Page) {
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  return page.getByRole('dialog');
}

async function pasteAndImport(page: Page, source: string) {
  const dialog = await openImport(page);
  await dialog.getByLabel('LearnMD source').fill(source);
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(dialog).not.toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'The art of understanding change',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(6);
});

test('copy prompt → validate paste → read, interact, and reload the local copy', async ({
  page,
  context,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page
    .getByRole('navigation', { name: 'Resources' })
    .getByRole('button', { name: 'Generate notes' })
    .click();
  await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Copied to clipboard' }),
  ).toBeVisible();
  if (browserName === 'chromium') {
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    expect(prompt).toContain('LearnMD');
    expect(prompt).toContain('derivation');
    expect(prompt).toContain('code-walkthrough');
  }

  const dialog = await openImport(page);
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      '---\nversion: "1.0"\ntitle: Broken\n---\n\n:::fill-blank\nMissing the answer attribute.\n:::',
    );
  await expect(dialog.getByText('A few things need attention')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Import & open' }),
  ).toBeDisabled();
  await dialog
    .getByLabel('LearnMD source')
    .fill(`\`\`\`\`learn.md\n${chapter()}\n\`\`\`\``);
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'An imported understanding' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(1); // The library search, never a source editor.
  const argument = page.getByRole('region', { name: 'A short argument' });
  await expect(argument.getByText('Start with the premise.')).toBeVisible();
  await argument.getByRole('button', { name: 'Next step' }).click();
  await expect(argument.getByText('The original conclusion.')).toBeVisible();
  await page.getByRole('button', { name: 'Detailed', exact: true }).click();
  await expect(
    page.getByText('An additional detail for careful readers.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Concise', exact: true }).click();
  await expect(
    page.getByText('An additional detail for careful readers.'),
  ).not.toBeVisible();
  await page.getByRole('radio', { name: 'The local note' }).check();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText('That’s right.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Add to favorites', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  const route = page.url();
  await page.locator('main.workspace').evaluate((element) => {
    element.scrollTop = 800;
  });
  await expect
    .poll(() =>
      page.locator('main.workspace').evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(700);
  // Observe the debounced IndexedDB write before simulating a reload.
  const noteId = route.split('/').at(-1)!;
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open('learnmd-library');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const read = database
                .transaction('notes')
                .objectStore('notes')
                .get(id);
              read.onsuccess = () => {
                resolve(read.result?.position ?? 0);
                database.close();
              };
              read.onerror = () => {
                reject(read.error);
                database.close();
              };
            };
          }),
        noteId,
      ),
    )
    .toBeGreaterThan(600);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'An imported understanding' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Concise', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page.locator('main.workspace').evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(600);
  expect(page.url()).toBe(route);
  expect(errors).toEqual([]);
});

test('file import and duplicate replacement are explicit and preserve favorites', async ({
  page,
}) => {
  const dialog = await openImport(page);
  await dialog
    .getByRole('button', { name: 'Import files', exact: true })
    .click();
  await dialog
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      {
        name: 'a-chapter.learn.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(chapter('A file from disk')),
      },
      {
        name: 'invalid-chapter.learn.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(
          '---\ntitle: An invalid file\n---\n\n:::fill-blank\nMissing the required answer.\n:::',
        ),
      },
    ]);
  await expect(
    dialog.getByText('a-chapter.learn.md', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'A file from disk' }),
  ).toBeVisible();
  const originalRoute = page.url();
  await page
    .getByRole('button', { name: 'Add to favorites', exact: true })
    .click();
  const replacement = await openImport(page);
  await replacement
    .getByLabel('LearnMD source')
    .fill(
      chapter(
        'A file from disk',
        'A revised conclusion with a better explanation.',
      ),
    );
  await expect(replacement.getByText(/words · ready to import/)).toBeVisible();
  await expect(
    replacement.getByRole('button', { name: 'Import & open' }),
  ).toBeDisabled();
  await replacement.getByLabel('Import as').selectOption('replace');
  await expect(replacement.getByLabel('Replace this local copy')).toHaveValue(
    originalRoute.split('/').at(-1)!,
  );
  await replacement.getByRole('button', { name: 'Replace & open' }).click();
  await expect(replacement).not.toBeVisible();
  expect(page.url()).toBe(originalRoute);
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(
    page.getByText('A revised conclusion with a better explanation.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /All notes/ })
    .click();
  await expect(page.locator('.note-card')).toHaveCount(7);
});

test('nested folders organize notes and safely reparent them on deletion', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Create folder' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Folder name').fill('Independent study');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Create folder' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Folder name').fill('Week one');
  await dialog
    .getByLabel('Parent folder')
    .selectOption({ label: 'Independent study' });
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await pasteAndImport(page, chapter('A note to organize'));
  await page.getByRole('button', { name: 'Manage note', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Display title').fill('A clearer library title');
  await dialog
    .getByLabel('In folder')
    .selectOption({ label: 'Independent study / Week one' });
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'A clearer library title' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Manage folder Week one', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Delete folder', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Confirm delete', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Folders' })
    .getByRole('button', { name: /Independent study/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'A clearer library title' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Manage folder Week one', exact: true }),
  ).toHaveCount(0);
});

test('desktop, dark mode, and narrow reading layouts remain usable', async ({
  page,
}, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('library-desktop.png') });
  await page.getByRole('button', { name: 'Open the notes' }).click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reader-desktop.png') });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: testInfo.outputPath('reader-dark.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200); // Let the responsive navigation transition finish.
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'The art of understanding change',
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('reader-narrow.png') });
  await page.locator('main.workspace').evaluate((element) => {
    element.scrollTop = 1800;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: testInfo.outputPath('reader-narrow-math.png'),
  });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /All notes/ })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'The art of understanding change',
      exact: true,
    }),
  ).toBeVisible();
});

test('bundled local images survive a portable backup and restore', async ({
  page,
}, testInfo) => {
  const dialog = await openImport(page);
  await dialog
    .getByRole('button', { name: 'Import files', exact: true })
    .click();
  await dialog
    .locator('input[webkitdirectory]')
    .setInputFiles(path.resolve('tests/e2e/fixtures/with-assets'));
  await expect(
    dialog.getByText('chapter.learn.md', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A chapter with a local figure',
    }),
  ).toBeVisible();
  const originalRoute = page.url();
  const originalImage = page.getByRole('img', { name: 'A local test figure' });
  await expect(originalImage).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() =>
      originalImage.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export library', exact: true })
    .click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('library-backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.format).toBe('learnmd-backup');
  expect(backup.assets).toHaveLength(1);
  expect(backup.assets[0].path).toBe('figure.png');
  expect(backup.assets[0].data.length).toBeGreaterThan(20);
  await page
    .locator('.settings-page input[type=file]')
    .setInputFiles(backupPath);
  await expect(
    page.getByText('Restored 7 notes as new copies.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search notes').fill('A chapter with a local figure');
  await expect(page.locator('.note-card')).toHaveCount(2);
  await page.locator('.note-card').last().locator('.note-open').click();
  expect(page.url()).not.toBe(originalRoute);
  const restoredImage = page.getByRole('img', { name: 'A local test figure' });
  await expect(restoredImage).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() =>
      restoredImage.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A chapter with a local figure',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'A local test figure' }),
  ).toHaveAttribute('src', /^blob:/);
});

test('semantic cross-references navigate inside the note without changing its route', async ({
  page,
}) => {
  const body = `---\nversion: "1.0"\ntitle: "Following the reasoning"\n---\n\n## Start here\n\n:::reference{target="main-idea" label="Visit the definition"}\n:::\n\n${'A supporting paragraph separates the reference from its target.\n\n'.repeat(30)}:::definition{id="main-idea" title="The main idea"}\nA definition at the end of the argument.\n:::\n\n:::reference{target="start-here" label="Return to the beginning"}\n:::`;
  await pasteAndImport(page, body);
  const route = page.url();
  await page
    .getByRole('link', { name: 'Visit the definition', exact: true })
    .click();
  await expect(
    page.getByText('A definition at the end of the argument.'),
  ).toBeInViewport();
  expect(page.url()).toBe(route);
  await page
    .getByRole('link', { name: 'Return to the beginning', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /^Start here/ }),
  ).toBeInViewport();
  expect(page.url()).toBe(route);
});

test('every public component opens in the live gallery without renderer or math failures', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .getByRole('navigation', { name: 'Resources' })
    .getByRole('button', { name: /Component guide/ })
    .click();
  const names = COMPONENTS.filter((component) => !component.structural).map(
    (component) => component.name,
  );
  expect(names.length).toBeGreaterThanOrEqual(65);
  const index = page.locator('.component-index');
  for (const name of names) {
    await index.getByRole('button', { name, exact: true }).click();
    await expect(
      page
        .locator('.example-heading')
        .getByRole('heading', { name, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.live-example .learn-render-error')).toHaveCount(
      0,
    );
    await expect(page.locator('.live-example .learn-math-error')).toHaveCount(
      0,
    );
  }
  expect(errors).toEqual([]);
});

test('untrusted HTML stays inert and external images require an explicit load', async ({
  page,
}) => {
  const requests: string[] = [];
  const png = await readFile(
    path.resolve('tests/e2e/fixtures/with-assets/figure.png'),
  );
  await page.route('https://example.test/**', async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
  await pasteAndImport(
    page,
    `---\nversion: "1.0"\ntitle: "Untrusted input stays safe"\n---\n\n## Safe reading\n\n<script>window.__learnmdUnsafeExecuted = true</script>\n\n<img src="invalid" onerror="window.__learnmdUnsafeExecuted = true">\n\n[An unsafe action](javascript:alert(1))\n\n![An external diagram](https://example.test/diagram.png)\n\nThe educational prose remains readable.`,
  );
  await expect(
    page.getByText('The educational prose remains readable.'),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Object.hasOwn(window, '__learnmdUnsafeExecuted')),
  ).toBe(false);
  await expect(page.locator('.learn-reader script')).toHaveCount(0);
  await expect(page.locator('.learn-reader [onerror]')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'An unsafe action' }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
  await page
    .getByRole('button', { name: 'Load image from example.test', exact: true })
    .click();
  await expect(
    page.getByRole('img', { name: 'An external diagram' }),
  ).toBeVisible();
  await expect.poll(() => requests.length).toBe(1);
});
