# Tools inventory

> **Auto-derived from routes** — regenerate counts with `node apps/tools-site/scripts/lib/extract-routes.js` helpers or `nx run tools-site:generate-tool-seo-catalog` after route changes.  
> **Last audited:** August 2026

## Summary

| Metric | Count |
| ------ | ----- |
| Total routed tools | 365 |
| Live (fully routed) | 343 |
| Coming soon (placeholder / stub) | 23 |
| Partial (live route, incomplete UI) | 3 |
| Category libraries | 22 |
| Prerender URLs (home + indexes + tools) | 387 |
| Unit test specs | ~520 |

**Completion rate:** 343 / 365 = **94.0%** live routes. With partial tools counted as incomplete, **340 / 365 = 93.2%** fully functional.

---

## Status legend

| Status | Meaning |
| ------ | ------- |
| **Live** | Routed tool with working UI; may have format limitations (see disclaimers in tool) |
| **Coming soon** | `ComingSoonPageComponent` placeholder or stub component with `isComingSoon = true`; `noindex`, omitted from sitemap |
| **Partial** | Route and shell exist; core interaction (upload, playback, export) not yet wired |

---

## Cross-cutting partial features

| Feature | Route / location | Remaining work |
| ------- | ---------------- | -------------- |
| Unit converter history | `/math-date-utils/unit-converter` | Clear/export/history management UI |
| BPMN text-to-diagram | `/process-viewers/bpmn-viewer` | Natural-language → BPMN preview tab |
| Media audio player | `/media-tools/audio-player` | Waveform, playlist, seek, speed controls |

---

## Tools by category

### System / Browser Utilities (`browser-utils`) — 6 live

System information and browser tools

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Screen Resolution Info | `/browser-utils/screen-resolution-info` | Live | — |
| Battery Status Viewer | `/browser-utils/battery-status-viewer` | Live | — |
| Device Orientation Logger | `/browser-utils/device-orientation-logger` | Live | — |
| Storage Viewer | `/browser-utils/storage-viewer` | Live | — |
| Cookie Editor | `/browser-utils/cookie-editor` | Live | — |
| Network Speed Test | `/browser-utils/network-speed-test` | Live | — |

### CAD & Engineering Viewers (`cad-viewers`) — 29 live

Open DWG, DXF, STEP, IFC, and PCB files in the browser.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Dwg Viewer | `/cad-viewers/dwg-viewer` | Live | — |
| Dxf Viewer | `/cad-viewers/dxf-viewer` | Live | — |
| Dwf Viewer | `/cad-viewers/dwf-viewer` | Live | — |
| Dgn Viewer | `/cad-viewers/dgn-viewer` | Live | — |
| Step Viewer | `/cad-viewers/step-viewer` | Live | — |
| Iges Viewer | `/cad-viewers/iges-viewer` | Live | — |
| Parasolid Viewer | `/cad-viewers/parasolid-viewer` | Live | — |
| Catia Viewer | `/cad-viewers/catia-viewer` | Live | — |
| Solidworks Viewer | `/cad-viewers/solidworks-viewer` | Live | — |
| Fusion 360 Viewer | `/cad-viewers/fusion-360-viewer` | Live | — |
| Inventor Viewer | `/cad-viewers/inventor-viewer` | Live | — |
| Creo Viewer | `/cad-viewers/creo-viewer` | Live | — |
| Rhino 3dm Viewer | `/cad-viewers/rhino-3dm-viewer` | Live | — |
| Sketchup Viewer | `/cad-viewers/sketchup-viewer` | Live | — |
| Plt Plot Viewer | `/cad-viewers/plt-plot-viewer` | Live | — |
| Hpgl Viewer | `/cad-viewers/hpgl-viewer` | Live | — |
| Gerber File Viewer | `/cad-viewers/gerber-file-viewer` | Live | — |
| Pcb Layout Viewer | `/cad-viewers/pcb-layout-viewer` | Live | — |
| Kicad Viewer | `/cad-viewers/kicad-viewer` | Live | — |
| Eagle Pcb Viewer | `/cad-viewers/eagle-pcb-viewer` | Live | — |
| Altium Pcb Viewer | `/cad-viewers/altium-pcb-viewer` | Live | — |
| Gdsii Layout Viewer | `/cad-viewers/gdsii-layout-viewer` | Live | — |
| Ifc Viewer | `/cad-viewers/ifc-viewer` | Live | — |
| Revit Viewer | `/cad-viewers/revit-viewer` | Live | — |
| Navisworks Viewer | `/cad-viewers/navisworks-viewer` | Live | — |
| Bim Clash Viewer | `/cad-viewers/bim-clash-viewer` | Live | — |
| Building Floor Plan Viewer | `/cad-viewers/building-floor-plan-viewer` | Live | — |
| Mep Model Viewer | `/cad-viewers/mep-model-viewer` | Live | — |
| Structural Model Viewer | `/cad-viewers/structural-model-viewer` | Live | — |

### File & Code Tools (`code-file-tools`) — 9 live

Code formatting and file utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Html Minifier | `/code-file-tools/html-minifier` | Live | — |
| Css Minifier | `/code-file-tools/css-minifier` | Live | — |
| Javascript Minifier | `/code-file-tools/javascript-minifier` | Live | — |
| Html Entity Encoder | `/code-file-tools/html-entity-encoder` | Live | — |
| Clipboard Viewer | `/code-file-tools/clipboard-viewer` | Live | — |
| Clipboard History | `/code-file-tools/clipboard-history` | Live | — |
| File Metadata Viewer | `/code-file-tools/file-metadata-viewer` | Live | — |
| Markdown To Pdf | `/code-file-tools/markdown-to-pdf` | Live | — |
| Html Table Exporter | `/code-file-tools/html-table-exporter` | Live | — |

### JSON / Data Converters (`data-converters`) — 8 live

Tools to convert, format, and validate JSON and data formats

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Json Formatter Beautifier Validator | `/data-converters/json-formatter-beautifier-validator` | Live | — |
| Csv To Json Json To Csv | `/data-converters/csv-to-json-json-to-csv` | Live | — |
| Yaml To Json Json To Yaml | `/data-converters/yaml-to-json-json-to-yaml` | Live | — |
| Html Table To Json | `/data-converters/html-table-to-json` | Live | — |
| Markdown To Html | `/data-converters/markdown-to-html` | Live | — |
| Json Linter Viewer | `/data-converters/json-linter-viewer` | Live | — |
| Excel To Json | `/data-converters/excel-to-json` | Live | — |
| Json Parser | `/data-converters/json-parser` | Live | — |

### Data Explorers (`data-explorers`) — 15 live

Browse Parquet, Avro, SQLite, and columnar files.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Parquet Viewer | `/data-explorers/parquet-viewer` | Live | — |
| Avro Viewer | `/data-explorers/avro-viewer` | Live | — |
| Orc Viewer | `/data-explorers/orc-viewer` | Live | — |
| Feather Viewer | `/data-explorers/feather-viewer` | Live | — |
| Arrow Viewer | `/data-explorers/arrow-viewer` | Live | — |
| Delta Lake Viewer | `/data-explorers/delta-lake-viewer` | Live | — |
| Sqlite Viewer | `/data-explorers/sqlite-viewer` | Live | — |
| Duckdb Viewer | `/data-explorers/duckdb-viewer` | Live | — |
| Csv Viewer | `/data-explorers/csv-viewer` | Live | — |
| Tsv Viewer | `/data-explorers/tsv-viewer` | Live | — |
| Json Viewer | `/data-explorers/json-viewer` | Live | — |
| Xml Viewer | `/data-explorers/xml-viewer` | Live | — |
| Yaml Viewer | `/data-explorers/yaml-viewer` | Live | — |
| Toml Viewer | `/data-explorers/toml-viewer` | Live | — |
| Ini Viewer | `/data-explorers/ini-viewer` | Live | — |

### Design & Web Dev Tools (`dev-design-tools`) — 12 live

CSS tools, responsive design helpers, and web dev utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Css Gradient Generator | `/dev-design-tools/css-gradient-generator` | Live | — |
| Box Shadow Generator | `/dev-design-tools/box-shadow-generator` | Live | — |
| Border Radius Preview | `/dev-design-tools/border-radius-preview` | Live | — |
| Pixel To Rem | `/dev-design-tools/pixel-to-rem` | Live | — |
| Responsive Breakpoint Tester | `/dev-design-tools/responsive-breakpoint-tester` | Live | — |
| Viewport Size Detector | `/dev-design-tools/viewport-size-detector` | Live | — |
| Postman Lite | `/dev-design-tools/postman-lite` | Live | — |
| Cors Test Tool | `/dev-design-tools/cors-test-tool` | Live | — |
| Http Header Decoder | `/dev-design-tools/http-header-decoder` | Live | — |
| Websocket Client | `/dev-design-tools/websocket-client` | Live | — |
| Http Request Generator | `/dev-design-tools/http-request-generator` | Live | — |
| Mock Json Generator | `/dev-design-tools/mock-json-generator` | Live | — |

### Diagram & Graph Viewers (`diagram-viewers`) — 29 live

Mermaid, PlantUML, Graphviz, UML, and mind maps.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Mermaid Diagram Viewer | `/diagram-viewers/mermaid-diagram-viewer` | Live | — |
| Plantuml Viewer | `/diagram-viewers/plantuml-viewer` | Live | — |
| Graphviz Dot Viewer | `/diagram-viewers/graphviz-dot-viewer` | Live | — |
| Uml Viewer | `/diagram-viewers/uml-viewer` | Live | — |
| Class Diagram Viewer | `/diagram-viewers/class-diagram-viewer` | Live | — |
| Sequence Diagram Viewer | `/diagram-viewers/sequence-diagram-viewer` | Live | — |
| Architecture Diagram Viewer | `/diagram-viewers/architecture-diagram-viewer` | Live | — |
| C4 Model Viewer | `/diagram-viewers/c4-model-viewer` | Live | — |
| Graphml Viewer | `/diagram-viewers/graphml-viewer` | Live | — |
| Gexf Viewer | `/diagram-viewers/gexf-viewer` | Live | — |
| Mind Map Viewer | `/diagram-viewers/mind-map-viewer` | Live | — |
| Freemind Viewer | `/diagram-viewers/freemind-viewer` | Live | — |
| Freeplane Viewer | `/diagram-viewers/freeplane-viewer` | Live | — |
| Concept Map Viewer | `/diagram-viewers/concept-map-viewer` | Live | — |
| Er Diagram Viewer | `/diagram-viewers/er-diagram-viewer` | Live | — |
| Dbml Viewer | `/diagram-viewers/dbml-viewer` | Live | — |
| Sql Schema Viewer | `/diagram-viewers/sql-schema-viewer` | Live | — |
| Prisma Schema Viewer | `/diagram-viewers/prisma-schema-viewer` | Live | — |
| Draw Io Viewer | `/diagram-viewers/draw-io-viewer` | Live | — |
| Visio Viewer | `/diagram-viewers/visio-viewer` | Live | — |
| Terraform Graph Viewer | `/diagram-viewers/terraform-graph-viewer` | Live | — |
| Kubernetes Architecture Viewer | `/diagram-viewers/kubernetes-architecture-viewer` | Live | — |
| Dependency Graph Viewer | `/diagram-viewers/dependency-graph-viewer` | Live | — |
| Rdf Viewer | `/diagram-viewers/rdf-viewer` | Live | — |
| Owl Ontology Viewer | `/diagram-viewers/owl-ontology-viewer` | Live | — |
| Knowledge Graph Viewer | `/diagram-viewers/knowledge-graph-viewer` | Live | — |
| State Machine Viewer | `/diagram-viewers/state-machine-viewer` | Live | — |
| Decision Tree Viewer | `/diagram-viewers/decision-tree-viewer` | Live | — |
| Drools Rule Viewer | `/diagram-viewers/drools-rule-viewer` | Live | — |

### File Viewers (`file-viewers`) — 26 live, 20 coming soon

Easily open, preview, and explore different file types directly in your browser.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Image Viewer | `/file-viewers/image-viewer` | Live | — |
| Pdf Viewer | `/file-viewers/pdf-viewer` | Live | — |
| Word Viewer | `/file-viewers/word-viewer` | Live | — |
| Powerpoint Viewer | `/file-viewers/powerpoint-viewer` | Live | — |
| Text File Viewer | `/file-viewers/text-file-viewer` | Live | — |
| Markdown Previewer | `/file-viewers/markdown-previewer` | Live | — |
| Excel Viewer | `/file-viewers/excel-viewer` | Live | — |
| Log Viewer | `/file-viewers/log-viewer` | Live | — |
| Audio Player | `/file-viewers/audio-player` | Live | — |
| Video Player | `/file-viewers/video-player` | Coming soon | Placeholder page or stub component |
| Font Viewer | `/file-viewers/font-viewer` | Live | — |
| 3d Model Viewer | `/file-viewers/3d-model-viewer` | Live | Upload + tool-api normalize (STL/OBJ/GLTF→GLB) + model-viewer orbit |
| Archive Viewer | `/file-viewers/archive-viewer` | Live | — |
| Xes Viewer | `/file-viewers/xes-viewer` | Live | — |
| Epub Viewer | `/file-viewers/epub-viewer` | Live | — |
| Mobi Viewer | `/file-viewers/mobi-viewer` | Live | — |
| Latex Viewer | `/file-viewers/latex-viewer` | Live | — |
| Svg Viewer | `/file-viewers/svg-viewer` | Live | — |
| Psd Viewer | `/file-viewers/psd-viewer` | Live | — |
| Ai File Viewer | `/file-viewers/ai-file-viewer` | Live | — |
| Heic Viewer | `/file-viewers/heic-viewer` | Live | — |
| Raw Image Viewer | `/file-viewers/raw-image-viewer` | Live | — |
| Tiff Viewer | `/file-viewers/tiff-viewer` | Live | — |
| Opendocument Viewer | `/file-viewers/opendocument-viewer` | Live | — |
| Rtf Viewer | `/file-viewers/rtf-viewer` | Live | — |
| Ics Viewer | `/file-viewers/ics-viewer` | Live | — |
| Subtitle Viewer | `/file-viewers/subtitle-viewer` | Coming soon | Placeholder page or stub component |
| Midi Viewer | `/file-viewers/midi-viewer` | Coming soon | Placeholder page or stub component |
| Musicxml Viewer | `/file-viewers/musicxml-viewer` | Coming soon | Placeholder page or stub component |
| Apk Viewer | `/file-viewers/apk-viewer` | Coming soon | Placeholder page or stub component |
| Ipa Viewer | `/file-viewers/ipa-viewer` | Coming soon | Placeholder page or stub component |
| Elf Binary Viewer | `/file-viewers/elf-binary-viewer` | Coming soon | Placeholder page or stub component |
| Pe Binary Viewer | `/file-viewers/pe-binary-viewer` | Coming soon | Placeholder page or stub component |
| Wav Spectrum Viewer | `/file-viewers/wav-spectrum-viewer` | Coming soon | Placeholder page or stub component |
| Spectrogram Viewer | `/file-viewers/spectrogram-viewer` | Coming soon | Placeholder page or stub component |
| Minecraft World Viewer | `/file-viewers/minecraft-world-viewer` | Coming soon | Placeholder page or stub component |
| Unity Asset Viewer | `/file-viewers/unity-asset-viewer` | Coming soon | Placeholder page or stub component |
| Game Save Viewer | `/file-viewers/game-save-viewer` | Coming soon | Placeholder page or stub component |
| Nft Metadata Viewer | `/file-viewers/nft-metadata-viewer` | Coming soon | Placeholder page or stub component |
| Smart Contract Viewer | `/file-viewers/smart-contract-viewer` | Coming soon | Placeholder page or stub component |
| Invoice Data Viewer | `/file-viewers/invoice-data-viewer` | Coming soon | Placeholder page or stub component |
| Audit Log Viewer | `/file-viewers/audit-log-viewer` | Coming soon | Placeholder page or stub component |
| Figma Export Viewer | `/file-viewers/figma-export-viewer` | Coming soon | Placeholder page or stub component |
| Sketch File Viewer | `/file-viewers/sketch-file-viewer` | Coming soon | Placeholder page or stub component |
| Indesign Viewer | `/file-viewers/indesign-viewer` | Coming soon | Placeholder page or stub component |

### Fun & Productivity Tools (`fun-tools`) — 11 live

Entertainment and productivity helpers

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Qr Code Generator | `/fun-tools/qr-code-generator` | Live | — |
| Barcode Generator | `/fun-tools/barcode-generator` | Live | — |
| Stopwatch Timer | `/fun-tools/stopwatch-timer` | Live | — |
| Random Number Generator | `/fun-tools/random-number-generator` | Live | — |
| Coin Toss Dice Roller | `/fun-tools/coin-toss-dice-roller` | Live | — |
| Lorem Ipsum Generator | `/fun-tools/lorem-ipsum-generator` | Live | — |
| Timezone Converter | `/fun-tools/timezone-converter` | Live | — |
| Typing Speed Test | `/fun-tools/typing-speed-test` | Live | — |
| Pomodoro Timer | `/fun-tools/pomodoro-timer` | Live | — |
| Flashcard Quiz Generator | `/fun-tools/flashcard-quiz-generator` | Live | — |
| Motivational Quote Generator | `/fun-tools/motivational-quote-generator` | Live | — |

### GIS & Mapping Viewers (`gis-viewers`) — 20 live

Explore GeoJSON, GPX, Shapefiles, and maps online.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Geojson Viewer | `/gis-viewers/geojson-viewer` | Live | — |
| Shapefile Viewer | `/gis-viewers/shapefile-viewer` | Live | — |
| Kml Viewer | `/gis-viewers/kml-viewer` | Live | — |
| Kmz Viewer | `/gis-viewers/kmz-viewer` | Live | — |
| Gpx Viewer | `/gis-viewers/gpx-viewer` | Live | — |
| Topojson Viewer | `/gis-viewers/topojson-viewer` | Live | — |
| Geopackage Viewer | `/gis-viewers/geopackage-viewer` | Live | — |
| Mbtiles Viewer | `/gis-viewers/mbtiles-viewer` | Live | — |
| Geotiff Viewer | `/gis-viewers/geotiff-viewer` | Live | — |
| Cog Viewer | `/gis-viewers/cog-viewer` | Live | — |
| Dem Viewer | `/gis-viewers/dem-viewer` | Live | — |
| Terrain Viewer | `/gis-viewers/terrain-viewer` | Live | — |
| Contour Map Viewer | `/gis-viewers/contour-map-viewer` | Live | — |
| Gps Track Viewer | `/gis-viewers/gps-track-viewer` | Live | — |
| Drone Flight Path Viewer | `/gis-viewers/drone-flight-path-viewer` | Live | — |
| Lidar Map Viewer | `/gis-viewers/lidar-map-viewer` | Live | — |
| Point Cloud Viewer | `/gis-viewers/point-cloud-viewer` | Live | — |
| Satellite Image Viewer | `/gis-viewers/satellite-image-viewer` | Live | — |
| Vector Tile Viewer | `/gis-viewers/vector-tile-viewer` | Live | — |
| Raster Map Viewer | `/gis-viewers/raster-map-viewer` | Live | — |

### Image & Color Tools (`image-color-tools`) — 10 live

Image manipulation and color utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Image To Base64 | `/image-color-tools/image-to-base64` | Live | — |
| Image Resizer | `/image-color-tools/image-resizer` | Live | — |
| Image Compressor | `/image-color-tools/image-compressor` | Live | — |
| Color Picker | `/image-color-tools/color-picker` | Live | — |
| Hex To Rgb | `/image-color-tools/hex-to-rgb` | Live | — |
| Gradient Generator | `/image-color-tools/gradient-generator` | Live | — |
| Palette Generator | `/image-color-tools/palette-generator` | Live | — |
| Image To Text | `/image-color-tools/image-to-text` | Live | — |
| Favicon Generator | `/image-color-tools/favicon-generator` | Live | — |
| Drawing Pad | `/image-color-tools/drawing-pad` | Live | — |

### Number & Date Tools (`math-date-utils`) — 12 live, 1 partial

Calculators, converters, and date utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Unit Converter | `/math-date-utils/unit-converter` | Partial | Converter works; history management UI shows "coming soon" toast |
| Number To Words | `/math-date-utils/number-to-words` | Live | — |
| Percentage Calculator | `/math-date-utils/percentage-calculator` | Live | — |
| Age Calculator | `/math-date-utils/age-calculator` | Live | — |
| Date Difference Calculator | `/math-date-utils/date-difference-calculator` | Live | — |
| Simple Compound Interest Calculator | `/math-date-utils/simple-compound-interest-calculator` | Live | — |
| Bmi Calculator | `/math-date-utils/bmi-calculator` | Live | — |
| Loan Emi Calculator | `/math-date-utils/loan-emi-calculator` | Live | — |
| Tip Calculator | `/math-date-utils/tip-calculator` | Live | — |
| Currency Converter | `/math-date-utils/currency-converter` | Live | — |
| Fraction Calculator | `/math-date-utils/fraction-calculator` | Live | — |
| Date To Day Of Week | `/math-date-utils/date-to-day-of-week` | Live | — |
| Zodiac Finder | `/math-date-utils/zodiac-finder` | Live | — |

### Media & Audio Tools (`media-tools`) — 1 live, 1 partial, 3 coming soon

Audio, video, and media utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Voice Recorder | `/media-tools/voice-recorder` | Live | — |
| Audio Player | `/media-tools/audio-player` | Partial | UI shell live; playlist playback controls not wired |
| Audio Trimmer | `/media-tools/audio-trimmer` | Coming soon | Placeholder page or stub component |
| Video To Gif | `/media-tools/video-to-gif` | Coming soon | Placeholder page or stub component |
| Webcam Snapshot | `/media-tools/webcam-snapshot` | Coming soon | Placeholder page or stub component |

### Medical & Healthcare Viewers (`medical-viewers`) — 18 live

DICOM, NIfTI, FHIR, and clinical file viewers.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Dicom Viewer | `/medical-viewers/dicom-viewer` | Live | — |
| Nifti Viewer | `/medical-viewers/nifti-viewer` | Live | — |
| Mri Viewer | `/medical-viewers/mri-viewer` | Live | — |
| Ct Scan Viewer | `/medical-viewers/ct-scan-viewer` | Live | — |
| X Ray Viewer | `/medical-viewers/x-ray-viewer` | Live | — |
| Ultrasound Viewer | `/medical-viewers/ultrasound-viewer` | Live | — |
| Mammography Viewer | `/medical-viewers/mammography-viewer` | Live | — |
| Pet Scan Viewer | `/medical-viewers/pet-scan-viewer` | Live | — |
| Nrrd Viewer | `/medical-viewers/nrrd-viewer` | Live | — |
| Minc Viewer | `/medical-viewers/minc-viewer` | Live | — |
| Pathology Slide Viewer | `/medical-viewers/pathology-slide-viewer` | Live | — |
| Whole Slide Image Viewer | `/medical-viewers/whole-slide-image-viewer` | Live | — |
| Ecg Viewer | `/medical-viewers/ecg-viewer` | Live | — |
| Eeg Viewer | `/medical-viewers/eeg-viewer` | Live | — |
| Hl7 Message Viewer | `/medical-viewers/hl7-message-viewer` | Live | — |
| Fhir Resource Viewer | `/medical-viewers/fhir-resource-viewer` | Live | — |
| Medical Timeline Viewer | `/medical-viewers/medical-timeline-viewer` | Live | — |
| Cda Viewer | `/medical-viewers/cda-viewer` | Live | — |

### ML Model Viewers (`ml-viewers`) — 9 live

Inspect ONNX and other ML model graphs.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Onnx Viewer | `/ml-viewers/onnx-viewer` | Live | — |
| Tensorflow Graph Viewer | `/ml-viewers/tensorflow-graph-viewer` | Live | — |
| Pytorch Model Viewer | `/ml-viewers/pytorch-model-viewer` | Live | — |
| Keras Model Viewer | `/ml-viewers/keras-model-viewer` | Live | — |
| Mlflow Model Viewer | `/ml-viewers/mlflow-model-viewer` | Live | — |
| Neural Network Graph Viewer | `/ml-viewers/neural-network-graph-viewer` | Live | — |
| Model Architecture Viewer | `/ml-viewers/model-architecture-viewer` | Live | — |
| Tensor Visualization Viewer | `/ml-viewers/tensor-visualization-viewer` | Live | — |
| Pickle Viewer | `/ml-viewers/pickle-viewer` | Live | — |

### Network & Traffic Viewers (`network-viewers`) — 17 live

HAR, PCAP, and protocol analysis in the browser.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Har Viewer | `/network-viewers/har-viewer` | Live | — |
| Pcap Viewer | `/network-viewers/pcap-viewer` | Live | — |
| Pcapng Viewer | `/network-viewers/pcapng-viewer` | Live | — |
| Network Traffic Viewer | `/network-viewers/network-traffic-viewer` | Live | — |
| Packet Analyzer | `/network-viewers/packet-analyzer` | Live | — |
| Protocol Analyzer | `/network-viewers/protocol-analyzer` | Live | — |
| Http Trace Viewer | `/network-viewers/http-trace-viewer` | Live | — |
| Api Request Viewer | `/network-viewers/api-request-viewer` | Live | — |
| Firewall Log Viewer | `/network-viewers/firewall-log-viewer` | Live | — |
| Siem Log Viewer | `/network-viewers/siem-log-viewer` | Live | — |
| Syslog Viewer | `/network-viewers/syslog-viewer` | Live | — |
| Dns Log Viewer | `/network-viewers/dns-log-viewer` | Live | — |
| Nmap Report Viewer | `/network-viewers/nmap-report-viewer` | Live | — |
| Nessus Report Viewer | `/network-viewers/nessus-report-viewer` | Live | — |
| Sarif Report Viewer | `/network-viewers/sarif-report-viewer` | Live | — |
| Malware Analysis Report Viewer | `/network-viewers/malware-analysis-report-viewer` | Live | — |
| Threat Intelligence Viewer | `/network-viewers/threat-intelligence-viewer` | Live | — |

### PDF Tools (`pdf-tools`) — 31 live

View, edit, generate, and secure PDFs

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Pdf Viewer | `/pdf-tools/pdf-viewer` | Live | — |
| Merge Pdfs | `/pdf-tools/merge-pdfs` | Live | — |
| Split Pdfs | `/pdf-tools/split-pdfs` | Live | Hybrid `/split` ZIP |
| Delete Pages | `/pdf-tools/delete-pages` | Live | Hybrid |
| Rotate Pages | `/pdf-tools/rotate-pages` | Live | — |
| Reorder Pages | `/pdf-tools/reorder-pages` | Live | — |
| Extract Pages | `/pdf-tools/extract-pages` | Live | — |
| Compress Pdf | `/pdf-tools/compress-pdf` | Live | — |
| Create Pdf From Html | `/pdf-tools/create-pdf-from-html` | Live | — |
| Tables Charts To Pdf | `/pdf-tools/tables-charts-to-pdf` | Live | — |
| Resume Invoice Generator | `/pdf-tools/resume-invoice-generator` | Live | — |
| Text To Pdf | `/pdf-tools/text-to-pdf` | Live | Hybrid `/text-to-pdf` |
| Screenshot To Pdf | `/pdf-tools/screenshot-to-pdf` | Live | — |
| Annotate Pdf | `/pdf-tools/annotate-pdf` | Live | Hybrid `/annotate` |
| Highlight Text | `/pdf-tools/highlight-text` | Live | Hybrid `/annotate` |
| Add Signature | `/pdf-tools/add-signature` | Live | Hybrid `/stamp-image` |
| Fill Pdf Forms | `/pdf-tools/fill-pdf-forms` | Live | Hybrid `/fill-form` |
| Pdf Metadata Editor | `/pdf-tools/pdf-metadata-editor` | Live | — |
| Add Watermark | `/pdf-tools/add-watermark` | Live | — |
| Pdf To Base64 | `/pdf-tools/pdf-to-base64` | Live | — |
| Password Protect Pdf | `/pdf-tools/password-protect-pdf` | Live | — |
| Flatten Pdf Forms | `/pdf-tools/flatten-pdf-forms` | Live | Hybrid `/flatten-form` |
| Html To Pdf | `/pdf-tools/html-to-pdf` | Live | Hybrid `/html-to-pdf` |
| Tables To Pdf | `/pdf-tools/tables-to-pdf` | Live | — |
| Charts To Pdf | `/pdf-tools/charts-to-pdf` | Live | — |
| Resume Generator | `/pdf-tools/resume-generator` | Live | — |
| Invoice Generator | `/pdf-tools/invoice-generator` | Live | — |
| Image To Pdf | `/pdf-tools/image-to-pdf` | Live | — |
| Add Page Numbers | `/pdf-tools/add-page-numbers` | Live | — |
| Barcode To Pdf | `/pdf-tools/barcode-to-pdf` | Live | — |
| Qr Code To Pdf | `/pdf-tools/qr-code-to-pdf` | Live | — |

### Process & Workflow Viewers (`process-viewers`) — 14 live, 1 partial

BPMN, DMN, Petri nets, and process mining tools.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Bpmn Viewer | `/process-viewers/bpmn-viewer` | Partial | Diagram viewer live; text-to-diagram tab marked coming soon |
| Bpmn Analytics Viewer | `/process-viewers/bpmn-analytics-viewer` | Live | — |
| Dmn Viewer | `/process-viewers/dmn-viewer` | Live | — |
| Decision Model Viewer | `/process-viewers/decision-model-viewer` | Live | — |
| Epc Diagram Viewer | `/process-viewers/epc-diagram-viewer` | Live | — |
| Pnml Viewer | `/process-viewers/pnml-viewer` | Live | — |
| Petri Net Viewer | `/process-viewers/petri-net-viewer` | Live | — |
| Bpel Viewer | `/process-viewers/bpel-viewer` | Live | — |
| Workflow Diagram Viewer | `/process-viewers/workflow-diagram-viewer` | Live | — |
| Process Map Viewer | `/process-viewers/process-map-viewer` | Live | — |
| Process Mining Viewer | `/process-viewers/process-mining-viewer` | Live | — |
| Event Log Viewer | `/process-viewers/event-log-viewer` | Live | — |
| Trace Explorer | `/process-viewers/trace-explorer` | Live | — |
| Process Timeline Viewer | `/process-viewers/process-timeline-viewer` | Live | — |
| Business Process Simulator | `/process-viewers/business-process-simulator` | Live | — |

### Scientific Data Viewers (`science-viewers`) — 20 live

NetCDF, HDF5, FITS, seismic, and research datasets.

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Hdf5 Viewer | `/science-viewers/hdf5-viewer` | Live | — |
| Netcdf Viewer | `/science-viewers/netcdf-viewer` | Live | — |
| Fits Viewer | `/science-viewers/fits-viewer` | Live | — |
| Grib Viewer | `/science-viewers/grib-viewer` | Live | — |
| Matlab Mat Viewer | `/science-viewers/matlab-mat-viewer` | Live | — |
| Root File Viewer | `/science-viewers/root-file-viewer` | Live | — |
| Molecular Structure Viewer | `/science-viewers/molecular-structure-viewer` | Live | — |
| Protein Structure Viewer | `/science-viewers/protein-structure-viewer` | Live | — |
| Fasta Viewer | `/science-viewers/fasta-viewer` | Live | — |
| Fastq Viewer | `/science-viewers/fastq-viewer` | Live | — |
| Genbank Viewer | `/science-viewers/genbank-viewer` | Live | — |
| Vcf Variant Viewer | `/science-viewers/vcf-variant-viewer` | Live | — |
| Las Well Log Viewer | `/science-viewers/las-well-log-viewer` | Live | — |
| Dlis Viewer | `/science-viewers/dlis-viewer` | Live | — |
| Seg Y Viewer | `/science-viewers/seg-y-viewer` | Live | — |
| Geological Model Viewer | `/science-viewers/geological-model-viewer` | Live | — |
| Borehole Viewer | `/science-viewers/borehole-viewer` | Live | — |
| Stratigraphy Viewer | `/science-viewers/stratigraphy-viewer` | Live | — |
| Climate Data Viewer | `/science-viewers/climate-data-viewer` | Live | — |
| Simulation Result Viewer | `/science-viewers/simulation-result-viewer` | Live | — |

### Security & Crypto Tools (`security-tools`) — 7 live

Hashing, encryption, and secure utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Hash Generator | `/security-tools/hash-generator` | Live | — |
| Uuid Generator | `/security-tools/uuid-generator` | Live | — |
| Password Strength Checker | `/security-tools/password-strength-checker` | Live | — |
| Random Password Generator | `/security-tools/random-password-generator` | Live | — |
| Text Encrypt Decrypt | `/security-tools/text-encrypt-decrypt` | Live | — |
| Secure Clipboard | `/security-tools/secure-clipboard` | Live | — |
| Private Notes | `/security-tools/private-notes` | Live | — |

### Validation & Testing Tools (`testing-tools`) — 6 live

Validators and testing utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Json Schema Validator | `/testing-tools/json-schema-validator` | Live | — |
| Password Rule Validator | `/testing-tools/password-rule-validator` | Live | — |
| Email Url Ip Checker | `/testing-tools/email-url-ip-checker` | Live | — |
| User Agent Parser | `/testing-tools/user-agent-parser` | Live | — |
| Credit Card Validator | `/testing-tools/credit-card-validator` | Live | — |
| Jwt Decoder | `/testing-tools/jwt-decoder` | Live | — |

### Text & Utilities (`text-utilities`) — 30 live

Tools for text manipulation and utilities

| Tool | Route | Status | Notes |
| ---- | ----- | ------ | ----- |
| Character Counter | `/text-utilities/character-counter` | Live | — |
| Text Case Convertor | `/text-utilities/text-case-convertor` | Live | — |
| Text To Ascii | `/text-utilities/text-to-ascii` | Live | — |
| Remove Duplicate Lines | `/text-utilities/remove-duplicate-lines` | Live | — |
| Text Reversal And Palindrome Checker | `/text-utilities/text-reversal-and-palindrome-checker` | Live | — |
| Base64 Encode And Decode | `/text-utilities/base64-encode-and-decode` | Live | — |
| Slug Generator | `/text-utilities/slug-generator` | Live | — |
| Text Difference | `/text-utilities/text-difference` | Live | — |
| Code Merge | `/text-utilities/code-merge` | Live | — |
| Url Encode And Decode | `/text-utilities/url-encode-and-decode` | Live | — |
| Unicode Escape Unescape | `/text-utilities/unicode-escape-unescape` | Live | — |
| Html Tag Stripper | `/text-utilities/html-tag-stripper` | Live | — |
| Sort Lines | `/text-utilities/sort-lines` | Live | — |
| Trim Normalize Whitespace | `/text-utilities/trim-normalize-whitespace` | Live | — |
| Find And Replace | `/text-utilities/find-and-replace` | Live | — |
| Line Number Tool | `/text-utilities/line-number-tool` | Live | — |
| Split Join Text | `/text-utilities/split-join-text` | Live | — |
| Regex Tester | `/text-utilities/regex-tester` | Live | — |
| Text Similarity | `/text-utilities/text-similarity` | Live | — |
| Invisible Character Detector | `/text-utilities/invisible-character-detector` | Live | — |
| Word Wrap Unwrap | `/text-utilities/word-wrap-unwrap` | Live | — |
| Extract Emails Urls | `/text-utilities/extract-emails-urls` | Live | — |
| Json String Escape Unescape | `/text-utilities/json-string-escape-unescape` | Live | — |
| Hex Encode Decode | `/text-utilities/hex-encode-decode` | Live | — |
| Rot13 Cipher | `/text-utilities/rot13-cipher` | Live | — |
| Binary Text Converter | `/text-utilities/binary-text-converter` | Live | — |
| Morse Code Converter | `/text-utilities/morse-code-converter` | Live | — |
| Readability Analyzer | `/text-utilities/readability-analyzer` | Live | — |
| Keyword Density | `/text-utilities/keyword-density` | Live | — |
| Pako Encode And Decode | `/text-utilities/pako-encode-and-decode` | Live | — |

---

## Coming soon — implementation roadmap

### Media tools (3) — utils exist, UI not wired

| Tool | Route | Backend utils | Next steps |
| ---- | ----- | ------------- | ---------- |
| Audio Trimmer | `/media-tools/audio-trimmer` | `audio-trimmer.utils.ts` | Wire upload, waveform trim handles, export |
| Video to GIF | `/media-tools/video-to-gif` | `video-to-gif.utils.ts` | Wire video upload, frame range, GIF encoder |
| Webcam Snapshot | `/media-tools/webcam-snapshot` | `webcam-snapshot.utils.ts` | Wire `getUserMedia`, capture, download |

### File viewers — stub component (1)

| Tool | Route | Notes |
| ---- | ----- | ----- |
| Video Player | `/file-viewers/video-player` | Stub with `isComingSoon`; utils in `video-player.utils.ts`; wire HTML5 video + playlist |

### File viewers — placeholder pages (19)

Shared `ComingSoonPageComponent` with per-tool config in `coming-soon-tools.ts`.

| Group | Tools | Suggested libraries |
| ----- | ----- | ------------------- |
| Subtitles & music | Subtitle, MIDI, MusicXML | `subtitle.js`, `midi-parser`, `opensheetmusicdisplay` |
| Mobile packages | APK, IPA | JSZip + manifest parsers |
| Binaries | ELF, PE | Custom header parsers |
| Audio analysis | WAV spectrum, Spectrogram | Web Audio API + FFT |
| Gaming | Minecraft world, Unity asset, Game save | Format-specific parsers (high effort) |
| Blockchain | NFT metadata, Smart contract | JSON + ABI decode |
| Enterprise | Invoice data, Audit log | Structured JSON/XML viewers |
| Design | Figma export, Sketch, InDesign | ZIP/XML parsers |

---

## Future enhancements (platform-wide)

See also [quality.md](./quality.md) and [future-file-viewers.md](./future-file-viewers.md).

### High priority

1. **Finish 23 coming-soon tools** — media (3) and file-viewers (20)  
2. **Complete 4 partial tools** — 3D model viewer, media audio player, unit-converter history, BPMN text-to-diagram  
3. **Technical debt** — i18n asset shipping, HTML sanitization pipeline, AutoGA route map generation  

### Medium priority

4. **Shared utils lib** — consolidate clipboard/download/suggestion helpers (`@tools-workspace/shared-utils`)  
5. **PWA / offline** — cache CDN scripts and enable offline for text/security tools  
6. **Home UX** — favorites, recent tools, better coming-soon badges in nav  
7. **Accessibility** — mega-menu keyboard nav, toast `aria-live`, contrast audit  

### Per-category enhancement themes

| Category | Enhancement ideas |
| -------- | ----------------- |
| **CAD viewers** | Binary format support (currently dump/JSON/CSV); WebGL 3D preview |
| **GIS viewers** | Larger file streaming; COG tile server integration |
| **Medical viewers** | DICOM series navigation; MPR views; anonymization export |
| **Science viewers** | FITS/DLIS/GRIB full spec support; NetCDF/HDF5 compression |
| **Network viewers** | PCAP live decode performance; threat intel STIX/TAXII |
| **Process viewers** | BPMN simulation export; XES conformance checking |
| **Diagram viewers** | PlantUML serverless render; draw.io embed |
| **PDF tools** | OCR layer; batch operations; cloud save (optional) |
| **ML viewers** | ONNX runtime inference preview; tensor shape viz |
| **Text utilities** | Batch file processing; API mode (optional backend) |

---

## Regeneration

```bash
# After adding/changing routes:
npx nx run tools-site:generate-tool-seo-catalog
# Updates tools-catalog.generated.ts, tool-seo-catalog.generated.ts, prerender-routes.txt
```
