# Quality, debt, testing, and future work

## Code quality

| Smell | Impact |
| ----- | ------ |
| Duplicated clipboard/download/suggestion helpers across libs | Drift |
| Giant `app.routes.ts` (~1975 lines, 365 lazy routes) | Merge pain |
| Stale `app.html` / `nx-welcome` | Confusion |
| AutoGA map lags routes (365) | Missing analytics |
| GA directives rarely used in templates | Dead surface |
| i18n: 28 languages listed, 4 JSON files, tools English-only | False capability |
| Theme keys | Unified on `theme` (migrates legacy `easytoolhub.theme`) |
| Folder typo `textDifferrence` | Naming debt |

**Coupling:** feature libs → `features-home` (`type:shared`) for nav/toast/assets. Home + shared kit still share one library (Navigation is coupled to the generated catalog). `shared-utils` for clipboard/download helpers is still future work.

**Security**

| Concern | Mitigation |
| ------- | ---------- |
| CDN scripts without SRI | Pin + SRI or npm bundle |
| `innerHTML` without DOMPurify (some viewers; markdown OK) | Shared sanitize |
| Clipboard history / PDF sessionStorage | TTL, clear UI, warnings |
| Postman arbitrary fetch | Expected; warn in UI |
| Client “security” tools | Clear disclaimers |
| No `eval` / `new Function` found | Keep it that way |

**Performance:** keep lazy routes; centralize CDN loaders; audit Monaco ~50 MB assets; OnPush + signals on heavy UIs; bound PDF thumbnails.

---

## Technical debt (prioritized)

| ID | Item | Priority | Fix |
| -- | ---- | -------- | --- |
| TD-01 | i18n JSON may not ship in build assets | High | Add to `project.json` assets or move files |
| TD-02 | Unsanitized HTML in some viewers | High | DOMPurify pipeline |
| TD-03 | Sensitive data in local/session storage | Medium | TTL + clear + warnings |
| TD-04 | AutoGA map incomplete | Medium | Generate from routes |
| TD-05 | Duplicated utils | Medium | `@tools-workspace/shared-utils` |
| TD-06 | ~~Unused npm packages~~ | Done | Removed CodeMirror, figlet, ngx viewers, flex-layout; Monaco bumped to v20 |
| TD-07 | Stale app artifacts / bad app.spec | Medium | Delete / rewrite |
| TD-08 | Theme key split | Medium | Single key + migrate |
| TD-09 | features-home mixed concerns | Medium | Split shared-ui later; tagged `type:shared` for now |
| TD-10 | Coming-soon still in nav | Medium | Badge or hide |
| TD-11 | Hardcoded GA/SEO values | Medium | Environments |
| TD-12 | ~~Unused lib routes~~ / GA directives | Low | lib.routes removed; GA directives still underused |
| TD-13 | Empty root npm scripts | Low | Add `start`/`test`/`build` proxies |
| TD-14 | `urlEncodeAndDecode` layout exception | Low | Extract utils |
| TD-15 | `textDifferrence` typo | Low | Rename when cheap |

---

## Testing

| Layer | Status |
| ----- | ------ |
| Unit (Jest) | ~520 specs — strong on utils; pdf-tools thinner; features-home light |
| E2E (Playwright) | **2** specs only |
| `passWithNoTests` | Enabled in Nx Jest defaults |

**Add next**

- Rewrite `app.spec.ts` for real shell  
- `CurrencyRateService` HttpClient mocks (cache / fallback / fail)  
- PDF workbench table-driven mode tests  
- XSS fixtures for HTML viewers  
- CI: every route in SEO catalog + AutoGA map  
- Playwright smoke: one happy path per category  

---

## Future enhancements

- Finish remaining media + file-viewers coming-soon tools  
- Unit-converter history UI  
- PWA / offline CDN cache  
- Favorites / recent on home  
- Split shared-ui + shared-utils; compose routes from lib fragments  
- Real i18n rollout (or shrink language picker to 4)  
- Accessibility audit (mega-menu, toasts `aria-live`, contrast)  
- Monitoring: GA dashboards for `tool_error` / CDN failures  

---

## Positive patterns to keep

Standalone + lazy `loadComponent`, pure utils + specs, `AssetService`, toast bus, SEO on prerender+client, PDF workbench modes, `TextToolBase`.
