import { Routes } from '@angular/router';

export const DATA_EXPLORERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'parquet-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/parquet-viewer/parquet-viewer').then(m => m.ParquetViewerComponent),
  },
  {
    path: 'avro-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/avro-viewer/avro-viewer').then(m => m.AvroViewerComponent),
  },
  {
    path: 'orc-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/orc-viewer/orc-viewer').then(m => m.OrcViewerComponent),
  },
  {
    path: 'feather-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/feather-viewer/feather-viewer').then(m => m.FeatherViewerComponent),
  },
  {
    path: 'arrow-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/arrow-viewer/arrow-viewer').then(m => m.ArrowViewerComponent),
  },
  {
    path: 'delta-lake-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/delta-lake-viewer/delta-lake-viewer').then(m => m.DeltaLakeViewerComponent),
  },
  {
    path: 'sqlite-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/sqlite-viewer/sqlite-viewer').then(m => m.SqliteViewerComponent),
  },
  {
    path: 'duckdb-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/duckdb-viewer/duckdb-viewer').then(m => m.DuckdbViewerComponent),
  },
  {
    path: 'csv-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/csv-viewer/csv-viewer').then(m => m.CsvViewerComponent),
  },
  {
    path: 'tsv-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/tsv-viewer/tsv-viewer').then(m => m.TsvViewerComponent),
  },
  {
    path: 'json-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/json-viewer/json-viewer').then(m => m.JsonViewerComponent),
  },
  {
    path: 'xml-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/xml-viewer/xml-viewer').then(m => m.XmlViewerComponent),
  },
  {
    path: 'yaml-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/yaml-viewer/yaml-viewer').then(m => m.YamlViewerComponent),
  },
  {
    path: 'toml-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/toml-viewer/toml-viewer').then(m => m.TomlViewerComponent),
  },
  {
    path: 'ini-viewer',
    loadComponent: () =>
      import('@tools-workspace/data-explorers/ini-viewer/ini-viewer').then(m => m.IniViewerComponent),
  },
];
