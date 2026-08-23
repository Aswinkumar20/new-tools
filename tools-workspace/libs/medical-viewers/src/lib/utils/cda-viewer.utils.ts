import {
  CDA_FORMATS_HINT,
  CDA_MAX_FILE_BYTES,
  CDA_SUPPORTED_EXTENSIONS
} from '../constants/cda-viewer.constants';
import type { CdaLoadedDocument, CdaSuggestion } from '../types/cda-viewer.types';
import { getFileExtension } from './medical-file.utils';
import {
  buildSampleCdaXml,
  exportCdaNarrativeText,
  filterCdaSections,
  parseCdaBytes
} from './cda-parse.utils';
import {
  createClinicalRecordId,
  filterValidClinicalFiles,
  isSupportedClinicalFile
} from './clinical-document.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  formatMedicalFileSize as formatCdaFileSize,
  readFileBytes as readCdaFileBytes
} from './medical-file.utils';

export { filterCdaSections, exportCdaNarrativeText, mapCdaNarrativeToHtml } from './cda-parse.utils';

export function isSupportedCdaFile(file: File): boolean {
  return isSupportedClinicalFile(file, CDA_SUPPORTED_EXTENSIONS);
}

export function filterValidCdaFiles(files: FileList | File[]) {
  return filterValidClinicalFiles(files, CDA_SUPPORTED_EXTENSIONS, CDA_MAX_FILE_BYTES);
}

export function createSampleCdaFile(): File {
  return new File([buildSampleCdaXml()], 'sample-ccd-document.xml', {
    type: 'application/xml',
    lastModified: 0
  });
}

export function createCdaDocumentRecord(file: File, bytes: Uint8Array): CdaLoadedDocument {
  const extension = getFileExtension(file.name) || '.xml';
  const text = new TextDecoder('utf-8').decode(bytes);
  const parsed = parseCdaBytes(bytes);
  const warnings = [...parsed.warnings];

  if (!parsed.sections.length) {
    warnings.push('Document parsed but no sections with narrative were found.');
  }

  return {
    id: createClinicalRecordId(file),
    name: file.name,
    size: file.size,
    extension,
    bytes,
    text,
    parsed,
    warnings
  };
}

export function exportCdaSummaryJson(record: CdaLoadedDocument): string {
  return JSON.stringify(
    {
      name: record.name,
      title: record.parsed.title,
      effectiveTime: record.parsed.effectiveTime,
      patientName: record.parsed.patientName,
      authorName: record.parsed.authorName,
      documentId: record.parsed.documentId,
      sectionCount: record.parsed.sections.length,
      sections: record.parsed.sections.map((s) => ({ id: s.id, title: s.title, code: s.code })),
      warnings: record.warnings,
      note: 'Education/research CDA preview — not for diagnostic use.'
    },
    null,
    2
  );
}

export function exportCdaSectionsJson(record: CdaLoadedDocument): string {
  return JSON.stringify(
    {
      title: record.parsed.title,
      sections: record.parsed.sections.map((s) => ({
        id: s.id,
        title: s.title,
        code: s.code,
        narrativeText: s.narrativeText
      }))
    },
    null,
    2
  );
}

export function canExportCda(record: CdaLoadedDocument | null): boolean {
  return !!record?.parsed.sections.length;
}

export function resolveCdaSuggestion(state: {
  hasDocuments: boolean;
  hasError: boolean;
}): CdaSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample CCD document',
      reason: 'Load the embedded CDA XML to verify sections and narrative rendering.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/cda-viewer'
    };
  }
  if (!state.hasDocuments) {
    return {
      id: 'upload',
      title: 'Upload a CDA document',
      reason: CDA_FORMATS_HINT,
      actionLabel: 'Choose file',
      path: '/medical-viewers/cda-viewer'
    };
  }
  return null;
}
