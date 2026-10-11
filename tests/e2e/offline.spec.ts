import { expect, test } from '@playwright/test';
import path from 'node:path';

test('a project-path production build reopens notes, bundled assets, and guides offline', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'The art of understanding change',
      exact: true,
    }),
  ).toBeVisible();
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: new URL(registration.scope).pathname,
      script: new URL(registration.active!.scriptURL).pathname,
    };
  });
  expect(worker.scope).toBe('/LearnMD/');
  expect(worker.script).toBe('/LearnMD/sw.js');
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      '---\nversion: "1.0"\ntitle: "Available without a connection"\n---\n\n## Offline understanding\n\nThis imported chapter stays available when the network disappears.\n\nThe mathematics $x^2 + y^2 = r^2$ stays available too.\n\n:::reveal{label="Reveal the offline explanation"}\nReading and interaction work without a server connection.\n:::',
    );
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Import & open' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Available without a connection',
    }),
  ).toBeVisible();
  const noteRoute = page.url();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const fileDialog = page.getByRole('dialog');
  await fileDialog
    .getByRole('button', { name: 'Import files', exact: true })
    .click();
  await fileDialog
    .locator('input[webkitdirectory]')
    .setInputFiles(path.resolve('tests/e2e/fixtures/with-assets'));
  await expect(
    fileDialog.getByText('chapter.learn.md', { exact: true }),
  ).toBeVisible();
  await fileDialog.getByRole('button', { name: 'Import & open' }).click();
  const localImage = page.getByRole('img', { name: 'A local test figure' });
  await expect(localImage).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() =>
      localImage.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'A chapter with a local figure',
    }),
  ).toBeVisible();
  await expect(localImage).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() =>
      localImage.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.goto(noteRoute);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Available without a connection',
    }),
  ).toBeVisible();
  await expect(page.locator('.katex')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px Lora'))).toBe(
    true,
  );
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
  await expect(page.locator('.note-card')).toHaveCount(8);
  await page.getByRole('button', { name: /Component guide/ }).click();
  await expect(page.locator('.component-index button')).toHaveCount(65);
  await page
    .locator('.component-index')
    .getByRole('button', { name: 'carousel', exact: true })
    .click();
  await expect(page.locator('.live-example .learn-carousel')).toBeVisible();
  await page
    .locator('.live-example')
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await expect(page.locator('.live-example .learn-render-error')).toHaveCount(
    0,
  );
  await context.setOffline(false);
});
