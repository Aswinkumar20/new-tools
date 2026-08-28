/**
 * Minimal browser globals for build-time SSG/prerender in Node.
 * Angular platform-server already provides Domino `document` — do not replace it.
 * Only fill APIs Domino/Node lack that app code touches during prerender.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function installPrerenderBrowserGlobals(): void {
  const g = globalThis as any;
  const noop = () => undefined;

  if (typeof g.requestAnimationFrame !== 'function') {
    g.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0);
  }
  if (typeof g.cancelAnimationFrame !== 'function') {
    g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }

  if (g.MutationObserver === undefined) {
    g.MutationObserver = class {
      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    };
  }

  if (g.ResizeObserver === undefined) {
    g.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }

  if (g.IntersectionObserver === undefined) {
    g.IntersectionObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }

  if (g.localStorage === undefined) {
    const store = new Map<string, string>();
    g.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  if (g.sessionStorage === undefined) {
    g.sessionStorage = g.localStorage;
  }

  if (typeof g.matchMedia !== 'function') {
    g.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    });
  }

  // Prefer existing Domino window; always ensure event + location APIs.
  if (g.window === undefined) {
    g.window = g;
  }
  const win = g.window;
  if (typeof win.addEventListener !== 'function') {
    win.addEventListener = noop;
  }
  if (typeof win.removeEventListener !== 'function') {
    win.removeEventListener = noop;
  }
  if (typeof win.dispatchEvent !== 'function') {
    win.dispatchEvent = () => false;
  }
  if (typeof g.addEventListener !== 'function') {
    g.addEventListener = win.addEventListener.bind(win);
  }
  if (typeof g.removeEventListener !== 'function') {
    g.removeEventListener = win.removeEventListener.bind(win);
  }

  ensureLocation(g);
  ensureLocation(win);
  if (g.document && !g.document.defaultView) {
    try {
      g.document.defaultView = win;
    } catch {
      /* Domino may make defaultView read-only */
    }
  }
  ensureLocation(g.document?.defaultView);

  if (typeof win.innerWidth !== 'number') {
    try {
      win.innerWidth = 1280;
      win.innerHeight = 800;
    } catch {
      /* ignore */
    }
  }

  if (typeof g.Event !== 'function') {
    g.Event = class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };
  }

  if (!win.history || typeof win.history !== 'object') {
    win.history = {
      length: 0,
      state: null,
      pushState: noop,
      replaceState: noop,
      go: noop,
      back: noop,
      forward: noop,
    };
  }

  if (g.navigator === undefined) {
    g.navigator = {
      userAgent: 'SSG',
      language: 'en',
      languages: ['en'],
      onLine: true,
    };
  }

  if (typeof g.XMLHttpRequest !== 'function') {
    g.XMLHttpRequest = class {
      readyState = 0;
      status = 0;
      statusText = '';
      responseText = '';
      response = null;
      responseType = '';
      onreadystatechange: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;
      open(): void {
        this.readyState = 1;
      }
      setRequestHeader(): void {}
      send(): void {
        this.readyState = 4;
        this.status = 0;
      }
      abort(): void {}
      getAllResponseHeaders(): string {
        return '';
      }
      getResponseHeader(): string | null {
        return null;
      }
    };
  }
}

function ensureLocation(target: any): void {
  if (!target || typeof target !== 'object') {
    return;
  }
  const base = {
    href: 'https://easytoolhub.com/',
    origin: 'https://easytoolhub.com',
    protocol: 'https:',
    host: 'easytoolhub.com',
    hostname: 'easytoolhub.com',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    assign: () => undefined,
    replace: () => undefined,
    reload: () => undefined,
    toString() {
      return this.href;
    },
  };

  if (!target.location || typeof target.location !== 'object') {
    try {
      target.location = { ...base };
    } catch {
      /* ignore read-only */
    }
    return;
  }

  for (const [key, value] of Object.entries(base)) {
    if (target.location[key] === undefined) {
      try {
        target.location[key] = value;
      } catch {
        /* ignore */
      }
    }
  }
}
