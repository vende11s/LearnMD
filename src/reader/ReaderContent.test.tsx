import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseLearnMD } from '../format/parser';
import { PUBLIC_COMPONENTS } from '../format/registry';
import { ReaderContent } from './ReaderContent';

function document(body: string) {
  return parseLearnMD(
    `---\ntitle: Reader test\nversion: "1.0"\n---\n\n${body}`,
  );
}
function mount(
  body: string,
  detail: 'concise' | 'standard' | 'detailed' = 'standard',
) {
  const parsed = document(body);
  return {
    ...render(<ReaderContent document={parsed} detail={detail} />),
    parsed,
  };
}
const child = (name: string, body: string, attrs = '') =>
  `:::${name}${attrs ? `{${attrs}}` : ''}\n${body}\n:::`;
const group = (name: string, body: string, attrs = '') =>
  `::::${name}${attrs ? `{${attrs}}` : ''}\n${body}\n::::`;

describe('published renderer contract', () => {
  it.each(
    PUBLIC_COMPONENTS.map((component) => [component.name, component.example]),
  )(
    'renders the documented %s example without a component failure or duplicate DOM IDs',
    (_name, example) => {
      const { container, parsed } = mount(example);
      expect(container.querySelector('.learn-render-error')).toBeNull();
      const ids = [...container.querySelectorAll('[id]')].map(
        (element) => element.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      function checkAnchors(nodes: typeof parsed.children) {
        for (const node of nodes) {
          if (node.id)
            expect(ids, `Missing semantic anchor ${node.id}`).toContain(
              node.id,
            );
          if (node.children) checkAnchors(node.children);
        }
      }
      checkAnchors(parsed.children);
    },
  );

  it('reveals derivations incrementally, supports previous and show-all, and preserves the authored explanation', async () => {
    const user = userEvent.setup();
    mount(
      group(
        'derivation',
        `${child('step', 'Initial equation')}\n\n${child('step', 'Subtract four', 'explanation="Keep both sides equal"')}\n\n${child('step', 'Divide by two')}`,
      ),
    );
    expect(screen.getByText('Initial equation')).toBeVisible();
    expect(screen.getByText('Subtract four')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Subtract four')).toBeVisible();
    expect(screen.getByText('Keep both sides equal')).toBeVisible();
    expect(screen.getByText('Divide by two')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByText('Subtract four')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText('Divide by two')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByText('Divide by two')).not.toBeVisible();
  });

  it('supports arrow-key tab navigation and keeps the selected panel accessible', async () => {
    const user = userEvent.setup();
    mount(
      group(
        'tabs',
        `${child('tab', 'Geometric explanation', 'title="Geometry"')}\n\n${child('tab', 'Algebraic explanation', 'title="Algebra"')}`,
      ),
    );
    const geometry = screen.getByRole('tab', { name: 'Geometry' });
    geometry.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Algebra' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Algebra' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Algebraic explanation')).toBeVisible();
    expect(screen.getByText('Geometric explanation')).not.toBeVisible();
    await user.keyboard('{Home}');
    expect(geometry).toHaveFocus();
  });

  it('uses authored initial selections and initially open accordions', () => {
    mount(
      `${group('tabs', `${child('tab', 'First explanation', 'title="First"')}\n\n${child('tab', 'Second explanation', 'title="Second"')}`, 'initial="1"')}\n\n${group('accordion', child('item', 'Expanded initially', 'title="Details"'), 'open="true"')}`,
    );
    expect(screen.getByText('Second explanation')).toBeVisible();
    expect(screen.getByText('First explanation')).not.toBeVisible();
    expect(screen.getByText('Expanded initially')).toBeVisible();
  });

  it('changes global density without resetting exercise state, and uses the corresponding layer', async () => {
    const user = userEvent.setup();
    const parsed = document(
      `${child('detail-level', 'Detailed assumptions', 'level="detailed"')}\n\n${group('layers', `${child('layer', 'Short version', 'title="Concise" level="concise"')}\n\n${child('layer', 'Full version', 'title="Detailed" level="detailed"')}`)}\n\n${group('quiz', `${child('choice', 'The true statement', 'correct="true"')}\n\n${child('choice', 'The false statement', 'correct="false"')}`)}`,
    );
    const { rerender } = render(
      <ReaderContent document={parsed} detail="concise" />,
    );
    expect(screen.getByText('Detailed assumptions')).not.toBeVisible();
    await user.click(screen.getByLabelText('The true statement'));
    rerender(<ReaderContent document={parsed} detail="detailed" />);
    expect(screen.getByText('Detailed assumptions')).toBeVisible();
    expect(screen.getByText('Full version')).toBeVisible();
    expect(screen.getByLabelText('The true statement')).toBeChecked();
  });

  it('shares explicitly declared state and resets interactions for a different document', async () => {
    const user = userEvent.setup();
    const source = `${child('variable', '', 'name="extra" value="off"')}\n\n${child('toggle', '', 'target="extra" on="on" off="off" label="Show assumptions"')}\n\n${child('conditional', 'Assume continuity', 'target="extra" equals="on"')}`;
    const { rerender } = mount(source);
    expect(screen.getByText('Assume continuity')).not.toBeVisible();
    await user.click(screen.getByRole('switch', { name: 'Show assumptions' }));
    expect(screen.getByText('Assume continuity')).toBeVisible();
    rerender(
      <ReaderContent
        document={document(`${source}\n\nDifferent note.`)}
        detail="standard"
      />,
    );
    expect(
      screen.getByRole('switch', { name: 'Show assumptions' }),
    ).not.toBeChecked();
    expect(screen.getByText('Assume continuity')).not.toBeVisible();
  });

  it('synchronizes mathematical steps with an explanation tab and a spotlight region', async () => {
    const user = userEvent.setup();
    const body = `${group('steps', `${child('step', 'Equation one')}\n\n${child('step', 'Equation two')}`)}\n\n${group('tabs', `${child('tab', 'Explain one', 'title="First"')}\n\n${child('tab', 'Explain two', 'title="Second"')}`)}\n\n${group('spotlight', `${child('item', 'Focus one', 'title="First focus"')}\n\n${child('item', 'Focus two', 'title="Second focus"')}`)}`;
    mount(`:::::sync{group="proof"}\n${body}\n:::::`);
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Explain two')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Second focus' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('tab', { name: 'First' }));
    expect(screen.getByText('Equation two')).not.toBeVisible();
  });

  it('navigates to a semantic ID inside a hidden tab without changing the application route', async () => {
    const user = userEvent.setup();
    window.location.hash = '#note/retained';
    mount(
      `${child('reference', '', 'target="target-step" label="Jump to the argument"')}\n\n${group('tabs', `${child('tab', 'First panel', 'title="Overview"')}\n\n${child('tab', 'Referenced argument', 'title="Argument" id="target-step"')}`)}`,
    );
    expect(screen.getByText('Referenced argument')).not.toBeVisible();
    await user.click(
      screen.getByRole('link', { name: 'Jump to the argument' }),
    );
    expect(window.location.hash).toBe('#note/retained');
    expect(screen.getByRole('tab', { name: 'Argument' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Referenced argument')).toBeVisible();
  });

  it('shows the question before revealing its authored answer', async () => {
    const user = userEvent.setup();
    mount(
      child(
        'question',
        'Why does this need a limit?',
        'answer="To find the local rate."',
      ),
    );
    expect(screen.getByText('Why does this need a limit?')).toBeVisible();
    expect(screen.getByText('To find the local rate.')).not.toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Explore the answer' }),
    );
    expect(screen.getByText('To find the local rate.')).toBeVisible();
  });

  it('checks multiple choices as a set and gives meaningful feedback', async () => {
    const user = userEvent.setup();
    mount(
      group(
        'quiz',
        `${child('choice', 'Two is even', 'correct="true"')}\n\n${child('choice', 'Four is even', 'correct="true"')}\n\n${child('choice', 'Three is even', 'correct="false"')}`,
        'multiple="true" explanation="Even numbers divide by two."',
      ),
    );
    await user.click(screen.getByLabelText('Two is even'));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('status')).toHaveTextContent('Take another look.');
    await user.click(screen.getByLabelText('Four is even'));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('status')).toHaveTextContent('That’s right.');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Even numbers divide by two.',
    );
  });

  it('checks matching pairs and permits keyboard-friendly sequence reordering', async () => {
    const user = userEvent.setup();
    mount(
      `${group('match', `${child('pair', '', 'left="Derivative" right="Rate"')}\n\n${child('pair', '', 'left="Integral" right="Area"')}`)}\n\n${group('sort', `${child('item', 'First step', 'title="Observe"')}\n\n${child('item', 'Second step', 'title="Explain"')}`)}`,
    );
    await user.selectOptions(screen.getByLabelText('Derivative'), 'Rate');
    await user.selectOptions(screen.getByLabelText('Integral'), 'Area');
    await user.click(screen.getByRole('button', { name: 'Check matches' }));
    expect(screen.getByText('All connections are correct.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Move Observe up' }));
    await user.click(screen.getByRole('button', { name: 'Check order' }));
    expect(screen.getByText('That sequence is correct.')).toBeVisible();
  });

  it('follows state-machine transitions and resets to the initial state', async () => {
    const user = userEvent.setup();
    const { container } = mount(
      group(
        'state-machine',
        `${child('node', 'Waiting for work', 'id="idle" label="Idle"')}\n\n${child('node', 'Doing work', 'id="busy" label="Busy"')}\n\n${child('edge', '', 'from="idle" to="busy" label="Begin"')}`,
        'start="idle"',
      ),
    );
    expect(screen.getByRole('button', { name: 'Idle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Begin Busy' }));
    expect(screen.getByRole('button', { name: 'Busy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      container.querySelector('.learn-diagram-description'),
    ).toHaveTextContent('Doing work');
    await user.click(screen.getByRole('button', { name: 'Reset state' }));
    expect(screen.getByRole('button', { name: 'Idle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('highlights the current code walkthrough lines and copies exact code', async () => {
    const user = userEvent.setup();
    mount(
      group(
        'code-walkthrough',
        `\`\`\`js\nconst x = 2;\nconsole.log(x);\n\`\`\`\n\n${child('step', 'Create a variable', 'title="Bind" lines="1"')}\n\n${child('step', 'Display the value', 'title="Print" lines="2"')}`,
      ),
    );
    await user.click(screen.getByRole('button', { name: /Print/ }));
    expect(screen.getByText('Display the value')).toBeVisible();
    expect(
      documentGlobal().querySelector('.learn-code-line.is-highlighted'),
    ).toHaveTextContent('console.log(x);');
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(await navigator.clipboard.readText()).toBe(
      'const x = 2;\nconsole.log(x);',
    );
  });

  it('sorts numeric GFM table columns numerically', async () => {
    const user = userEvent.setup();
    mount(
      child(
        'data-table',
        '| Name | Count |\n| --- | --- |\n| Ten | 10 |\n| Two | 2 |',
        'sortable="true"',
      ),
    );
    await user.click(screen.getByRole('button', { name: /Count/ }));
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Two');
    expect(screen.getByRole('columnheader', { name: /Count/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('renders untrusted source without executable markup or remote resource requests', async () => {
    const user = userEvent.setup();
    const { container } = mount(
      '![External illustration](https://example.com/figure.png)\n\n[bad](javascript:alert(1))\n\n<script>window.attacked=true</script>\n\n$\\htmlClass{evil}{x}$',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script, iframe, .evil')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Load image from example.com' }),
    );
    expect(
      screen.getByRole('img', { name: 'External illustration' }),
    ).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('copies original LaTeX and restores closed disclosures after print', async () => {
    const user = userEvent.setup();
    const { container } = mount(
      `$$\nx^2 + y^2\n$$\n\n${child('proof', 'Complete proof content.')}`,
    );
    await user.click(screen.getByRole('button', { name: 'Copy LaTeX' }));
    expect(await navigator.clipboard.readText()).toBe('x^2 + y^2');
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    fireEvent(window, new Event('beforeprint'));
    expect(details.open).toBe(true);
    fireEvent(window, new Event('afterprint'));
    expect(details.open).toBe(false);
  });
});

// Keeps the test helper named document distinct from the browser document.
function documentGlobal() {
  return window.document;
}
