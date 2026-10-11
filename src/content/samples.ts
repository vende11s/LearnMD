import { calculusSource } from './calculus';
import { linearAlgebraSource } from './linear-algebra';
import { algorithmsSource } from './algorithms';
import { networksSource } from './networks';
import { physicsSource } from './physics';
import { historySource } from './history';

export interface SampleDocument {
  id: string;
  title: string;
  description: string;
  subject: string;
  source: string;
}

export const SAMPLES: SampleDocument[] = [
  {
    id: 'calculus',
    title: 'The art of understanding change',
    description:
      'A thoughtful introduction to derivatives, from a moving point to the shape of a function.',
    subject: 'Calculus',
    source: calculusSource,
  },
  {
    id: 'linear-algebra',
    title: 'Seeing through linear transformations',
    description:
      'Vectors, matrices, and eigenvectors as a language for geometry.',
    subject: 'Linear algebra',
    source: linearAlgebraSource,
  },
  {
    id: 'algorithms',
    title: 'The quiet power of binary search',
    description:
      'An invariant-first guide to an algorithm that is simple to state and subtle to get right.',
    subject: 'Computer science',
    source: algorithmsSource,
  },
  {
    id: 'networks',
    title: 'A packet’s journey across the internet',
    description:
      'Follow a request through names, connections, layers, and trust boundaries.',
    subject: 'Computer networks',
    source: networksSource,
  },
  {
    id: 'physics',
    title: 'Energy, motion, and the pendulum',
    description:
      'Discover why the same mathematics appears in springs, circuits, and swinging masses.',
    subject: 'Physics',
    source: physicsSource,
  },
  {
    id: 'history',
    title: 'Reading the Industrial Revolution',
    description:
      'A careful study of technological change, lived experience, and historical evidence.',
    subject: 'History',
    source: historySource,
  },
];
