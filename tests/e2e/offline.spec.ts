import { expect, test } from '@playwright/test';

test('a production build reopens imported notes with the network offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'The art of understanding change',
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      '---\nversion: "1.0"\ntitle: "Available without a connection"\n---\n\n## Offline understanding\n\nThis imported chapter stays available when the network disappears.\n\n:::reveal{label="Reveal the offline explanation"}\nReading and interaction work without a server connection.\n:::',
    );
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Available without a connection',
    }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Available without a connection',
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'This imported chapter stays available when the network disappears.',
    ),
  ).toBeVisible();
  await page
    .getByText('Reveal the offline explanation', { exact: true })
    .click();
  await expect(
    page.getByText('Reading and interaction work without a server connection.'),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /All notes/ })
    .click();
  await expect(page.locator('.note-card')).toHaveCount(7);
  await context.setOffline(false);
});
