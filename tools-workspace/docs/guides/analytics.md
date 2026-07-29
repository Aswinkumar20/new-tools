# Google Analytics

Measurement ID: `G-C7L2T1RHVW`  
Loaded in `apps/tools-site/src/index.html` (`gtag`, `send_page_view: false` for SPA).  
Services injected from `App` (`app.ts`).

Prefer **auto tracking** for tool views. Use directives/services for actions.

## Privacy

**Track:** tool name/category, file type/size/count, action types, error **types** (not messages with user data), performance, search term **length** only, path without query.

**Do not track:** file contents, input text, PII, sensitive query params.

## Automatic tracking

| What | Where |
| ---- | ----- |
| SPA page views | `GoogleAnalyticsService` on `NavigationEnd` |
| Tool view / usage | `AutoGATrackerService` (+ pageview path heuristics) |
| Time on page | `App` (30s interval + navigation) |
| JS errors | `App` → `trackException` |
| CWV / load | `App` → `trackPerformance` |
| Scroll | `gaScroll` on app shell |

Mapped routes may emit both `tool_usage` and `tool_view` — filter carefully in dashboards.

## Services

### `GoogleAnalyticsService`

Notable methods: `trackPageView`, `trackEvent`, `trackToolUsage`, `trackToolCompletion`, `trackToolError`, `trackFileUpload` / `trackFileDownload`, `trackClick`, `trackFormSubmit`, `trackSearch`, `trackScrollDepth`, `trackTimeOnPage`, `trackPerformance`, `trackException`, `trackOutboundLink`, journey helpers, `setUserProperty`, `getSessionStats`.

### `AutoGATrackerService`

Hand-maintained route map in `initializeRouteMap()` (~130 entries — **lags** full 162 routes). API:

```typescript
this.autoTracker.getCurrentTool();
this.autoTracker.trackAction('copy', { file_type: 'pdf' });
this.autoTracker.trackCompletion({ duration_ms: 500 });
```

New tools: add `addToolRoute(...)` in the service (or generate the map — see [quality.md](../quality.md)).

## Directives

```html
<button gaToolAction="copy">Copy</button>
<button gaToolCompletion [gaToolMetadata]="{ duration_ms: 1000 }">Done</button>
<button gaClick="convert-button" gaClickType="button">Convert</button>
```

Files under `apps/tools-site/src/app/directives/`. Template adoption is still minimal.

## Adding tracking to a tool

1. Ensure route is in AutoGA map (views).  
2. Actions: `gaToolAction` / `AutoGATrackerService`.  
3. Files/errors: `GoogleAnalyticsService` or `utils/ga-helper.ts`.  
4. Avoid also calling `trackToolUsage(..., 'view')` on init (duplicates).

Reference: `apps/tools-site/src/app/examples/ga-tracking-example.ts`.

## Key events

`tool_usage`, `tool_view`, `tool_action`, `tool_completion`, `tool_error`, `file_upload` / `file_download`, `click`, `form_submit`, `search`, `scroll`, `time_on_page`, `performance`, `exception`, session events.

## Dashboard tips

Engagement → Events → `tool_usage` or `tool_view` → breakdown by `tool_name` / `tool_category`. Verify Network payloads omit content/PII.
