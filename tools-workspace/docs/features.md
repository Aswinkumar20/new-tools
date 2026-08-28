# Features

Each category is one Nx library (except home/shell in `features-home`). Flows are browser-local unless noted.

## Cross-cutting

| Feature | Location | Notes |
| ------- | -------- | ----- |
| Home / discovery | `libs/features-home/.../myComponent/` | Search + catalog from generated config |
| Navigation / theme | `.../navigation/` | Mega-menu, language, dark mode (`localStorage` `theme`) |
| Toasts | `ToastService` + container in `App` | Used by ~all tools |
| SEO | `SeoService` + generated catalog | See [guides/seo.md](./guides/seo.md) |
| Analytics | GA4 + AutoGA | See [guides/analytics.md](./guides/analytics.md) |
| i18n | 4 JSON locales, ~20 keys | Chrome only; tools English; asset path may not ship — see [quality.md](./quality.md) |
| SSG / prerender | `outputMode: static` + `RenderMode.Prerender` | Crawlable HTML; deploy browser dist only |

## Categories

### Text utilities — `libs/text-utilities` (30)

Encode/decode, transform, analyze, merge. Typical flow: paste/upload → options → live process → copy/download. Many extend `TextToolBase` (undo/redo, 10 MB upload).

Deps: Monaco (diff), pako, CDN jspdf (word-counter export).

### File viewers — `libs/file-viewers` (25 live + 19 coming soon)

In-browser preview. Implemented viewers include office, images, archives, ebooks, SVG/PSD/HEIC/TIFF, audio/video, and 3D.

**Coming soon (shared `ComingSoonPageComponent`):** subtitle, MIDI, MusicXML, APK/IPA, ELF/PE, WAV spectrum, spectrogram, Minecraft/Unity/game-save, NFT/smart-contract, invoice/audit, Figma/Sketch/InDesign.

### Data converters — `libs/data-converters` (8)

CSV⇄JSON, Excel→JSON, HTML table→JSON, JSON tools, Markdown⇄HTML, YAML⇄JSON (custom YAML parser).

### Math & date — `libs/math-date-utils` (13)

Calculators + unit/currency. Currency uses FX HTTP (see [api.md](./api.md)). Unit-converter history UI still toasts “coming soon”.

### PDF tools — `libs/pdf-tools` (~34)

| Kind | Examples |
| ---- | -------- |
| Full UIs | merge, split, signature, viewer |
| Edit workbench | Thin routes set `PdfToolMode` on `PdfWorkbenchComponent` |
| Create workbench | Thin routes → `PdfJspdfWorkbenchComponent` |

Services: `PdfLibService`, `PdfJsLoaderService`, `PdfPreviewService`, `PdfJspdfService`. May persist PDF bytes in `sessionStorage`.

### Image & color — `libs/image-color-tools` (10)

Canvas tools + OCR via dynamic `tesseract.js`.

### Code & file — `libs/code-file-tools` (9)

Minifiers, clipboard viewer/history (plaintext in `localStorage`), markdown→PDF.

### Dev & design — `libs/dev-design-tools` (12)

CSS generators, Postman Lite (`fetch`), CORS tester, WebSocket client, mock JSON, etc.

### Testing — `libs/testing-tools` (6)

Validators, JWT **decoder** (not signature verify unless utils say otherwise), UA parser.

### Security — `libs/security-tools` (7)

Hash, passwords, AES-GCM helpers (`st-aes-gcm.util.ts`), UUID, private notes, secure clipboard.

### Media — `libs/media-tools` (5)

| Tool | Status |
| ---- | ------ |
| Voice recorder | Implemented |
| Audio player, trimmer, video→GIF, webcam | Coming soon (utils may exist, UI not wired) |

### Browser utils — `libs/browser-utils` (6)

Battery, cookies, orientation, speed test (default Hetzner 1MB bin), screen info, storage viewer.

### Fun tools — `libs/fun-tools` (11)

QR/barcode (CDN), timers, lorem, typing test, timezone, etc.

### CAD viewers — `libs/cad-viewers` (29)

DWG/DXF/DWF/DGN, STEP/IGES, SolidWorks/Fusion/Inventor/Creo, Rhino/SketchUp, Gerber/KiCad/Eagle/Altium, IFC/Revit/Navisworks, BIM/MEP/floor-plan/structural.

### GIS viewers — `libs/gis-viewers` (20)

GeoJSON, GPX, Shapefile, KML/KMZ, TopoJSON, GeoPackage, MBTiles, GeoTIFF/COG, DEM/terrain, contours, GPS/drone, LiDAR/point cloud, satellite, vector tiles, raster map.

### Medical viewers — `libs/medical-viewers` (18)

DICOM, NIfTI, MRI/CT/X-ray/ultrasound/mammography/PET, NRRD/MINC, pathology/WSI, ECG/EEG, HL7/FHIR/CDA, medical timeline.

### Science viewers — `libs/science-viewers` (20)

HDF5, NetCDF, FITS, GRIB, MATLAB MAT, ROOT, molecular/protein, FASTA/FASTQ/GenBank/VCF, LAS/DLIS/SEG-Y, geological/borehole/stratigraphy, climate, simulation.

### Network viewers — `libs/network-viewers` (17)

HAR, PCAP/PCAPng, traffic/packet/protocol, HTTP trace, API request, firewall/SIEM/syslog/DNS logs, Nmap/Nessus/SARIF, malware/threat intel.

### Process viewers — `libs/process-viewers` (15)

BPMN (+ analytics), DMN, decision model, EPC, PNML, Petri net, BPEL, workflow/process map, process mining, event log, trace explorer, timeline, business-process simulator.

### Diagram viewers — `libs/diagram-viewers` (29)

Mermaid, PlantUML, Graphviz, UML/class/sequence, C4/architecture, GraphML/GEXF, mind maps (FreeMind/Freeplane/concept), ER/DBML/SQL/Prisma, draw.io/Visio, Terraform/K8s/dependency graphs, RDF/OWL/knowledge graph, state machine, decision tree, Drools.

### Data explorers — `libs/data-explorers` (15)

Parquet, Avro, ORC, Feather, Arrow, Delta Lake, SQLite, DuckDB, CSV/TSV, JSON/XML/YAML/TOML/INI.

### ML viewers — `libs/ml-viewers` (9)

ONNX, TensorFlow graph, PyTorch, Keras, MLflow, neural-network graph, model architecture, tensor visualization, pickle.

## Coming soon (confirmed in UI)

Media: `/media-tools/audio-player`, `/audio-trimmer`, `/video-to-gif`, `/webcam-snapshot`.

File viewers extras: subtitle, MIDI, MusicXML, APK, IPA, ELF, PE, WAV spectrum, spectrogram, Minecraft world, Unity asset, game save, NFT metadata, smart contract, invoice data, audit log, Figma export, Sketch, InDesign.  

## Interaction map

```mermaid
flowchart LR
  Home --> Route[app.routes.ts]
  Route --> Tool
  Tool --> Nav
  Tool --> Toast
  Tool --> Utils
  Utils --> CDN
  Utils --> BrowserAPIs
```
