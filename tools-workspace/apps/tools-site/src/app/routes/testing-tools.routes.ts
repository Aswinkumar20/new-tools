import { Routes } from '@angular/router';

export const TESTING_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'json-schema-validator',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/json-schema-validator/json-schema-validator').then(m => m.JsonSchemaValidatorComponent),
  },
  {
    path: 'password-rule-validator',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/password-rule-validator/password-rule-validator').then(m => m.PasswordRuleValidatorComponent),
  },
  {
    path: 'email-url-ip-checker',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/email-url-ip-checker/email-url-ip-checker').then(m => m.EmailUrlIpCheckerComponent),
  },
  {
    path: 'user-agent-parser',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/user-agent-parser/user-agent-parser').then(m => m.UserAgentParserComponent),
  },
  {
    path: 'credit-card-validator',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/credit-card-validator/credit-card-validator').then(m => m.CreditCardValidatorComponent),
  },
  {
    path: 'jwt-decoder',
    loadComponent: () =>
      import('@tools-workspace/testing-tools/jwt-decoder/jwt-decoder').then(m => m.JwtDecoderComponent),
  },
];
