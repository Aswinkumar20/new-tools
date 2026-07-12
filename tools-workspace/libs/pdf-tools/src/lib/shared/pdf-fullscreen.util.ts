export const FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
] as const;

export function isDocumentFullscreen(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  return !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  const el = element as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
    return;
  }
  if (el.mozRequestFullScreen) {
    await el.mozRequestFullScreen();
    return;
  }
  if (el.msRequestFullscreen) {
    await el.msRequestFullscreen();
  }
}

export async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }
  if (doc.mozCancelFullScreen) {
    await doc.mozCancelFullScreen();
    return;
  }
  if (doc.msExitFullscreen) {
    await doc.msExitFullscreen();
  }
}

export function listenFullscreenChange(handler: () => void): () => void {
  for (const event of FULLSCREEN_CHANGE_EVENTS) {
    document.addEventListener(event, handler);
  }
  return () => {
    for (const event of FULLSCREEN_CHANGE_EVENTS) {
      document.removeEventListener(event, handler);
    }
  };
}

export function fullscreenPreviewWidth(): number {
  return Math.max(320, globalThis.innerWidth - 96);
}
