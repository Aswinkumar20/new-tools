/** Minimal typings for UMD scripts loaded from /assets at runtime. */

export interface LamejsMp3Encoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}

export interface LamejsGlobal {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LamejsMp3Encoder;
}

export interface GifJsOptions {
  workers?: number;
  quality?: number;
  workerScript?: string;
  width?: number;
  height?: number;
  repeat?: number;
}

export interface GifJsInstance {
  addFrame: (
    element: HTMLCanvasElement | CanvasRenderingContext2D | ImageData,
    options?: { delay?: number; copy?: boolean }
  ) => void;
  on: (event: 'finished' | 'progress', handler: (payload: Blob | number) => void) => void;
  render: () => void;
  abort: () => void;
}

export interface GifJsConstructor {
  new (options?: GifJsOptions): GifJsInstance;
}

export interface FfmpegProgress {
  progress: number;
  time?: number;
}

export interface FfmpegLoadOptions {
  coreURL?: string;
  wasmURL?: string;
  workerURL?: string;
}

export interface FfmpegInstance {
  loaded: boolean;
  load: (options?: FfmpegLoadOptions, config?: { signal?: AbortSignal }) => Promise<void>;
  exec: (args: string[], timeout?: number, config?: { signal?: AbortSignal }) => Promise<number>;
  writeFile: (path: string, data: Uint8Array, config?: { signal?: AbortSignal }) => Promise<void>;
  readFile: (
    path: string,
    encoding?: 'binary' | 'utf8',
    config?: { signal?: AbortSignal }
  ) => Promise<Uint8Array>;
  on: (event: 'progress' | 'log', handler: (payload: FfmpegProgress | { message: string }) => void) => void;
  terminate: () => void;
}

export interface FfmpegWasmGlobal {
  FFmpeg: new () => FfmpegInstance;
}

declare global {
  interface Window {
    lamejs?: LamejsGlobal;
    GIF?: GifJsConstructor;
    FFmpegWASM?: FfmpegWasmGlobal;
  }
}
