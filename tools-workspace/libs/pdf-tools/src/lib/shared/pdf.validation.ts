/** Basic client-side validation for PDF tools */

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOutputFilename(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter an output filename';
  if (INVALID_FILENAME_CHARS.test(trimmed)) return 'Filename contains invalid characters';
  if (!trimmed.toLowerCase().endsWith('.pdf')) return 'Filename must end with .pdf';
  return null;
}

export function validateRequiredText(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  return null;
}

export function validateEmail(value: string, required = false): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Email is required' : null;
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address';
  return null;
}

export function validatePageRangeInput(input: string, pageCount: number): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Enter a page range (e.g. 1-3, 5)';
  if (pageCount < 1) return 'No pages available';

  const pages = new Set<number>();
  for (const part of trimmed.split(',')) {
    const segment = part.trim();
    if (!segment) continue;
    if (segment.includes('-')) {
      const [startStr, endStr] = segment.split('-');
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return `Invalid range "${segment}"`;
      }
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        return `Range "${segment}" is outside pages 1–${pageCount}`;
      }
      if (start > end) return `Range "${segment}" has start greater than end`;
      for (let p = start; p <= end; p++) pages.add(p);
    } else {
      const page = Number.parseInt(segment, 10);
      if (Number.isNaN(page)) return `Invalid page "${segment}"`;
      if (page < 1 || page > pageCount) return `Page ${page} is outside pages 1–${pageCount}`;
      pages.add(page);
    }
  }

  if (!pages.size) return 'No valid pages in range';
  return null;
}

export function validateTableData(headers: string, rows: string): string | null {
  const headerCols = headers
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (!headerCols.length) return 'Add at least one table column header';

  const rowLines = rows
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rowLines.length) return 'Add at least one table row';

  for (let i = 0; i < rowLines.length; i++) {
    const cols = rowLines[i].split(',').map((c) => c.trim());
    if (cols.length !== headerCols.length) {
      return `Row ${i + 1} has ${cols.length} columns; expected ${headerCols.length}`;
    }
  }
  return null;
}

export function validatePassword(value: string, minLength = 4): string | null {
  if (!value.trim()) return 'Password is required';
  if (value.length < minLength) return `Password must be at least ${minLength} characters`;
  return null;
}

export function validateFontSize(size: number): string | null {
  if (!Number.isFinite(size) || size < 6 || size > 72) {
    return 'Font size must be between 6 and 72';
  }
  return null;
}

export function validateOpacity(opacity: number): string | null {
  if (!Number.isFinite(opacity) || opacity < 0.1 || opacity > 0.8) {
    return 'Opacity must be between 0.1 and 0.8';
  }
  return null;
}

export function validateImageFiles(files: File[]): string | null {
  if (!files.length) return 'Select at least one image';
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return `"${file.name}" is not a supported image file`;
    }
    if (file.size > 25 * 1024 * 1024) {
      return `"${file.name}" exceeds 25 MB image limit`;
    }
  }
  return null;
}
