const loadedScripts = new Set<string>();

/** Load a classic script tag once (for UMD bundles in /assets). */
export function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-mt-src="${src}"]`);
    if (existing) {
      loadedScripts.add(src);
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset['mtSrc'] = src;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/** Fetch remote bytes as Uint8Array (for FFmpeg core WASM). */
export async function fetchBytes(source: string | Blob | File): Promise<Uint8Array> {
  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Normalize typed arrays for BlobPart (strict ArrayBuffer typing). */
export function bytesToBlobPart(bytes: Uint8Array | Int8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Create a blob URL from remote content (mirrors @ffmpeg/util toBlobURL). */
export async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const bytes = await fetchBytes(url);
  return URL.createObjectURL(new Blob([bytesToBlobPart(bytes)], { type: mimeType }));
}
