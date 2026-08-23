import {
  K8S_JSON_SAMPLE,
  K8S_MARKDOWN_SAMPLE,
  K8S_SAMPLE,
  K8S_XML_SAMPLE
} from '../constants/kubernetes-architecture-viewer-sample.data';
import { filterK8sLinks, filterK8sServices, filterK8sWorkloads, parseKubernetesText } from './kubernetes-architecture-viewer-parse.utils';
import {
  canExportK8s,
  createK8sFileRecord,
  createSampleK8sFile,
  exportK8sWorkloadsCsv,
  filterValidK8sFiles
} from './kubernetes-architecture-viewer.utils';

describe('kubernetes-architecture-viewer-parse.utils', () => {
  it('parses the shop Kubernetes sample', () => {
    const parsed = parseKubernetesText(K8S_SAMPLE, 'sample-shop.yaml');
    expect(parsed.workloads.length).toBe(2);
    expect(parsed.services.length).toBe(3);
    expect(parsed.links.length).toBeGreaterThanOrEqual(3);
    expect(parsed.workloads.some((w) => w.name === 'web' && w.kind === 'Deployment' && w.replicas === 2)).toBe(true);
    expect(parsed.services.some((s) => s.name === 'api' && s.kind === 'Service')).toBe(true);
    expect(parsed.services.some((s) => s.kind === 'Ingress' && s.name === 'shop')).toBe(true);
    expect(parsed.links.some((l) => l.rel === 'selects' && l.targetName === 'web')).toBe(true);
    expect(parsed.links.some((l) => l.rel === 'routes')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseKubernetesText(K8S_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.workloads.length).toBe(1);
    expect(md.services.length).toBe(1);
    expect(md.links.length).toBe(1);

    const json = parseKubernetesText(K8S_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.workloads.length).toBe(1);
    expect(json.services.length).toBe(1);
    expect(json.links.length).toBe(1);

    const xml = parseKubernetesText(K8S_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.workloads.length).toBe(1);
    expect(xml.services.length).toBe(1);
    expect(xml.links.length).toBe(1);
  });

  it('filters workloads, services, and links', () => {
    const parsed = parseKubernetesText(K8S_SAMPLE, 'shop.yaml');
    expect(filterK8sWorkloads(parsed.workloads, 'kind:Deployment').length).toBe(2);
    expect(filterK8sServices(parsed.services, 'kind:Ingress').some((s) => s.name === 'shop')).toBe(true);
    expect(filterK8sLinks(parsed.links, 'rel:routes').length).toBe(1);
    expect(filterK8sWorkloads(parsed.workloads, 'workload:api').some((w) => w.name === 'api')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseKubernetesText('')).toThrow(/empty/i);
    expect(() => parseKubernetesText('hello world')).toThrow(/Not a Kubernetes/i);
  });
});

describe('kubernetes-architecture-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleK8sFile();
    expect(file.name).toBe('sample-shop.yaml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample manifest', () => {
    const file = createSampleK8sFile();
    const record = createK8sFileRecord(file, new TextEncoder().encode(K8S_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.workloads.length).toBe(2);
    expect(canExportK8s(record)).toBe(true);
  });

  it('exports workloads csv', () => {
    const parsed = parseKubernetesText(K8S_SAMPLE, 'shop.yaml');
    const csv = exportK8sWorkloadsCsv(parsed);
    expect(csv).toContain('index,id,name,kind,namespace,replicas');
    expect(csv.split('\n').length).toBe(3);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleK8sFile();
    const { accepted, rejected } = filterValidK8sFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.yaml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
