import { MAMMOGRAPHY_HANGING_SLOTS } from '../constants/mammography-viewer.constants';
import type {
  MammographyHangingCell,
  MammographyHangingSlot,
  MammographyLoadedFile
} from '../types/mammography-viewer.types';
import type { DicomParsedImage } from '../types/dicom-viewer.types';

/** Infer standard screening slot from laterality + view position / description. */
export function inferMammographySlot(parsed: DicomParsedImage): MammographyHangingSlot {
  const lat = (parsed.imageLaterality || '').trim().toUpperCase();
  const viewRaw = `${parsed.viewPosition || ''} ${parsed.seriesDescription || ''} ${parsed.protocolName || ''}`.toUpperCase();

  const side: 'R' | 'L' | '' =
    lat.startsWith('R') || lat === 'RT'
      ? 'R'
      : lat.startsWith('L') || lat === 'LT'
        ? 'L'
        : viewRaw.includes(' RIGHT') || /\bR[\s_-]CC\b/.test(viewRaw) || /\bR[\s_-]MLO\b/.test(viewRaw)
          ? 'R'
          : viewRaw.includes(' LEFT') || /\bL[\s_-]CC\b/.test(viewRaw) || /\bL[\s_-]MLO\b/.test(viewRaw)
            ? 'L'
            : '';

  const isMlo = viewRaw.includes('MLO');
  const isCc = viewRaw.includes('CC') && !isMlo;

  if (side === 'R' && isCc) return 'R-CC';
  if (side === 'R' && isMlo) return 'R-MLO';
  if (side === 'L' && isCc) return 'L-CC';
  if (side === 'L' && isMlo) return 'L-MLO';
  return 'unassigned';
}

/** Build 2×2 hanging layout (R-CC, R-MLO, L-CC, L-MLO). */
export function buildMammographyHanging(files: MammographyLoadedFile[]): MammographyHangingCell[] {
  const cells: MammographyHangingCell[] = MAMMOGRAPHY_HANGING_SLOTS.map((slot) => ({
    slot,
    file: null
  }));

  for (const file of files) {
    if (!file.parsed || file.softFail) continue;
    const slot = inferMammographySlot(file.parsed);
    if (slot === 'unassigned') continue;
    const cell = cells.find((c) => c.slot === slot);
    if (cell && !cell.file) {
      cell.file = file;
    }
  }

  return cells;
}

export function hangingAssignedCount(cells: MammographyHangingCell[]): number {
  return cells.filter((c) => c.file != null).length;
}
