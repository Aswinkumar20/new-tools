import {
  fileFromPastedText,
  looksLikeCdaText,
  looksLikeFhirText,
  looksLikeHl7Text,
  looksLikeTimelineText,
  looksLikeWaveformText
} from './clinical-document.utils';

describe('clinical-document.utils paste helpers', () => {
  it('creates a file from pasted text', () => {
    const file = fileFromPastedText('{"resourceType":"Patient"}', 'pasted.json', 'application/json');
    expect(file?.name).toBe('pasted.json');
    expect(file?.size).toBeGreaterThan(0);
  });

  it('rejects empty paste', () => {
    expect(fileFromPastedText('   ', 'x.json', 'application/json')).toBeNull();
  });

  it('detects FHIR, HL7, CDA, timeline, and waveform text', () => {
    expect(looksLikeFhirText('{"resourceType":"Bundle","entry":[]}')).toBe(true);
    expect(looksLikeHl7Text('MSH|^~\\&|LAB||EMR||20240101||ORU^R01|1|P|2.5')).toBe(true);
    expect(looksLikeCdaText('<ClinicalDocument xmlns="urn:hl7-org:v3"></ClinicalDocument>')).toBe(true);
    expect(looksLikeTimelineText('date,title\n2024-01-01,Visit')).toBe(true);
    expect(looksLikeWaveformText('{"sampleRateHz":250,"channels":[]}')).toBe(true);
    expect(looksLikeFhirText('hello world')).toBe(false);
  });
});
