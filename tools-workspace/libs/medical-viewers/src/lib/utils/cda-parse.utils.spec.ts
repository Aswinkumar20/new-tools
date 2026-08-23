import { buildSampleCdaXml, filterCdaSections, mapCdaNarrativeToHtml, parseCdaText } from './cda-parse.utils';

describe('cda-parse.utils', () => {
  it('parses sample CDA with sections and patient', () => {
    const parsed = parseCdaText(buildSampleCdaXml());
    expect(parsed.title).toContain('Continuity of Care');
    expect(parsed.patientName).toContain('John');
    expect(parsed.sections.length).toBe(3);
    expect(parsed.sections[0].narrativeText.length).toBeGreaterThan(0);
  });

  it('maps CDA narrative tags to HTML', () => {
    const html = mapCdaNarrativeToHtml('<paragraph>Hello</paragraph><list><item>One</item></list>');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
  });

  it('filters sections by query', () => {
    const parsed = parseCdaText(buildSampleCdaXml());
    const filtered = filterCdaSections(parsed.sections, 'Medications');
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Medications');
  });
});
