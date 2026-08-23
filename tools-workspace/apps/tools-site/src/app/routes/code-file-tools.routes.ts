import { Routes } from '@angular/router';

export const CODE_FILE_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'html-minifier',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/html-minifier/html-minifier').then(m => m.HtmlMinifierComponent),
  },
  {
    path: 'css-minifier',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/css-minifier/css-minifier').then(m => m.CssMinifierComponent),
  },
  {
    path: 'javascript-minifier',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/javascript-minifier/javascript-minifier').then(m => m.JavascriptMinifierComponent),
  },
  {
    path: 'html-entity-encoder',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/html-entity-encoder/html-entity-encoder').then(m => m.HtmlEntityEncoderComponent),
  },
  {
    path: 'clipboard-viewer',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/clipboard-viewer/clipboard-viewer').then(m => m.ClipboardViewerComponent),
  },
  {
    path: 'clipboard-history',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/clipboard-history/clipboard-history').then(m => m.ClipboardHistoryComponent),
  },
  {
    path: 'file-metadata-viewer',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/file-metadata-viewer/file-metadata-viewer').then(m => m.FileMetadataViewerComponent),
  },
  {
    path: 'markdown-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/markdown-to-pdf/markdown-to-pdf').then(m => m.MarkdownToPdfComponent),
  },
  {
    path: 'html-table-exporter',
    loadComponent: () =>
      import('@tools-workspace/code-file-tools/html-table-exporter/html-table-exporter').then(m => m.HtmlTableExporterComponent),
  },
];
