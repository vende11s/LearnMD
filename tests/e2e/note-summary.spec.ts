import { expect, test } from '@playwright/test';

test('existing notes show a clean excerpt and the same reading time everywhere', async ({
  page,
}) => {
  const title = 'Trygonometria do liczb zespolonych';
  const excerpt = 'Krótka ściąga do wyznaczania argumentu liczby zespolonej.';
  // Metadata adds many source words, but is not part of the reading estimate.
  const tags = Array.from(
    { length: 40 },
    (_, i) => `"metadata words are not reading content ${i}"`,
  );
  const source = `---
title: "${title}"
version: "1.0"
tags: [${tags.join(', ')}]
---
# ${title}

Krótka **ściąga** do wyznaczania [argumentu](https://example.com) liczby zespolonej.

## Przykład

${'wyjaśnienie '.repeat(250)}
`;
  await page.goto('/');
  await expect(page.locator('.note-card')).toHaveCount(1);
  // Simulate a note already stored by an earlier release, without reimporting it.
  await page.evaluate(
    ({ title, source }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('learnmd-library');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('notes', 'readwrite');
          const notes = transaction.objectStore('notes');
          notes.delete('learnmd-guide');
          notes.put({
            id: 'existing-trigonometry',
            title,
            description: '',
            subject: 'Matematyka',
            tags: [],
            source,
            folderId: null,
            favorite: false,
            createdAt: 1,
            updatedAt: 1,
            openedAt: 0,
            position: 0,
            sample: false,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
    { title, source },
  );
  await page.reload();
  const card = page.locator('.note-card').filter({ hasText: title });
  await expect(card.locator('.note-open p')).toHaveText(excerpt);
  await expect(card.locator('.note-card-footer')).toContainText('2 min read');
  await expect(page.locator('.featured-copy > p')).toHaveText(excerpt);
  await expect(page.locator('.featured-meta')).toContainText('2 min read');

  await card.locator('.note-open').click();
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible();
  await expect(page.locator('.read-meta')).toContainText('2 MIN READ');
  await page.reload();
  await expect(page.locator('.read-meta')).toContainText('2 MIN READ');

  await page
    .locator('.sidebar')
    .getByRole('button', { name: /All notes/ })
    .click();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(card.locator('.note-open p')).toHaveText(excerpt);
  await expect(card.locator('.note-card-footer')).toContainText('2 min read');
});
