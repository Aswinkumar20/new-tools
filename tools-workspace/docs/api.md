# API documentation

There is **no first-party product REST API** and **no runtime Node/Express server**. Production serves static files from `dist/apps/tools-site/browser/` (SSG). Tools that call the network use third-party or browser APIs only.

## Authentication

None for tools. No user accounts. Currency and i18n endpoints are public. Postman Lite / WebSocket use caller-defined headers/URLs.

## HttpClient

Configured via `provideHttpClient(withFetch())` in `app.config.ts`.

### Translations

| | |
| --- | --- |
| Service | `libs/features-home/.../translation.service.ts` |
| Request | `GET assets/i18n/{lang}.json` |
| Locales on disk | `en`, `es`, `fr`, `de` under `apps/tools-site/src/assets/i18n/` |
| Errors | Fall back toward English |
| Caveat | Build assets input is `apps/tools-site/assets` — confirm i18n JSON is copied in production builds |

### Currency rates

| | |
| --- | --- |
| Service | `libs/math-date-utils/.../currency-rate.service.ts` |
| Primary | `GET https://open.er-api.com/v6/latest/{BASE}` |
| Fallback | `GET https://api.exchangerate.host/latest?base={BASE}` |
| Cache | In-memory Map, TTL 60s |
| Errors | Primary → fallback → throw user-facing error |
| Provider | `@Injectable()` without `providedIn: 'root'` — provided by the converter |

Success mapping expects primary `result === 'success'`, `base_code`, `time_last_update_unix`, `rates`.

## Browser `fetch`

| Use | File | Notes |
| --- | ---- | ----- |
| Postman Lite | `dev-design-tools/.../postman-lite.utils.ts` | User URL/method/headers |
| CORS tester | `.../cors-test-tool.utils.ts` | User URL |
| Speed test | `browser-utils/.../network-speed-test.utils.ts` | Default `https://speed.hetzner.de/1MB.bin` |
| data: → blob | QR/barcode utils | Not remote APIs |
| Image → ArrayBuffer | PDF add-signature | Local |

HTTP Request Generator **emits** fetch/axios/curl snippets; it does not call remote APIs.

## CDN scripts

Dynamic `<script>` loads for pdf.js, SheetJS, mammoth, marked, DOMPurify, JSZip, Chart.js, qrcode, JsBarcode, jspdf, html2canvas (see file-viewers, pdf-tools, fun-tools, data-converters). No centralized SRI. Failures should surface as toast/error in each tool.

## Google Analytics

| | |
| --- | --- |
| ID | `G-C7L2T1RHVW` |
| Loader | `index.html` gtag |
| Wrapper | `GoogleAnalyticsService` (no-ops if `gtag` missing) |

Details: [guides/analytics.md](./guides/analytics.md).

## WebSocket

`dev-design-tools` WebSocket client — user-supplied `ws:`/`wss:` URL; errors in UI.

## Summary

| Target | Consumer | Auth | Errors |
| ------ | -------- | ---- | ------ |
| `assets/i18n/*.json` | TranslationService | None | Fallback lang |
| open.er-api.com | CurrencyRateService | None | Fallback API |
| api.exchangerate.host | CurrencyRateService | None | Throw |
| User URL | Postman / CORS | User | UI |
| Hetzner 1MB | Speed test | None | Failed test |
| CDN URLs | Viewers / PDF / fun | None | Load fail |
| gtag | Analytics | Measurement ID | No-op |
| User WS URL | WebSocket client | User | UI |
