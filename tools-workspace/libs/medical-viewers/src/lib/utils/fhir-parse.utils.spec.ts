import { buildSampleFhirBundleJson, parseFhirText } from './fhir-parse.utils';

describe('fhir-parse.utils', () => {
  it('parses sample Bundle with resources, references, and timeline', () => {
    const parsed = parseFhirText(buildSampleFhirBundleJson(), '.json');
    expect(parsed.primaryResourceType).toBe('Bundle');
    expect(parsed.resources.length).toBe(3);
    expect(parsed.references.some((r) => r.reference.includes('Patient/patient-001'))).toBe(true);
    expect(parsed.timeline.some((e) => e.label === 'birthDate')).toBe(true);
    expect(parsed.timeline.some((e) => e.label === 'effectiveDateTime')).toBe(true);
  });

  it('builds expandable tree nodes', () => {
    const parsed = parseFhirText(buildSampleFhirBundleJson(), '.json');
    expect(parsed.tree[0].children?.length).toBeGreaterThan(0);
  });

  it('rejects empty documents', () => {
    expect(() => parseFhirText('   ', '.json')).toThrow('Empty FHIR document');
  });
});
