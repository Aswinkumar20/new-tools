import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';

/** Display refresh interval while a test is running (ms). */
export const TYPING_TICK_MS = 100;

/** Max stored results (newest first). */
export const TYPING_RESULTS_LIMIT = 10;

/** Accuracy below this suggests focusing on precision. */
export const TYPING_LOW_ACCURACY_PERCENT = 90;

/** WPM at or above this is treated as a strong speed result. */
export const TYPING_HIGH_WPM = 60;

export const TYPING_SAMPLE_TEXTS: ReadonlyArray<string> = [
  'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.',
  'Programming is the art of telling a computer what to do through a series of instructions. It requires logic, creativity, and problem-solving skills.',
  'The internet has revolutionized how we communicate, work, and access information. It connects billions of people around the world.',
  'Learning to type efficiently is an essential skill in the digital age. Practice regularly to improve your speed and accuracy.',
  'Nature provides us with beauty, resources, and inspiration. We must protect and preserve our environment for future generations.',
  'Books are windows to different worlds, perspectives, and knowledge. Reading expands our minds and enriches our lives.',
  'Technology continues to evolve at a rapid pace, transforming industries and creating new opportunities for innovation and growth.',
  'Music has the power to evoke emotions, bring people together, and express ideas that words alone cannot convey.',
  'Travel broadens our horizons and helps us understand different cultures, traditions, and ways of life around the globe.',
  'Science helps us understand the world around us, from the smallest particles to the vastness of the universe.'
];

export const TYPING_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Stopwatch Timer',
    path: '/fun-tools/stopwatch-timer',
    description: 'Time free-form drills with lap splits'
  },
  {
    label: 'Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer',
    description: 'Structure typing practice into focus intervals'
  },
  {
    label: 'Lorem Ipsum Generator',
    path: '/fun-tools/lorem-ipsum-generator',
    description: 'Generate extra practice passages'
  },
  {
    label: 'Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator',
    description: 'Reset mindset between attempts'
  },
  {
    label: 'Flashcard & Quiz Generator',
    path: '/fun-tools/flashcard-quiz-generator',
    description: 'Mix typing practice with study drills'
  }
];
