import { sourceProps } from './source';
import { useI18n } from '../i18n';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import type { LearnNode } from '../format/types';
import {
  attr,
  BlockHeading,
  elementId,
  flag,
  hasAnchor,
  named,
  rest,
  titleOf,
  useReader,
  useSelection,
} from './context';

export function Progression({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const steps = named(node, ['step', 'item', 'hint']);
  const [selected, select] = useSelection(node, steps.length);
  const [all, setAll] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);
  const reveal = (value: number) => {
    setAll(false);
    select(value);
  };
  return (
    <section
      className={`learn-progression learn-${node.name}`}
      aria-label={titleOf(
        node,
        node.name === 'derivation'
          ? t('Step-by-step derivation', 'Wyprowadzenie krok po kroku')
          : t('Step-by-step explanation', 'Wyjaśnienie krok po kroku'),
      )}
    >
      <BlockHeading
        node={node}
        fallback={
          node.name === 'derivation'
            ? t('Working through it', 'Przejdźmy przez rozumowanie')
            : undefined
        }
      />
      {render(rest(node, ['step', 'item', 'hint']))}
      <div className="learn-step-list">
        {steps.map((step, index) => (
          <div
            id={elementId(step)}
            {...sourceProps(step, 'structural')}
            ref={index === selected ? currentRef : undefined}
            className={`learn-step ${index === selected && !all ? 'is-current' : ''}`}
            key={index}
            hidden={!all && index > selected}
          >
            <span className="learn-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="learn-step-content">
              {attr(step, 'title') && <h5>{attr(step, 'title')}</h5>}
              {render(step.children)}
              {attr(step, 'explanation') && (
                <p className="learn-step-explanation">
                  {attr(step, 'explanation')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {steps.length > 1 && (
        <div className="learn-controls print-hide">
          <button
            type="button"
            className="learn-icon-button"
            onClick={() => reveal(selected - 1)}
            disabled={selected === 0 && !all}
            aria-label={t('Previous step', 'Poprzedni krok')}
          >
            <ArrowLeft size={15} />
          </button>
          <span className="learn-progress-text" aria-live="polite">
            {all
              ? t(
                  `All ${steps.length} steps`,
                  `Wszystkie kroki: ${steps.length}`,
                )
              : t(
                  `Step ${selected + 1} of ${steps.length}`,
                  `Krok ${selected + 1} z ${steps.length}`,
                )}
          </span>
          <button
            type="button"
            className="learn-primary-button"
            onClick={() => reveal(selected + 1)}
            disabled={selected >= steps.length - 1 || all}
          >
            {t('Next step', 'Następny krok')} <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className="learn-text-button"
            onClick={() => {
              setAll(!all);
              if (all) select(0);
            }}
          >
            {all
              ? t('Start again', 'Zacznij od nowa')
              : t('Show all', 'Pokaż wszystko')}
          </button>
        </div>
      )}
    </section>
  );
}

type TabsMode = 'tabs' | 'variants' | 'layers' | 'scenario' | 'branch';
const tabChildren: Record<TabsMode, string[]> = {
  tabs: ['tab'],
  variants: ['variant'],
  layers: ['layer'],
  scenario: ['case'],
  branch: ['option'],
};
export function Tabs({
  node,
  mode = 'tabs',
}: {
  node: LearnNode;
  mode?: TabsMode;
}) {
  const { t } = useI18n();
  const { render } = useReader();
  const entries = named(node, tabChildren[mode]);
  const [selected, select] = useSelection(node, entries.length);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = (index + 1) % entries.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index + entries.length - 1) % entries.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = entries.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      select(next);
      list.current
        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        [next]?.focus();
    }
  }
  return (
    <section className={`learn-tabs learn-${mode}`}>
      <BlockHeading
        node={node}
        fallback={
          mode === 'branch' ? t('Choose a path', 'Wybierz ścieżkę') : undefined
        }
      />
      {render(rest(node, tabChildren[mode]))}
      <div
        ref={list}
        className="learn-tab-list print-hide"
        role="tablist"
        aria-label={titleOf(
          node,
          mode === 'layers'
            ? t('Explanation layers', 'Warstwy wyjaśnienia')
            : t('Content choices', 'Warianty treści'),
        )}
      >
        {entries.map((entry, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={elementId(entry, `${id}-panel-${index}`)}
            aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => select(index)}
          >
            {titleOf(
              entry,
              `${mode === 'branch' ? t('Path', 'Ścieżka') : mode === 'scenario' ? t('Scenario', 'Scenariusz') : t('View', 'Wariant')} ${index + 1}`,
            )}
            {selected === index && mode === 'branch' && (
              <ArrowRight size={14} />
            )}
          </button>
        ))}
      </div>
      {entries.map((entry, index) => (
        <div
          className="learn-tab-panel"
          key={index}
          id={elementId(entry, `${id}-panel-${index}`)}
          {...sourceProps(entry, 'structural')}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${index}`}
          hidden={selected !== index}
          tabIndex={0}
        >
          <h5 className="print-only">
            {titleOf(entry, t(`View ${index + 1}`, `Wariant ${index + 1}`))}
          </h5>
          {render(entry.children)}
        </div>
      ))}
    </section>
  );
}

export function Disclosure({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const name = node.name ?? 'reveal';
  const defaults: Record<string, string> = {
    proof: t('Proof', 'Dowód'),
    reveal: t('Reveal explanation', 'Pokaż wyjaśnienie'),
    hint: t('Show a hint', 'Pokaż podpowiedź'),
    popover: t('More context', 'Więcej kontekstu'),
    question: t('Think it through', 'Zastanów się'),
  };
  const label = attr(node, 'label', attr(node, 'title', defaults[name]));
  const progressive = named(node, ['step']).length > 0;
  return (
    <details
      className={`learn-disclosure learn-${name}`}
      open={flag(node, 'open')}
    >
      <summary>
        <span>{label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="learn-disclosure-body">
        {progressive ? (
          <Progression
            node={{ ...node, attributes: { ...node.attributes, title: '' } }}
          />
        ) : (
          render(node.children)
        )}
        {name === 'proof' && (
          <span
            className="learn-qed"
            aria-label={t('End of proof', 'Koniec dowodu')}
          >
            □
          </span>
        )}
      </div>
    </details>
  );
}

export function Accordion({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  return (
    <section className="learn-accordion">
      <BlockHeading node={node} />
      {render(rest(node, ['item']))}
      {named(node, ['item']).map((item, index) => (
        <div
          key={index}
          id={elementId(item)}
          {...sourceProps(item, 'structural')}
        >
          <Disclosure
            node={{
              ...item,
              name: 'reveal',
              attributes: {
                open: attr(node, 'open', 'false'),
                ...item.attributes,
                title: titleOf(
                  item,
                  t(`Section ${index + 1}`, `Sekcja ${index + 1}`),
                ),
              },
            }}
          />
        </div>
      ))}
    </section>
  );
}

export function Annotated({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render, navigation } = useReader();
  const annotations = named(node, ['annotation']);
  const [selected, setSelected] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    if (navigation) {
      const found = annotations.findIndex((annotation) =>
        hasAnchor(annotation, navigation.id),
      );
      if (found >= 0) setSelected(found);
    }
  }, [navigation]);
  return (
    <section className="learn-annotated">
      <BlockHeading node={node} />
      {render(rest(node, ['annotation']))}
      <div className="learn-annotation-labels">
        {annotations.map((annotation, index) => (
          <button
            key={index}
            type="button"
            className={selected === index ? 'is-active' : ''}
            aria-expanded={selected === index}
            aria-controls={elementId(annotation, `${id}-${index}`)}
            onClick={() => setSelected(selected === index ? null : index)}
          >
            <sup>{index + 1}</sup>
            {attr(
              annotation,
              'label',
              t(`Annotation ${index + 1}`, `Adnotacja ${index + 1}`),
            )}
          </button>
        ))}
      </div>
      {annotations.map((annotation, index) => (
        <aside
          className="learn-annotation-content"
          id={elementId(annotation, `${id}-${index}`)}
          {...sourceProps(annotation, 'structural')}
          key={index}
          hidden={selected !== index}
        >
          <span className="learn-eyebrow">
            {attr(
              annotation,
              'label',
              t(`Note ${index + 1}`, `Uwaga ${index + 1}`),
            )}
          </span>
          {render(annotation.children)}
        </aside>
      ))}
    </section>
  );
}

export function Spotlight({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const items = named(node, ['item', 'region']);
  const [active, setActive] = useSelection(node, items.length);
  const [clear, setClear] = useState(false);
  useEffect(() => setClear(false), [active]);
  return (
    <section className="learn-spotlight">
      <BlockHeading node={node} />
      {render(rest(node, ['item', 'region']))}
      <div className="learn-spotlight-areas">
        {items.map((item, index) => (
          <div
            id={elementId(item)}
            {...sourceProps(item, 'structural')}
            className={`learn-spotlight-area ${!clear && active !== index ? 'is-dimmed' : ''}`}
            key={index}
          >
            <button
              type="button"
              aria-pressed={!clear && active === index}
              onClick={() => {
                setActive(index);
                setClear(false);
              }}
            >
              {titleOf(item, t(`Focus ${index + 1}`, `Fragment ${index + 1}`))}
              {!clear && active === index && <Check size={14} />}
            </button>
            {render(item.children)}
          </div>
        ))}
      </div>
      {!clear && (
        <button
          type="button"
          className="learn-text-button print-hide"
          onClick={() => setClear(true)}
        >
          <RotateCcw size={13} />{' '}
          {t('Clear focus', 'Pokaż wszystkie fragmenty')}{' '}
        </button>
      )}
    </section>
  );
}
