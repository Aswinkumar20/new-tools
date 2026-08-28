import { YL_CSV_SAMPLE, YL_JSON_SAMPLE, YL_MARKDOWN_SAMPLE } from '../constants/yaml-viewer-sample.data';
import {
  buildSampleYamlBytes,
  filterYlNodes,
  filterYlRows,
  parseYamlBytes,
  parseYamlText
} from './yaml-viewer-parse.utils';
import {
  canExportYl,
  createSampleYlFile,
  createYlFileRecord,
  exportYlSchemaCsv,
  filterValidYlFiles,
  resolveYlSuggestion
} from './yaml-viewer.utils';

describe('yaml-viewer-parse.utils', () => {
  it('parses the k8s YAML sample', () => {
    const parsed = parseYamlBytes(buildSampleYamlBytes(), 'k8s-deploy.yaml');
    expect(parsed.sourceKind).toBe('yaml');
    expect(parsed.rootType).toBe('object');
    expect(parsed.name).toBe('WebDeploy');
    expect(parsed.valid).toBe(true);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.nodes.some((n) => n.name === 'active' && n.type === 'boolean')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'note' && n.type === 'null')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'nginx')).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseYamlText(YL_JSON_SAMPLE, 'deploy.json');
    expect(json.sourceKind).toBe('json');
    expect(json.rows.length).toBe(2);

    const csv = parseYamlText(YL_CSV_SAMPLE, 'deploy.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rows.length).toBe(2);

    const md = parseYamlText(YL_MARKDOWN_SAMPLE, 'deploy.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('warns on tabs and duplicate keys', () => {
    const parsed = parseYamlText('name: A\n\tbad: 1\nname: B\n', 'dup.yaml');
    expect(parsed.issues.some((i) => i.code === 'tabs')).toBe(true);
    expect(parsed.issues.some((i) => i.code === 'duplicate-key')).toBe(true);
  });

  it('filters nodes and rows', () => {
    const parsed = parseYamlBytes(buildSampleYamlBytes(), 'deploy.yaml');
    expect(filterYlNodes(parsed.nodes, 'name:sku').length).toBeGreaterThan(0);
    expect(filterYlNodes(parsed.nodes, 'type:boolean').length).toBe(1);
    expect(filterYlNodes(parsed.nodes, 'sku:work').length).toBe(1);
    expect(filterYlRows(parsed.rows, 'sku:work').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseYamlText('')).toThrow(/empty/i);
    expect(() => parseYamlText('hello world')).toThrow(/Not a YAML/i);
  });
});

describe('yaml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleYlFile();
    expect(file.name).toBe('k8s-deploy.yaml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample yaml', () => {
    const file = createSampleYlFile();
    const record = createYlFileRecord(file, buildSampleYamlBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportYl(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseYamlBytes(buildSampleYamlBytes(), 'deploy.yaml');
    const csv = exportYlSchemaCsv(parsed);
    expect(csv).toContain('path,name,type,nullable,childCount,sample');
    expect(csv.split('\n').length).toBe(parsed.schema.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleYlFile();
    const { accepted, rejected } = filterValidYlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'deploy.yaml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveYlSuggestion covers empty and error states', () => {
    expect(resolveYlSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveYlSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveYlSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createYlFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportYl(record)).toBe(false);
    expect(canExportYl(null)).toBe(false);
  });
});
