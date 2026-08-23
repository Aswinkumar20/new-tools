import type { CdaSection, ParsedCdaDocument } from '../types/cda-viewer.types';

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function localElements(parent: Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter((el) => el.localName === name);
}

function firstLocalText(parent: Element | Document, names: string[]): string {
  for (const name of names) {
    const nodes = parent instanceof Document
      ? Array.from(parent.getElementsByTagName('*')).filter((el) => el.localName === name)
      : localElements(parent, name);
    for (const node of nodes) {
      const text = node.textContent?.trim();
      if (text) return text;
      const value = node.getAttribute('value');
      if (value) return formatCdaDate(value);
    }
  }
  return '';
}

function formatCdaDate(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{14}/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
  }
  return value;
}

function extractNarrative(section: Element): { html: string; text: string } {
  const textEl = localElements(section, 'text')[0];
  if (!textEl) {
    return { html: '', text: '' };
  }
  const html = textEl.innerHTML.trim();
  const text = textEl.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return { html, text };
}

function walkSections(node: Element, level: number, sections: CdaSection[], warnings: string[]): void {
  const directSections = Array.from(node.children).filter((child) => child.localName === 'section');
  for (const section of directSections.length ? directSections : localElements(node, 'section')) {
    if (sections.some((s) => s.id === section.getAttribute('ID') || s.title === firstLocalText(section, ['title']))) {
      continue;
    }
    const title = firstLocalText(section, ['title']) || 'Untitled section';
    const codeEl = localElements(section, 'code')[0];
    const code = codeEl?.getAttribute('code') ?? undefined;
    const { html, text } = extractNarrative(section);
    if (!text && !html) {
      warnings.push(`Section "${title}" has no narrative text.`);
    }
    sections.push({
      id: section.getAttribute('ID') || `section-${sections.length + 1}`,
      title,
      code,
      narrativeHtml: html,
      narrativeText: text,
      level
    });
    walkSections(section, level + 1, sections, warnings);
  }
}

export function parseCdaText(text: string): ParsedCdaDocument {
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty CDA document');

  if (typeof DOMParser === 'undefined') {
    throw new Error('CDA parsing requires DOMParser (browser environment)');
  }

  const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid CDA XML document');
  }

  const root = Array.from(doc.getElementsByTagName('*')).find(
    (el) => el.localName === 'ClinicalDocument' || el.localName === 'clinicaldocument'
  );
  if (!root) {
    throw new Error('Not a ClinicalDocument — root element missing');
  }

  const title = firstLocalText(root, ['title']) || 'Clinical Document';
  const effectiveTime =
    localElements(root, 'effectiveTime')[0]?.getAttribute('value') ??
    firstLocalText(root, ['effectiveTime']);
  const documentId = root.getAttribute('id') ?? localElements(root, 'id')[0]?.getAttribute('extension') ?? undefined;

  const recordTarget = localElements(root, 'recordTarget')[0];
  const patientRole = recordTarget ? localElements(recordTarget, 'patientRole')[0] ?? recordTarget : null;
  const patientNode = patientRole ? localElements(patientRole, 'patient')[0] : localElements(root, 'patient')[0];
  const patientGiven = patientNode ? firstLocalText(patientNode, ['given']) : '';
  const patientFamily = patientNode ? firstLocalText(patientNode, ['family']) : '';
  const patientName = [patientGiven, patientFamily].filter(Boolean).join(' ') || undefined;

  const authorNode = localElements(root, 'author')[0];
  const authorGiven = authorNode ? firstLocalText(authorNode, ['given']) : '';
  const authorFamily = authorNode ? firstLocalText(authorNode, ['family']) : '';
  const authorName = [authorGiven, authorFamily].filter(Boolean).join(' ') || undefined;

  const sections: CdaSection[] = [];
  const structuredBody = localElements(root, 'structuredBody')[0] ?? root;
  walkSections(structuredBody, 0, sections, warnings);

  if (!sections.length) {
    warnings.push('No CDA sections found — showing document title only.');
  }

  return {
    title,
    effectiveTime: effectiveTime ? formatCdaDate(effectiveTime) : undefined,
    patientName,
    authorName,
    documentId,
    sections,
    warnings
  };
}

export function parseCdaBytes(bytes: Uint8Array): ParsedCdaDocument {
  return parseCdaText(decodeUtf8(bytes));
}

export function buildSampleCdaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <id extension="sample-ccd-001"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="20240115103000"/>
  <author>
    <assignedAuthor>
      <assignedPerson>
        <name><given>Jane</given><family>Smith</family></name>
      </assignedPerson>
    </assignedAuthor>
  </author>
  <recordTarget>
    <patientRole>
      <patient>
        <name><given>John</given><family>Doe</family></name>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section ID="summary">
          <title>Summary</title>
          <text><paragraph>Patient is a 44-year-old male seen for follow-up. Overall stable.</paragraph></text>
        </section>
      </component>
      <component>
        <section ID="medications">
          <title>Medications</title>
          <text>
            <list><item>Amoxicillin 500mg — 5 day course</item><item>Ibuprofen 200mg PRN</item></list>
          </text>
        </section>
      </component>
      <component>
        <section ID="results">
          <title>Results</title>
          <text><paragraph>CBC 2024-01-15: WBC 7.2, Hemoglobin 14.1 g/dL.</paragraph></text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
}

export function filterCdaSections(sections: CdaSection[], query: string): CdaSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.narrativeText.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q)
  );
}

export function mapCdaNarrativeToHtml(html: string): string {
  const source = (html || '').trim() || '<p>No narrative content</p>';
  return source
    .replace(/<\s*paragraph\b([^>]*)>/gi, '<p$1>')
    .replace(/<\s*\/\s*paragraph\s*>/gi, '</p>')
    .replace(/<\s*list\b([^>]*)>/gi, '<ul$1>')
    .replace(/<\s*\/\s*list\s*>/gi, '</ul>')
    .replace(/<\s*item\b([^>]*)>/gi, '<li$1>')
    .replace(/<\s*\/\s*item\s*>/gi, '</li>');
}

export function exportCdaNarrativeText(parsed: ParsedCdaDocument): string {
  const lines = [
    parsed.title,
    parsed.effectiveTime ? `Effective: ${parsed.effectiveTime}` : '',
    parsed.patientName ? `Patient: ${parsed.patientName}` : '',
    ''
  ].filter(Boolean);

  for (const section of parsed.sections) {
    lines.push(`## ${section.title}`);
    lines.push(section.narrativeText);
    lines.push('');
  }
  return lines.join('\n');
}
