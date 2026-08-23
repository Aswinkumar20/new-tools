import type { DicomLoadedFile, DicomSeriesGroup } from '../types/dicom-viewer.types';

export type { DicomSeriesGroup };

function sliceSortKey(file: DicomLoadedFile): [number, number, string] {
  const instance = file.parsed?.instanceNumber;
  const ipp = file.parsed?.imagePositionPatient;
  const z = ipp != null ? ipp[2] : Number.NaN;
  const primary =
    instance != null && Number.isFinite(instance)
      ? instance
      : Number.isFinite(z)
        ? z
        : Number.POSITIVE_INFINITY;
  const secondary = Number.isFinite(z) ? z : 0;
  return [primary, secondary, file.name];
}

/** Sort slices by InstanceNumber, then ImagePositionPatient Z, then name. */
export function sortSlices(files: DicomLoadedFile[]): DicomLoadedFile[] {
  return [...files].sort((a, b) => {
    const [ap, as, an] = sliceSortKey(a);
    const [bp, bs, bn] = sliceSortKey(b);
    if (ap !== bp) return ap - bp;
    if (as !== bs) return as - bs;
    return an.localeCompare(bn);
  });
}

/** Group loaded DICOM files by SeriesInstanceUID (empty UID → single “ungrouped” bucket). */
export function groupBySeries(files: DicomLoadedFile[]): DicomSeriesGroup[] {
  const map = new Map<string, DicomLoadedFile[]>();
  for (const file of files) {
    const uid = (file.parsed?.seriesInstanceUid || '').trim() || '__ungrouped__';
    const list = map.get(uid) ?? [];
    list.push(file);
    map.set(uid, list);
  }

  const groups: DicomSeriesGroup[] = [];
  let index = 0;
  for (const [uid, groupFiles] of map.entries()) {
    const sorted = sortSlices(groupFiles);
    const first = sorted[0]?.parsed;
    const description = first?.seriesDescription?.trim() || '';
    const protocolName = first?.protocolName?.trim() || '';
    const labelBase = description || protocolName || `Series ${index + 1}`;
    groups.push({
      seriesInstanceUid: uid === '__ungrouped__' ? '' : uid,
      label: `${labelBase} (${sorted.length})`,
      description,
      protocolName,
      files: sorted
    });
    index += 1;
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}
