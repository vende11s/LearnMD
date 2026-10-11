import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'en-US' });

const englishGuide = 'Your first steps with LearnMD';
const polishGuide = 'Pierwsze kroki z LearnMD';

async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: englishGuide, exact: true }),
  ).toBeVisible();
}

async function library(page: Page, language: 'en' | 'pl') {
  await page
    .getByRole('navigation', {
      name: language === 'en' ? 'Main navigation' : 'Nawigacja główna',
      exact: true,
    })
    .getByRole('button', {
      name: language === 'en' ? /All notes/ : /Wszystkie notatki/,
    })
    .click();
}

async function switchLanguage(page: Page, language: 'en' | 'pl') {
  await page
    .locator('.sidebar-footer')
    .getByRole('button', { name: /^(Settings|Ustawienia)$/ })
    .click();
  await page
    .getByRole('combobox', { name: /^(Interface language|Język interfejsu)$/ })
    .selectOption(language);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

test('starts with one guide and opens generation directly from a clear import dialog', async ({
  page,
}) => {
  await start(page);
  await expect(page.locator('.local-badge')).toHaveCount(0);
  await expect(page.getByText('LOCAL WORKSPACE', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('A SPACE FOR CURIOUS MINDS', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/A quiet place to think/)).toHaveCount(0);
  await expect(page.locator('.local-message')).toContainText(
    'All notes are stored on this device.',
  );
  await expect(page.locator('.local-message')).toContainText('No cloud.');

  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('Import notes from anywhere.', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/Make understanding your own/)).toHaveCount(0);
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      '---\nversion: "1.0"\ntitle: "A unique import title"\n---\n\nA useful explanation.',
    );
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  const choice = dialog.getByRole('combobox', {
    name: 'Import as',
    exact: true,
  });
  await expect(choice).toHaveValue('new');
  await expect(choice.locator('option')).toHaveText([
    'New note',
    'Replace existing note…',
  ]);
  await dialog
    .getByRole('button', { name: 'Generate notes', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/#generate$/);
  await expect(
    page.getByRole('button', { name: 'Copy prompt', exact: true }),
  ).toBeVisible();
});

test('localizes the authored guide while preserving imported content and the chosen language after reload', async ({
  page,
}) => {
  await start(page);
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('LearnMD source')
    .fill(
      '---\nversion: "1.0"\ntitle: "My untranslated field notes"\n---\n\nThis sentence must remain exactly as I wrote it.',
    );
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Import & open', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'My untranslated field notes',
    }),
  ).toBeVisible();

  await switchLanguage(page, 'pl');
  await library(page, 'pl');
  await expect(page.locator('.note-card')).toHaveCount(2);
  await expect(
    page.getByRole('heading', { level: 2, name: polishGuide, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.note-card').getByRole('heading', {
      name: 'My untranslated field notes',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator('.note-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'My untranslated field notes',
        exact: true,
      }),
    })
    .locator('.note-open')
    .click();
  await expect(
    page.getByText('This sentence must remain exactly as I wrote it.', {
      exact: true,
    }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'My untranslated field notes',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('This sentence must remain exactly as I wrote it.', {
      exact: true,
    }),
  ).toBeVisible();
  await library(page, 'pl');
  await expect(
    page.getByRole('heading', { level: 2, name: polishGuide, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(2);
});

test('keeps a deliberately deleted guide deleted after reload and language changes', async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole('button', { name: `Delete ${englishGuide}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Confirm delete', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Room for a new idea.', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Room for a new idea.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(0);

  await switchLanguage(page, 'pl');
  await library(page, 'pl');
  await expect(
    page.getByRole('heading', { name: 'Miejsce na nowy pomysł.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: polishGuide, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Miejsce na nowy pomysł.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(0);
});

test('introduces the workflow and four short fraction exercises with preserved answers', async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole('button', { name: 'Open the notes', exact: true })
    .click();
  const steps = page.getByRole('region', {
    name: 'From topic to note',
    exact: true,
  });
  await expect(
    steps.getByText('Ask your LLM', { exact: true }),
  ).not.toBeVisible();
  await steps.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(
    steps.getByText('Ask your LLM', { exact: true }),
  ).toBeVisible();

  const carousel = page.getByRole('region', {
    name: 'Give it a try',
    exact: true,
  });
  const firstAnswer = carousel.getByRole('radio', {
    name: /^3\/4/,
  });
  await firstAnswer.check();
  await carousel
    .getByRole('button', { name: 'Check answer', exact: true })
    .click();
  await expect(carousel.getByRole('status')).toContainText('That’s right.');
  await carousel
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await expect(
    carousel.getByText('Slide 2 of 4', { exact: true }),
  ).toBeVisible();
  await carousel
    .getByRole('checkbox', {
      name: '3/4',
      exact: true,
    })
    .check();
  await carousel
    .getByRole('checkbox', {
      name: '4/4',
      exact: true,
    })
    .check();
  await carousel
    .getByRole('button', { name: 'Check answer', exact: true })
    .click();
  await expect(carousel.getByRole('status')).toContainText('That’s right.');
  await carousel
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await carousel
    .getByRole('textbox', {
      name: 'From fractions to percentages',
      exact: true,
    })
    .fill('25');
  await carousel
    .getByRole('button', { name: 'Check answer', exact: true })
    .click();
  await expect(carousel.getByRole('status')).toContainText('Exactly right.');
  await carousel
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await carousel
    .getByRole('combobox', { name: '1/4', exact: true })
    .selectOption('One quarter');
  await carousel
    .getByRole('combobox', { name: '1/2', exact: true })
    .selectOption('One half');
  await carousel
    .getByRole('combobox', { name: '3/4', exact: true })
    .selectOption('Three quarters');
  await carousel
    .getByRole('button', { name: 'Check matches', exact: true })
    .click();
  await expect(carousel.getByRole('status')).toContainText(
    'All connections are correct.',
  );
  await carousel
    .getByRole('combobox', { name: 'Go to slide', exact: true })
    .selectOption('0');
  await expect(firstAnswer).toBeChecked();
  await expect(carousel.getByRole('status')).toContainText('That’s right.');
  await expect(page.locator('.learn-render-error')).toHaveCount(0);
});
