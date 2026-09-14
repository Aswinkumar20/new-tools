const loadedScripts = new Set<string>();

export function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-fv-src="${src}"]`);
    if (existing) {
      loadedScripts.add(src);
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset['fvSrc'] = src;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export interface AppInfoParserConstructor {
  new (file: File | Blob): { parse(): Promise<Record<string, unknown>> };
}

declare global {
  interface Window {
    AppInfoParser?: AppInfoParserConstructor;
  }
}

export async function loadAppInfoParser(scriptUrl: string): Promise<AppInfoParserConstructor> {
  if (window.AppInfoParser) {
    return window.AppInfoParser;
  }

  await loadScript(scriptUrl);
  if (!window.AppInfoParser) {
    throw new Error('AppInfoParser failed to initialize');
  }
  return window.AppInfoParser;
}
