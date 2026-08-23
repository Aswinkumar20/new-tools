import { Routes } from '@angular/router';

export const TOOLS_ROUTES: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('@tools-workspace/features-home/myComponent/my-component').then(m => m.MyComponent),
  },
];
