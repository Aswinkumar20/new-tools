declare module 'pako' {
  export function deflate(
    data: Uint8Array | ArrayBuffer | string,
    options?: { level?: number },
  ): Uint8Array;
  export function inflate(
    data: Uint8Array | ArrayBuffer,
    options?: { to?: string },
  ): Uint8Array;
  export function deflateRaw(
    data: Uint8Array | ArrayBuffer | string,
    options?: { level?: number },
  ): Uint8Array;
  export function inflateRaw(
    data: Uint8Array | ArrayBuffer,
    options?: { to?: string },
  ): Uint8Array;
  export function gzip(
    data: Uint8Array | ArrayBuffer | string,
    options?: { level?: number },
  ): Uint8Array;
  export function ungzip(
    data: Uint8Array | ArrayBuffer,
    options?: { to?: string },
  ): Uint8Array;
}
