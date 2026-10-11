import { englishGuideSource } from './guide.en';
import { polishGuideSource } from './guide.pl';

export const GUIDE_ID = 'learnmd-guide';
export type GuideLanguage = 'en' | 'pl';

/** Migration identities only: the retired chapter bodies are no longer bundled. */
export const LEGACY_SAMPLE_IDS = [
  'calculus',
  'linear-algebra',
  'algorithms',
  'networks',
  'physics',
  'history',
] as const;

export interface GuideDocument {
  id: string;
  title: string;
  description: string;
  subject: string;
  source: string;
}

const guides: Record<GuideLanguage, GuideDocument> = {
  en: {
    id: GUIDE_ID,
    title: 'Your first steps with LearnMD',
    description: 'Three steps. Four quick challenges. Your turn.',
    subject: 'Getting started',
    source: englishGuideSource,
  },
  pl: {
    id: GUIDE_ID,
    title: 'Pierwsze kroki z LearnMD',
    description: 'Trzy kroki. Cztery krótkie zadania. Teraz Ty.',
    subject: 'Na początek',
    source: polishGuideSource,
  },
};

export function getGuide(language: GuideLanguage): GuideDocument {
  return { ...guides[language] };
}
