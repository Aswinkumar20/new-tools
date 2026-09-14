import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface SubtitleCue {
  id: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export function parseSubtitleContent(content: string, fileName: string): SubtitleCue[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.vtt') || content.trimStart().startsWith('WEBVTT')) {
    return parseVtt(content);
  }
  return parseSrt(content);
}

export function parseSrt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  let id = 1;

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      continue;
    }

    let timeLineIndex = 0;
    if (/^\d+$/.test(lines[0]?.trim() ?? '')) {
      timeLineIndex = 1;
    }

    const timing = lines[timeLineIndex];
    const match = timing?.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!match) {
      continue;
    }

    const startSeconds = parseCueTimestamp(match[1] ?? '');
    const endSeconds = parseCueTimestamp(match[2] ?? '');
    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
    if (!text) {
      continue;
    }

    cues.push({ id: id++, startSeconds, endSeconds, text });
  }

  return cues;
}

export function parseVtt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];
  let id = 1;
  let i = 0;

  while (i < lines.length && !lines[i]?.includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const timing = lines[i]?.trim() ?? '';
    const match = timing.match(
      /(?:(\d{1,2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*(?:(\d{1,2}:)?\d{2}:\d{2}\.\d{3})/
    );
    if (!match) {
      i++;
      continue;
    }

    const fullMatch = timing.match(
      /((?:\d{1,2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}\.\d{3})/
    );
    if (!fullMatch) {
      i++;
      continue;
    }

    const startSeconds = parseCueTimestamp(fullMatch[1] ?? '');
    const endSeconds = parseCueTimestamp(fullMatch[2] ?? '');
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i]?.trim() !== '') {
      textLines.push(lines[i] ?? '');
      i++;
    }

    const text = textLines.join('\n').trim();
    if (text) {
      cues.push({ id: id++, startSeconds, endSeconds, text });
    }
    i++;
  }

  return cues;
}

export function parseCueTimestamp(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    return minutes * 60 + seconds;
  }
  return Number(normalized) || 0;
}

export function formatCueTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00.000';
  }
  const totalMs = Math.floor(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  const frac = ms.toString().padStart(3, '0');
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${frac}`;
}

export function filterSubtitleCues(cues: SubtitleCue[], query: string): SubtitleCue[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return cues;
  }
  return cues.filter((cue) => cue.text.toLowerCase().includes(q));
}

export function isSubtitleFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.srt') ||
    name.endsWith('.vtt') ||
    name.endsWith('.sub') ||
    file.type === 'text/vtt' ||
    file.type === 'application/x-subrip'
  );
}

export function resolveSubtitleSuggestion(options: {
  hasCues: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'sv-text',
      title: 'Not a subtitle file?',
      reason: 'Open plain text or markdown in Text File Viewer instead.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }
  if (!options.hasCues) {
    return {
      id: 'sv-video',
      title: 'Pair with video playback?',
      reason: 'Use Video Player to preview clips alongside subtitle files.',
      actionLabel: 'Open Video Player',
      path: '/file-viewers/video-player'
    };
  }
  return null;
}
