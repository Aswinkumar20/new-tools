import { Routes } from '@angular/router';

export const SECURITY_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'hash-generator',
    loadComponent: () =>
      import('@tools-workspace/security-tools/hash-generator/hash-generator').then(m => m.HashGeneratorComponent),
  },
  {
    path: 'uuid-generator',
    loadComponent: () =>
      import('@tools-workspace/security-tools/uuid-generator/uuid-generator').then(m => m.UuidGeneratorComponent),
  },
  {
    path: 'password-strength-checker',
    loadComponent: () =>
      import('@tools-workspace/security-tools/password-strength-checker/password-strength-checker').then(m => m.PasswordStrengthCheckerComponent),
  },
  {
    path: 'random-password-generator',
    loadComponent: () =>
      import('@tools-workspace/security-tools/random-password-generator/random-password-generator').then(m => m.RandomPasswordGeneratorComponent),
  },
  {
    path: 'text-encrypt-decrypt',
    loadComponent: () =>
      import('@tools-workspace/security-tools/text-encrypt-decrypt/text-encrypt-decrypt').then(m => m.TextEncryptDecryptComponent),
  },
  {
    path: 'secure-clipboard',
    loadComponent: () =>
      import('@tools-workspace/security-tools/secure-clipboard/secure-clipboard').then(m => m.SecureClipboardComponent),
  },
  {
    path: 'private-notes',
    loadComponent: () =>
      import('@tools-workspace/security-tools/private-notes/private-notes').then(m => m.PrivateNotesComponent),
  },
];
