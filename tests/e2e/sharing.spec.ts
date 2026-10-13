import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const api = 'http://127.0.0.1:8787';
const shareId = '1234567890abcdef1234567890abcdef';
const ttl = 7 * 24 * 60 * 60 * 1000;
const authorClient = `v1.${'a'.repeat(32)}.${'b'.repeat(43)}`;
const recipientClient = `v1.${'c'.repeat(32)}.${'d'.repeat(43)}`;

async function library(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        notes: {
          id: string;
          title: string;
          folderId: string | null;
          favorite: boolean;
          position: number;
        }[];
        folders: { id: string; name: string; parentId: string | null }[];
        assets: { noteId: string; path: string; blob: Blob }[];
      }>((resolve, reject) => {
        const opening = indexedDB.open('learnmd-library');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const database = opening.result;
          const tx = database.transaction(['notes', 'folders', 'assets']);
          const notes = tx.objectStore('notes').getAll();
          const folders = tx.objectStore('folders').getAll();
          const assets = tx.objectStore('assets').getAll();
          tx.oncomplete = () => {
            resolve({
              notes: notes.result,
              folders: folders.result,
              assets: assets.result,
            });
            database.close();
          };
          tx.onerror = () => {
            database.close();
            reject(tx.error);
          };
        };
      }),
  );
}

async function seed(page: Page) {
  await page.goto('/');
  await expect(page.locator('.note-card')).toHaveCount(1);
  const picture = (
    await readFile('tests/e2e/fixtures/with-assets/figure.png')
  ).toString('base64');
  await page.evaluate(
    (image) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('learnmd-library');
        opening.onsuccess = () => {
          const database = opening.result;
          const tx = database.transaction(
            ['notes', 'folders', 'assets'],
            'readwrite',
          );
          for (const folder of [
            { id: 'private-parent', name: 'Private parent', parentId: null },
            {
              id: 'original-root',
              name: 'Study pack',
              parentId: 'private-parent',
              icon: 'book',
            },
            {
              id: 'original-child',
              name: 'Exercises',
              parentId: 'original-root',
              icon: 'folder',
            },
          ])
            tx.objectStore('folders').put(folder);
          for (const note of [
            {
              id: 'original-note',
              title: 'Shared diagram',
              folderId: 'original-root',
              body: '## Visible explanation\n\n![A local test figure](figure.png)',
            },
            {
              id: 'original-exercise',
              title: 'Shared exercise',
              folderId: 'original-child',
              body: '## Practice\n\nSolve a useful problem.',
            },
            {
              id: 'private-note',
              title: 'Private material',
              folderId: 'private-parent',
              body: 'Never share this note.',
            },
          ])
            tx.objectStore('notes').put({
              ...note,
              source: `---\ntitle: ${note.title}\nversion: "1.0"\n---\n\n${note.body}\n`,
              description: '',
              subject: 'Math',
              tags: [],
              favorite: true,
              position: 123,
              openedAt: 456,
              createdAt: 100,
              updatedAt: 200,
              sample: false,
            });
          const blob = new Blob(
            [Uint8Array.from(atob(image), (char) => char.charCodeAt(0))],
            { type: 'image/png' },
          );
          for (const path of ['figure.png', 'unused-private.png'])
            tx.objectStore('assets').put({
              id: `original-note:${path}`,
              noteId: 'original-note',
              path,
              blob,
            });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => {
            database.close();
            reject(tx.error);
          };
        };
        opening.onerror = () => reject(opening.error);
      }),
    picture,
  );
  await page.reload();
  await expect(page.locator('.note-card')).toHaveCount(4);
}

async function apiMock(
  context: BrowserContext,
  handler: (method: string) => {
    status?: number;
    body: unknown;
    expiresAt?: number;
    retryAfter?: number;
  },
) {
  let sessions = 0;
  await context.route(`${api}/**`, async (route) => {
    if (new URL(route.request().url()).pathname === '/session') {
      expect(route.request().method()).toBe('POST');
      sessions++;
      await route.fulfill({ status: 201, json: { token: recipientClient } });
      return;
    }
    expect(route.request().headers()['x-share-client']).toBe(recipientClient);
    const result = handler(route.request().method());
    await route.fulfill({
      status: result.status ?? 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:5183',
        'Access-Control-Expose-Headers': 'X-Share-Expires-At, Retry-After',
        'Cache-Control': 'no-store',
        ...(result.expiresAt
          ? { 'X-Share-Expires-At': String(result.expiresAt) }
          : {}),
        ...(result.retryAfter
          ? { 'Retry-After': String(result.retryAfter) }
          : {}),
      },
      body: JSON.stringify(result.body),
    });
  });
  return () => sessions;
}

test('share a nested folder with an image, preview and import an independent copy, then revoke', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  const createdAt = Date.now();
  const expiresAt = createdAt + ttl;
  let uploaded: Record<string, unknown> | undefined;
  let deleted = false;
  let authorSessions = 0;
  await context.route(`${api}/**`, async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname === '/session') {
      authorSessions++;
      expect(request.headers()['x-turnstile-token']).toBeUndefined();
      await route.fulfill({ status: 201, json: { token: authorClient } });
    } else if (request.method() === 'POST') {
      uploaded = request.postDataJSON();
      expect(request.headers()['x-share-client']).toBe(authorClient);
      expect(request.headers()['x-turnstile-token']).toBe('local-development');
      await route.fulfill({
        json: {
          id: shareId,
          createdAt,
          expiresAt,
          deleteToken: 'd'.repeat(64),
        },
      });
    } else if (request.method() === 'DELETE') {
      expect(request.headers().authorization).toBe(`Bearer ${'d'.repeat(64)}`);
      deleted = true;
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        json: uploaded,
        headers: { 'X-Share-Expires-At': String(expiresAt) },
      });
    }
  });
  const menu = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  // Expand the private parent before accessing its shared child.
  const parent = page.locator('.folder-row').filter({
    has: page.getByRole('button', {
      name: 'Manage folder Private parent',
      exact: true,
    }),
  });
  const expand = parent.getByRole('button', { name: /Expand/ });
  if (await expand.count()) await expand.click();
  await page
    .getByRole('button', { name: 'Manage folder Study pack', exact: true })
    .click();
  await page.getByRole('button', { name: 'Share a copy', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Link valid for 7 days', { exact: true }),
  ).toBeVisible();
  expect(uploaded).toBeUndefined();
  await dialog
    .getByRole('button', { name: 'Create link', exact: true })
    .click();
  const link = dialog.getByRole('textbox', { name: 'Share link', exact: true });
  await expect(link).toHaveValue(new RegExp(`#share/${shareId}$`));
  await expect(dialog.getByText(/Expires:/)).toBeVisible();
  expect(authorSessions).toBe(1);
  expect(uploaded?.format).toBe('learnmd-share');
  expect(uploaded?.notes).toHaveLength(2);
  expect(uploaded?.folders).toHaveLength(2);
  expect(uploaded?.assets).toHaveLength(1);
  const serialized = JSON.stringify(uploaded);
  for (const privateValue of [
    'Private parent',
    'Private material',
    'original-root',
    'original-note',
    'favorite',
    'openedAt',
    'position',
    'unused-private.png',
  ]) {
    expect(serialized).not.toContain(privateValue);
  }
  await page.screenshot({ path: testInfo.outputPath('share-created.png') });

  const recipient = await browser.newContext({
    viewport: page.viewportSize()!,
    locale: 'en-US',
  });
  try {
    const recipientSessions = await apiMock(recipient, () => ({
      body: uploaded,
      expiresAt,
    }));
    const receiver = await recipient.newPage();
    receiver.on('pageerror', (error) => errors.push(error.message));
    await receiver.goto(await link.inputValue());
    await expect(
      receiver.getByRole('heading', { name: 'Study pack', exact: true }),
    ).toBeVisible();
    await expect(receiver.getByText(/Link valid for 7 days/)).toBeVisible();
    expect((await library(receiver)).notes).toHaveLength(1);
    await receiver
      .getByRole('button', { name: 'Shared diagram', exact: true })
      .click();
    await expect(
      receiver.getByRole('img', { name: 'A local test figure', exact: true }),
    ).toBeVisible();
    await receiver.screenshot({
      path: testInfo.outputPath('share-preview.png'),
    });
    await receiver
      .getByRole('button', { name: 'Add to my library', exact: true })
      .click();
    await expect(receiver).toHaveURL(/#folder\//);
    const imported = await library(receiver);
    expect(imported.notes).toHaveLength(3);
    expect(imported.folders).toHaveLength(2);
    expect(imported.assets).toHaveLength(1);
    const root = imported.folders.find(
      (folder) => folder.name === 'Study pack',
    )!;
    expect(root.parentId).toBeNull();
    expect(
      imported.folders.find((folder) => folder.name === 'Exercises')?.parentId,
    ).toBe(root.id);
    const diagram = imported.notes.find(
      (note) => note.title === 'Shared diagram',
    )!;
    expect(diagram.id).not.toBe('original-note');
    expect(diagram.favorite).toBe(false);
    expect(diagram.position).toBe(0);
    await receiver.goto(await link.inputValue());
    await expect(
      receiver.getByText('Already in your library', { exact: true }),
    ).toBeVisible();
    await receiver.reload();
    await expect(
      receiver.getByText('Already in your library', { exact: true }),
    ).toBeVisible();
    expect(recipientSessions()).toBe(1);
    expect((await library(receiver)).notes).toHaveLength(3);
    await recipient.setOffline(true);
    await receiver.evaluate((id) => {
      location.hash = `note/${id}`;
    }, diagram.id);
    await expect(
      receiver.getByRole('img', { name: 'A local test figure', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        receiver
          .getByRole('img', { name: 'A local test figure', exact: true })
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  } finally {
    await recipient.close();
  }
  await dialog
    .getByRole('button', { name: 'Disable link', exact: true })
    .click();
  await expect.poll(() => deleted).toBe(true);
  expect(authorSessions).toBe(1);
  expect(errors).toEqual([]);
});

test('expired link explains seven days and never imports content', async ({
  page,
  context,
}) => {
  await apiMock(context, () => ({
    status: 410,
    body: { error: 'expired', message: 'This link has expired.' },
  }));
  await page.goto(`/#share/${shareId}`);
  await expect(page.getByRole('alert')).toContainText(/expired|7 days/i);
  await expect(
    page.getByRole('button', { name: 'Add to my library', exact: true }),
  ).toHaveCount(0);
  expect((await library(page)).notes).toHaveLength(1);
});

test('download rate limit gives a retry time without an automatic retry loop', async ({
  page,
  context,
}) => {
  await page.clock.install();
  let requests = 0;
  await apiMock(context, () => {
    requests++;
    return {
      status: 429,
      retryAfter: 60,
      body: {
        error: 'rate_limited',
        message: 'Please try again later.',
        retryAfter: 60,
      },
    };
  });
  await page.goto(`/#share/${shareId}`);
  await expect(page.getByRole('alert')).toContainText(/Too many requests/i);
  await expect(
    page.getByRole('status').filter({ hasText: /Try again in/ }),
  ).toContainText(/\d+ seconds/);
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true }),
  ).toBeDisabled();
  // React's development StrictMode can abort an initial mount's request.
  expect(requests).toBeLessThanOrEqual(2);
  const initialRequests = requests;
  await page.clock.runFor(2000);
  expect(requests).toBe(initialRequests);
  expect((await library(page)).notes).toHaveLength(1);
});

test('monthly budget pause survives reload, leaves local notes available and resumes only on demand', async ({
  page,
  context,
}, testInfo) => {
  const start = Date.UTC(2026, 9, 13, 12);
  const resetAt = Date.UTC(2026, 10, 1);
  await page.clock.install({ time: new Date(start) });
  let requests = 0;
  let resumed = false;
  const sessions = await apiMock(context, () => {
    requests++;
    return resumed
      ? { status: 410, body: { error: 'expired' } }
      : {
          status: 429,
          retryAfter: (resetAt - start) / 1000,
          body: {
            error: 'monthly_limit',
            resetAt,
            retryAfter: (resetAt - start) / 1000,
          },
        };
  });
  await page.goto(`/#share/${shareId}`);
  const pauseNotice = page
    .getByRole('status')
    .filter({ hasText: /Sharing paused/ });
  await expect(pauseNotice).toBeVisible();
  await expect(page.getByText(/2026/).first()).toBeVisible();
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await expect(retry).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('monthly-budget-paused.png'),
  });
  const initialRequests = requests;
  expect(initialRequests).toBeGreaterThan(0);
  expect(initialRequests).toBeLessThanOrEqual(2);
  await page.reload();
  await expect(pauseNotice).toBeVisible();
  await expect(retry).toBeDisabled();
  expect(requests).toBe(initialRequests);
  expect(sessions()).toBe(1);
  await page.goto('/');
  await expect(page.locator('.note-card')).toHaveCount(1);
  await page.goto(`/#share/${shareId}`);
  await expect(retry).toBeDisabled();
  expect(requests).toBe(initialRequests);
  resumed = true;
  await page.clock.fastForward(resetAt - start + 1000);
  await expect(retry).toBeEnabled();
  expect(requests).toBe(initialRequests);
  await retry.click();
  await expect(page.getByRole('alert')).toContainText(/expired/i);
  expect(requests).toBe(initialRequests + 1);
  expect(sessions()).toBe(1);
  expect((await library(page)).notes).toHaveLength(1);
});
