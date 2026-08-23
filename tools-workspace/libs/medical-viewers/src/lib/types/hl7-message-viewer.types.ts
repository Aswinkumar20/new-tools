export interface Hl7RelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface Hl7Field {
  index: number;
  value: string;
  components: string[];
  label?: string;
}

export interface Hl7Segment {
  id: string;
  name: string;
  fields: Hl7Field[];
  raw: string;
  lineIndex: number;
}

export interface ParsedHl7Message {
  segments: Hl7Segment[];
  messageType: string;
  triggerEvent: string;
  version: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  warnings: string[];
}

export interface Hl7LoadedMessage {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ParsedHl7Message;
  warnings: string[];
}

export type Hl7ExportFormat = 'original' | 'summary-json' | 'segments-json' | 'formatted-txt';

export interface Hl7Suggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}
