import {
  TF_JSON_SAMPLE,
  TF_MARKDOWN_SAMPLE,
  TF_SAMPLE,
  TF_XML_SAMPLE
} from '../constants/terraform-graph-viewer-sample.data';
import { filterTfEdges, filterTfResources, parseTerraformGraphText } from './terraform-graph-viewer-parse.utils';
import {
  canExportTf,
  createSampleTfFile,
  createTfFileRecord,
  exportTfResourcesCsv,
  filterValidTfFiles,
  resolveTfSuggestion
} from './terraform-graph-viewer.utils';

describe('terraform-graph-viewer-parse.utils', () => {
  it('parses the shop Terraform graph sample', () => {
    const parsed = parseTerraformGraphText(TF_SAMPLE, 'sample-shop.dot');
    expect(parsed.resources.length).toBe(4);
    expect(parsed.edges.length).toBe(3);
    expect(parsed.resources.some((r) => r.id === 'aws_instance.web' && r.type === 'aws_instance')).toBe(true);
    expect(parsed.resources.some((r) => r.id === 'aws_vpc.shop' && r.provider === 'aws')).toBe(true);
    expect(parsed.edges.some((e) => e.source === 'aws_vpc.shop' && e.target === 'aws_subnet.public')).toBe(true);
    expect(parsed.edges.some((e) => e.source === 'aws_security_group.web' && e.target === 'aws_instance.web')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseTerraformGraphText(TF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.resources.length).toBe(2);
    expect(md.edges.length).toBe(1);

    const json = parseTerraformGraphText(TF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.resources.length).toBe(2);
    expect(json.edges.length).toBe(1);

    const xml = parseTerraformGraphText(TF_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.resources.length).toBe(2);
    expect(xml.edges.length).toBe(1);
  });

  it('filters resources and edges', () => {
    const parsed = parseTerraformGraphText(TF_SAMPLE, 'shop.dot');
    expect(filterTfResources(parsed.resources, 'type:aws_instance').every((r) => r.type === 'aws_instance')).toBe(true);
    expect(filterTfResources(parsed.resources, 'provider:aws').length).toBe(4);
    expect(filterTfEdges(parsed.edges, 'from:aws_vpc').length).toBe(1);
    expect(filterTfEdges(parsed.edges, 'to:aws_instance.web').length).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseTerraformGraphText('')).toThrow(/empty/i);
    expect(() => parseTerraformGraphText('hello world')).toThrow(/Not a Terraform/i);
  });
});

describe('terraform-graph-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTfFile();
    expect(file.name).toBe('sample-shop.dot');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample graph', () => {
    const file = createSampleTfFile();
    const record = createTfFileRecord(file, new TextEncoder().encode(TF_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.resources.length).toBe(4);
    expect(canExportTf(record)).toBe(true);
  });

  it('exports resources csv', () => {
    const parsed = parseTerraformGraphText(TF_SAMPLE, 'shop.dot');
    const csv = exportTfResourcesCsv(parsed);
    expect(csv).toContain('index,id,name,type,provider');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTfFile();
    const { accepted, rejected } = filterValidTfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'graph.dot.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveTfSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveTfSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveTfSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveTfSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createTfFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportTf(record)).toBe(false);
  });

  it('canExportTf returns false for null', () => {
    expect(canExportTf(null)).toBe(false);
  });
});
