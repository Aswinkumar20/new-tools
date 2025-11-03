import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'tools',
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('@tools-workspace/features-home').then(m => m.MyComponent), // This is a standalone component
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
    {
    path: 'text-utilities',
    children: [ 
      { path: '', redirectTo: 'character-counter', pathMatch: 'full' },
      {
        path: 'character-counter',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.WordsAndCharacterCounterComponent), // This is a standalone component
      },
      {
        path: 'text-case-convertor',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextCaseConvertorComponent), // This is a standalone component
      },
      {
        path: 'text-to-ascii',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextToASCIIComponent), // This is a standalone component
      },
      {
        path: 'remove-duplicate-lines',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.RemoveDuplicateLinesComponent), // This is a standalone component
      },
      {
        path: 'text-reversal-and-palindrome-checker',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextReversalAndPalindromeCheckerComponent), // This is a standalone component
      },
      {
        path: 'base64-encode-and-decode',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.Base64EncodeAndDecodeComponent), // This is a standalone component
      },
      {
        path: 'slug-generator',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.SlugGeneratorComponent), // This is a standalone component
      },
      {
        path: 'text-difference',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextDifferenceComponent), // This is a standalone component
      },
      {
        path: 'code-merge',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.CodeMergeComponent), // This is a standalone component
      },
    ],
  },
  { path: '', redirectTo: 'tools', pathMatch: 'full' },
  { path: '**', redirectTo: 'tools' },
];
