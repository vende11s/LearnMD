import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider, LANGUAGE_KEY, useI18n } from '../i18n';
import { parseLearnMD } from '../format/parser';
import { ReaderContent } from './ReaderContent';

const parse = (source: string) =>
  parseLearnMD(`---\ntitle: Practice\nversion: '1.0'\n---\n\n${source}`);
const quizSlides = `::::::carousel{title="Practice sequence"}
:::::slide{title="Reason it through"}
::::quiz
Which statement is correct?
:::choice{correct="true"}
A square has four sides.
:::
:::choice{correct="false"}
A square has five sides.
:::
::::
::::: 
:::::slide{title="Work it out" id="working-slide"}
## A second perspective
:::scratchpad{title="My reasoning"}
:::
:::::
::::::`;

describe('carousel reading and persistent slide state', () => {
  it('retains answers, feedback, and scratch work while navigating arbitrary nested content', async () => {
    const user = userEvent.setup();
    const document = parse(quizSlides);
    expect(
      document.diagnostics.filter((item) => item.severity === 'error'),
    ).toEqual([]);
    render(<ReaderContent document={document} />);
    expect(screen.getByText('Slide 1 of 2')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Previous slide' }),
    ).toBeDisabled();
    await user.click(screen.getByLabelText('A square has four sides.'));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('status')).toHaveTextContent('That’s right.');
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'My reasoning' }),
      'Each angle is a right angle.',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Go to slide' }),
      '0',
    );
    expect(screen.getByLabelText('A square has four sides.')).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('That’s right.');
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('textbox', { name: 'My reasoning' })).toHaveValue(
      'Each angle is a right angle.',
    );
  });

  it('scopes keyboard navigation to the focused carousel and leaves nested controls usable', async () => {
    const user = userEvent.setup();
    render(<ReaderContent document={parse(quizSlides)} />);
    const carousel = screen.getByRole('region', { name: 'Practice sequence' });
    fireEvent.keyDown(window.document.body, { key: 'ArrowRight' });
    expect(screen.getByText('Slide 1 of 2')).toBeVisible();
    carousel.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Slide 2 of 2')).toBeVisible();
    const scratchpad = screen.getByRole('textbox', { name: 'My reasoning' });
    scratchpad.focus();
    await user.keyboard('{ArrowLeft}{Home}');
    expect(screen.getByText('Slide 2 of 2')).toBeVisible();
    carousel.focus();
    await user.keyboard('{Home}');
    const correct = screen.getByLabelText('A square has four sides.');
    correct.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Slide 1 of 2')).toBeVisible();
    carousel.focus();
    await user.keyboard('{End}{ArrowRight}');
    expect(screen.getByText('Slide 2 of 2')).toBeVisible();
  });

  it('opens a slide through a semantic reference while preserving the application route', async () => {
    const user = userEvent.setup();
    window.location.hash = '#note/practice';
    render(
      <ReaderContent
        document={parse(
          `:::reference{target="working-slide" label="Go to my work"}\n:::\n\n${quizSlides}`,
        )}
      />,
    );
    await user.click(screen.getByRole('link', { name: 'Go to my work' }));
    expect(screen.getByText('Slide 2 of 2')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'My reasoning' })).toBeVisible();
    expect(window.location.hash).toBe('#note/practice');
  });

  it('shares a declared initial index through sync and supports independent nested carousels', async () => {
    const user = userEvent.setup();
    const sequence = (name: string) =>
      `::::carousel{title="${name}" initial="1"}\n:::slide{title="One"}\nFirst ${name}\n:::\n:::slide{title="Two"}\nSecond ${name}\n:::\n::::`;
    render(
      <ReaderContent
        document={parse(
          `:::::sync{group="linked"}\n${sequence('Left')}\n\n${sequence('Right')}\n:::::`,
        )}
      />,
    );
    const left = screen.getByRole('region', { name: 'Left' }),
      right = screen.getByRole('region', { name: 'Right' });
    expect(within(left).getByText('Second Left')).toBeVisible();
    expect(within(right).getByText('Second Right')).toBeVisible();
    await user.click(
      within(left).getByRole('button', { name: 'Previous slide' }),
    );
    expect(within(right).getByText('First Right')).toBeVisible();
    expect(within(right).getByText('Second Right')).not.toBeVisible();
  });

  it('localizes controls without translating authored content or resetting answers', async () => {
    const user = userEvent.setup();
    localStorage.setItem(LANGUAGE_KEY, 'pl');
    function Switcher() {
      const { setLanguage } = useI18n();
      return <button onClick={() => setLanguage('en')}>English UI</button>;
    }
    render(
      <I18nProvider>
        <Switcher />
        <ReaderContent document={parse(quizSlides)} />
      </I18nProvider>,
    );
    expect(screen.getByText('Slajd 1 z 2')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Następny slajd' }),
    ).toBeVisible();
    expect(screen.getByText('Sprawdź zrozumienie')).toBeVisible();
    await user.click(screen.getByLabelText('A square has four sides.'));
    await user.click(screen.getByRole('button', { name: 'Sprawdź odpowiedź' }));
    expect(screen.getByRole('status')).toHaveTextContent('Zgadza się.');
    await user.click(screen.getByRole('button', { name: 'English UI' }));
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeVisible();
    expect(screen.getByLabelText('A square has four sides.')).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('That’s right.');
    localStorage.removeItem(LANGUAGE_KEY);
  });
});
