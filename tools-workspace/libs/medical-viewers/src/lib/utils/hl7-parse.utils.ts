import type { Hl7Field, Hl7Segment, ParsedHl7Message } from '../types/hl7-message-viewer.types';

const SEGMENT_FIELD_LABELS: Record<string, Record<number, string>> = {
  MSH: {
    3: 'Sending Application',
    4: 'Sending Facility',
    5: 'Receiving Application',
    6: 'Receiving Facility',
    7: 'Date/Time',
    9: 'Message Type',
    10: 'Control ID',
    11: 'Processing ID',
    12: 'Version'
  },
  PID: {
    1: 'Set ID',
    3: 'Patient ID',
    5: 'Patient Name',
    7: 'Date of Birth',
    8: 'Sex',
    11: 'Address'
  },
  PV1: {
    2: 'Patient Class',
    3: 'Assigned Location',
    7: 'Attending Doctor',
    19: 'Visit Number'
  },
  OBR: {
    4: 'Universal Service ID',
    7: 'Observation Date/Time',
    16: 'Ordering Provider',
    25: 'Result Status'
  },
  OBX: {
    2: 'Value Type',
    3: 'Observation ID',
    5: 'Observation Value',
    6: 'Units',
    8: 'Abnormal Flags',
    11: 'Result Status'
  },
  EVN: {
    1: 'Event Type',
    2: 'Recorded Date/Time',
    5: 'Operator ID'
  }
};

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function splitFields(segmentLine: string, separator = '|'): string[] {
  if (segmentLine.startsWith('MSH')) {
    const rest = segmentLine.slice(3);
    const parts = rest.split(separator);
    return ['MSH', separator, ...parts.slice(1)];
  }
  return segmentLine.split(separator);
}

function parseField(value: string, componentSep = '^'): Hl7Field {
  const components = value ? value.split(componentSep) : [];
  return { index: 0, value, components };
}

function assignFieldLabels(segmentName: string, fields: Hl7Field[]): Hl7Field[] {
  const labels = SEGMENT_FIELD_LABELS[segmentName];
  if (!labels) return fields;
  return fields.map((field, index) => ({
    ...field,
    index,
    label: labels[index] ?? undefined
  }));
}

function parseSegmentLine(line: string, lineIndex: number, componentSep = '^'): Hl7Segment | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const name = trimmed.slice(0, 3);
  if (!/^[A-Z0-9]{3}$/.test(name)) {
    return null;
  }
  const rawFields = splitFields(trimmed);
  const fields = assignFieldLabels(
    name,
    rawFields.map((value, index) => ({ ...parseField(value, componentSep), index }))
  );
  return {
    id: `${name}-${lineIndex}`,
    name,
    fields,
    raw: trimmed,
    lineIndex
  };
}

function extractMessageMeta(segments: Hl7Segment[]): {
  messageType: string;
  triggerEvent: string;
  version: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
} {
  const msh = segments.find((s) => s.name === 'MSH');
  if (!msh) {
    return {
      messageType: '',
      triggerEvent: '',
      version: '',
      messageControlId: '',
      sendingApplication: '',
      sendingFacility: ''
    };
  }
  const msgTypeField = msh.fields[9]?.value ?? '';
  const [messageType = '', triggerEvent = ''] = msgTypeField.split('^');
  return {
    messageType,
    triggerEvent,
    version: msh.fields[12]?.value ?? '',
    messageControlId: msh.fields[10]?.value ?? '',
    sendingApplication: msh.fields[3]?.value ?? '',
    sendingFacility: msh.fields[4]?.value ?? ''
  };
}

export function normalizeHl7Text(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function parseHl7Text(text: string): ParsedHl7Message {
  const warnings: string[] = [];
  const normalized = normalizeHl7Text(text);
  if (!normalized) {
    throw new Error('Empty HL7 message');
  }

  const lines = normalized.split('\n').filter((l) => l.trim());
  const segments: Hl7Segment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const segment = parseSegmentLine(lines[i], i);
    if (!segment) {
      warnings.push(`Line ${i + 1} is not a valid HL7 segment — skipped.`);
      continue;
    }
    segments.push(segment);
  }

  if (!segments.length) {
    throw new Error('No valid HL7 segments found');
  }

  const hasMsh = segments.some((s) => s.name === 'MSH');
  if (!hasMsh) {
    warnings.push('Missing MSH segment — message header metadata unavailable.');
  }

  const unknownSegments = segments.filter((s) => !SEGMENT_FIELD_LABELS[s.name] && s.name !== 'MSH');
  if (unknownSegments.length) {
    warnings.push(
      `${unknownSegments.length} segment type(s) without field label presets (${[...new Set(unknownSegments.map((s) => s.name))].join(', ')}).`
    );
  }

  const meta = extractMessageMeta(segments);

  return {
    segments,
    ...meta,
    warnings
  };
}

export function parseHl7Bytes(bytes: Uint8Array): ParsedHl7Message {
  return parseHl7Text(decodeUtf8(bytes));
}

export function formatHl7Message(parsed: ParsedHl7Message): string {
  return parsed.segments.map((s) => s.raw).join('\r');
}

export function filterHl7Segments(segments: Hl7Segment[], query: string): Hl7Segment[] {
  const q = query.trim().toLowerCase();
  if (!q) return segments;
  return segments.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.raw.toLowerCase().includes(q) ||
      s.fields.some((f) => f.value.toLowerCase().includes(q) || f.label?.toLowerCase().includes(q))
  );
}

export function buildSampleHl7Message(): string {
  return [
    'MSH|^~\\&|EASYTOOLHUB|LAB|HIS|FACILITY|20240115103000||ORU^R01|MSG00001|P|2.5',
    'PID|1||12345^^^MRN||DOE^JOHN^M||19800115|M|||123 MAIN ST^^METRO^CA^90210',
    'PV1|1|O|CLINIC^101^A||||5678^SMITH^JANE^MD',
    'OBR|1|ORD001|ACC001|CBC^COMPLETE BLOOD COUNT^L|||20240115101500',
    'OBX|1|NM|WBC^White Blood Cells^L|1|7.2|10*3/uL|4.0-11.0|N|||F',
    'OBX|2|NM|HGB^Hemoglobin^L|1|14.1|g/dL|13.0-17.0|N|||F'
  ].join('\r');
}
