export const FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
] as const;

export type MedicalFullscreenMode = 'none' | 'native' | 'css';

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
    await Promise.resolve(el.webkitRequestFullscreen());
    return;
  }
  if (el.mozRequestFullScreen) {
    await Promise.resolve(el.mozRequestFullScreen());
    return;
  }
  if (el.msRequestFullscreen) {
    await Promise.resolve(el.msRequestFullscreen());
  }
}

export async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  if (document.fullscreenElement && doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await Promise.resolve(doc.webkitExitFullscreen());
    return;
  }
  if (doc.mozCancelFullScreen) {
    await Promise.resolve(doc.mozCancelFullScreen());
    return;
  }
  if (doc.msExitFullscreen) {
    await Promise.resolve(doc.msExitFullscreen());
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

export function findMedicalWorkspace(host: HTMLElement): HTMLElement | null {
  return host.querySelector('[data-medical-workspace]');
}

export async function applyMedicalFullscreenToggle(
  host: HTMLElement,
  currentlyOn: boolean
): Promise<{ active: boolean; mode: MedicalFullscreenMode }> {
  const target = findMedicalWorkspace(host) ?? host;

  if (currentlyOn) {
    if (isDocumentFullscreen()) {
      try {
        await exitDocumentFullscreen();
      } catch {
        /* ignore */
      }
    }
    return { active: false, mode: 'none' };
  }

  try {
    await requestElementFullscreen(target);
    if (isDocumentFullscreen()) {
      return { active: true, mode: 'native' };
    }
  } catch {
    /* CSS fallback */
  }
  return { active: true, mode: 'css' };
}
