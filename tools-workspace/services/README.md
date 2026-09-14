# Backend services

| Path | Role |
| ---- | ---- |
| `tool-api/` | **Main** multi-domain Java API (pdf today; more modules later) |

Do **not** create one microservice per tool by default.
Add a package under `tool-api` first; split to `services/<domain>-api` only if load/deps require it.

Contracts live in `/contracts/<domain>/`.
Infra (compose/env) lives in `/infra/`.
