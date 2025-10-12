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
      {
        path: 'character-counter',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.WordsAndCharacterCounterComponent), // This is a standalone component
      },
      { path: '', redirectTo: 'character-counter', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tools', pathMatch: 'full' },
  { path: '**', redirectTo: 'tools' },
];
