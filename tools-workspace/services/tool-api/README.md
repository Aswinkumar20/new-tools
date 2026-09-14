# EasyToolHub Tool API (multi-domain Java backend)

One Spring Boot service for **all** server-side tool logic.
PDF is the first domain module — more domains (text, media, security, …) plug in the same app.

## Layout

```
services/tool-api/
  src/main/java/com/easytoolhub/
    ToolApiApplication.java          ← entrypoint
    common/                          ← shared (CORS, temp files, errors, /api/v1/health)
    pdf/                             ← PDF domain (/api/v1/pdf/*)
    model3d/                         ← 3D model domain (/api/v1/model3d/*)
    # text/                          ← future
    # media/                         ← future
contracts/
  pdf/openapi.yaml                   ← PDF contract
  model3d/openapi.yaml               ← Model3D contract
```

## Run

```bash
cd services/tool-api
mvn spring-boot:run
# from repo root: npm run start:api
```

- Platform health: http://localhost:8080/api/v1/health  
- PDF health: http://localhost:8080/api/v1/pdf/health  
- Model3D health: http://localhost:8080/api/v1/model3d/health  

### Model3D endpoints

| Method | Path | Result |
|--------|------|--------|
| POST | `/api/v1/model3d/inspect` | JSON mesh metadata (multipart `file`) |
| POST | `/api/v1/model3d/normalize` | GLB binary for browser viewing (STL/OBJ/embedded GLTF/GLB) |

Uploads are ephemeral (TempWorkspace) and wiped after each request.
## Adding a new domain

1. Create `com.easytoolhub.<domain>/` with `api`, `application`, (optional) `engine`
2. Add `contracts/<domain>/openapi.yaml`
3. Keep routes under `/api/v1/<domain>/...`
4. Reuse `common.platform.TempWorkspace` with `createJobDir("<domain>")`
