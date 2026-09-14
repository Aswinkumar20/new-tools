import { bytesToBlobPart, loadScript, toBlobURL } from './mt-script-loader.utils';
import { clampTrimRange } from './audio-trimmer.utils';
import { clampGifFps, clampGifWidth } from './video-to-gif.utils';
import type { FfmpegInstance, GifJsConstructor } from '../types/mt-vendor.types';

export type VideoToGifEngine = 'standard' | 'hq';

export interface VideoToGifConvertOptions {
  video: HTMLVideoElement;
  sourceFile: File;
  trimStartSeconds: number;
  trimEndSeconds: number;
  fps: number;
  maxWidth: number;
  loopCount: number;
  reverse: boolean;
  engine: VideoToGifEngine;
  gifScriptUrl: string;
  gifWorkerUrl: string;
  ffmpegScriptUrl: string;
  onProgress?: (progress: number, message?: string) => void;
  signal?: AbortSignal;
}

export interface VideoToGifConvertResult {
  blob: Blob;
  width: number;
  height: number;
  frameCount: number;
  engine: VideoToGifEngine;
}

const FFMPEG_CORE_VERSION = '0.12.6';
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

let gifConstructorPromise: Promise<GifJsConstructor> | null = null;
let ffmpegInstance: FfmpegInstance | null = null;
let ffmpegLoadPromise: Promise<FfmpegInstance> | null = null;

export function computeScaledVideoDimensions(
  videoWidth: number,
  videoHeight: number,
  maxWidth: number
): { width: number; height: number } {
  const width = clampGifWidth(maxWidth);
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { width, height: width };
  }
  const height = Math.max(1, Math.round((videoHeight / videoWidth) * width));
  return { width, height };
}

export async function loadGifConstructor(gifScriptUrl: string): Promise<GifJsConstructor> {
  if (window.GIF) {
    return window.GIF;
  }

  if (!gifConstructorPromise) {
    gifConstructorPromise = loadScript(gifScriptUrl).then(() => {
      if (!window.GIF) {
        throw new Error('gif.js failed to initialize');
      }
      return window.GIF;
    });
  }

  return gifConstructorPromise;
}

async function loadFfmpegInstance(ffmpegScriptUrl: string): Promise<FfmpegInstance> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      if (!window.FFmpegWASM?.FFmpeg) {
        await loadScript(ffmpegScriptUrl);
      }
      if (!window.FFmpegWASM?.FFmpeg) {
        throw new Error('FFmpeg failed to initialize');
      }

      const ffmpeg = new window.FFmpegWASM.FFmpeg();
      const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }

  return ffmpegLoadPromise;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Conversion aborted', 'AbortError');
  }
}

function waitForVideoEvent(video: HTMLVideoElement, event: 'seeked' | 'loadeddata'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video seek failed'));
    };
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSeconds) < 0.001) {
    return;
  }
  video.currentTime = timeSeconds;
  await waitForVideoEvent(video, 'seeked');
}

export async function convertVideoToGif(
  options: VideoToGifConvertOptions
): Promise<VideoToGifConvertResult> {
  if (options.engine === 'hq') {
    return convertVideoToGifWithFfmpeg(options);
  }
  return convertVideoToGifWithGifJs(options);
}

async function convertVideoToGifWithGifJs(
  options: VideoToGifConvertOptions
): Promise<VideoToGifConvertResult> {
  const {
    video,
    trimStartSeconds,
    trimEndSeconds,
    fps,
    maxWidth,
    loopCount,
    reverse,
    gifScriptUrl,
    gifWorkerUrl,
    onProgress,
    signal
  } = options;

  assertNotAborted(signal);

  const { startSeconds, endSeconds } = clampTrimRange(
    trimStartSeconds,
    trimEndSeconds,
    video.duration || 0
  );
  const duration = Math.max(0.05, endSeconds - startSeconds);
  const frameFps = clampGifFps(fps);
  const frameDelayMs = Math.round(1000 / frameFps);
  const frameCount = Math.max(1, Math.ceil(duration * frameFps));
  const { width, height } = computeScaledVideoDimensions(video.videoWidth, video.videoHeight, maxWidth);

  const GIF = await loadGifConstructor(gifScriptUrl);
  assertNotAborted(signal);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported');
  }

  const frameTimes: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    frameTimes.push(startSeconds + (i / frameFps));
  }
  if (reverse) {
    frameTimes.reverse();
  }

  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: gifWorkerUrl,
    width,
    height,
    repeat: loopCount === 0 ? 0 : loopCount
  });

  for (let i = 0; i < frameTimes.length; i++) {
    assertNotAborted(signal);
    await seekVideo(video, frameTimes[i] ?? startSeconds);
    ctx.drawImage(video, 0, 0, width, height);
    gif.addFrame(ctx, { copy: true, delay: frameDelayMs });
    onProgress?.((i + 1) / frameTimes.length, `Capturing frame ${i + 1} of ${frameTimes.length}`);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    gif.on('finished', (result) => {
      if (result instanceof Blob) {
        resolve(result);
      } else {
        reject(new Error('Unexpected GIF output'));
      }
    });
    gif.on('progress', (value) => {
      if (typeof value === 'number') {
        onProgress?.(value, 'Encoding GIF…');
      }
    });
    try {
      gif.render();
    } catch (error) {
      reject(error);
    }
  });

  return { blob, width, height, frameCount: frameTimes.length, engine: 'standard' };
}

async function convertVideoToGifWithFfmpeg(
  options: VideoToGifConvertOptions
): Promise<VideoToGifConvertResult> {
  const {
    video,
    trimStartSeconds,
    trimEndSeconds,
    fps,
    maxWidth,
    loopCount,
    reverse,
    ffmpegScriptUrl,
    sourceFile,
    onProgress,
    signal
  } = options;

  assertNotAborted(signal);

  const inputBytes = new Uint8Array(await sourceFile.arrayBuffer());
  assertNotAborted(signal);

  const { startSeconds, endSeconds } = clampTrimRange(
    trimStartSeconds,
    trimEndSeconds,
    video.duration || 0
  );
  const duration = Math.max(0.05, endSeconds - startSeconds);
  const frameFps = clampGifFps(fps);
  const width = computeScaledVideoDimensions(
    video.videoWidth,
    video.videoHeight,
    maxWidth
  ).width;
  const frameCount = Math.max(1, Math.ceil(duration * frameFps));

  const ffmpeg = await loadFfmpegInstance(ffmpegScriptUrl);
  assertNotAborted(signal);

  ffmpeg.on('progress', (payload) => {
    if ('progress' in payload && typeof payload.progress === 'number') {
      onProgress?.(Math.min(0.95, payload.progress), 'FFmpeg encoding…');
    }
  });

  const inputName = 'input.video';
  const outputName = 'output.gif';
  await ffmpeg.writeFile(inputName, inputBytes);

  const filters = [
    `fps=${frameFps}`,
    `scale=${width}:-1:flags=lanczos`,
    reverse ? 'reverse' : null,
    'split[s0][s1]',
    '[s0]palettegen[p]',
    '[s1][p]paletteuse'
  ]
    .filter(Boolean)
    .join(',');

  const loopArg = loopCount === 0 ? '-1' : String(Math.max(0, loopCount - 1));
  const exitCode = await ffmpeg.exec([
    '-ss',
    startSeconds.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    inputName,
    '-vf',
    filters,
    '-loop',
    loopArg,
    outputName
  ]);

  if (exitCode !== 0) {
    throw new Error('FFmpeg failed to create GIF');
  }

  const output = await ffmpeg.readFile(outputName);
  onProgress?.(1, 'GIF ready');
  const blob = new Blob([bytesToBlobPart(output)], { type: 'image/gif' });

  return {
    blob,
    width,
    height: computeScaledVideoDimensions(video.videoWidth, video.videoHeight, maxWidth).height,
    frameCount,
    engine: 'hq'
  };
}

export function buildGifFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video';
  return `${base}.gif`;
}

