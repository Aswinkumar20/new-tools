# Model3D hybrid (Angular + Java tool-api)

3D model viewing uses the shared backend `services/tool-api` **model3d** domain.

## Run locally

```bash
npm run start:api    # services/tool-api on :8080
npm run start:ui     # Angular :4200, proxies /api → :8080
```

## Flow

1. Browser uploads GLB / embedded GLTF / STL / OBJ to `/api/v1/model3d/inspect` + `/normalize`
2. API parses / validates, returns mesh metadata + a GLB blob
3. UI loads GLB in Google `<model-viewer>` (orbit, auto-rotate, download)

Uploads are **not stored** — `TempWorkspace` wipes the job directory after each request.

## Endpoints

See `contracts/model3d/openapi.yaml` and `services/tool-api/README.md`.
