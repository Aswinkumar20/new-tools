import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';

export const FQG_MIN_CARDS_FOR_QUIZ = 2;
export const FQG_NEXT_CARD_DELAY_MS = 500;

export const FQG_EMPTY_FORM: { front: string; back: string } = { front: '', back: '' };

export const FQG_ERROR_FRONT_EMPTY = 'Front side cannot be empty.';
export const FQG_ERROR_BACK_EMPTY = 'Back side cannot be empty.';

export const FQG_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer',
    description: 'Study in focused intervals between quiz rounds'
  },
  {
    label: 'Typing Speed Test',
    path: '/fun-tools/typing-speed-test',
    description: 'Practice recalling answers under a typing drill'
  },
  {
    label: 'Lorem Ipsum Generator',
    path: '/fun-tools/lorem-ipsum-generator',
    description: 'Generate placeholder text while designing card layouts'
  },
  {
    label: 'Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator',
    description: 'Pick a quote for a quick morale boost mid-study'
  },
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Draft longer study notes in Markdown alongside your deck'
  }
];
