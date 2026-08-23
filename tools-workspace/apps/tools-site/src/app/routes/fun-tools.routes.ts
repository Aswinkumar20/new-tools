import { Routes } from '@angular/router';

export const FUN_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'qr-code-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/qr-code-generator/qr-code-generator').then(m => m.QrCodeGeneratorComponent),
  },
  {
    path: 'barcode-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/barcode-generator/barcode-generator').then(m => m.BarcodeGeneratorComponent),
  },
  {
    path: 'stopwatch-timer',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/stopwatch-timer/stopwatch-timer').then(m => m.StopwatchTimerComponent),
  },
  {
    path: 'random-number-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/random-number-generator/random-number-generator').then(m => m.RandomNumberGeneratorComponent),
  },
  {
    path: 'coin-toss-dice-roller',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/coin-toss-dice-roller/coin-toss-dice-roller').then(m => m.CoinTossDiceRollerComponent),
  },
  {
    path: 'lorem-ipsum-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/lorem-ipsum-generator/lorem-ipsum-generator').then(m => m.LoremIpsumGeneratorComponent),
  },
  {
    path: 'timezone-converter',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/timezone-converter/timezone-converter').then(m => m.TimezoneConverterComponent),
  },
  {
    path: 'typing-speed-test',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/typing-speed-test/typing-speed-test').then(m => m.TypingSpeedTestComponent),
  },
  {
    path: 'pomodoro-timer',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/pomodoro-timer/pomodoro-timer').then(m => m.PomodoroTimerComponent),
  },
  {
    path: 'flashcard-quiz-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/flashcard-quiz-generator/flashcard-quiz-generator').then(m => m.FlashcardQuizGeneratorComponent),
  },
  {
    path: 'motivational-quote-generator',
    loadComponent: () =>
      import('@tools-workspace/fun-tools/motivational-quote-generator/motivational-quote-generator').then(m => m.MotivationalQuoteGeneratorComponent),
  },
];
