import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

test.use({ locale: 'en-US' });

const note = (title: string, body: string) =>
  `---\nversion: "1.0"\ntitle: "${title}"\n---\n\n# ${title}\n\n${body}\n`;
const block = (name: string, body: string, attributes = '', width = 3) =>
  `${':'.repeat(width)}${name}${attributes ? `{${attributes}}` : ''}\n${body}\n${':'.repeat(width)}`;

async function openLibrary(page: Page) {
  await page.goto('/');
  await expect(page.locator('.note-card').first()).toBeVisible();
}

async function importSource(page: Page, source: string) {
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /Add note/ })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('LearnMD source').fill(source);
  await expect(dialog.getByText(/words · ready to import/)).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Import & open', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.document-title')).toBeVisible();
}

async function allNotes(page: Page) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /All notes/ })
    .click();
  await expect(page.locator('.note-card').first()).toBeVisible();
}

/** Preserve the real native write, and observe its successful argument for Firefox, which cannot grant clipboard-read. */
async function observeClipboard(
  page: Page,
  context: BrowserContext,
  browserName: string,
) {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    const nativeWrite = clipboard.writeText.bind(clipboard);
    Object.defineProperty(clipboard, 'writeText', {
      configurable: true,
      value: async (value: string) => {
        await nativeWrite(value);
        (
          window as Window & { __learnmdClipboard?: string }
        ).__learnmdClipboard = value;
      },
    });
  });
}

async function copiedSource(page: Page, browserName: string) {
  const value =
    browserName === 'chromium'
      ? page.evaluate(() => navigator.clipboard.readText())
      : page.evaluate(
          () =>
            (window as Window & { __learnmdClipboard?: string })
              .__learnmdClipboard ?? '',
        );
  // The Windows native clipboard serializes LF as CRLF. Compare Markdown text
  // with normalized platform newlines; the native write is checked exactly too.
  return (await value).replace(/\r\n/g, '\n');
}

async function selectRenderedText(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
}

test.describe('language preference', () => {
  test.use({ locale: 'pl-PL' });

  test('Polish follows the browser, the prompt remains English, and an English preference survives reload', async ({
    page,
    context,
    browserName,
  }, testInfo) => {
    await observeClipboard(page, context, browserName);
    await openLibrary(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(
      page.locator('.sidebar').getByRole('button', { name: /Dodaj notatkę/ }),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Narzędzia' })
      .getByRole('button', { name: 'Generuj notatki', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Kopiuj prompt', exact: true })
      .click();
    await expect
      .poll(() => copiedSource(page, browserName))
      .toContain(
        'You are an expert educator writing a complete .learn.md document',
      );
    const prompt = await copiedSource(page, browserName);
    expect(prompt.slice(0, 1000)).toContain(
      'OUTPUT LANGUAGE: Write the notes in the language of the supplied materials unless the user explicitly requests a different language.',
    );
    expect(prompt).toContain('CAROUSELS AND LONG QUESTION SETS');
    expect(prompt).toContain('Write concise, clear explanatory notes');
    expect(prompt).toContain('Preserve necessary reasoning');
    expect(prompt.length).toBeLessThan(28_000);
    expect(prompt).toBe(
      await page.locator('.prompt-preview pre').textContent(),
    );
    await page
      .getByRole('navigation', { name: 'Narzędzia' })
      .getByRole('button', { name: /^Komponenty\b/ })
      .click();
    await page
      .locator('.component-index')
      .getByRole('button', { name: 'carousel', exact: true })
      .click();
    await expect(page.locator('.example-heading')).toContainText(
      'Ręcznie przewijana seria slajdów',
    );
    await expect(page.locator('.property-list')).toContainText(
      'Początkowy slajd, liczony od zera.',
    );
    await expect(page.locator('.source-example pre')).toContainText(
      'Continuity and differentiability',
    );
    await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Czytanie', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('.detail-control')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('settings-polish.png') });
    await page
      .getByRole('combobox', { name: 'Język interfejsu', exact: true })
      .selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('combobox', { name: 'Interface language', exact: true }),
    ).toHaveValue('en');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('combobox', { name: 'Interface language', exact: true }),
    ).toHaveValue('en');
    await expect(
      page.locator('.sidebar').getByRole('button', { name: /Add note/ }),
    ).toBeVisible();
  });
});

test('reader, guide, and settings have no density controls while authored views remain interactive', async ({
  page,
}) => {
  await openLibrary(page);
  await importSource(
    page,
    note(
      'An explanation with manual views',
      `## One idea\n\nA clear paragraph with **ordinary Markdown** and $x^2$.\n\n${block('section', 'The complete explanation is always visible.', 'title="A closer look"')}\n\n${block('layers', `${block('layer', 'Begin with the geometric intuition.', 'title="Geometry"')}\n\n${block('layer', 'Now inspect the algebraic interpretation.', 'title="Algebra"')}`, 'title="Two interpretations"', 4)}`,
    ),
  );
  const noDensityControls = async () => {
    await expect(page.locator('.detail-control')).toHaveCount(0);
    await expect(
      page.getByRole('group', { name: 'Level of detail', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^(Concise|Standard|Detailed)$/ }),
    ).toHaveCount(0);
  };
  await noDensityControls();
  await expect(
    page.getByText('The complete explanation is always visible.'),
  ).toBeVisible();
  await expect(
    page.getByText('Begin with the geometric intuition.'),
  ).toBeVisible();
  await expect(
    page.getByText('Now inspect the algebraic interpretation.'),
  ).not.toBeVisible();
  await page.getByRole('tab', { name: 'Algebra', exact: true }).click();
  await expect(
    page.getByText('Now inspect the algebraic interpretation.'),
  ).toBeVisible();
  await expect(
    page.getByText('The complete explanation is always visible.'),
  ).toBeVisible();

  await page.getByRole('button', { name: /Component guide/ }).click();
  const index = page.locator('.component-index');
  await index.getByRole('button', { name: 'definition', exact: true }).click();
  await noDensityControls();
  await index.getByRole('button', { name: 'layers', exact: true }).click();
  await noDensityControls();
  await expect(
    index.getByRole('button', { name: 'detail-level', exact: true }),
  ).toHaveCount(0);
  await page
    .locator('.live-example')
    .getByRole('tab', { name: 'Formal', exact: true })
    .click();
  await expect(page.locator('.live-example .katex')).toBeVisible();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await noDensityControls();
  await expect(
    page.getByRole('heading', { name: 'Reading', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: 'Interface language', exact: true }),
  ).toBeVisible();
});

test('a long carousel mixes content, preserves answers and scratch work, and reveals headings through the outline', async ({
  page,
}, testInfo) => {
  await openLibrary(page);
  const slides = [
    block(
      'slide',
      '## Read the context\n\nA power function has the form $f(x)=x^n$. For positive integer $n$, its derivative is $nx^{n-1}$.\n\n> Use the exponent as a multiplier and reduce it by one.',
      'title="Context"',
      5,
    ),
  ];
  for (let index = 1; index <= 12; index++) {
    const quiz = block(
      'quiz',
      `For $f(x)=x^{${index + 1}}$, which method gives its derivative?\n\n${block('choice', 'Apply the power rule.', 'correct="true"')}\n\n${block('choice', 'Keep the function unchanged.', 'correct="false"')}`,
      `title="Question ${index}" explanation="Multiply by ${index + 1}, then reduce the exponent by one."`,
      4,
    );
    slides.push(block('slide', quiz, `title="Question ${index}"`, 5));
  }
  slides.push(
    block(
      'slide',
      `## Reflection worksheet\n\n${block('scratchpad', 'Try a fresh power function and explain each operation.', 'title="Your reasoning"')}`,
      'title="Reflection"',
      5,
    ),
  );
  await importSource(
    page,
    note(
      'A longer question sequence',
      block('carousel', slides.join('\n\n'), 'title="Power rule practice"', 6),
    ),
  );
  const route = page.url();
  const carousel = page.getByRole('region', {
    name: 'Power rule practice',
    exact: true,
  });
  const jump = carousel.getByRole('combobox', { name: 'Go to slide' });
  await expect(carousel.locator('.learn-carousel-slide')).toHaveCount(14);
  await expect(jump.getByRole('option')).toHaveCount(14);
  await expect(
    carousel.getByText('Slide 1 of 14', { exact: true }),
  ).toBeVisible();
  await expect(carousel.locator('.katex').first()).toBeVisible();
  await carousel
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await carousel
    .getByRole('radio', { name: 'Apply the power rule.', exact: true })
    .check();
  await carousel
    .getByRole('button', { name: 'Check answer', exact: true })
    .click();
  await expect(
    carousel.getByText('That’s right.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('carousel-questions.png'),
  });
  await carousel
    .getByRole('button', { name: 'Next slide', exact: true })
    .click();
  await expect(
    carousel.getByRole('radio', { name: 'Apply the power rule.', exact: true }),
  ).not.toBeChecked();
  await jump.selectOption('13');
  await carousel
    .getByRole('textbox', { name: 'Your reasoning', exact: true })
    .fill('Differentiate x³ to obtain 3x².');
  await carousel
    .getByRole('textbox', { name: 'Your reasoning', exact: true })
    .press('ArrowLeft');
  await expect(jump).toHaveValue('13');
  await jump.selectOption('1');
  await expect(
    carousel.getByRole('radio', { name: /^Apply the power rule\./ }),
  ).toBeChecked();
  await expect(
    carousel.getByText('That’s right.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Document outline' })
    .getByRole('button', { name: 'Reflection worksheet', exact: true })
    .click();
  await expect(jump).toHaveValue('13');
  await expect(
    carousel.getByRole('textbox', { name: 'Your reasoning', exact: true }),
  ).toHaveValue('Differentiate x³ to obtain 3x².');
  await expect(
    carousel.getByRole('heading', { name: /^Reflection worksheet/ }),
  ).toBeInViewport();
  expect(page.url()).toBe(route);
  await carousel.focus();
  await carousel.press('Home');
  await expect(jump).toHaveValue('0');
  await expect(
    carousel.getByRole('heading', { name: /^Read the context/ }),
  ).toBeVisible();
});

test('copying a whole note or selected context preserves authored Markdown, formulas, and quiz answers', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  await observeClipboard(page, context, browserName);
  await openLibrary(page);
  const formula = block(
    'formula',
    '$$\n\\frac{d}{dx}x^2 = 2x\n$$',
    'id="power-rule" title="A derivative"',
  );
  const quiz = block(
    'quiz',
    `A derivative measures a local rate. What is the derivative of $x^2$?\n\n${block('choice', '$2x$', 'correct="true"')}\n\n${block('choice', '$x^2$', 'correct="false"')}`,
    'title="Check the power rule" explanation="The exponent becomes a coefficient, then decreases by one."',
    4,
  );
  const source = note(
    'Context for an external conversation',
    `## A useful calculation\n\nKeep the **assumption** $x \\in \\mathbb{R}$ in view.\n\n${formula}\n\n${quiz}`,
  );
  await importSource(page, source);
  await page
    .locator('.document-source-action')
    .getByRole('button', { name: 'Copy source', exact: true })
    .click();
  await expect.poll(() => copiedSource(page, browserName)).toBe(source);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __learnmdClipboard?: string }).__learnmdClipboard,
    ),
  ).toBe(source);
  await selectRenderedText(
    page.locator('#power-rule .learn-math-display .katex-html'),
  );
  const copySelection = page.getByRole('button', {
    name: 'Copy source of selection',
    exact: true,
  });
  await expect(copySelection).toBeVisible();
  const selectionBottom = await page.evaluate(() =>
    Math.max(
      ...Array.from(
        window.getSelection()!.getRangeAt(0).getClientRects(),
        (rect) => rect.bottom,
      ),
    ),
  );
  expect((await copySelection.boundingBox())!.y).toBeGreaterThan(
    selectionBottom,
  );
  await page.screenshot({
    path: testInfo.outputPath('copy-selection-source.png'),
  });
  await copySelection.click();
  await expect.poll(() => copiedSource(page, browserName)).toBe(formula);
  await selectRenderedText(page.locator('.learn-quiz > p').first());
  await expect(copySelection).toBeVisible();
  await copySelection.click();
  await expect.poll(() => copiedSource(page, browserName)).toBe(quiz);
  const copied = await copiedSource(page, browserName);
  expect(copied).toContain('correct="true"');
  expect(copied).toContain('$2x$');
  expect(copied).toContain('explanation="The exponent becomes a coefficient');
  expect(copied).not.toContain('Check answer');
  await page.keyboard.press('Escape');
  await expect(copySelection).not.toBeVisible();
});

test('hover trash offers a reversible confirmation and deletes only the chosen local note', async ({
  page,
}) => {
  await openLibrary(page);
  const originalCount = await page.locator('.note-card').count();
  await importSource(
    page,
    note(
      'Keep this independent note',
      'This note must survive deleting its neighbor.',
    ),
  );
  await importSource(
    page,
    note('Remove only this copy', 'This is the one selected for removal.'),
  );
  await allNotes(page);
  const chosen = page.locator('.note-card').filter({
    has: page.getByRole('heading', {
      name: 'Remove only this copy',
      exact: true,
    }),
  });
  const survivor = page.locator('.note-card').filter({
    has: page.getByRole('heading', {
      name: 'Keep this independent note',
      exact: true,
    }),
  });
  await expect(page.locator('.note-card')).toHaveCount(originalCount + 2);
  await chosen.hover();
  await chosen
    .getByRole('button', { name: 'Delete Remove only this copy', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'Confirm delete', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel('Display title')).toHaveValue(
    'Remove only this copy',
  );
  await dialog.getByRole('button', { name: 'Keep it', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Confirm delete', exact: true }),
  ).not.toBeVisible();
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await expect(chosen).toBeVisible();
  await expect(survivor).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(originalCount + 2);
  await chosen.hover();
  await chosen
    .getByRole('button', { name: 'Delete Remove only this copy', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: 'Confirm delete', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(chosen).toHaveCount(0);
  await expect(survivor).toBeVisible();
  await expect(page.locator('.note-card')).toHaveCount(originalCount + 1);
  await page.reload();
  await expect(chosen).toHaveCount(0);
  await expect(survivor).toBeVisible();
  await survivor.locator('.note-open').click();
  await expect(
    page.getByText('This note must survive deleting its neighbor.', {
      exact: true,
    }),
  ).toBeVisible();
});
