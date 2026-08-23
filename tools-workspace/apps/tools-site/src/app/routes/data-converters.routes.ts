import { Routes } from '@angular/router';

export const DATA_CONVERTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'json-formatter-beautifier-validator',
    loadComponent: () =>
      import('@tools-workspace/data-converters/json-formatter-beautifier-validator/json-formatter-beautifier-validator').then(m => m.JsonFormatterBeautifierValidatorComponent),
  },
  {
    path: 'csv-to-json-json-to-csv',
    loadComponent: () =>
      import('@tools-workspace/data-converters/csv-to-json-json-to-csv/csv-to-json-json-to-csv').then(m => m.CsvToJsonJsonToCsvComponent),
  },
  {
    path: 'yaml-to-json-json-to-yaml',
    loadComponent: () =>
      import('@tools-workspace/data-converters/yaml-to-json-json-to-yaml/yaml-to-json-json-to-yaml').then(m => m.YamlToJsonJsonToYamlComponent),
  },
  {
    path: 'html-table-to-json',
    loadComponent: () =>
      import('@tools-workspace/data-converters/html-table-to-json/html-table-to-json').then(m => m.HtmlTableToJsonComponent),
  },
  {
    path: 'markdown-to-html',
    loadComponent: () =>
      import('@tools-workspace/data-converters/markdown-to-html/markdown-to-html').then(m => m.MarkdownToHtmlComponent),
  },
  {
    path: 'json-linter-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-converters/json-linter-viewer/json-linter-viewer').then(m => m.JsonLinterViewerComponent),
  },
  {
    path: 'excel-to-json',
    loadComponent: () =>
      import('@tools-workspace/data-converters/excel-to-json/excel-to-json').then(m => m.ExcelToJsonComponent),
  },
  {
    path: 'json-parser',
    loadComponent: () =>
      import('@tools-workspace/data-converters/json-parser/json-parser').then(m => m.JsonParserComponent),
  },
];
