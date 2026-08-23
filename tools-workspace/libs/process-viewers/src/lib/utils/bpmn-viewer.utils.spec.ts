import {
  buildBpmnStats,
  countBpmnElementsByKind,
  createBpmnFileRecord,
  exportBpmnElementsCsv,
  filterBpmnElements,
  filterValidBpmnFiles,
  formatBpmnFileSize,
  getXmlRootTagName,
  looksLikeBpmnXml,
  parseBpmnElements,
  resolveBpmnSuggestion
} from './bpmn-viewer.utils';
import { BPMN_SAMPLE_XML } from '../constants/bpmn-viewer.constants';

describe('bpmn-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatBpmnFileSize(500)).toBe('500 B');
    expect(formatBpmnFileSize(2048)).toBe('2.0 KB');

    const ok = new File(['<xml/>'], 'demo.bpmn', { type: 'application/xml' });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const result = filterValidBpmnFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('demo.txt');
  });

  it('detects BPMN XML and parses elements', () => {
    expect(looksLikeBpmnXml(BPMN_SAMPLE_XML)).toBe(true);
    expect(looksLikeBpmnXml('hello')).toBe(false);

    const elements = parseBpmnElements(BPMN_SAMPLE_XML);
    expect(elements.some((item) => item.id === 'Task_Review')).toBe(true);
    expect(elements.some((item) => item.typeLabel.includes('Gateway'))).toBe(true);
    expect(elements.find((item) => item.id === 'Task_Review')?.kind).toBe('task');

    const stats = buildBpmnStats(BPMN_SAMPLE_XML, elements, 1);
    expect(stats.processName).toBe('Order Fulfillment');
    expect(stats.tasks).toBeGreaterThanOrEqual(3);
    expect(stats.events).toBeGreaterThanOrEqual(2);
    expect(stats.gateways).toBe(1);
    expect(stats.warnings).toBe(1);

    const counts = countBpmnElementsByKind(elements);
    expect(counts.task).toBeGreaterThanOrEqual(3);
    expect(filterBpmnElements(elements, 'gateway', '').length).toBe(1);
    expect(filterBpmnElements(elements, 'all', 'ship').length).toBeGreaterThan(0);

    const csv = exportBpmnElementsCsv(elements);
    expect(csv).toContain('id,name,type,type_label,kind');
    expect(csv).toContain('Task_Review');

    const record = createBpmnFileRecord(
      new File([BPMN_SAMPLE_XML], 'order.bpmn'),
      BPMN_SAMPLE_XML
    );
    expect(record.name).toBe('order.bpmn');
  });

  it('accepts any definitions prefix and rejects unrelated XML', () => {
    expect(looksLikeBpmnXml('<bpmn2:definitions id="d"></bpmn2:definitions>')).toBe(true);
    expect(looksLikeBpmnXml('<semantic:definitions/>')).toBe(true);
    expect(
      looksLikeBpmnXml('\uFEFF<?xml version="1.0"?><!-- export --><definitions id="d"/>')
    ).toBe(true);
    expect(
      looksLikeBpmnXml('<model xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"/>')
    ).toBe(true);

    expect(looksLikeBpmnXml('<?xml version="1.0"?><catalog><item/></catalog>')).toBe(false);
    expect(getXmlRootTagName('<?xml version="1.0"?><catalog><item/></catalog>')).toBe('catalog');
    expect(getXmlRootTagName('not xml')).toBe('');
  });

  it('resolves suggestions by state', () => {
    expect(resolveBpmnSuggestion({ hasFiles: false, hasError: false, elementCount: 0 })?.id).toBe(
      'bpmn-intro'
    );
    expect(resolveBpmnSuggestion({ hasFiles: true, hasError: true, elementCount: 0 })?.id).toBe(
      'bpmn-fix'
    );
    expect(resolveBpmnSuggestion({ hasFiles: true, hasError: false, elementCount: 120 })?.id).toBe(
      'bpmn-large'
    );
  });
});
