import { useId, useRef, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { LearnNode } from '../format/types';
import { useI18n } from '../i18n';
import {
  BlockHeading,
  elementId,
  named,
  rest,
  titleOf,
  useReader,
  useSelection,
} from './context';
import { sourceProps } from './source';

/** Slides stay mounted: navigating never destroys quiz answers or scratch work. */
export function Carousel({ node }: { node: LearnNode }) {
  const { t } = useI18n();
  const { render } = useReader();
  const slides = named(node, ['slide']);
  const [selected, select] = useSelection(node, slides.length);
  const id = useId();
  const region = useRef<HTMLElement>(null);
  const label = titleOf(node, t('Interactive pages', 'Interaktywne strony'));
  function move(next: number) {
    select(next);
    requestAnimationFrame(() => {
      // A long quiz may leave its navigation below the top of the next slide.
      if (region.current && region.current.getBoundingClientRect().top < 0) {
        region.current.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : 'smooth',
        });
      }
    });
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.learn-carousel') !== event.currentTarget) return;
    if (
      target !== event.currentTarget &&
      !target.closest('[data-carousel-navigation]')
    )
      return;
    if (target.matches('input, textarea, select, [contenteditable="true"]'))
      return;
    const next =
      event.key === 'ArrowRight'
        ? selected + 1
        : event.key === 'ArrowLeft'
          ? selected - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? slides.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    move(next);
  }
  if (!slides.length)
    return (
      <section className="learn-carousel">
        <BlockHeading node={node} />
        <p className="learn-empty">
          {t(
            'Add at least one slide to this carousel.',
            'Dodaj co najmniej jeden slajd do tej karuzeli.',
          )}
        </p>
        {render(rest(node, ['slide']))}
      </section>
    );
  return (
    <section
      ref={region}
      className="learn-carousel"
      role="region"
      aria-roledescription={t('carousel', 'karuzela')}
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <BlockHeading node={node} />
      {render(rest(node, ['slide']))}
      <div className="learn-carousel-position print-hide">
        <span aria-live="polite" aria-atomic="true">
          {t(
            `Slide ${selected + 1} of ${slides.length}`,
            `Slajd ${selected + 1} z ${slides.length}`,
          )}
        </span>
        <label className="learn-sr-only" htmlFor={`${id}-jump`}>
          {t('Go to slide', 'Przejdź do slajdu')}
        </label>
        <select
          id={`${id}-jump`}
          value={selected}
          onChange={(event) => move(Number(event.target.value))}
        >
          {slides.map((slide, index) => (
            <option key={index} value={index}>
              {index + 1}.{' '}
              {titleOf(slide, t(`Slide ${index + 1}`, `Slajd ${index + 1}`))}
            </option>
          ))}
        </select>
        <span className="learn-carousel-keyboard-hint">
          {t('← → to navigate', '← → przewijanie')}
        </span>
      </div>
      <div className="learn-carousel-slides">
        {slides.map((slide, index) => (
          <div
            key={index}
            id={elementId(slide, `${id}-slide-${index}`)}
            {...sourceProps(slide, 'structural')}
            className="learn-carousel-slide"
            role="group"
            aria-roledescription={t('slide', 'slajd')}
            aria-label={`${index + 1} / ${slides.length}${titleOf(slide, '') ? ` · ${titleOf(slide, '')}` : ''}`}
            hidden={selected !== index}
          >
            <BlockHeading node={slide} />
            {render(slide.children)}
          </div>
        ))}
      </div>
      <div
        className="learn-carousel-navigation print-hide"
        data-carousel-navigation="true"
      >
        <button
          type="button"
          className="learn-secondary-button"
          disabled={selected === 0}
          onClick={() => move(selected - 1)}
        >
          <ArrowLeft size={15} />
          {t('Previous slide', 'Poprzedni slajd')}
        </button>
        <div className="learn-carousel-progress" aria-hidden="true">
          <span
            style={{
              width: `${((selected + 1) / Math.max(1, slides.length)) * 100}%`,
            }}
          />
        </div>
        <button
          type="button"
          className="learn-primary-button"
          disabled={selected === slides.length - 1}
          onClick={() => move(selected + 1)}
        >
          {t('Next slide', 'Następny slajd')}
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
