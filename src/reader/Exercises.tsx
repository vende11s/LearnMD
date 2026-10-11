import { useEffect, useId, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { LearnNode } from '../format/types';
import {
  attr,
  BlockHeading,
  elementId,
  flag,
  hasAnchor,
  named,
  plainText,
  rest,
  titleOf,
  useReader,
} from './context';

function Feedback({
  success,
  children,
}: {
  success: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`learn-feedback ${success ? 'is-correct' : 'is-retry'}`}
      role="status"
    >
      {success && <Check size={16} />}
      <div>{children}</div>
    </div>
  );
}

export function Quiz({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const choices = named(node, ['choice']);
  const multiple = flag(node, 'multiple');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState(false);
  const id = useId();
  const correct = choices.every(
    (choice, index) => flag(choice, 'correct') === selected.has(index),
  );
  return (
    <section className="learn-exercise learn-quiz">
      <BlockHeading node={node} fallback="Check your understanding" />
      {render(rest(node, ['choice']))}
      <fieldset>
        <legend className="learn-sr-only">
          {titleOf(node, 'Choose the correct answer')}
        </legend>
        {choices.map((choice, index) => (
          <label
            id={elementId(choice)}
            className={`learn-choice ${checked && flag(choice, 'correct') ? 'is-correct' : ''} ${selected.has(index) ? 'is-selected' : ''}`}
            key={index}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={id}
              checked={selected.has(index)}
              onChange={() => {
                setChecked(false);
                setSelected((current) =>
                  multiple
                    ? new Set(
                        current.has(index)
                          ? [...current].filter((item) => item !== index)
                          : [...current, index],
                      )
                    : new Set([index]),
                );
              }}
            />
            <span>{render(choice.children)}</span>
            {checked && flag(choice, 'correct') && (
              <Check size={16} aria-label="Correct choice" />
            )}
          </label>
        ))}
      </fieldset>
      <div className="learn-controls print-hide">
        <button
          type="button"
          className="learn-primary-button"
          disabled={!selected.size}
          onClick={() => setChecked(true)}
        >
          Check answer
        </button>
        {multiple && <span className="learn-help">Choose all that apply</span>}
      </div>
      {checked && (
        <Feedback success={correct}>
          <strong>{correct ? 'That’s right.' : 'Take another look.'}</strong>
          {attr(node, 'explanation') && <p>{attr(node, 'explanation')}</p>}
          {!correct && !attr(node, 'explanation') && (
            <p>
              The correct {multiple ? 'choices are' : 'choice is'} marked.
              Compare the reasoning with your selection.
            </p>
          )}
        </Feedback>
      )}
      <div className="print-only">
        <strong>Answer:</strong>{' '}
        {choices
          .filter((choice) => flag(choice, 'correct'))
          .map(plainText)
          .join('; ')}{' '}
        {attr(node, 'explanation')}
      </div>
    </section>
  );
}

export function FillBlank({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const normalize = (value: string) =>
    flag(node, 'caseSensitive')
      ? value.trim().normalize('NFKC')
      : value.trim().normalize('NFKC').toLocaleLowerCase();
  const correct = attr(node, 'answer')
    .split('|')
    .some((candidate) => normalize(candidate) === normalize(answer));
  const id = useId();
  return (
    <section className="learn-exercise">
      <BlockHeading node={node} fallback="Complete the thought" />
      {render(node.children)}
      <form
        className="learn-inline-form print-hide"
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
      >
        <label className="learn-sr-only" htmlFor={id}>
          {attr(node, 'title', 'Your answer')}
        </label>
        <input
          id={id}
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setChecked(false);
          }}
          placeholder={attr(node, 'placeholder', 'Your answer…')}
          autoComplete="off"
        />
        <button className="learn-primary-button" disabled={!answer.trim()}>
          Check answer
        </button>
      </form>
      {checked && (
        <Feedback success={correct}>
          {correct
            ? 'Exactly right.'
            : 'Not quite — revisit the explanation and try again.'}
        </Feedback>
      )}
      <details className="learn-small-reveal">
        <summary>Show accepted answer</summary>
        <p>{attr(node, 'answer').split('|').join(' or ')}</p>
      </details>
    </section>
  );
}

export function Match({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const pairs = named(node, ['pair']);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const correct = pairs.every(
    (pair, index) => answers[index] === attr(pair, 'right'),
  );
  const choices = [
    ...new Set(pairs.map((pair) => attr(pair, 'right'))),
  ].reverse();
  const id = useId();
  return (
    <section className="learn-exercise">
      <BlockHeading node={node} fallback="Connect the ideas" />
      {render(rest(node, ['pair']))}
      <div className="learn-match-list">
        {pairs.map((pair, index) => (
          <div className="learn-match-row" key={index} id={elementId(pair)}>
            <label htmlFor={`${id}-${index}`}>{attr(pair, 'left')}</label>
            <ArrowRight size={14} aria-hidden="true" />
            <select
              id={`${id}-${index}`}
              value={answers[index] ?? ''}
              onChange={(event) => {
                setAnswers({ ...answers, [index]: event.target.value });
                setChecked(false);
              }}
            >
              <option value="">Choose a match</option>
              {choices.map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
            <span className="print-only">{attr(pair, 'right')}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="learn-primary-button print-hide"
        disabled={pairs.some((_, index) => !answers[index])}
        onClick={() => setChecked(true)}
      >
        Check matches
      </button>
      {checked && (
        <Feedback success={correct}>
          {correct
            ? 'All connections are correct.'
            : `${pairs.filter((pair, index) => answers[index] === attr(pair, 'right')).length} of ${pairs.length} connections are correct. Try adjusting the others.`}
        </Feedback>
      )}
    </section>
  );
}

export function Sort({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const items = named(node, ['item']);
  const [order, setOrder] = useState(() =>
    items.map((_, index) => index).reverse(),
  );
  const [checked, setChecked] = useState(false);
  const move = (index: number, direction: -1 | 1) => {
    const copy = [...order];
    const other = index + direction;
    if (other < 0 || other >= copy.length) return;
    [copy[index], copy[other]] = [copy[other], copy[index]];
    setOrder(copy);
    setChecked(false);
  };
  const correct = order.every((value, index) => value === index);
  return (
    <section className="learn-exercise">
      <BlockHeading node={node} fallback="Put it in order" />
      {render(rest(node, ['item']))}
      <ol className="learn-sort-list print-hide">
        {order.map((itemIndex, position) => (
          <li key={itemIndex} id={elementId(items[itemIndex])}>
            <span className="learn-sort-position">{position + 1}</span>
            <div>
              {attr(items[itemIndex], 'title') && (
                <strong>{attr(items[itemIndex], 'title')}</strong>
              )}
              {render(items[itemIndex].children)}
            </div>
            <div className="learn-sort-controls">
              <button
                type="button"
                className="learn-icon-button"
                aria-label={`Move ${titleOf(items[itemIndex], `item ${itemIndex + 1}`)} up`}
                disabled={position === 0}
                onClick={() => move(position, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="learn-icon-button"
                aria-label={`Move ${titleOf(items[itemIndex], `item ${itemIndex + 1}`)} down`}
                disabled={position === order.length - 1}
                onClick={() => move(position, 1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="learn-primary-button print-hide"
        onClick={() => setChecked(true)}
      >
        Check order
      </button>
      {checked && (
        <Feedback success={correct}>
          {correct
            ? 'That sequence is correct.'
            : 'The sequence needs another look. Use the arrows to move each step.'}
        </Feedback>
      )}
      <ol className="print-only">
        {items.map((item, index) => (
          <li key={index}>
            {attr(item, 'title')}
            {plainText(item)}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Question({ node }: { node: LearnNode }) {
  const { render, navigation } = useReader();
  const [prediction, setPrediction] = useState('');
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (navigation && hasAnchor(node, navigation.id)) setRevealed(true);
  }, [navigation]);
  const id = useId();
  const answer = named(node, ['answer', 'explanation']);
  const isPrediction = node.name === 'predict';
  const prompt = attr(node, 'prompt');
  const bodyIsQuestion =
    answer.length > 0 || (!prompt && Boolean(attr(node, 'answer')));
  return (
    <section className="learn-exercise">
      <BlockHeading
        node={node}
        fallback={isPrediction ? 'Pause and predict' : 'A question to consider'}
      />
      {prompt && <p className="learn-question-prompt">{prompt}</p>}
      {bodyIsQuestion && render(rest(node, ['answer', 'explanation']))}
      {isPrediction && (
        <div className="print-hide">
          <label className="learn-help" htmlFor={id}>
            What do you expect to happen?
          </label>
          <textarea
            id={id}
            rows={2}
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
            placeholder="Write your reasoning before revealing the outcome…"
          />
        </div>
      )}
      <button
        type="button"
        className="learn-text-button print-hide"
        aria-expanded={revealed}
        aria-controls={`${id}-answer`}
        onClick={() => setRevealed(!revealed)}
      >
        {revealed
          ? 'Hide explanation'
          : isPrediction
            ? 'Reveal outcome'
            : 'Explore the answer'}
        <ArrowRight size={14} />
      </button>
      <div className="learn-answer" id={`${id}-answer`} hidden={!revealed}>
        {attr(node, 'answer') && <p>{attr(node, 'answer')}</p>}
        {answer.length > 0
          ? answer.map((item, index) => (
              <div key={index} id={elementId(item)}>
                {render(item.children)}
              </div>
            ))
          : !bodyIsQuestion && render(node.children)}
      </div>
    </section>
  );
}

export function Checklist({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const directItems = named(node, ['item']);
  const items = directItems.length
    ? directItems
    : (node.children ?? [])
        .filter((child) => child.type === 'list')
        .flatMap((list) => list.children ?? []);
  const [checked, setChecked] = useState(
    () =>
      new Set(
        items.flatMap((item, index) =>
          item.checked || flag(item, 'checked') ? [index] : [],
        ),
      ),
  );
  return (
    <section className="learn-checklist">
      <BlockHeading node={node} />
      {render(
        (node.children ?? []).filter(
          (child) => child.name !== 'item' && child.type !== 'list',
        ),
      )}
      <div className="learn-checklist-progress" aria-live="polite">
        {checked.size} of {items.length} considered
      </div>
      {items.map((item, index) => (
        <label
          className="learn-checklist-item"
          key={index}
          id={elementId(item)}
        >
          <input
            type="checkbox"
            checked={checked.has(index)}
            onChange={() =>
              setChecked(
                (current) =>
                  new Set(
                    current.has(index)
                      ? [...current].filter((value) => value !== index)
                      : [...current, index],
                  ),
              )
            }
          />
          <div>
            {attr(item, 'title') && <strong>{attr(item, 'title')}</strong>}
            {render(item.children)}
          </div>
        </label>
      ))}
    </section>
  );
}

export function Scratchpad({ node }: { node: LearnNode }) {
  const { render } = useReader();
  const [value, setValue] = useState('');
  const id = useId();
  return (
    <section className="learn-scratchpad">
      <BlockHeading node={node} fallback="Space to think" />
      {render(node.children)}
      <label className="learn-sr-only" htmlFor={id}>
        {titleOf(node, 'Temporary scratchpad')}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={5}
        maxLength={20000}
        spellCheck
        placeholder={attr(
          node,
          'placeholder',
          'Try a calculation, sketch an argument, or put it in your own words…',
        )}
      />
      <div className="learn-scratchpad-footer">
        <span>Temporary · cleared when you leave this note</span>
        {value && (
          <button
            type="button"
            className="learn-text-button"
            onClick={() => setValue('')}
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

export function DecisionTree({ node }: { node: LearnNode }) {
  const { render, navigation } = useReader();
  const nodes = named(node, ['node']);
  const edges = named(node, ['edge']);
  const start = attr(
    node,
    'root',
    attr(node, 'start', attr(nodes[0] ?? node, 'id')),
  );
  const [path, setPath] = useState([start]);
  useEffect(() => {
    if (!navigation) return;
    const destination = nodes.find((item) => hasAnchor(item, navigation.id));
    if (destination) setPath([start, attr(destination, 'id')]);
  }, [navigation]);
  const current = nodes.find((item) => attr(item, 'id') === path.at(-1));
  const jump = (target: string) => {
    if (nodes.some((item) => attr(item, 'id') === target))
      setPath([...path, target]);
  };
  const choices = current
    ? [
        ...(['yes', 'no', 'next'] as const)
          .filter((key) => attr(current, key))
          .map((key) => ({
            label: key === 'next' ? 'Continue' : key === 'yes' ? 'Yes' : 'No',
            target: attr(current, key),
          })),
        ...edges
          .filter((edge) => attr(edge, 'from') === attr(current, 'id'))
          .map((edge) => ({
            label: attr(edge, 'label', 'Continue'),
            target: attr(edge, 'to'),
          })),
      ]
    : [];
  return (
    <section className="learn-decision-tree">
      <BlockHeading node={node} fallback="Follow the reasoning" />
      {render(rest(node, ['node', 'edge']))}
      {path.length > 1 && (
        <p className="learn-help print-hide">
          {path
            .map((id) =>
              titleOf(
                nodes.find((item) => attr(item, 'id') === id) ?? node,
                id,
              ),
            )
            .join(' → ')}
        </p>
      )}
      {nodes.map((item, index) => (
        <div
          className="learn-decision-current"
          key={index}
          hidden={current !== item}
        >
          <h5>{titleOf(item, attr(item, 'id'))}</h5>
          {render(item.children)}
          {attr(item, 'description') && <p>{attr(item, 'description')}</p>}
          <div className="print-only">
            {['yes', 'no', 'next']
              .filter((key) => attr(item, key))
              .map((key) => (
                <p key={key}>
                  {key}: {attr(item, key)}
                </p>
              ))}
          </div>
        </div>
      ))}
      {!current && (
        <p className="learn-empty">The starting decision is unavailable.</p>
      )}
      <div className="learn-controls print-hide">
        {choices.map((choice, index) => (
          <button
            key={index}
            type="button"
            className="learn-primary-button"
            disabled={
              !nodes.some((item) => attr(item, 'id') === choice.target) ||
              path.length >= 50
            }
            onClick={() => jump(choice.target)}
          >
            {choice.label}
            <ArrowRight size={14} />
          </button>
        ))}
        {current && !choices.length && (
          <span className="learn-eyebrow">End of this path</span>
        )}
      </div>
      {path.length > 1 && (
        <div className="learn-controls print-hide">
          <button
            type="button"
            className="learn-text-button"
            onClick={() => setPath(path.slice(0, -1))}
          >
            Back one decision
          </button>
          <button
            type="button"
            className="learn-text-button"
            onClick={() => setPath([start])}
          >
            <RotateCcw size={13} /> Start again
          </button>
        </div>
      )}
      <div className="print-only">
        {edges.map((edge, index) => (
          <p key={index} id={elementId(edge)}>
            {attr(edge, 'from')} → {attr(edge, 'to')}: {attr(edge, 'label')}
          </p>
        ))}
      </div>
    </section>
  );
}
