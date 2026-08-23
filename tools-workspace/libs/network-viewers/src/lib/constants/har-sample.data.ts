/** Synthetic HAR 1.2 capture (education / research). */

export function buildHarSampleObject(): Record<string, unknown> {
  const started = '2026-03-12T09:14:02.000Z';
  const entry = (
    offsetMs: number,
    time: number,
    method: string,
    url: string,
    status: number,
    mime: string,
    timings: Record<string, number>,
    extras: { reqBody?: string; resBody?: string; ip?: string; statusText?: string } = {}
  ) => ({
    startedDateTime: new Date(Date.parse(started) + offsetMs).toISOString(),
    time,
    request: {
      method,
      url,
      httpVersion: 'HTTP/1.1',
      headers: [
        { name: 'Host', value: new URL(url).host },
        { name: 'User-Agent', value: 'EasyToolHub-HAR-Sample/1.0' },
        { name: 'Accept', value: mime.includes('json') ? 'application/json' : '*/*' }
      ],
      queryString: [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value })),
      cookies: [],
      headersSize: 180,
      bodySize: extras.reqBody ? extras.reqBody.length : 0,
      postData: extras.reqBody ? { mimeType: 'application/json', text: extras.reqBody } : undefined
    },
    response: {
      status,
      statusText: extras.statusText ?? (status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'OK'),
      httpVersion: 'HTTP/1.1',
      headers: [
        { name: 'Content-Type', value: mime },
        { name: 'Content-Length', value: String((extras.resBody ?? '').length) },
        { name: 'Cache-Control', value: status === 200 ? 'public, max-age=60' : 'no-store' }
      ],
      cookies: [],
      content: { size: (extras.resBody ?? '').length, mimeType: mime, text: extras.resBody ?? '' },
      redirectURL: '',
      headersSize: 160,
      bodySize: (extras.resBody ?? '').length
    },
    cache: {},
    timings: {
      blocked: timings.blocked ?? 0,
      dns: timings.dns ?? -1,
      connect: timings.connect ?? -1,
      ssl: timings.ssl ?? -1,
      send: timings.send ?? 1,
      wait: timings.wait ?? 20,
      receive: timings.receive ?? 5
    },
    serverIPAddress: extras.ip ?? '93.184.216.34',
    connection: '1'
  });

  return {
    log: {
      version: '1.2',
      creator: { name: 'EasyToolHub HAR Sample', version: '1.0' },
      browser: { name: 'SampleBrowser', version: '20' },
      pages: [
        {
          startedDateTime: started,
          id: 'page_1',
          title: 'Example storefront',
          pageTimings: { onContentLoad: 210, onLoad: 340 }
        }
      ],
      entries: [
        entry(0, 118, 'GET', 'https://example.com/', 200, 'text/html', { blocked: 4, dns: 12, connect: 18, ssl: 14, send: 1, wait: 52, receive: 17 }, {
          resBody: '<!doctype html><html><head><title>Example</title></head><body>Hello</body></html>'
        }),
        entry(22, 74, 'GET', 'https://cdn.example.com/app.css', 200, 'text/css', { blocked: 1, dns: 8, connect: 10, ssl: 9, send: 1, wait: 32, receive: 13 }, {
          resBody: 'body{font-family:sans-serif}',
          ip: '13.32.10.4'
        }),
        entry(40, 168, 'GET', 'https://cdn.example.com/app.js', 200, 'application/javascript', { blocked: 2, dns: -1, connect: -1, ssl: -1, send: 1, wait: 120, receive: 45 }, {
          resBody: 'console.log("app")',
          ip: '13.32.10.4'
        }),
        entry(88, 142, 'GET', 'https://api.example.com/v1/products?limit=8', 200, 'application/json', { blocked: 1, dns: 6, connect: 14, ssl: 11, send: 1, wait: 88, receive: 21 }, {
          resBody: '{"items":[{"id":1,"name":"Widget"}]}',
          ip: '10.20.30.40'
        }),
        entry(110, 96, 'GET', 'https://cdn.example.com/hero.webp', 200, 'image/webp', { blocked: 0, dns: -1, connect: -1, ssl: -1, send: 1, wait: 40, receive: 55 }, {
          resBody: 'WEBP',
          ip: '13.32.10.4'
        }),
        entry(150, 48, 'GET', 'https://cdn.example.com/missing.woff2', 404, 'text/plain', { blocked: 0, dns: -1, connect: -1, ssl: -1, send: 1, wait: 36, receive: 11 }, {
          resBody: 'not found',
          ip: '13.32.10.4',
          statusText: 'Not Found'
        }),
        entry(210, 126, 'POST', 'https://api.example.com/v1/cart', 201, 'application/json', { blocked: 1, dns: -1, connect: -1, ssl: -1, send: 8, wait: 96, receive: 21 }, {
          reqBody: '{"sku":"W-1","qty":1}',
          resBody: '{"ok":true,"id":"c-19"}',
          ip: '10.20.30.40',
          statusText: 'Created'
        })
      ]
    }
  };
}

export const HAR_JSON_SAMPLE = JSON.stringify(buildHarSampleObject(), null, 2);
