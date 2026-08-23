import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  PPT_DEFAULT_SLIDE_HEIGHT_EMU,
  PPT_DEFAULT_SLIDE_WIDTH_EMU,
  PPT_LARGE_FILE_SUGGEST_BYTES,
  PPT_MANY_SLIDES_SUGGEST_THRESHOLD,
  PPT_MAX_FILE_SIZE_BYTES,
  PPT_MAX_ZOOM,
  PPT_MIME_TYPE,
  PPT_MIN_ZOOM,
  PPT_OOXML_RELATIONSHIPS_NS,
  PPT_SCHEME_COLOR_HEX,
  PPT_ZOOM_STEP
} from '../constants/powerpoint-viewer.constants';
import type {
  JsZipConstructor,
  PresentationFile,
  PresentationValidationResult,
  PptxData,
  PptxElement,
  PptxSlide
} from '../types/powerpoint-viewer.types';
import { PresentationType } from '../types/powerpoint-viewer.types';

export async function loadJsZipLibrary(): Promise<JsZipConstructor> {
  if (globalThis.window === undefined) {
    throw new TypeError('JSZip can only be loaded in browser environment');
  }

  const jszipMod = await import('jszip');
  const JSZipLib = (jszipMod.default ?? jszipMod) as unknown as JsZipConstructor;
  if (!JSZipLib?.loadAsync) {
    throw new Error('Failed to load JSZip library');
  }
  return JSZipLib;
}

export function detectPresentationType(file: File): PresentationType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.pptx') || mimeType === PPT_MIME_TYPE) {
    return PresentationType.PPTX;
  }

  return PresentationType.UNSUPPORTED;
}

export function formatPowerpointFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampPowerpointZoom(level: number): number {
  return Math.max(PPT_MIN_ZOOM, Math.min(PPT_MAX_ZOOM, level));
}

export function stepPowerpointZoom(current: number, direction: 1 | -1): number {
  return clampPowerpointZoom(current + direction * PPT_ZOOM_STEP);
}

export function validatePresentationFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    formatFileSize?: (bytes: number) => string;
  } = {}
): PresentationValidationResult {
  const maxFileSize = options.maxFileSize ?? PPT_MAX_FILE_SIZE_BYTES;
  const formatSize = options.formatFileSize ?? formatPowerpointFileSize;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (detectPresentationType(file) === PresentationType.UNSUPPORTED) {
      errors.push(`${file.name}: Unsupported file format. Only PPTX files are supported.`);
      continue;
    }

    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${formatSize(maxFileSize)})`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function createPresentationFileRecord(
  file: File,
  url: string,
  slides: PptxSlide[],
  slideWidthEmu: number,
  slideHeightEmu: number,
  metadata: PresentationFile['metadata'] = {}
): PresentationFile {
  return {
    name: file.name,
    file,
    url,
    size: file.size,
    presentationType: detectPresentationType(file),
    slides,
    totalSlides: slides.length,
    currentSlideIndex: 0,
    slideWidthEmu,
    slideHeightEmu,
    metadata
  };
}

export function escapePowerpointHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function isFullscreenActive(doc: Document = document): boolean {
  const extended = doc as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    doc.fullscreenElement ||
    extended.webkitFullscreenElement ||
    extended.mozFullScreenElement ||
    extended.msFullscreenElement
  );
}

export function safeRevokeObjectUrl(url: string | undefined): void {
  if (!url) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore invalid object URLs during teardown
  }
}

export function getPresentationTypeLabel(type: PresentationType): string {
  switch (type) {
    case PresentationType.PPTX:
      return 'PPTX';
    default:
      return 'Unknown';
  }
}

export function getSlidePreviewLabel(slide: PptxSlide | undefined, index: number): string {
  if (!slide) {
    return `Slide ${index + 1}`;
  }
  if (slide.parseError) {
    return 'Parse error';
  }
  const texts = slide.elements
    .filter((e) => e.type === 'text' && e.content?.trim())
    .map((e) => (e.content || '').trim())
    .sort((a, b) => b.length - a.length);
  const text = texts[0];
  if (text) {
    return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }
  if (slide.elements.some((e) => e.type === 'image')) {
    return 'Image slide';
  }
  return 'No extractable text';
}

export function resolvePowerpointSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  slideCount: number;
  currentSize: number;
  hasParseWarnings: boolean;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, slideCount, currentSize, hasParseWarnings } = options;

  if (hasError) {
    return {
      id: 'pp-meta',
      title: 'Check the file type?',
      reason:
        'Upload failed or the format was rejected. Confirm it is a valid PPTX before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'pp-pdf',
      title: 'Need a PDF export of your deck?',
      reason:
        'After reviewing slides here, open PDF Viewer to check exported PDFs with page-accurate layout.',
      actionLabel: 'Open PDF Viewer',
      path: '/file-viewers/pdf-viewer'
    };
  }

  if (hasParseWarnings) {
    return {
      id: 'pp-image',
      title: 'Some slides need a richer preview?',
      reason:
        'Charts and complex shapes may not extract. Export those slides as images and open Image Viewer.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }

  if (currentSize > PPT_LARGE_FILE_SUGGEST_BYTES) {
    return {
      id: 'pp-pdf-large',
      title: 'This presentation is fairly large',
      reason:
        'Large PPTX files can be heavy to share. Export a PDF handout and preview it in PDF Viewer.',
      actionLabel: 'Open PDF Viewer',
      path: '/file-viewers/pdf-viewer'
    };
  }

  if (slideCount > PPT_MANY_SLIDES_SUGGEST_THRESHOLD) {
    return {
      id: 'pp-word',
      title: 'Long deck — add speaker notes?',
      reason:
        'Long presentations often pair with a notes document. Draft or review notes in Word Viewer.',
      actionLabel: 'Open Word Viewer',
      path: '/file-viewers/word-viewer'
    };
  }

  return {
    id: 'pp-pdf-loaded',
    title: 'Share this as a PDF?',
    reason:
      'After reviewing slides, export to PDF for stakeholders who do not need an editable deck.',
    actionLabel: 'Open PDF Viewer',
    path: '/file-viewers/pdf-viewer'
  };
}


export async function parsePptxManually(file: File): Promise<PptxData> {
    const JSZip = await loadJsZipLibrary();
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();

    let slideWidthEmu = PPT_DEFAULT_SLIDE_WIDTH_EMU;
    let slideHeightEmu = PPT_DEFAULT_SLIDE_HEIGHT_EMU;
    let slideFiles: string[] = [];

    try {
      const presentationXml = await zip.files['ppt/presentation.xml']?.async('string');
      if (presentationXml) {
        const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');
        const sldSz = findElementsByLocalName(presentationDoc, 'sldSz')[0];
        if (sldSz) {
          const cx = Number(sldSz.getAttribute('cx'));
          const cy = Number(sldSz.getAttribute('cy'));
          if (Number.isFinite(cx) && cx > 0) slideWidthEmu = cx;
          if (Number.isFinite(cy) && cy > 0) slideHeightEmu = cy;
        }

        // Respect presentation order from sldIdLst + relationships (not just filename sort)
        const presRels = await loadPresentationRelationships(zip, parser);
        const sldIds = findElementsByLocalName(presentationDoc, 'sldId');
        for (const sldId of sldIds) {
          const rid =
            sldId.getAttribute('r:id') ||
            sldId.getAttributeNS(PPT_OOXML_RELATIONSHIPS_NS, 'id') ||
            sldId.getAttribute('id');
          if (!rid) continue;
          const target = presRels.get(rid);
          if (!target) continue;
          const path = target.startsWith('/')
            ? target.replace(/^\//, '')
            : target.startsWith('ppt/')
              ? target
              : `ppt/${target.replace(/^\.\//, '')}`;
          if (zip.files[path]) {
            slideFiles.push(path);
          }
        }
      }
    } catch {
      // keep defaults / fallback list
    }

    if (slideFiles.length === 0) {
      slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
          const numA = Number(a.match(/slide(\d+)/i)?.[1] || '0');
          const numB = Number(b.match(/slide(\d+)/i)?.[1] || '0');
          return numA - numB;
        });
    }

    const slides: PptxSlide[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideEntry = zip.files[slideFile];
      if (!slideEntry) continue;
      try {
        const xmlContent = await slideEntry.async('string');
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
        if (parserError) {
          throw new Error(parserError.textContent?.trim() || 'Invalid slide XML');
        }

        const relMap = await loadSlideRelationships(zip, slideFile, parser);
        const layoutBoxes = await loadLayoutPlaceholderBoxes(
          zip,
          relMap,
          parser,
          slideWidthEmu,
          slideHeightEmu
        );
        const elements: PptxElement[] = [];
        const capturedTexts = new Set<string>();
        let autoTop = 8;

        const nextFallbackBox = (preferWidth = 88, preferHeight = 10): { x: number; y: number; width: number; height: number } => {
          const box = { x: 6, y: Math.min(autoTop, 88), width: preferWidth, height: preferHeight };
          autoTop += preferHeight + 2;
          return box;
        };

        const resolveBox = (
          node: Element,
          fallbackW = 88,
          fallbackH = 12
        ): { x: number; y: number; width: number; height: number } => {
          const local = readTransformBox(node, slideWidthEmu, slideHeightEmu);
          if (local) return local;
          const ph = findElementsByLocalName(node, 'ph')[0];
          const idx = ph?.getAttribute('idx') || (ph ? '0' : '');
          if (idx && layoutBoxes.has(idx)) {
            return layoutBoxes.get(idx)!;
          }
          // Common title placeholder without idx
          if (ph && layoutBoxes.has('0')) {
            return layoutBoxes.get('0')!;
          }
          return nextFallbackBox(fallbackW, fallbackH);
        };

        const pushText = (el: PptxElement): void => {
          elements.push(el);
          if (el.type === 'text' && el.content?.trim()) {
            capturedTexts.add(el.content.trim().toLowerCase());
          }
        };

        for (const sp of findElementsByLocalName(xmlDoc, 'sp')) {
          const textParts = extractShapeText(sp);
          const fill = readShapeFill(sp);
          if (textParts.length === 0 && !fill) continue;

          const box = resolveBox(sp, 88, Math.max(8, textParts.length * 5));

          if (fill && textParts.length === 0) {
            elements.push({
              type: 'shape',
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              style: { background: fill }
            });
            continue;
          }

          const firstRun = textParts[0];
          const textColor = ensureReadableTextColor(
            firstRun?.color || '#1e293b',
            fill || readSlideBackground(xmlDoc) || '#ffffff'
          );
          pushText({
            type: 'text',
            content: textParts.map(p => p.text).join('\n'),
            x: box.x,
            y: box.y,
            width: Math.max(box.width, 4),
            height: Math.max(box.height, 4),
            style: {
              fontSize: firstRun?.fontSize ?? 16,
              fontWeight: firstRun?.bold ? '700' : '400',
              color: textColor,
              textAlign: firstRun?.align || 'left',
              background: fill || undefined
            }
          });
        }

        // Tables / charts frames often hold unique per-slide content
        for (const frame of findElementsByLocalName(xmlDoc, 'graphicFrame')) {
          const box = resolveBox(frame, 88, 40);
          const tableTexts = extractTableTexts(frame);
          if (tableTexts.length === 0) continue;

          tableTexts.forEach((rowText, rowIdx) => {
            if (!rowText.trim()) return;
            const top = Math.min(box.y + rowIdx * Math.max(box.height / Math.max(tableTexts.length, 1), 4), 90);
            pushText({
              type: 'text',
              content: rowText,
              x: box.x,
              y: top,
              width: Math.max(box.width, 20),
              height: Math.max(box.height / Math.max(tableTexts.length, 1), 5),
              style: {
                fontSize: 13,
                fontWeight: rowIdx === 0 ? '700' : '400',
                color: '#1e293b',
                textAlign: 'left'
              }
            });
          });
        }

        for (const pic of findElementsByLocalName(xmlDoc, 'pic')) {
          const blip = findElementsByLocalName(pic, 'blip')[0];
          const embed =
            blip?.getAttribute('r:embed') ||
            blip?.getAttributeNS(PPT_OOXML_RELATIONSHIPS_NS, 'embed') ||
            blip?.getAttribute('embed');
          if (!embed) continue;

          const imageData = await resolveImageData(zip, relMap, embed);
          if (!imageData) continue;

          const box = resolveBox(pic, 80, 45);
          elements.push({
            type: 'image',
            imageData,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
          });
        }

        // Also capture text from group shapes (grpSp children already walked as sp),
        // and any leftover a:t nodes not attached to processed shapes.
        const remaining = collectSlideTexts(xmlDoc).filter(t => {
          const lower = t.toLowerCase();
          if (capturedTexts.has(lower)) return false;
          for (const captured of capturedTexts) {
            if (captured.includes(lower)) return false;
          }
          return true;
        });
        if (remaining.length > 0) {
          remaining.forEach((text, idx) => {
            const box = nextFallbackBox(88, 8);
            pushText({
              type: 'text',
              content: text,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              style: {
                fontSize: idx === 0 ? 18 : 14,
                fontWeight: idx === 0 ? '700' : '400',
                color: '#1e293b'
              }
            });
          });
        }

        // Last resort: regex extract from raw XML if DOM walk missed namespaced text
        if (elements.length === 0) {
          const rawTexts = collectTextsFromRawXml(xmlContent);
          rawTexts.forEach((text, idx) => {
            const box = nextFallbackBox(88, 8);
            pushText({
              type: 'text',
              content: text,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              style: {
                fontSize: idx === 0 ? 18 : 14,
                fontWeight: idx === 0 ? '700' : '400',
                color: '#1e293b'
              }
            });
          });
        }

        if (elements.length === 0) {
          warnings.push(
            `Slide ${i + 1}: No extractable content found (unsupported shapes, charts, or empty slide).`
          );
        }

        // Deep-copy so slides never share element references
        slides.push({
          id: i + 1,
          background: readSlideBackground(xmlDoc) || '#ffffff',
          elements: elements.map(el => ({
            ...el,
            style: el.style ? { ...el.style } : undefined
          }))
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown parse error';
        warnings.push(`Slide ${i + 1} failed to parse: ${detail}`);
        slides.push({
          id: i + 1,
          background: '#ffffff',
          elements: [],
          parseError: detail
        });
      }
    }

    if (slideFiles.length === 0) {
      throw new Error('No slides found in this PPTX file. The file may be corrupted or not a valid presentation.');
    }

    if (slides.length === 0) {
      throw new Error('Unable to parse any slides from this presentation.');
    }

    const failedCount = slides.filter(s => !!s.parseError).length;
    if (failedCount === slides.length) {
      throw new Error(
        `All ${failedCount} slides failed to parse. The file may be corrupted or use unsupported features.`
      );
    }

    // Collapse repetitive empty-content warnings into one toast-friendly message
    const emptySlideNums = warnings
      .map(w => w.match(/^Slide (\d+): No extractable content/i)?.[1])
      .filter((n): n is string => !!n);
    const otherWarnings = warnings.filter(w => !/^Slide \d+: No extractable content/i.test(w));
    const collapsedWarnings = [...otherWarnings];
    if (emptySlideNums.length === 1) {
      collapsedWarnings.push(warnings.find(w => w.startsWith(`Slide ${emptySlideNums[0]}: No extractable`))!);
    } else if (emptySlideNums.length > 1) {
      collapsedWarnings.push(
        `Slides ${emptySlideNums.join(', ')}: no extractable content (placeholders/images may need a richer renderer).`
      );
    }

    return { slides, slideWidthEmu, slideHeightEmu, warnings: collapsedWarnings };
  }

async function loadPresentationRelationships(zip: any, parser: DOMParser): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const relContent = await zip.files['ppt/_rels/presentation.xml.rels']?.async('string');
      if (!relContent) return map;
      const relDoc = parser.parseFromString(relContent, 'text/xml');
      for (const rel of findElementsByLocalName(relDoc, 'Relationship')) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) map.set(id, target);
      }
    } catch {
      // ignore
    }
    return map;
  }

function extractTableTexts(frame: Element): string[] {
    const rows = findElementsByLocalName(frame, 'tr');
    if (rows.length === 0) {
      // Non-table graphic frame: still pull any text runs
      const texts = findElementsByLocalName(frame, 't')
        .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(t => t.length > 0);
      return texts.length ? [texts.join(' · ')] : [];
    }

    return rows.map(row => {
      const cells = findElementsByLocalName(row, 'tc');
      return cells
        .map(cell =>
          findElementsByLocalName(cell, 't')
            .map(t => (t.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ')
        )
        .filter(Boolean)
        .join(' | ');
    }).filter(Boolean);
  }

function collectSlideTexts(xmlDoc: Document): string[] {
    const texts = findElementsByLocalName(xmlDoc, 't')
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 1 && !/^[0-9.\s]+$/.test(t));
    return Array.from(new Set(texts)).slice(0, 60);
  }

export function ensureReadableTextColor(color: string, background: string): string {
    const c = (color || '').toLowerCase();
    const bg = (background || '#ffffff').toLowerCase();
    const isLight = (hex: string): boolean => {
      const h = hex.replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(h)) return true;
      const r = Number.parseInt(h.slice(0, 2), 16);
      const g = Number.parseInt(h.slice(2, 4), 16);
      const b = Number.parseInt(h.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 180;
    };
    if (isLight(c) && isLight(bg)) {
      return '#1e293b';
    }
    return color || '#1e293b';
  }

export function findElementsByLocalName(root: Document | Element, localName: string): Element[] {
    const results: Element[] = [];
    const walk = (node: Node): void => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if ((el.localName || el.nodeName.split(':').pop()) === localName) {
          results.push(el);
        }
        for (const child of Array.from(el.childNodes)) {
          walk(child);
        }
      }
    };
    walk(root);
    return results;
  }

async function loadSlideRelationships(
  zip: any,
  slideFile: string,
  parser: DOMParser
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const slideName = slideFile.split('/').pop()?.replace(/\.xml$/i, '') || '';
    const relFile = `ppt/slides/_rels/${slideName}.xml.rels`;
    try {
      const relContent = await zip.files[relFile]?.async('string');
      if (!relContent) return map;
      const relDoc = parser.parseFromString(relContent, 'text/xml');
      for (const rel of findElementsByLocalName(relDoc, 'Relationship')) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) map.set(id, target);
      }
    } catch {
      // ignore
    }
    return map;
  }

function resolvePptPath(target: string, baseDir = 'ppt'): string {
    const cleaned = target.replace(/\\/g, '/');
    if (cleaned.startsWith('/')) return cleaned.replace(/^\//, '');
    if (cleaned.startsWith('ppt/')) return cleaned;
    if (cleaned.startsWith('../')) {
      // e.g. ../slideLayouts/slideLayout1.xml from ppt/slides/
      const parts = `${baseDir}/slides/${cleaned}`.split('/');
      const out: string[] = [];
      for (const part of parts) {
        if (part === '..') out.pop();
        else if (part && part !== '.') out.push(part);
      }
      return out.join('/');
    }
    return `${baseDir}/${cleaned.replace(/^\.\//, '')}`;
  }

async function loadLayoutPlaceholderBoxes(
  zip: any,
  relMap: Map<string, string>,
  parser: DOMParser,
  slideWidthEmu: number,
  slideHeightEmu: number
): Promise<Map<string, { x: number; y: number; width: number; height: number }>> {
    const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
    let layoutTarget: string | null = null;
    for (const target of relMap.values()) {
      if (/slideLayout/i.test(target)) {
        layoutTarget = target;
        break;
      }
    }
    if (!layoutTarget) return boxes;

    const layoutPath = resolvePptPath(layoutTarget);
    try {
      const layoutXml = await zip.files[layoutPath]?.async('string');
      if (!layoutXml) return boxes;
      const layoutDoc = parser.parseFromString(layoutXml, 'text/xml');
      for (const sp of findElementsByLocalName(layoutDoc, 'sp')) {
        const ph = findElementsByLocalName(sp, 'ph')[0];
        if (!ph) continue;
        const idx = ph.getAttribute('idx') || '0';
        const box = readTransformBox(sp, slideWidthEmu, slideHeightEmu);
        if (box) boxes.set(idx, box);
      }
      // Also check pics on layout for placeholder geometry
      for (const pic of findElementsByLocalName(layoutDoc, 'pic')) {
        const ph = findElementsByLocalName(pic, 'ph')[0];
        if (!ph) continue;
        const idx = ph.getAttribute('idx') || '0';
        const box = readTransformBox(pic, slideWidthEmu, slideHeightEmu);
        if (box && !boxes.has(idx)) boxes.set(idx, box);
      }
    } catch {
      // ignore layout load failures
    }
    return boxes;
  }

function collectTextsFromRawXml(xml: string): string[] {
    const texts: string[] = [];
    const re = /<(?:a:)?t(?:\s[^>]*)?>([^<]*)<\/(?:a:)?t>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) !== null) {
      const text = (match[1] || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
      if (text.length > 1 && !/^[0-9.\s]+$/.test(text)) {
        texts.push(text);
      }
    }
    return Array.from(new Set(texts)).slice(0, 60);
  }

async function resolveImageData(zip: any, relMap: Map<string, string>, embedId: string): Promise<string | null> {
    const target = relMap.get(embedId);
    if (!target) return null;

    const candidates = [
      resolvePptPath(target),
      target.startsWith('../') ? `ppt/${target.replace(/^\.\.\//, '')}` : '',
      `ppt/slides/${target}`,
      `ppt/media/${target.split('/').pop()}`
    ].filter(Boolean);

    let imageFile: any = null;
    let imagePath = '';
    for (const path of candidates) {
      if (zip.files[path]) {
        imageFile = zip.files[path];
        imagePath = path;
        break;
      }
    }
    if (!imageFile) return null;

    const imageData = await imageFile.async('base64');
    const ext = (imagePath.split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
    return `data:image/${mime};base64,${imageData}`;
  }

function readTransformBox(
  node: Element,
  slideWidthEmu: number,
  slideHeightEmu: number
): { x: number; y: number; width: number; height: number } | null {
    const xfrm = findElementsByLocalName(node, 'xfrm')[0];
    if (!xfrm) return null;
    const off = findElementsByLocalName(xfrm, 'off')[0];
    const ext = findElementsByLocalName(xfrm, 'ext')[0];
    if (!off || !ext) return null;

    const xEmu = Number(off.getAttribute('x') || 0);
    const yEmu = Number(off.getAttribute('y') || 0);
    const wEmu = Number(ext.getAttribute('cx') || 0);
    const hEmu = Number(ext.getAttribute('cy') || 0);
    if (!Number.isFinite(wEmu) || !Number.isFinite(hEmu) || wEmu <= 0 || hEmu <= 0) {
      return null;
    }

    return {
      x: (xEmu / slideWidthEmu) * 100,
      y: (yEmu / slideHeightEmu) * 100,
      width: (wEmu / slideWidthEmu) * 100,
      height: (hEmu / slideHeightEmu) * 100
    };
  }

function readShapeFill(sp: Element): string | undefined {
    const spPr = findElementsByLocalName(sp, 'spPr')[0];
    if (!spPr) return undefined;
    return readSolidFill(spPr);
  }

function readSolidFill(node: Element): string | undefined {
    const fills = findElementsByLocalName(node, 'solidFill');
    for (const fill of fills) {
      const srgb = findElementsByLocalName(fill, 'srgbClr')[0];
      if (srgb?.getAttribute('val')) {
        return `#${srgb.getAttribute('val')}`;
      }
      const scheme = findElementsByLocalName(fill, 'schemeClr')[0];
      if (scheme) {
        return schemeColorToHex(scheme.getAttribute('val'));
      }
    }
    return undefined;
  }

function readSlideBackground(xmlDoc: Document): string | undefined {
    const bg = findElementsByLocalName(xmlDoc, 'bg')[0];
    if (!bg) return undefined;
    return readSolidFill(bg);
  }

function schemeColorToHex(name: string | null): string | undefined {
  return name ? PPT_SCHEME_COLOR_HEX[name] : undefined;
}

function extractShapeText(sp: Element): Array<{
  text: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  align?: string;
}> {
    const paragraphs = findElementsByLocalName(sp, 'p');
    const parts: Array<{ text: string; fontSize?: number; bold?: boolean; color?: string; align?: string }> = [];

    for (const p of paragraphs) {
      const pPr = findElementsByLocalName(p, 'pPr')[0];
      const alignAttr = pPr?.getAttribute('algn');
      const align = alignAttr === 'ctr' ? 'center' : alignAttr === 'r' ? 'right' : 'left';

      const runs = findElementsByLocalName(p, 'r');
      const runTexts: string[] = [];
      let fontSize: number | undefined;
      let bold = false;
      let color: string | undefined;

      for (const r of runs) {
        const t = findElementsByLocalName(r, 't')[0];
        const text = t?.textContent ?? '';
        if (!text) continue;
        runTexts.push(text);

        const rPr = findElementsByLocalName(r, 'rPr')[0];
        if (rPr) {
          const sz = Number(rPr.getAttribute('sz'));
          if (Number.isFinite(sz) && sz > 0) {
            fontSize = Math.max(10, Math.round(sz / 100));
          }
          bold = rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true' || bold;
          const fill = readSolidFill(rPr);
          if (fill) color = fill;
        }
      }

      for (const fld of findElementsByLocalName(p, 'fld')) {
        const t = findElementsByLocalName(fld, 't')[0];
        if (t?.textContent) runTexts.push(t.textContent);
      }

      const combined = runTexts.join('').trim();
      if (combined) {
        parts.push({ text: combined, fontSize, bold, color, align });
      }
    }

    return parts;
  }

