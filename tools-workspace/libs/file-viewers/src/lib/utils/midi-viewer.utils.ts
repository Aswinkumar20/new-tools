import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface MidiNote {
  pitch: number;
  startTicks: number;
  durationTicks: number;
  track: number;
  velocity: number;
}

export interface MidiTrackInfo {
  index: number;
  name: string;
  noteCount: number;
}

export interface MidiParseResult {
  format: number;
  ticksPerBeat: number;
  tracks: MidiTrackInfo[];
  notes: MidiNote[];
  durationTicks: number;
}

export function isMidiFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mid') || name.endsWith('.midi') || file.type === 'audio/midi';
}

export function parseMidiFile(buffer: ArrayBuffer): MidiParseResult {
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder();
  let offset = 0;

  const readChunk = (): { id: string; length: number; start: number } => {
    const id = textDecoder.decode(new Uint8Array(buffer, offset, 4));
    const length = view.getUint32(offset + 4);
    const start = offset + 8;
    offset = start + length;
    return { id, length, start };
  };

  const header = readChunk();
  if (header.id !== 'MThd') {
    throw new Error('Invalid MIDI file (missing MThd header)');
  }

  const format = view.getUint16(header.start);
  const trackCount = view.getUint16(header.start + 2);
  const division = view.getUint16(header.start + 4);
  const ticksPerBeat = division & 0x8000 ? 480 : division;

  const notes: MidiNote[] = [];
  const tracks: MidiTrackInfo[] = [];
  let maxTick = 0;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    const trackChunk = readChunk();
    if (trackChunk.id !== 'MTrk') {
      throw new Error('Invalid MIDI track chunk');
    }

    let trackOffset = trackChunk.start;
    const trackEnd = trackChunk.start + trackChunk.length;
    let tick = 0;
    let runningStatus = 0;
    let trackName = `Track ${trackIndex + 1}`;
    const activeNotes = new Map<number, { pitch: number; velocity: number; start: number }>();

    while (trackOffset < trackEnd) {
      const delta = readVariableLength(view, trackOffset, trackEnd);
      trackOffset = delta.next;
      tick += delta.value;

      if (trackOffset >= trackEnd) {
        break;
      }

      let status = view.getUint8(trackOffset);
      if (status < 0x80) {
        status = runningStatus;
        trackOffset -= 1;
      } else {
        runningStatus = status;
        trackOffset += 1;
      }

      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (type === 0x90) {
        const pitch = view.getUint8(trackOffset);
        const velocity = view.getUint8(trackOffset + 1);
        trackOffset += 2;
        if (velocity > 0) {
          activeNotes.set(channel * 128 + pitch, { pitch, velocity, start: tick });
        } else {
          finalizeNote(activeNotes, channel, pitch, tick, trackIndex, notes);
        }
      } else if (type === 0x80) {
        const pitch = view.getUint8(trackOffset);
        trackOffset += 2;
        finalizeNote(activeNotes, channel, pitch, tick, trackIndex, notes);
      } else if (status === 0xff) {
        const metaType = view.getUint8(trackOffset);
        const meta = readVariableLength(view, trackOffset + 1, trackEnd);
        trackOffset = meta.next;
        const metaLength = meta.value;
        if (metaType === 0x03 && metaLength > 0) {
          trackName = textDecoder.decode(new Uint8Array(buffer, trackOffset, metaLength)).trim() || trackName;
        }
        trackOffset += metaLength;
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        trackOffset += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        trackOffset += 1;
      } else {
        trackOffset += 1;
      }

      maxTick = Math.max(maxTick, tick);
    }

    tracks.push({
      index: trackIndex,
      name: trackName,
      noteCount: notes.filter((n) => n.track === trackIndex).length
    });
  }

  return { format, ticksPerBeat, tracks, notes, durationTicks: maxTick };
}

function finalizeNote(
  activeNotes: Map<number, { pitch: number; velocity: number; start: number }>,
  channel: number,
  pitch: number,
  tick: number,
  trackIndex: number,
  notes: MidiNote[]
): void {
  const key = channel * 128 + pitch;
  const active = activeNotes.get(key);
  if (!active) {
    return;
  }
  notes.push({
    pitch: active.pitch,
    startTicks: active.start,
    durationTicks: Math.max(1, tick - active.start),
    track: trackIndex,
    velocity: active.velocity
  });
  activeNotes.delete(key);
}

function readVariableLength(
  view: DataView,
  start: number,
  end: number
): { value: number; next: number } {
  let value = 0;
  let offset = start;
  while (offset < end) {
    const byte = view.getUint8(offset++);
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      break;
    }
  }
  return { value, next: offset };
}

export function midiPitchLabel(pitch: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12] ?? 'C'}${octave}`;
}

export function drawMidiPianoRoll(
  canvas: HTMLCanvasElement,
  notes: MidiNote[],
  durationTicks: number,
  options: { minPitch?: number; maxPitch?: number } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || notes.length === 0 || durationTicks <= 0) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 240;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const minPitch = options.minPitch ?? Math.min(...notes.map((n) => n.pitch)) - 2;
  const maxPitch = options.maxPitch ?? Math.max(...notes.map((n) => n.pitch)) + 2;
  const pitchRange = Math.max(1, maxPitch - minPitch);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  for (let p = minPitch; p <= maxPitch; p++) {
    if (p % 12 === 0) {
      const y = height - ((p - minPitch) / pitchRange) * height;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  for (const note of notes) {
    const x = (note.startTicks / durationTicks) * width;
    const w = Math.max(2, (note.durationTicks / durationTicks) * width);
    const y = height - ((note.pitch - minPitch) / pitchRange) * height;
    const noteHeight = Math.max(3, height / pitchRange - 1);
    ctx.fillStyle = `hsl(${(note.pitch * 5) % 360}, 70%, 55%)`;
    ctx.fillRect(x, y - noteHeight, w, noteHeight);
  }
}

export function resolveMidiSuggestion(options: {
  hasNotes: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'mv-audio',
      title: 'Need audio playback?',
      reason: 'Audio Player handles MP3 and WAV if this file is not MIDI.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }
  if (!options.hasNotes) {
    return null;
  }
  return {
    id: 'mv-spectrum',
    title: 'Inspect audio spectrum?',
    reason: 'WAV Spectrum Viewer shows waveform and FFT for audio exports.',
    actionLabel: 'Open WAV Spectrum Viewer',
    path: '/file-viewers/wav-spectrum-viewer'
  };
}
