import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', reducedMotion: 'reduce' });

test('a long outline scrolls independently in both directions, including at its boundaries', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.note-card').first()).toBeVisible();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  const sections = Array.from({ length: 60 }, (_, index) => {
    const label = String(index + 1).padStart(2, '0');
    return `## Section ${label}\n\n${Array.from(
      { length: 4 },
      () =>
        'A longer note needs room for careful explanation. Each section adds another idea to read and revisit.',
    ).join('\n\n')}`;
  }).join('\n\n');
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      `---\nversion: "1.0"\ntitle: "A long outline"\n---\n\n# A long outline\n\n${sections}`,
    );
  await dialog
    .getByRole('button', { name: 'Import & open', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const route = page.url();
  const workspace = page.locator('.workspace');
  const nav = page.getByRole('navigation', {
    name: 'Document outline',
    exact: true,
  });
  await expect(nav.getByRole('button')).toHaveCount(60);
  await expect(
    nav.getByRole('button', { name: 'Section 01', exact: true }),
  ).toHaveAttribute('aria-current', 'location');
  await expect
    .poll(() =>
      nav.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true);

  const initialPosition = await workspace.evaluate(
    (element) => element.scrollTop,
  );
  await nav.hover();
  await page.mouse.wheel(0, 450);
  await expect
    .poll(() => nav.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(
    initialPosition,
  );
  const firstOutlinePosition = await nav.evaluate(
    (element) => element.scrollTop,
  );
  // The panel header is also part of its independent wheel area.
  await page.locator('.document-outline > .eyebrow').hover();
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => nav.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(firstOutlinePosition);
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(
    initialPosition,
  );
  const outlinePosition = await nav.evaluate((element) => element.scrollTop);

  // Reading changes the highlighted entry, never the user's outline position.
  const readingPosition = await workspace.evaluate((element) => {
    const heading = document.getElementById('section-50')!;
    const top =
      element.scrollTop +
      heading.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      80;
    element.scrollTo({ top, behavior: 'instant' });
    return top;
  });
  const current = nav.getByRole('button', { name: 'Section 50', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'location');
  expect(await nav.evaluate((element) => element.scrollTop)).toBe(
    outlinePosition,
  );
  expect(await workspace.evaluate((element) => element.scrollTop)).toBeCloseTo(
    readingPosition,
    0,
  );
  await page.locator('.reader-column').hover();
  await page.mouse.wheel(0, 450);
  await expect
    .poll(() => workspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(readingPosition + 100);
  expect(await nav.evaluate((element) => element.scrollTop)).toBe(
    outlinePosition,
  );

  await page.setViewportSize({ width: 1440, height: 480 });
  await expect(
    page.getByRole('button', { name: 'Print note', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page
        .locator('.document-outline')
        .evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(480);
  expect(await nav.evaluate((element) => element.scrollTop)).toBe(
    outlinePosition,
  );
  const positionAfterResize = await workspace.evaluate(
    (element) => element.scrollTop,
  );

  // Wheel input must stop at either end of the outline, not chain to the note.
  for (const delta of [-500, 500]) {
    await nav.evaluate((element, direction) => {
      element.scrollTop = direction < 0 ? 0 : element.scrollHeight;
    }, delta);
    await nav.hover();
    await page.mouse.wheel(0, delta);
    // Wheel scrolling is asynchronous, including when the target cannot move.
    await page.waitForTimeout(150);
    expect(await workspace.evaluate((element) => element.scrollTop)).toBe(
      positionAfterResize,
    );
  }

  // Keyboard focus can reach clipped links through the outline's own scrollport.
  await current.focus();
  for (let index = 0; index < 10; index++) await page.keyboard.press('Tab');
  const last = nav.getByRole('button', { name: 'Section 60', exact: true });
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport({ ratio: 1 });
  expect(await workspace.evaluate((element) => element.scrollTop)).toBe(
    positionAfterResize,
  );
  await last.click();
  await expect(
    page.getByRole('heading', { name: /^Section 60/, level: 2 }),
  ).toBeInViewport();
  expect(page.url()).toBe(route);
});
