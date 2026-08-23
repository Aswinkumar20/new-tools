# Future File Viewers — Implementation Roadmap

> **Status:** Planned / partially in progress (`xes-viewer` in `libs/file-viewers`)  
> **Purpose:** Catalog of specialized file viewers, mapped to EasyToolHub’s architecture: **one product category = one Nx lib = one URL parent**. New category libs are allowed and preferred when a vertical has a clear nav/SEO identity.

---

## Table of Contents

0. [Project Module Placement (EasyToolHub)](#0-project-module-placement-easytoolhub)
1. [Why Specialized Viewers Matter](#1-why-specialized-viewers-matter)
2. [Why AI Alone Cannot Replace These Tools](#2-why-ai-alone-cannot-replace-these-tools)
3. [Highest Opportunity Shortlist (SEO + Uniqueness + AI Resistance)](#3-highest-opportunity-shortlist-seo--uniqueness--ai-resistance)
4. [Engineering / CAD / Manufacturing](#4-engineering--cad--manufacturing)
5. [3D Model / Graphics](#5-3d-model--graphics)
6. [BIM / Construction](#6-bim--construction)
7. [GIS / Mapping](#7-gis--mapping)
8. [Medical / Healthcare](#8-medical--healthcare)
9. [Scientific Data](#9-scientific-data)
10. [Geology / Mining / Oil & Gas](#10-geology--mining--oil--gas)
11. [Process / Workflow](#11-process--workflow)
12. [Network / Cybersecurity](#12-network--cybersecurity)
13. [Software Architecture](#13-software-architecture)
14. [Cloud / DevOps](#14-cloud--devops)
15. [Data File Viewers](#15-data-file-viewers)
16. [Security / Identity](#16-security--identity)
17. [Blockchain](#17-blockchain)
18. [Audio / Signal](#18-audio--signal)
19. [Video](#19-video)
20. [Document / Design](#20-document--design)
21. [AI / Machine Learning Model](#21-ai--machine-learning-model)
22. [Gaming / Virtual World](#22-gaming--virtual-world)
23. [Enterprise / Business](#23-enterprise--business)
24. [Graph / Network Data Formats](#24-graph--network-data-formats)
25. [Diagram Languages (UML, PlantUML, Mermaid, C4)](#25-diagram-languages-uml-plantuml-mermaid-c4)
26. [Business Process & Decision Models (BPMN / DMN / EPC)](#26-business-process--decision-models-bpmn--dmn--epc)
27. [Database Schema & ER Diagrams](#27-database-schema--er-diagrams)
28. [Knowledge Graphs & Semantic Web](#28-knowledge-graphs--semantic-web)
29. [Timelines & Event Streams](#29-timelines--event-streams)
30. [Mind Maps & Concept Maps](#30-mind-maps--concept-maps)
31. [Decision Rules & State Machines](#31-decision-rules--state-machines)
32. [Suggested Implementation Priority](#32-suggested-implementation-priority)
33. [Placement by Module (Master Index)](#33-placement-by-module-master-index)
34. [Planned New Category Modules](#34-planned-new-category-modules)

---

## 0. Project Module Placement (EasyToolHub)

EasyToolHub is an **Nx monorepo**: thin `apps/tools-site` shell + **domain libs** under `libs/`.

| Architecture rule | Meaning |
| ----------------- | ------- |
| **1 category = 1 lib = 1 route parent** | e.g. `libs/file-viewers` → `@tools-workspace/file-viewers` → `/file-viewers/...` |
| **Nav / SEO category** | Each lib gets a `CATEGORY_META` entry (name, description, icons) in `extract-routes.js` |
| **New categories are OK** | When a vertical is distinct for users/SEO (CAD, GIS, medical, …), **create a new lib** instead of overcrowding `file-viewers` |
| **Reuse intent libs** | Convert → `data-converters`; mutate PDF/image/media → those libs; JWT decode → `testing-tools` |

### 0.1 Existing modules (keep using)

| Lib (`libs/…`) | Alias | Route parent | Role | Future-viewer fit |
| -------------- | ----- | ------------ | ---- | ----------------- |
| **`file-viewers`** | `@tools-workspace/file-viewers` | `/file-viewers` | General upload → preview/explore | Office, docs, images, logs, archive, fonts, Excel, audio/video players, generic 3D shell, **XES (today)**; also home for tools that do **not** yet have a dedicated category |
| **`data-converters`** | `@tools-workspace/data-converters` | `/data-converters` | Convert / format / validate | CSV↔JSON, YAML↔JSON, JSON beautify — **not** Parquet/CAD/DICOM viz |
| **`pdf-tools`** | `@tools-workspace/pdf-tools` | `/pdf-tools` | PDF mutate / generate | Edit only; preview stays in `file-viewers` |
| **`image-color-tools`** | `@tools-workspace/image-color-tools` | `/image-color-tools` | Image mutate, color, OCR | Mutate only; passive preview in `file-viewers` |
| **`media-tools`** | `@tools-workspace/media-tools` | `/media-tools` | Record / trim / convert A/V | Capture/transform; file analyzers → `file-viewers` or media category tools |
| **`code-file-tools`** | `@tools-workspace/code-file-tools` | `/code-file-tools` | Minify, clipboard, metadata | Source minify / metadata; optional source viewer |
| **`dev-design-tools`** | `@tools-workspace/dev-design-tools` | `/dev-design-tools` | CSS, HTTP/WS, mock JSON | Live HTTP playground; **HAR file** → `network-viewers` |
| **`testing-tools`** | `@tools-workspace/testing-tools` | `/testing-tools` | Validators, JWT decoder | Paste-and-decode tokens / schemas |
| **`security-tools`** | `@tools-workspace/security-tools` | `/security-tools` | Hash, passwords, AES, UUID | Crypto **utilities**; binary/report **viewers** → `network-viewers` / `file-viewers` |
| **`text-utilities`** | `@tools-workspace/text-utilities` | `/text-utilities` | Text transforms | Not for domain file viewers |
| **`math-date-utils`** | `@tools-workspace/math-date-utils` | `/math-date-utils` | Calculators | Optional coordinate converter only |
| **`browser-utils`** / **`fun-tools`** | … | … | Browser / fun tools | Not applicable |
| **`features-home`** | `@tools-workspace/features-home` | `/` | Shell (nav, footer, toast) | No tools |
| **`apps/tools-site`** | — | — | Routes, SEO catalog, SSR | Registers every category + tool |

### 0.2 Planned new category modules (create as first-class libs)

These follow the **same architecture** as existing categories. Create the lib when starting the **first tool** in that vertical (do not wait to “outgrow” `file-viewers`).

| New lib | Route / alias | Display name (CATEGORY_META) | Owns |
| ------- | ------------- | ---------------------------- | ---- |
| **`cad-viewers`** | `/cad-viewers` · `@tools-workspace/cad-viewers` | CAD & Engineering Viewers | DWG, DXF, STEP, IGES, IFC/BIM, Gerber/PCB, vendor CAD |
| **`gis-viewers`** | `/gis-viewers` · `@tools-workspace/gis-viewers` | GIS & Mapping Viewers | GeoJSON, Shapefile, KML/KMZ, GPX, GeoTIFF, DEM, LiDAR maps, drone tracks |
| **`medical-viewers`** | `/medical-viewers` · `@tools-workspace/medical-viewers` | Medical & Healthcare Viewers | DICOM, NIfTI, WSI, FHIR, HL7, ECG/EEG clinical views |
| **`science-viewers`** | `/science-viewers` · `@tools-workspace/science-viewers` | Scientific Data Viewers | NetCDF, HDF5, FITS, GRIB, SEG-Y, well logs, FASTA/VCF, molecules |
| **`network-viewers`** | `/network-viewers` · `@tools-workspace/network-viewers` | Network & Traffic Viewers | PCAP/PCAPNG, HAR, protocol/packet analyzers, security scan report viewers |
| **`process-viewers`** | `/process-viewers` · `@tools-workspace/process-viewers` | Process & Workflow Viewers | XES (migrate), BPMN, PNML, BPEL, DMN, EPC, process timelines |
| **`diagram-viewers`** | `/diagram-viewers` · `@tools-workspace/diagram-viewers` | Diagram & Graph Viewers | PlantUML, Mermaid, Graphviz DOT, UML/C4, GraphML/GEXF, mind maps, ER/DBML |
| **`data-explorers`** | `/data-explorers` · `@tools-workspace/data-explorers` | Data Explorers | Parquet, Avro, ORC, Feather, Arrow, Delta, SQLite, DuckDB (explore; convert stays in `data-converters`) |
| **`ml-viewers`** | `/ml-viewers` · `@tools-workspace/ml-viewers` | ML Model Viewers | ONNX, TensorFlow/PyTorch/Keras graphs, MLflow artifacts |

Full create checklist: [§34](#34-planned-new-category-modules).

### 0.3 Already in `file-viewers` (keep; migrate only when category lib exists)

| Tool | Notes |
| ---- | ----- |
| Image, PDF, Word, PPT, Text, Markdown, Excel, Log, Audio, Font, Archive | Stay in **`file-viewers`** (general File Viewers category) |
| Video player, 3D model viewer | Stay in **`file-viewers`** as general media/3D shells; CAD solids may also use shared 3D patterns from `cad-viewers` |
| **XES Viewer** | Keep until **`process-viewers`** is created, then **migrate** route + component into that lib |

### 0.4 Placement decision rules

| User intent | Put tool in | Example |
| ----------- | ----------- | ------- |
| **Vertical domain viewer** with a planned category | **New category lib** ([§0.2](#02-planned-new-category-modules-create-as-first-class-libs)) | DICOM → `medical-viewers`; GeoJSON → `gis-viewers` |
| **General file preview** (office, image, archive, generic 3D/video) | **`file-viewers`** | PDF, Word, STL via `3d-model-viewer` |
| **Convert A → B / format / lint** | **`data-converters`** | CSV↔JSON |
| **Decode / validate token or schema** | **`testing-tools`** | JWT decoder |
| **Hash / encrypt utility** | **`security-tools`** | Hash generator |
| **Edit PDF / mutate image / record media** | **`pdf-tools` / `image-color-tools` / `media-tools`** | Merge PDF, trim audio |
| **Live HTTP/CSS playground** | **`dev-design-tools`** | Request builder (not HAR file) |
| **No matching category yet** | **`file-viewers`** temporarily, or **create** the planned category lib first | Prefer creating the category if it is listed in §0.2 |

**Policy:** For tools in a planned vertical, **create the category module first** (empty lib + `CATEGORY_META` + route parent), then add the first tool — same workflow as any existing category.

### 0.5 How to add a tool (existing category)

1. Implement under `libs/<category>/src/lib/component/<tool-slug>/` (+ utils/types/constants/spec)
2. Export from `libs/<category>/src/index.ts`
3. Add a deep `loadComponent` in `apps/tools-site/src/app/routes/<category>.routes.ts`
4. Run `npx nx run tools-site:generate-sitemap`
5. Optional: AutoGA map, footer curated lists

### 0.6 How to add a **new category module** (architecture checklist)

Same pattern as `file-viewers` / `data-converters`:

1. Generate Nx Angular library: `libs/<category-slug>/` (prefix `lib`, standalone)
2. Add path aliases in `tsconfig.base.json`: exact barrel + `"@tools-workspace/<category-slug>/*": ["libs/<category-slug>/src/lib/component/*"]`
3. Add `CATEGORY_META['<category-slug>']` in `apps/tools-site/scripts/lib/extract-routes.js` (name, description, faIcon, materialIcon)
4. Add `loadChildren` in `app.routes.ts` and a category file `apps/tools-site/src/app/routes/<category-slug>.routes.ts` (index + deep `loadComponent`s)
5. Implement first tool; export from `src/index.ts`
6. Regenerate SEO catalog / sitemap
7. Shared shells (map, 3D, volume, packet, graph) live **inside that category lib** (or a later shared shell lib if two categories need the same engine)

---

## 1. Why Specialized Viewers Matter

Many file types store information in formats that are **technically correct but human-unfriendly**. Users do not want to read XML, binary blobs, or raw coordinates — they want **maps, diagrams, timelines, charts, and interactive exploration**.

| File Type | Domain | Why Viewing Is Difficult | What Users Actually Want | Purpose of a Dedicated Viewer |
| --------- | ------ | ------------------------ | ------------------------ | ----------------------------- |
| **XES** | Process Mining | Raw event sequences, not a visual model | Process maps, variants, bottlenecks, timelines | Turn event logs into analyzable process insights |
| **BPMN (.bpmn)** | Business Processes | XML model, requires diagram rendering | Interactive process diagrams, validation | Visualize and validate business workflows |
| **BPEL (.bpel)** | Workflow Automation | Executable process definitions | Workflow visualization, execution analysis | Understand orchestration logic without reading XML |
| **Petri Net (.pnml)** | Process Modeling | Mathematical model, not human-friendly | Graph visualization, simulation | Explore places/transitions and token flow |
| **GraphML (.graphml)** | Graph Data | Nodes and edges without layout | Network graphs, communities, relationships | Interactive network exploration |
| **GEXF (.gexf)** | Network Analysis | Large dynamic graphs | Social/network visualization | Visualize evolving network structures |
| **GPX (.gpx)** | GPS/Tracking | Coordinates only | Maps, routes, elevation, movement analytics | Plot tracks and analyze movement |
| **FIT (.fit)** | Sports/Fitness | Sensor/time-series data | Activity charts, maps, performance analysis | Fitness performance dashboards |
| **Parquet (.parquet)** | Data Engineering | Columnar storage format | Data exploration, profiling, charts | Schema + sample data without Spark/Hive |
| **Avro (.avro)** | Big Data | Schema + serialized records | Schema viewer, data explorer | Inspect schemas and sample records |
| **FHIR JSON/XML** | Healthcare | Medical resources with relationships | Patient timelines, clinical views | Clinical resource navigation |
| **HL7 (.hl7)** | Healthcare | Message format, not user-readable | Clinical event viewer | Decode and present HL7 messages |
| **DICOM (.dcm)** | Medical Imaging | Images + metadata + medical context | Image viewer, annotations, reports | Medical-grade image review |
| **LAS (.las)** | Oil & Gas / LiDAR | Well logs or point clouds | Depth charts or 3D point navigation | Domain visualization without desktop GIS/E&P tools |
| **SEG-Y (.sgy)** | Geophysics | Seismic binary data | Seismic visualization | Seismic section interpretation |
| **NetCDF (.nc)** | Climate/Science | Multi-dimensional scientific arrays | Maps, slices, charts | Slice and plot scientific grids |
| **HDF5 (.h5)** | Scientific Data | Hierarchical datasets | Dataset explorer, visualization | Browse hierarchies and visualize arrays |
| **FITS (.fits)** | Astronomy | Scientific image + metadata | Astronomical image analysis | Astro image stretch, WCS, overlays |
| **STL/OBJ/PLY** | 3D Models | Geometry without context | 3D rendering, measurement | Interactive mesh inspection |
| **IFC (.ifc)** | BIM/Construction | Building information model | 3D building viewer | Navigate building components & properties |
| **DWG/DXF** | CAD | Engineering drawings | CAD viewer, layers, measurements | Engineering drawing review |
| **STEP/IGES** | Manufacturing | Precise CAD solids/surfaces | 3D part inspection, measurements | Neutral CAD exchange review |
| **GeoJSON / Shapefile** | GIS | Spatial features | Interactive maps | Map-based feature exploration |
| **KML/KMZ** | GIS | Geographic annotations | Earth/map visualization | Placemarks, paths, overlays on maps |
| **ONNX** | ML | Opaque model graph binary | Layer graph, tensors, ops | Model architecture inspection |
| **HAR (.har)** | Web Debugging | Network traces | Timeline, request analysis | Browser waterfall & request inspection |
| **PCAP (.pcap)** | Networking | Packet captures | Network flows, protocol analysis | Packet timeline & protocol decode |
| **Gerber / GDSII** | Electronics | PCB/mask geometry | Layered PCB / IC layout | Manufacturing / electronics review |

### Design principle

| Need | Why |
| ---- | --- |
| **Domain semantics** | Encoding alone (JSON/XML/binary) does not convey meaning |
| **Interactive UI** | Zoom, pan, filter, layer toggle, measure, simulate |
| **Visual mapping** | Graphs, maps, 3D, timelines beat raw text |
| **Trust & precision** | Engineering, medical, and scientific work needs accurate tools |
| **AI resistance** | Chatbots cannot rotate a mesh, window a CT slice, or decode a PCAP timeline |

---

## 2. Why AI Alone Cannot Replace These Tools

AI can summarize or describe files, but it cannot replace interactive, pixel-accurate, or protocol-accurate viewers.

| Tool Name | File Type | Why AI Cannot Replace It | When to Use This Viewer |
| --------- | --------- | ------------------------ | ----------------------- |
| **DICOM Viewer** | `.dcm` | Medical image viewing, zoom, windowing, measurements, slices | Radiology review, teaching, QA |
| **3D Model Viewer** | `.stl`, `.obj`, `.fbx`, `.glb` | Interactive 3D rotation, lighting, mesh inspection | Design review, 3D printing prep |
| **CAD Drawing Viewer** | `.dwg`, `.dxf` | Layers, dimensions, engineering drawings | Construction / manufacturing review |
| **STEP / CAD Solid Viewer** | `.step`, `.stp`, `.iges` | Precise solid geometry interaction | Mechanical design review |
| **BIM Model Viewer** | `.ifc` | 3D building navigation, components, properties | AEC coordination |
| **GIS Map Viewer** | `.shp`, `.geojson`, `.kml` | Interactive maps, layers, spatial analysis | Location intelligence |
| **Point Cloud Viewer** | `.las`, `.laz`, `.ply` | Millions of 3D points, spatial navigation | Survey / LiDAR inspection |
| **Seismic Data Viewer** | `.sgy`, `.segy` | Geological interpretation, seismic sections | Exploration geophysics |
| **Medical Scan Viewer** | `.nii`, `.nii.gz` | Brain/body volume visualization | Research / clinical imaging |
| **XES Process Viewer** | `.xes` | Process graphs, trace exploration, variants | Process mining analysis |
| **BPMN Diagram Viewer** | `.bpmn` | Workflow diagrams and interaction | Business process design review |
| **Petri Net Viewer** | `.pnml` | Graph simulation and token movement | Formal process modeling |
| **PCAP Network Viewer** | `.pcap`, `.pcapng` | Packet timeline, traffic graphs | Network troubleshooting / forensics |
| **HAR Viewer** | `.har` | Browser network waterfall visualization | Web performance debugging |
| **Log Timeline Viewer** | `.log` | Time-based event investigation | Ops / incident response |
| **Infrastructure Graph Viewer** | Terraform / Kubernetes files | Dependency graphs | Platform engineering |
| **Dependency Graph Viewer** | package / architecture graphs | Interactive relationship exploration | Software supply-chain analysis |
| **Mind Map Viewer** | `.mm`, `.xmind` | Visual hierarchy navigation | Knowledge organization |
| **Flowchart Viewer** | `.drawio`, `.vsdx` | Diagram interaction | Process / architecture docs |
| **ER Diagram Viewer** | `.erd`, database schemas | Database relationship visualization | Data modeling |
| **Molecule Viewer** | `.pdb`, `.mol` | 3D molecular structure | Chemistry / biotech |
| **Astronomy Image Viewer** | `.fits` | Scientific image processing | Astronomy research |
| **Weather / Climate Viewer** | `.nc`, `.grib` | Multi-dimensional climate visualization | Climate / meteorology |
| **Scientific Dataset Viewer** | `.h5`, `.netcdf` | Large scientific arrays | Research data exploration |
| **Satellite Image Viewer** | GeoTIFF | Large raster visualization | Remote sensing |
| **Drone Flight Viewer** | `.gpx`, telemetry files | Route + sensor visualization | UAV / field ops |
| **ONNX / Model Graph Viewer** | `.onnx`, `.pb`, `.pt` | Interactive neural network graphs | ML model inspection |
| **Parquet / Columnar Viewer** | `.parquet`, `.orc`, `.avro` | Schema + large-table exploration | Data engineering |
| **PCB / Gerber Viewer** | Gerber, KiCad, GDSII | Layered electronics layouts | Electronics manufacturing |
| **Audio Waveform Viewer** | `.wav` | Waveform/spectrum analysis | Audio engineering |
| **Video Metadata Viewer** | `.mp4`, `.mkv` | Frame analysis, codec details | Media QA |

---

## 3. Highest Opportunity Shortlist (SEO + Uniqueness + AI Resistance)

If the goal is **SEO + uniqueness + AI resistance**, these are especially interesting. A browser-based implementation provides something users **cannot get just by asking an AI chatbot**.

| Priority | Tool | Typical Extensions | Target category module | Why High Opportunity | What Browser UX Must Deliver |
| -------- | ---- | ------------------ | ---------------------- | -------------------- | ---------------------------- |
| 1 | **DICOM Viewer** | `.dcm` | **`medical-viewers`** *(create lib)* | Huge search demand; medical; AI cannot window/measure slices | Window/level, zoom, multi-slice, metadata |
| 2 | **DWG Viewer** | `.dwg` | **`cad-viewers`** *(create lib)* | AutoCAD ecosystem; desktop lock-in | Layers, pan/zoom, measurements |
| 3 | **DXF Viewer** | `.dxf` | **`cad-viewers`** | Open CAD exchange; pairs with DWG | 2D drawing + layers |
| 4 | **STEP Viewer** | `.step`, `.stp` | **`cad-viewers`** | Neutral CAD; manufacturing SEO | Interactive 3D solids |
| 5 | **IFC Viewer** | `.ifc` | **`cad-viewers`** (BIM) | OpenBIM; AEC niche + SEO | 3D building + properties |
| 6 | **STL Viewer** | `.stl` | **`file-viewers`** (`3d-model-viewer`) | 3D printing mass audience | Rotate, measure, printability cues |
| 7 | **GeoJSON Viewer** | `.geojson` | **`gis-viewers`** *(create lib)* | Developers + GIS; easy web win | Interactive map + feature inspect |
| 8 | **Shapefile Viewer** | `.shp` (+ `.dbf`, `.shx`) | **`gis-viewers`** | Classic GIS; few good free web tools | Map + attribute table |
| 9 | **GPX Viewer** | `.gpx` | **`gis-viewers`** | Fitness / outdoor SEO | Map, elevation profile, stats |
| 10 | **LAS Viewer** | `.las`, `.laz` | **`gis-viewers`** (LiDAR) / **`science-viewers`** (well log) | LiDAR / well-log dual demand | Point cloud or well curves |
| 11 | **PCAP Viewer** | `.pcap`, `.pcapng` | **`network-viewers`** *(create lib)* | Security / networking professionals | Packet timeline, filters, decode |
| 12 | **HAR Viewer** | `.har` | **`network-viewers`** | Web perf debugging; high developer traffic | Waterfall, timing, headers |
| 13 | **XES Viewer** | `.xes` | **`file-viewers`** today → migrate **`process-viewers`** | Process mining niche; already shipped | Traces, variants, process map |
| 14 | **BPMN Viewer** | `.bpmn` | **`process-viewers`** *(create lib)* | Business process SEO; diagram interaction | Interactive workflow diagram |
| 15 | **NetCDF Viewer** | `.nc` | **`science-viewers`** *(create lib)* | Climate/science; multi-dim arrays | Slice maps, variables, charts |
| 16 | **HDF5 Viewer** | `.h5`, `.hdf5` | **`science-viewers`** | Scientific / ML datasets | Hierarchy browser + array viz |
| 17 | **Parquet Viewer** | `.parquet` | **`data-explorers`** *(create lib)* | Data engineering SEO | Schema, preview, profiling |
| 18 | **ONNX Viewer** | `.onnx` | **`ml-viewers`** *(create lib)* | ML boom; graph visualization | Ops graph, tensors, metadata |
| 19 | **NIfTI Viewer** | `.nii`, `.nii.gz` | **`medical-viewers`** | Neuroimaging research | Volume slices / 3D ortho |
| 20 | **Point Cloud Viewer** | `.las`, `.laz`, `.ply`, `.e57` | **`gis-viewers`** | Survey / scanning; AI-resistant | Spatial 3D navigation at scale |

**Why this shortlist wins for a tools website**

| Criterion | How these tools score |
| --------- | --------------------- |
| **SEO** | High-intent queries (“view dwg online”, “dicom viewer”, “pcap online”) |
| **Uniqueness** | Few polished free browser tools vs generic JSON/PDF viewers |
| **AI resistance** | Require interactive canvas (3D, map, medical viewport, packet timeline) |
| **Reusable shells** | Shared 3D, map, table, graph, timeline engines amortize cost |
| **Differentiation** | Positions the product as domain tooling, not another text utility |

---

## 4. Engineering / CAD / Manufacturing

> **Target category module:** **`libs/cad-viewers`** *(create new category — see §34)*.  
> **Related:** tessellated STEP/IGES can share 3D patterns with `file-viewers`/`3d-model-viewer`; PCB/Gerber use CAD 2D viewport inside `cad-viewers`.

**Purpose:** Open engineering drawings, solids, plot files, and PCB layouts without native CAD licenses.  
**Why build:** Manufacturing and design reviews need layers, measurements, and accurate geometry — not file downloads.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features | Module |
| ---- | -------------------------- | ---------- | ---------------------- | ------ |
| **DWG Viewer** | `.dwg` | AutoCAD native drawings | Layers, pan/zoom, measurements | **`cad-viewers`** |
| **DXF Viewer** | `.dxf` | Open CAD exchange | 2D/3D drawing display | **`cad-viewers`** |
| **DWF Viewer** | `.dwf`, `.dwfx` | Design Web Format publishing | Lightweight CAD publish preview | **`cad-viewers`** |
| **DGN Viewer** | `.dgn` | MicroStation / Bentley drawings | Civil / plant CAD review | **`cad-viewers`** |
| **STEP Viewer** | `.step` | ISO 10303 solids | Neutral 3D mechanical models | **`cad-viewers`** |
| **STP Viewer** | `.stp` | STEP alias extension | Same as STEP viewer | **`cad-viewers`** |
| **IGES Viewer** | `.iges` | Legacy surface CAD | Surface model inspection | **`cad-viewers`** |
| **IGS Viewer** | `.igs` | IGES alias | Same as IGES viewer | **`cad-viewers`** |
| **Parasolid Viewer** | `.x_t`, `.x_b` | Industrial CAD kernel | High-end solid geometry | **`cad-viewers`** |
| **CATIA Viewer** | `.catpart`, `.catproduct` | Dassault CATIA | Aerospace / automotive parts | **`cad-viewers`** |
| **SolidWorks Viewer** | `.sldprt`, `.sldasm` | SolidWorks parts/assemblies | Mechanical design review | **`cad-viewers`** |
| **Fusion 360 Viewer** | Fusion exports / `.f3d` (where available) | Autodesk Fusion | Maker / product design | **`cad-viewers`** |
| **Inventor Viewer** | `.ipt`, `.iam` | Autodesk Inventor | Mechanical parts/assemblies | **`cad-viewers`** |
| **Creo Viewer** | `.prt` | PTC Creo | Product engineering models | **`cad-viewers`** |
| **Rhino 3DM Viewer** | `.3dm` | Rhinoceros models | Freeform / industrial design | **`cad-viewers`** |
| **SketchUp Viewer** | `.skp` | SketchUp models | Architecture concept models | **`cad-viewers`** |
| **AutoCAD Viewer** | `.dwg`, `.dxf` | Generic AutoCAD family | Unified CAD drawing UX | **`cad-viewers`** |
| **PLT Plot Viewer** | `.plt` | Plotter output | Legacy plot preview | **`cad-viewers`** |
| **HPGL Viewer** | `.hpgl`, `.hgl` | Plotter language | Vector plot inspection | **`cad-viewers`** |
| **Gerber File Viewer** | `.gbr`, `.ger` | PCB fabrication | Layered board artwork | **`cad-viewers`** |
| **PCB Layout Viewer** | PCB project files | Electronics layout | Copper/silk/mask layers | **`cad-viewers`** |
| **KiCad Viewer** | KiCad project / PCB | Open-source EDA | KiCad board & schematic | **`cad-viewers`** |
| **Eagle PCB Viewer** | Eagle `.brd`, `.sch` | Autodesk Eagle | Legacy PCB projects | **`cad-viewers`** |
| **Altium PCB Viewer** | Altium project / PCB | Altium Designer | Professional PCB review | **`cad-viewers`** |
| **GDSII Layout Viewer** | `.gds` | IC / photomask layout | Semiconductor layout | **`cad-viewers`** |

---

## 5. 3D Model / Graphics

> **Target category module:** **`libs/file-viewers`** (extend `3d-model-viewer`) for general meshes (STL/OBJ/GLTF).  
> **Point clouds / survey LiDAR** → **`libs/gis-viewers`**. CAD solids (STEP) → **`libs/cad-viewers`**.

**Purpose:** Interactive mesh, scene, material, and volumetric visualization in the browser.  
**Why build:** Geometry and materials are meaningless as text; users need rotate, light, measure, and inspect.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features | Module |
| ---- | -------------------------- | ---------- | ---------------------- | ------ |
| **STL Viewer** | `.stl` | 3D printing meshes | Rotate, measure, orientation | `file-viewers` |
| **OBJ Viewer** | `.obj` | Universal mesh exchange | Mesh + MTL materials | `file-viewers` |
| **FBX Viewer** | `.fbx` | Animation / game assets | Skeletons, animation preview | `file-viewers` |
| **GLB Viewer** | `.glb` | Binary glTF | Fast web 3D | `file-viewers` |
| **GLTF Viewer** | `.gltf` | Web 3D standard | Scenes, PBR materials | `file-viewers` |
| **USD Viewer** | `.usd`, `.usda`, `.usdc` | Universal Scene Description | Film / VFX / Omniverse | `file-viewers` |
| **USDZ Viewer** | `.usdz` | Apple AR packages | AR model preview | `file-viewers` |
| **PLY Viewer** | `.ply` | Scanned meshes / points | 3D scan review | `file-viewers` |
| **3DS Viewer** | `.3ds` | Legacy 3D Studio | Older asset support | `file-viewers` |
| **3MF Viewer** | `.3mf` | Modern 3D printing | Richer than STL | `file-viewers` |
| **COLLADA Viewer** | `.dae` | Cross-tool exchange | Interop scenes | `file-viewers` |
| **VRML Viewer** | `.wrl` | Legacy web 3D | Older interactive 3D | `file-viewers` |
| **X3D Viewer** | `.x3d` | VRML successor | Declarative 3D scenes | `file-viewers` |
| **BLEND Viewer** | `.blend` | Blender projects | Scene / object preview | `file-viewers` |
| **MAX Viewer** | `.max` | 3ds Max | DCC asset preview | `file-viewers` |
| **Maya Model Viewer** | `.ma`, `.mb` | Autodesk Maya | Animation / film assets | `file-viewers` |
| **Cinema4D Viewer** | `.c4d` | Maxon Cinema 4D | Motion graphics assets | `file-viewers` |
| **Point Cloud Viewer** | `.las`, `.laz`, `.ply`, `.e57`, `.pcd` | Dense spatial points | Spatial navigation at scale | **`gis-viewers`** |
| **Mesh Viewer** | generic meshes | Generic triangle/quad meshes | Topology / normals inspect | `file-viewers` |
| **Texture Map Viewer** | image textures | UV / albedo maps | Texture QA | `file-viewers` |
| **Normal Map Viewer** | normal maps | Tangent-space normals | Shading debug | `file-viewers` |
| **Height Map Viewer** | height / displacement | Terrain / displacement | Height visualization | `file-viewers` |
| **Voxel Viewer** | voxel / `.vox` | Volumetric grids | Voxel worlds / scans | `file-viewers` |

---

## 6. BIM / Construction

> **Target category module:** **`libs/cad-viewers`** (BIM + engineering under one AEC/CAD category).

**Purpose:** Navigate building information models, clashes, quantities, and construction schedules.  
**Why build:** AEC coordination needs 3D + metadata + discipline filters, not flat PDFs alone.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **IFC Viewer** | `.ifc` | OpenBIM standard | 3D + element properties |
| **Revit Viewer** | `.rvt` | Autodesk Revit projects | Native Revit preview |
| **RVT Viewer** | `.rvt` | Revit file alias naming | Same as Revit viewer |
| **RFA Viewer** | `.rfa` | Revit families | Family / component preview |
| **Navisworks Viewer** | `.nwd`, `.nwc` | Coordination models | Multi-discipline federation |
| **BIM Model Viewer** | `.ifc`, BIM packs | Generic BIM shell | Cross-format building view |
| **BIM Quantity Viewer** | BIM quantities / QTO | Takeoff data | Quantities & schedules |
| **BIM Clash Viewer** | clash reports / Navis | Coordination conflicts | Clash detection review |
| **Building Floor Plan Viewer** | plans / BIM slices | 2D floor plates | Level-by-level plans |
| **Construction Timeline Viewer** | 4D schedules | Time + model | 4D construction sequencing |
| **MEP Model Viewer** | MEP BIM | Mechanical/electrical/plumbing | Discipline isolation |
| **Structural Model Viewer** | structural BIM | Structural framing | Beams, columns, loads context |

---

## 7. GIS / Mapping

> **Target category module:** **`libs/gis-viewers`** *(create new category)*.  
> **Related:** coordinate *calculator* only → `math-date-utils`.

**Purpose:** Map-based visualization of vector, raster, tile, GPS, and LiDAR geospatial data.  
**Why build:** Coordinates without a map are useless for spatial understanding.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **GeoJSON Viewer** | `.geojson` | Web-native geo | Interactive map + properties |
| **Shapefile Viewer** | `.shp` (+ sidecar files) | Classic ESRI vector | Map + attribute table |
| **KML Viewer** | `.kml` | Google Earth annotations | Placemarks, paths, overlays |
| **KMZ Viewer** | `.kmz` | Zipped KML | Packaged geo content |
| **GPX Viewer** | `.gpx` | GPS tracks | Route, elevation, stats |
| **TopoJSON Viewer** | `.topojson` | Topology-optimized geo | Efficient choropleths |
| **GeoPackage Viewer** | `.gpkg` | OGC SQLite geo DB | Layers + attributes |
| **MBTiles Viewer** | `.mbtiles` | Tile packages | Offline map tiles |
| **Vector Tile Viewer** | `.mvt`, tile URLs | Modern web maps | Vector tile inspect |
| **GeoTIFF Viewer** | georeferenced `.tif` | Satellite / aerial | CRS-aware raster |
| **COG Viewer** | `.tif` (Cloud Optimized GeoTIFF) | Streaming large rasters | Cloud GIS workflows |
| **Raster Map Viewer** | raster grids | Generic geo rasters | Stretch, bands, legend |
| **Satellite Image Viewer** | satellite rasters | EO imagery | Band composites, zoom |
| **DEM Viewer** | `.dem`, elevation grids | Digital elevation | Terrain height |
| **ASCII Grid Viewer** | `.asc` | Legacy GIS grids | Grid elevation / rasters |
| **Terrain Viewer** | DEM / mesh terrain | 3D terrain | Hillshade / 3D relief |
| **Contour Map Viewer** | contours / DEM-derived | Elevation contours | Contour lines |
| **Coordinate Converter Viewer** | CRS / coords | Reproject / convert | Lat-long ↔ projected |
| **GPS Track Viewer** | `.gpx`, tracks | Track analysis | Speed, distance, elevation |
| **Drone Flight Path Viewer** | `.gpx`, telemetry | UAV missions | Route + sensor overlay |
| **LiDAR Map Viewer** | `.las`, `.laz` | Aerial LiDAR | Classified point maps |

---

## 8. Medical / Healthcare

> **Target category module:** **`libs/medical-viewers`** *(create new category)*.  
> **Related:** not `data-converters`; waveform shells may be shared with `file-viewers` audio utilities where useful.

**Purpose:** Clinical and research medical formats with correct semantics (windowing, patient context, messaging).  
**Why build:** Healthcare data has strict structure and visual requirements; wrong rendering is unsafe/unusable.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **DICOM Viewer** | `.dcm` | Clinical imaging standard | Window/level, series, metadata |
| **MRI Viewer** | DICOM / NIfTI MRI | MRI studies | Multi-plane MRI review |
| **CT Scan Viewer** | DICOM CT | CT volumes | Axial / MPR views |
| **X-Ray Viewer** | DICOM XR | Radiographs | Contrast, measure, annotate |
| **Ultrasound Viewer** | DICOM US | Ultrasound cine/stills | Frame / cine review |
| **Mammography Viewer** | DICOM MG | Breast imaging | High-res mammography UX |
| **PET Scan Viewer** | DICOM PET | Nuclear medicine | SUV / fusion context |
| **NIfTI Viewer** | `.nii`, `.nii.gz` | Research volumes | Ortho slices / volume |
| **Medical Image Viewer** | `.nii`, `.nii.gz` | Generic medical volumes | Volume / slice shell |
| **Analyze Format Viewer** | `.hdr`, `.img` | Legacy neuroimaging | Research compatibility |
| **NRRD Viewer** | `.nrrd` | Research rasters | Volume / segmentation |
| **MINC Viewer** | `.mnc` | Medical Imaging NetCDF | Neuroimaging research |
| **CDA Viewer** | `.xml` | Clinical Document Architecture | Clinical documents |
| **Brain Imaging Viewer** | neuroimaging volumes | Brain-focused UX | Atlases, overlays |
| **Neuroimaging Viewer** | NIfTI / DICOM / MINC | Research neuroscience | Multi-modal brain view |
| **Pathology Slide Viewer** | `.svs`, `.ndpi`, WSI | Digital pathology | Gigapixel slide zoom |
| **Whole Slide Image Viewer** | WSI formats | Pathology slides | Pyramid tile viewing |
| **Aperio Viewer** | `.svs` | Aperio WSI | Pathology vendor format |
| **Hamamatsu Viewer** | `.ndpi` | Hamamatsu WSI | Pathology vendor format |
| **ECG Viewer** | `.ecg`, waveform | Cardiac signals | Multi-lead ECG plots |
| **EEG Viewer** | `.edf` | Brain signals | Multi-channel EEG |
| **HL7 Message Viewer** | `.hl7` | Clinical messaging | Segment decode / events |
| **FHIR Resource Viewer** | FHIR JSON/XML | FHIR resources | Resource tree + refs |
| **Medical Timeline Viewer** | FHIR / HL7 / events | Longitudinal care | Patient journey timeline |

---

## 9. Scientific Data

> **Target category module:** **`libs/science-viewers`** *(create new category)*.  
> **Related:** Parquet/Avro → **`data-explorers`**; CSV↔JSON → `data-converters`.

**Purpose:** Explore multi-dimensional scientific arrays, simulation outputs, and bioinformatics sequences.  
**Why build:** Research formats are hierarchical or multi-dimensional; users need slices, plots, and metadata browsers.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **HDF5 Viewer** | `.h5`, `.hdf5` | Hierarchical datasets | Tree + array viz |
| **NetCDF Viewer** | `.nc` | Climate / model grids | Variables, slices, maps |
| **FITS Viewer** | `.fits` | Astronomy images | Stretch, WCS, headers |
| **GRIB Viewer** | `.grib`, `.grib2` | Weather fields | Forecast grids |
| **MATLAB MAT Viewer** | `.mat` | MATLAB workspaces | Variable browser |
| **ROOT File Viewer** | `.root` | HEP (CERN) data | Histograms / trees |
| **CDF Viewer** | `.cdf` | Space science CDF | Space physics data |
| **Scientific Dataset Viewer** | multi-format science | Generic science shell | Shared array explorer |
| **Climate Data Viewer** | NetCDF / GRIB climate | Climate analysis | Anomalies, maps, series |
| **Weather Model Viewer** | GRIB / NetCDF | NWP models | Forecast visualization |
| **Ocean Data Viewer** | ocean NetCDF | Oceanography | Currents, SST, depth |
| **Simulation Result Viewer** | sim outputs | Generic sim results | Field / time series |
| **CFD Result Viewer** | CFD meshes / fields | Fluid dynamics | Velocity, pressure fields |
| **Finite Element Analysis Viewer** | FEA results | Structural simulation | Stress / displacement |
| **Molecular Structure Viewer** | `.pdb`, `.mol`, `.sdf` | Chemistry 3D | Atoms, bonds, styles |
| **Protein Structure Viewer** | PDB / mmCIF | Proteins | Ribbon / surface view |
| **DNA Sequence Viewer** | sequence files | DNA inspection | Sequence + annotations |
| **Genome Browser** | genomic tracks | Genomics | Multi-track genome view |
| **FASTA Viewer** | `.fasta`, `.fa` | Sequences | Sequence browse / search |
| **FASTQ Viewer** | `.fastq`, `.fq` | Sequencing reads | Quality scores |
| **GenBank Viewer** | `.gb`, `.gbk` | Annotated sequences | Genomic annotations |
| **VCF Variant Viewer** | `.vcf` | Genetic variants | Variant table + filters |

---

## 10. Geology / Mining / Oil & Gas

> **Target category modules:** **`libs/science-viewers`** (well logs, SEG-Y, subsurface) + **`libs/gis-viewers`** (LiDAR / mine maps). No separate oil/gas lib unless SEO later demands it.

**Purpose:** Domain visualization for subsurface, mining, and exploration datasets.  
**Why build:** Industry binaries and models need depth charts, sections, and geological context.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **LAS Well Log Viewer** | `.las` | Well logging | Depth curves, tracks |
| **DLIS Viewer** | `.dlis` | Digital Log Interchange | Multi-frame well logs |
| **SEG-Y Viewer** | `.sgy`, `.segy` | Seismic volumes | Seismic sections |
| **Seismic Data Viewer** | seismic files | Interpretation | Horizons / amplitude |
| **Geological Model Viewer** | geo models | Subsurface models | 3D geology |
| **Borehole Viewer** | well / borehole data | Drilling context | Borehole paths + logs |
| **Rock Core Viewer** | core images / data | Core analysis | Core photos + depth |
| **Stratigraphy Viewer** | strat columns | Layering | Stratigraphic columns |
| **Reservoir Model Viewer** | reservoir grids | E&P reservoirs | Porosity / saturation |
| **Mine Map Viewer** | mine plans | Mining ops | Mine levels / maps |
| **Geological Cross Section Viewer** | sections | Interpretation | 2D geological sections |
| **LAS / LiDAR Point Cloud Viewer** | `.las` | LiDAR points | Survey / mapping clouds |
| **LAZ Viewer** | `.laz` | Compressed LiDAR | Efficient point clouds |
| **E57 Viewer** | `.e57` | 3D imaging exchange | Scanner interchange |
| **PCD Viewer** | `.pcd` | PCL point clouds | Robotics / vision |
| **XYZ Point Viewer** | `.xyz` | Simple point lists | Lightweight clouds |
| **Core Sample Viewer** | images/data | Core photography + data | Lab / geology QA |

---

## 11. Process / Workflow

> **Target category module:** **`libs/process-viewers`** *(create new category)*. Migrate **XES** from `file-viewers` when the lib is created; put BPMN/PNML/DMN/BPEL here from day one.

**Purpose:** Visualize event logs, BPMN diagrams, Petri nets, and process simulations.  
**Why build:** Process analysts need maps, variants, and simulations — not raw XML.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **XES Viewer** | `.xes` | Process mining logs | Traces, events, variants |
| **BPMN Viewer** | `.bpmn`, `.bpmn2` | Business process diagrams | Interactive workflow |
| **BPMN Analytics Viewer** | BPMN + logs | Conformance / performance | Overlay analytics on BPMN |
| **DMN Viewer** | `.dmn` | Decision Model & Notation | Decision tables / DRD |
| **Decision Model Viewer** | `.dmn` | Business decisions | Decision requirements |
| **EPC Diagram Viewer** | `.epml` | Event-driven Process Chain | EPC process maps |
| **PNML Viewer** | `.pnml` | Petri net markup | Places / transitions |
| **Petri Net Viewer** | PNML / nets | Formal models | Token simulation |
| **BPEL Viewer** | `.bpel` | Executable orchestration | Workflow visualization |
| **Workflow Diagram Viewer** | workflow XML / files | Generic workflows | Cross-tool workflow UX |
| **Process Map Viewer** | `.xes`, `.bpmn` | Discovered/designed maps | Process map overlay |
| **Process Mining Viewer** | event logs | End-to-end PM | Discovery + variants |
| **Event Log Viewer** | `.xes`, `.csv` | Raw event browse | Case / activity table |
| **Trace Explorer** | event logs | Case-centric view | Trace search & compare |
| **Process Timeline Viewer** | event logs | Time view | Gantt-like process time |
| **Business Process Simulator** | BPMN / PNML | What-if simulation | Token / path simulation |

---

## 12. Network / Cybersecurity

> **Target category module:** **`libs/network-viewers`** *(create new category)* for PCAP/HAR/protocol/scan-report viewers.  
> **Split:** JWT/hash utilities → `testing-tools` / `security-tools`; generic log preview may stay in `file-viewers/log-viewer`.

**Purpose:** Protocol-aware inspection of traffic, HTTP traces, security scans, and threat reports.  
**Why build:** Debugging and security need waterfalls, filters, and timelines — not grep alone.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **PCAP Viewer** | `.pcap` | Packet captures | Packet list + decode |
| **PCAPNG Viewer** | `.pcapng` | Next-gen captures | Advanced PCAP features |
| **Network Traffic Viewer** | flows / PCAP | Traffic overview | Conversations, graphs |
| **Packet Analyzer** | PCAP family | Deep packet inspect | Protocol trees |
| **Protocol Analyzer** | PCAP / logs | Protocol focus | HTTP, DNS, TLS, etc. |
| **HAR Viewer** | `.har` | Browser network traces | Waterfall + timings |
| **HTTP Trace Viewer** | HAR / logs | HTTP debugging | Request/response detail |
| **API Request Viewer** | HAR / OpenAPI traces | API calls | Endpoint / payload inspect |
| **Firewall Log Viewer** | firewall logs | Perimeter events | Allow/deny timelines |
| **SIEM Log Viewer** | SIEM exports | Security events | Correlation-friendly view |
| **Syslog Viewer** | syslog | System logs | Facility/severity filter |
| **DNS Log Viewer** | DNS logs | DNS queries | Query/response analysis |
| **Nmap Report Viewer** | Nmap `.xml` | Port scan results | Host / port matrix |
| **Nessus Report Viewer** | `.nessus` | Vuln scans | Finding severity tables |
| **SARIF Report Viewer** | `.sarif` | Static analysis | Code finding navigation |
| **Malware Analysis Report Viewer** | sandbox JSON/XML | Malware reports | Indicators & behavior |
| **Threat Intelligence Viewer** | TI feeds / STIX | Threat intel | IOC browse & graphs |

---

## 13. Software Architecture

> **Target category module:** **`libs/diagram-viewers`** for PlantUML/Mermaid/DOT/UML/C4/dependency graphs.  
> **Related:** live HTTP playgrounds → `dev-design-tools`; minify → `code-file-tools`.

**Purpose:** Turn code, packages, and diagrams into interactive architecture views.  
**Why build:** Text configs and source hide relationships; graphs reveal coupling and blast radius.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **Dependency Graph Viewer** | package files / lockfiles | Dep trees | Interactive graph |
| **Package Dependency Viewer** | package manifests | Multi-ecosystem deps | Unified dep UX |
| **NPM Dependency Viewer** | `package-lock.json` | JS/TS deps | npm graph / audit view |
| **Maven Dependency Viewer** | `pom.xml` | JVM deps | Maven tree |
| **Gradle Dependency Viewer** | Gradle build files | Gradle deps | Configuration graphs |
| **Python Dependency Viewer** | `requirements.txt`, `poetry.lock` | Python deps | Pip/Poetry graphs |
| **Import Graph Viewer** | source code | Module imports | Import relationship graph |
| **Include Dependency Viewer** | C/C++ headers | `#include` chains | Header dependency tree |
| **Code Architecture Viewer** | source trees | Module structure | Layer / package maps |
| **Call Graph Viewer** | compiler / static analysis outputs | Call relationships | Function call graphs |
| **UML Viewer** | `.uml`, `.xmi` | UML diagrams | Class / activity / use case |
| **Class Diagram Viewer** | `.uml`, `.xmi` | OO structure | Classes & relations |
| **Sequence Diagram Viewer** | `.puml`, `.plantuml`, UML | Interactions | Sequence playback |
| **PlantUML Viewer** | `.puml`, `.plantuml` | Text-to-diagram | Render PlantUML |
| **Mermaid Diagram Viewer** | `.mmd`, `.mermaid` | Markdown diagrams | Render Mermaid |
| **Architecture Diagram Viewer** | `.drawio`, `.archimate` | Enterprise arch | ArchiMate / arch diagrams |
| **C4 Model Viewer** | `.dsl`, `.puml` | C4 architecture | Context → code views |
| **Database ER Diagram Viewer** | `.erd`, schemas, SQL | Data models | ER relationships |
| **API Dependency Viewer** | OpenAPI / gateway config | Service APIs | API coupling maps |
| **Microservice Architecture Viewer** | service catalogs | Service mesh view | Service topology |

---

## 14. Cloud / DevOps

> **Target category module:** **`libs/diagram-viewers`** (IaC/service graphs) and/or **`libs/file-viewers`** for simple YAML tree preview. Prefer **`diagram-viewers`** for Terraform/Compose/K8s topology graphs.  
> **Related:** live cluster APIs out of scope unless uploaded snapshots.

**Purpose:** Visualize cloud resources, containers, and IaC as graphs and inventories.  
**Why build:** YAML and JSON hide topology; operators need dependency and resource views.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **Kubernetes YAML Viewer** | K8s YAML | Manifest review | Resource tree + validation |
| **Kubernetes Cluster Viewer** | cluster snapshots / API | Live/static topology | Workloads, services, ingress |
| **Helm Chart Viewer** | Helm charts | Chart structure | Templates, values, deps |
| **Docker Compose Viewer** | `compose.yaml` | Local stacks | Service graphs |
| **Docker Image Viewer** | image / tar | Image inspect | Layers, history, config |
| **Container Layer Viewer** | image layers | Layer diff | Size / filesystem layers |
| **Terraform Graph Viewer** | `.tf` | Resource deps | Terraform graph |
| **Terraform State Viewer** | `.tfstate` | State inspection | Resources in state |
| **CloudFormation Viewer** | `.yaml`, `.json` | AWS CloudFormation | Template resource graph |
| **Ansible Playbook Viewer** | `.yaml` | Ansible automation | Play / role / task view |
| **Cloud Architecture Diagram Viewer** | IaC / exports | Architecture diagrams | Multi-cloud topology |
| **AWS Resource Viewer** | AWS exports / IaC | AWS inventory | Resource relationships |
| **AWS Architecture Viewer** | `.json` / exports | AWS architecture | Service topology diagrams |
| **Azure Resource Viewer** | Azure exports / IaC | Azure inventory | Resource relationships |
| **Azure Resource Graph Viewer** | Azure exports | Azure ARG-style views | Resource query / graph |
| **GCP Resource Viewer** | GCP exports / IaC | GCP inventory | Resource relationships |
| **Kubernetes Architecture Viewer** | `.yaml` | K8s topology | Cluster architecture map |

---

## 15. Data File Viewers

> **Target category module split:**  
> - **Columnar / DB explore** (Parquet, Avro, ORC, SQLite, DuckDB, …) → **`libs/data-explorers`** *(create new category)*  
> - **Office/tabular preview already shipped** (Excel, CSV-as-table if added beside Excel) → **`libs/file-viewers`**  
> - **Convert / format** → **`libs/data-converters`**  
> - **JSON Schema validate** → **`libs/testing-tools`**

**Purpose:** Explore schemas and sample data from tabular, config, columnar, and embedded DB formats.  
**Why build:** Data engineers and analysts need instant profiling without heavyweight desktop tools.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **CSV Viewer** | `.csv` | Tabular data | Filter, sort, charts |
| **TSV Viewer** | `.tsv` | Tab-separated tables | Spreadsheet-style viewer |
| **Excel Viewer** | `.xls`, `.xlsx` | Spreadsheets | Sheets, formulas preview |
| **JSON Viewer** | `.json` | Structured data | Tree, search, format |
| **XML Viewer** | `.xml` | Markup data | Tree, XPath, format |
| **YAML Viewer** | `.yaml`, `.yml` | Config files | Structure explorer |
| **TOML Viewer** | `.toml` | Config (Rust/Python) | Structured config view |
| **INI Viewer** | `.ini`, `.cfg` | Legacy configs | Section browser |
| **SQLite Viewer** | `.sqlite`, `.db` | Embedded SQL | Tables, query |
| **DuckDB Viewer** | `.duckdb` | Analytical DB | Tables, query |
| **Parquet Viewer** | `.parquet` | Columnar files | Schema + preview |
| **ORC Viewer** | `.orc` | Hive columnar | Schema + preview |
| **Avro Viewer** | `.avro` | Schema + records | Schema + samples |
| **Feather Viewer** | `.feather` | Arrow Feather | Fast dataframe peek |
| **Arrow Viewer** | `.arrow`, IPC | Apache Arrow | Schema + batches |
| **Delta Lake Viewer** | Delta tables | Lakehouse tables | Versions, schema, samples |

---

## 16. Security / Identity

> **Target category module split:**  
> - **JWT / JWK / OAuth decode** → **`libs/testing-tools`** (extend existing JWT decoder)  
> - **Hash / password / encrypt utilities** → **`libs/security-tools`**  
> - **Certificate / PEM / X509 file viewers** → **`libs/security-tools`** (utility UX) or `file-viewers` if purely upload-preview  
> - **APK / IPA / ELF / PE** → **`libs/file-viewers`**  
> - **Malware / Nmap / Nessus / SARIF reports** → **`libs/network-viewers`**

**Purpose:** Inspect tokens, certificates, and keys safely without executing untrusted material.  
**Why build:** Auth and PKI debugging needs structured decode views, not opaque PEM blobs.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **JWT Viewer** | `.jwt`, token strings | Auth tokens | Header/payload decode |
| **JWK Viewer** | `.jwk`, JWKS | Key sets | Key parameters |
| **OAuth Token Viewer** | OAuth tokens | OAuth debugging | Claims / scopes |
| **Certificate Viewer** | `.crt`, `.cer` | TLS certs | Subject, SAN, chain |
| **SSL Certificate Viewer** | TLS certs | HTTPS QA | Validity, cipher context |
| **PEM Viewer** | `.pem` | PEM containers | Block type + decode |
| **X509 Certificate Viewer** | X.509 | PKI details | Full certificate fields |
| **SSH Key Viewer** | `.pub`, OpenSSH keys | SSH keys | Fingerprint, type, comment |
| **PGP Key Viewer** | `.asc`, PGP keys | OpenPGP | User IDs, fingerprints |
| **OpenSSL Key Viewer** | `.key`, `.pem` | Key metadata (safe) | Key hygiene checks |
| **Hash Analyzer** | hash strings | Hash identify | Algorithm guess / compare |
| **Password Hash Viewer** | hash dumps | Hash formats | Identify bcrypt/argon/etc. |
| **APK Viewer** | `.apk` | Android packages | Package contents / manifest |
| **IPA Viewer** | `.ipa` | iOS packages | Package contents / Info.plist |
| **ELF Binary Viewer** | `.elf` | Linux/Unix binaries | Headers, sections, imports |
| **PE Binary Viewer** | `.exe`, `.dll` | Windows binaries | PE headers, imports, sections |
| **Malware Report Viewer** | `.json`, `.xml` | Sandbox / AV reports | Indicators & behavior |
| **Nmap Viewer** | `.xml` | Nmap scan XML | Host / port matrix |
| **Nessus Viewer** | `.nessus` | Vuln scan reports | Finding severity tables |
| **Burp Report Viewer** | Burp exports | AppSec findings | Issue list / evidence |
| **SARIF Viewer** | `.sarif` | Static analysis results | Code finding navigation |

---

## 17. Blockchain

> **Target category module:** **`libs/file-viewers`** (long-tail). Create **`blockchain-viewers`** later only if this vertical becomes a nav priority.

**Purpose:** Explore transactions, contracts, wallets, and token flows visually.  
**Why build:** On-chain data is dense JSON; users want flows, ABIs, and contract structure.

| Tool | Typical Input | Why to Use | Purpose / Key Features |
| ---- | ------------- | ---------- | ---------------------- |
| **Blockchain Transaction Viewer** | tx JSON/CSV | Tx inspection | Fields, logs, status |
| **Wallet Transaction / Flow Viewer** | address history / transactions | Wallet activity | Chronological txs + fund flows |
| **Crypto Address Viewer** | addresses | Address intel | Balance / type / links |
| **Smart Contract Viewer** | bytecode / verified source / Solidity/ABI | Contract review | Functions, events |
| **Solidity Contract Viewer** | `.sol` | Solidity source | Structure + ABI gen |
| **ABI Viewer** | ABI JSON | Contract interface | Methods / events decode |
| **NFT Metadata Viewer** | NFT metadata JSON | NFT assets | Traits, media, rarity |
| **Token Flow Viewer / Analyzer** | blockchain / transfer graphs | Fund tracing | Token movement graphs |

---

## 18. Audio / Signal

> **Target category module split:**  
> - **Playback + spectrum / MIDI / MusicXML** → **`libs/file-viewers`** (extend `audio-player`)  
> - **Record / trim / convert** → **`libs/media-tools`**  
> - **ECG / EEG** → **`libs/medical-viewers`**

**Purpose:** Playback plus analytical views for audio and scientific/medical signals.  
**Why build:** Signal QA needs waveforms, spectra, and multi-channel plots — not play-only.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **WAV Viewer / Analyzer** | `.wav` | Uncompressed audio | Waveform + analysis |
| **WAV Spectrum Viewer** | `.wav` | Frequency view | FFT spectrum |
| **Audio Spectrum Viewer** | audio files | Frequency view | FFT spectrum |
| **Spectrogram Viewer** | audio / signals | Time-frequency | Spectrogram heatmap |
| **Audio Viewer** | `.mp3`, `.wav`, `.flac` | Playback | Audio preview |
| **MP3 Analyzer / Metadata Viewer** | `.mp3` | Compressed audio | ID3 / bitrate / waveform |
| **FLAC Analyzer** | `.flac` | Lossless audio | Stream info + waveform |
| **MIDI Viewer** | `.mid`, `.midi` | MIDI events | Piano-roll / tracks |
| **MusicXML Viewer** | `.musicxml`, `.mxl` | Digital scores | Sheet music rendering |
| **ECG Viewer** | `.ecg` | Cardiac signals | Multi-lead ECG plots |
| **EEG Viewer** | `.edf` | Brain signals | Multi-channel EEG |
| **Signal Waveform Viewer** | generic signals | Lab signals | Multi-channel waveforms |
| **Oscilloscope Viewer** | captured waveforms | Scope-like UX | Trigger / measure metaphor |

---

## 19. Video

> **Target category module split:**  
> - **Playback + metadata / subtitle / codec analyzers** → **`libs/file-viewers`** (extend `video-player`)  
> - **Record / trim / video→GIF** → **`libs/media-tools`**

**Purpose:** Inspect video containers, codecs, frames, and subtitles beyond simple playback.  
**Why build:** Media QA and forensics need metadata, stream, and frame-level tools.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **Video Viewer** | `.mp4`, `.avi`, `.mkv` | Playback | Media preview |
| **Video Metadata Viewer** | `.mp4`, `.mkv`, `.avi` | Container tags | Streams, duration, tags |
| **MP4 Analyzer** | `.mp4`, `.m4v` | MP4 atoms | Box/atom tree |
| **MKV Metadata Viewer** | `.mkv` | Matroska | Tracks, chapters |
| **Subtitle Viewer** | `.srt`, `.vtt` | Captions | Timed text preview |
| **Frame Sequence / Analyzer Viewer** | video / image seq | Frame scrub | Frame-by-frame QA |
| **Codec Information / Analyzer Viewer** | video files | Codec details | Profile, level, bitrate |
| **Video Stream Analyzer** | containers | Stream inspect | A/V sync, stream map |

---

## 20. Document / Design

> **Target category module split:**  
> - **Document/image preview** → **`libs/file-viewers`** (many already exist)  
> - **PDF mutate** → **`libs/pdf-tools`**  
> - **Image mutate / OCR** → **`libs/image-color-tools`**  
> - **Draw.io / Visio / Mind Map / Lucidchart** → **`libs/diagram-viewers`**

**Purpose:** Render documents and design files as readable, navigable previews.  
**Why build:** Users expect open-and-read for docs and design handoffs — not download-only.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **PDF Viewer** | `.pdf` | Universal docs | Read, search, annotate |
| **Word Viewer** | `.doc`, `.docx` | Office documents | Document preview |
| **PowerPoint Viewer** | `.ppt`, `.pptx` | Presentations | Slide preview |
| **OpenDocument Viewer** | `.odt`, `.ods`, `.odp` | LibreOffice / ODF | Open standards docs |
| **RTF Viewer** | `.rtf` | Legacy rich text | Legacy document support |
| **EPUB Viewer** | `.epub` | E-books | Reflowable reading |
| **MOBI Viewer** | `.mobi` | Kindle formats | E-book compatibility |
| **Markdown Viewer** | `.md` | Docs-as-code | Rendered markdown |
| **LaTeX Viewer** | `.tex` | Academic writing | Source + preview |
| **Image Viewer** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | Everyday images | Gallery / zoom |
| **SVG Viewer** | `.svg` | Vector graphics | DOM / layer inspect |
| **TIFF Viewer** | `.tif`, `.tiff` | Multi-page / high bit-depth | Print / archival |
| **RAW Image Viewer** | `.raw`, `.cr2`, `.nef`, `.arw` | Camera RAW | Photography review |
| **HEIC Viewer** | `.heic` | Apple photos | Mobile photo preview |
| **PSD Viewer** | `.psd` | Photoshop | Layer-aware preview |
| **AI File Viewer** | `.ai` | Illustrator | Design asset preview |
| **Figma Export Viewer** | Figma exports | Design handoff | Frames / components |
| **Sketch File Viewer** | `.sketch` | Sketch app | Artboards preview |
| **InDesign Viewer** | `.indd`, `.idml` | Print layout | Page layout preview |
| **Visio Viewer** | `.vsdx` | Diagrams | Interactive Visio |
| **Draw.io Viewer** | `.drawio` | diagrams.net | Flow / arch diagrams |
| **Lucidchart Viewer** | Lucid exports | Collaboration diagrams | Imported chart view |
| **Flowchart Viewer** | `.drawio`, `.vsdx` | Process / flow diagrams | Interactive flowcharts |
| **Mind Map Viewer** | `.xmind`, `.mm` | Mind maps | Hierarchy navigation |

---

## 21. AI / Machine Learning Model

> **Target category module:** **`libs/ml-viewers`** *(create new category)*. Pickle viewer must be **safe/metadata-only** (no code execution).

**Purpose:** Inspect model graphs, layers, tensors, and ML experiment artifacts.  
**Why build:** Model files are opaque binaries; engineers need architecture and tensor metadata views.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **ONNX Viewer** | `.onnx` | Cross-framework models | Ops graph, tensors |
| **TensorFlow Graph / Model Viewer** | `.pb`, `.h5`, SavedModel | TF graphs | Node/op graph |
| **PyTorch Model Viewer** | `.pt`, `.pth` | PyTorch checkpoints | Module tree / tensors |
| **Keras Model Viewer** | `.h5`, `.keras` | Keras models | Layer summary |
| **Pickle Viewer** | `.pkl` | Serialized Python (safe mode) | Artifact inspection |
| **MLflow Model Viewer** | model files / ML artifacts | Experiment models | Artifact + signature |
| **Neural Network Graph Viewer** | model graphs | Generic NN graph | Interactive net graph |
| **Model Architecture Viewer** | multi-framework | Architecture summary | Layers, params, shapes |
| **Tensor Visualization Viewer** | tensor dumps | Weight/activation viz | Heatmaps / histograms |

---

## 22. Gaming / Virtual World

> **Target category module:** **`libs/file-viewers`** (reuse 3D shell). Optional later: `gaming-viewers` if volume warrants a nav category.

**Purpose:** Inspect game worlds, assets, saves, replays, and shaders.  
**Why build:** Game binaries and world formats need specialized parsers and visual maps.

| Tool | Typical Extensions / Input | Why to Use | Purpose / Key Features |
| ---- | -------------------------- | ---------- | ---------------------- |
| **Minecraft World Viewer** | `.mca`, `.dat` | Minecraft worlds | Chunk / map view |
| **Unity Asset Viewer** | `.asset`, asset bundles | Unity content | Asset inspect |
| **Unreal Asset Viewer** | `.uasset` | Unreal content | Asset inspect |
| **Game Save Viewer** | various saves | Save debugging | Structure browse |
| **Game Replay Viewer** | replay files | Match review | Playback analysis |
| **Level Map Viewer** | level / map files | Level design | Top-down / 3D level |
| **Shader Viewer** | `.glsl`, `.hlsl`, `.shader` | Shader code / preview | Shader compile / preview |

---

## 23. Enterprise / Business

> **Target category module:** **`libs/file-viewers`** (export explorers); reuse `pdf-viewer` / `excel-viewer` where formats overlap.

**Purpose:** Readable views of enterprise exports, audits, finance, and contracts.  
**Why build:** Compliance and business exports are dense; specialized viewers speed audits and ops.

| Tool | Typical Input | Why to Use | Purpose / Key Features |
| ---- | ------------- | ---------- | ---------------------- |
| **SAP Export Viewer** | SAP exports | ERP data | Tables / docs preview |
| **Salesforce Data Viewer** | SFDC exports | CRM data | Object / field browse |
| **ServiceNow Export Viewer** | SNOW exports | ITSM data | Incident / CMDB views |
| **Audit Log Viewer** | JSON / logs | Audit trails | Time-based audit search |
| **Compliance Report Viewer** | GRC reports | Compliance | Control / finding views |
| **Financial Statement Viewer** | finance exports | Statements | P&L / balance structure |
| **Invoice Data Viewer** | invoice XML/PDF/JSON | AP/AR | Line items & totals |
| **Contract Document Viewer** | contracts | Legal ops | Clause-oriented preview |
| **SAP Log Viewer** | SAP exports | ERP operational logs | SAP ops / audit |
| **ServiceNow Log Viewer** | ServiceNow exports | ITSM event logs | Service management |

---

## 24. Graph / Network Data Formats

> **Target category module:** **`libs/diagram-viewers`** (shared graph canvas).

**Purpose:** Render graph datasets with layout, communities, and relationship exploration.  
**Why build:** Nodes/edges without layout are unreadable; users need interactive network visualization.

| Tool Name | File Types | Purpose | Why to Use |
| --------- | ---------- | ------- | ---------- |
| **Graphviz DOT Viewer** | `.dot`, `.gv` | Graph rendering | Render DOT graphs without Graphviz desktop |
| **GraphML Viewer** | `.graphml` | Network graphs | Standard XML graph exchange |
| **GEXF Viewer** | `.gexf` | Dynamic networks | Time-varying social/network graphs |
| **GDF Viewer** | `.gdf` | Graph datasets | GUESS/Gephi-style datasets |
| **Pajek Network Viewer** | `.net` | Social/network graphs | Classic SNA format |
| **UCINET Viewer** | `.dl` | Social network analysis | UCINET DL matrices |
| **TGF Viewer** | `.tgf` | Simple graphs | Trivial Graph Format |
| **LEDA Graph Viewer** | `.leda` | Mathematical graphs | LEDA graph structures |
| **GraphSON Viewer** | `.json` (GraphSON) | Graph databases | TinkerPop/Gremlin exchange |
| **GML Viewer** | `.gml` | Graph modeling language | GML network files |

---

## 25. Diagram Languages (UML, PlantUML, Mermaid, C4)

> **Target category module:** **`libs/diagram-viewers`**. Markdown-embedded Mermaid may also deepen `file-viewers/markdown-previewer`.

**Purpose:** Interactive rendering of text- and XML-based architecture/diagram languages.  
**Why build:** Diagram source is not the deliverable — rendered, clickable diagrams are.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **UML Viewer** | `.uml` | UML models | Multi-diagram UML browse |
| **Class Diagram Viewer** | `.uml`, `.xmi` | OO design | Classes, associations, inheritance |
| **Sequence Diagram Viewer** | `.puml`, `.plantuml` | Interactions | Lifelines, messages |
| **PlantUML Viewer** | `.puml` | Text-to-UML | Instant PlantUML render |
| **Mermaid Diagram Viewer** | `.mmd`, `.mermaid` | Docs-as-diagrams | Flowcharts, sequence, ER, etc. |
| **Architecture Diagram Viewer** | `.drawio`, `.archimate` | Enterprise architecture | ArchiMate / arch canvases |
| **C4 Model Viewer** | `.dsl`, `.puml` | C4 architecture | Context, container, component views |

---

## 26. Business Process & Decision Models (BPMN / DMN / EPC)

> **Target category module:** **`libs/process-viewers`**.

**Purpose:** Visualize process and decision notations used in BPM suites.  
**Why build:** BPMN/DMN/EPC are XML models that only make sense as diagrams and decision tables.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **BPMN Viewer** | `.bpmn` | Process diagrams | Interactive BPMN canvas |
| **DMN Viewer** | `.dmn` | Decision models | DRD + decision tables |
| **EPC Diagram Viewer** | `.epml` | Event-driven chains | EPC process maps |
| **Workflow Diagram Viewer** | workflow XML | Generic workflows | Cross-engine workflow UX |
| **Process Map Viewer** | `.xes`, `.bpmn` | Process maps | Discovered or designed maps |
| **Decision Model Viewer** | `.dmn` | Business decisions | Decision requirements diagrams |

---

## 27. Database Schema & ER Diagrams

> **Target category module:** **`libs/diagram-viewers`**. SQL format helpers (if any) → `data-converters`.

**Purpose:** Show database structure as ER diagrams and schema explorers.  
**Why build:** SQL/DDL and schema DSLs hide relationships that ER graphs make obvious.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **ER Diagram Viewer** | `.erd` | Classic ER models | Entities & relationships |
| **SQL Schema Viewer** | `.sql` | DDL / schema dumps | Tables, FKs, indexes |
| **Database Diagram Viewer** | `.dbml` | Schema diagrams | Visual DB design |
| **DBML Viewer** | `.dbml` | Database Markup Language | dbdiagram-style render |
| **Prisma Schema Viewer** | `.prisma` | Prisma ORM schema | Models, relations, enums |
| **Graph Database Viewer** | Neo4j exports | Property graphs | Node/rel browse |
| **Cypher Graph Viewer** | `.cypher` | Neo4j queries/graphs | Query result graphs |

---

## 28. Knowledge Graphs & Semantic Web

> **Target category module:** **`libs/diagram-viewers`** (graph canvas + triple browser).

**Purpose:** Explore RDF/OWL ontologies and linked-data graphs visually.  
**Why build:** Triples and ontologies are hard to reason about as raw text; graphs and class trees help.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **RDF Viewer** | `.rdf` | Resource Description Framework | Triple / graph view |
| **OWL Ontology Viewer** | `.owl` | Ontologies | Classes, properties, axioms |
| **Turtle Viewer** | `.ttl` | RDF Turtle | Readable RDF browse |
| **N-Triples Viewer** | `.nt` | RDF N-Triples | Line-oriented triple inspect |
| **Knowledge Graph Viewer** | graph exports | KG exploration | Entities, relations, paths |

---

## 29. Timelines & Event Streams

> **Target category module split:** process/event mining timelines → **`process-viewers`**; generic logs → **`file-viewers/log-viewer`**; network timelines → **`network-viewers`**; source code → `file-viewers` or `code-file-tools`.

**Purpose:** Time-ordered exploration of logs, audits, and activity streams.  
**Why build:** Event investigation is temporal — tables alone miss sequence and concurrency.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **XES Viewer** | `.xes` | Process mining events | Traces, variants, timelines |
| **Event Log Viewer** | `.xes`, `.csv` | Generic event logs | Case / activity tables |
| **JSON Timeline Viewer** | `.json` | Timestamped JSON events | Interactive timeline |
| **Audit Trail Viewer** | logs | Compliance audits | Who/what/when search |
| **Activity Stream Viewer** | event files | Product/activity feeds | Chronological activity UI |
| **Log Timeline Viewer** | `.log` | Ops investigation | Time-based log scrubbing |
| **Log Viewer** | `.log` | Structured / unstructured logs | Search, filter, highlight |
| **Nginx Log Viewer** | `.log` | Nginx access/error | Web traffic analysis |
| **Apache Log Viewer** | `.log` | Apache access/error | Web traffic analysis |
| **Docker Log Viewer** | `.json` | Container logs | Container debugging |
| **Git Diff Viewer** | `.diff`, `.patch` | Patches | Diff visualization |
| **Git Repository Viewer** | `.git` | Repo structure | History / tree explore |
| **Source Code Viewer** | `.js`, `.ts`, `.java`, `.py`, … | Code reading | Syntax highlight + nav |

---

## 30. Mind Maps & Concept Maps

> **Target category module:** **`libs/diagram-viewers`**.

**Purpose:** Navigate hierarchical and conceptual knowledge maps interactively.  
**Why build:** Mind-map XML/JSON dumps are useless without spatial hierarchy UI.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **Mind Map Viewer** | `.xmind` | XMind maps | Expand/collapse hierarchy |
| **FreeMind Viewer** | `.mm` | FreeMind maps | Classic mind-map browse |
| **Freeplane Viewer** | `.mm` | Freeplane maps | Freeplane-compatible `.mm` |
| **Concept Map Viewer** | `.cmap` | Concept maps | Labeled concept relations |

---

## 31. Decision Rules & State Machines

> **Target category module:** **`libs/process-viewers`** (DMN/Drools with BPM) and **`libs/diagram-viewers`** (statecharts / automata diagrams).

**Purpose:** Visualize decision tables, rule engines, and state/transition models.  
**Why build:** Rules and automata are logic structures — users need tables, trees, and state diagrams.

| Tool Name | File Types | Why to Use | Purpose / Key Features |
| --------- | ---------- | ---------- | ---------------------- |
| **DMN Viewer** | `.dmn` | Decision notation | Decision tables / DRD |
| **Decision Tree Viewer** | `.json` | Decision trees | Tree navigation / paths |
| **Rule Engine Viewer** | `.drl` | Rule bases | Rule browse / groups |
| **Drools Rule Viewer** | `.drl` | Drools rules | DRL structure view |
| **State Machine Viewer** | `.scxml` | SCXML statecharts | States & transitions |
| **Finite Automata Viewer** | `.dot`, custom | Automata | States, alphabet, acceptors |
| **UML State Diagram Viewer** | `.uml` | UML state machines | Statechart rendering |
| **Petri Net Viewer** | `.pnml` | Concurrent systems | Places, transitions, tokens |
| **Markov Model Viewer** | model files | Stochastic models | States + transition probs |

---

## 32. Suggested Implementation Priority

Create the **category lib first** (when starting that vertical), then ship tools into it — same architecture as existing categories.

| Priority | Focus | Create category lib | First tools |
| -------- | ----- | ------------------- | ----------- |
| **P0** | Process | **`process-viewers`** | BPMN; migrate XES from `file-viewers` |
| **P0** | Data explore | **`data-explorers`** | Parquet |
| **P0** | Network | **`network-viewers`** | HAR, then PCAP |
| **P1** | GIS | **`gis-viewers`** | GeoJSON, GPX, Shapefile |
| **P1** | CAD | **`cad-viewers`** | DXF, DWG, STEP |
| **P1** | General 3D | `file-viewers` (existing) | STL/OBJ/GLTF via `3d-model-viewer` |
| **P2** | Medical | **`medical-viewers`** | DICOM, NIfTI |
| **P2** | Science | **`science-viewers`** | NetCDF, HDF5 |
| **P2** | BIM / LiDAR | `cad-viewers` + `gis-viewers` | IFC, Point Cloud, LAS |
| **P3** | Diagrams / IaC | **`diagram-viewers`** | Mermaid, PlantUML, DOT, Terraform graph |
| **P3** | ML models | **`ml-viewers`** | ONNX |
| **P3** | Identity utils | `testing-tools` / `security-tools` | Deepen JWT; cert/PEM utilities |
| **P4** | Deep verticals | existing new cats | SEG-Y, Gerber, WSI, DMN |
| **P5** | Long tail | `file-viewers` (or later cats) | Gaming, blockchain, enterprise |

### Shared building blocks (own inside the category that needs them)

| Building Block | Owning category lib | Reused by |
| -------------- | ------------------- | --------- |
| **Table + schema explorer** | **`data-explorers`** (+ Excel in `file-viewers`) | Parquet, Avro, SQLite, DuckDB, … |
| **Graph / network canvas** | **`diagram-viewers`** (+ process/ml as needed) | DOT, GraphML, UML, C4, RDF, deps |
| **Process / timeline UI** | **`process-viewers`** | XES, BPMN analytics, DMN-related timelines |
| **Map engine** | **`gis-viewers`** | GeoJSON, GPX, KML, Shapefile, GeoTIFF |
| **3D mesh engine** | **`file-viewers`** (`3d-model-viewer`) | STL, OBJ, GLTF, PLY |
| **CAD 2D + BIM 3D** | **`cad-viewers`** | DWG, DXF, IFC, Gerber, STEP |
| **Diagram render engine** | **`diagram-viewers`** | PlantUML, Mermaid, Draw.io, mind maps |
| **Decision / state UI** | **`process-viewers`** / **`diagram-viewers`** | DMN, Drools, SCXML |
| **Waveform / spectrum** | `file-viewers` (+ `media-tools` capture) | WAV, MIDI; ECG/EEG → `medical-viewers` |
| **Volume / slice viewer** | **`medical-viewers`** / **`science-viewers`** | DICOM, NIfTI, NetCDF, HDF5 |
| **Packet / protocol UI** | **`network-viewers`** | PCAP, PCAPNG, HAR |

If two categories need the same engine later, extract a shared shell lib — do **not** block creating categories for that reason.

---

## 33. Placement by Module (Master Index)

### Existing: `libs/file-viewers` — general File Viewers

| Family | Tools | Note |
| ------ | ----- | ---- |
| Shipped | Image, PDF, Word, PPT, Text, Markdown, Excel, Log, Audio, Font, Archive, **XES** | XES → migrate to `process-viewers` |
| Coming soon | Video player, 3D model viewer | General media / mesh |
| Stay here | EPUB, MOBI, LaTeX, SVG, PSD, AI, APK/IPA/ELF/PE, gaming/blockchain long-tail, enterprise export explorers | General preview |
| Do **not** add new | DICOM, DWG, GeoJSON, PCAP, Parquet, ONNX, BPMN, … | Use planned category libs |

### Existing: intent libs (not domain viewers)

| Lib | Owns |
| --- | ---- |
| **`data-converters`** | CSV↔JSON, YAML↔JSON, JSON format/lint, Excel→JSON, MD→HTML (already) |
| **`testing-tools`** | JWT decoder (extend JWK/OAuth), JSON Schema validator |
| **`security-tools`** | Hash/password/encrypt utilities; cert fingerprint helpers |
| **`pdf-tools`** | PDF mutate only |
| **`image-color-tools`** | Image mutate / OCR |
| **`media-tools`** | Record / trim / convert A/V |
| **`code-file-tools`** | Minify, clipboard, metadata; optional source viewer |
| **`dev-design-tools`** | Live HTTP/CSS — **not** HAR file viewer |

### Planned category libs (create; see §34)

| Lib | Owns (representative) |
| --- | --------------------- |
| **`cad-viewers`** | DWG, DXF, DGN, STEP, IGES, IFC/BIM, Gerber, PCB, vendor CAD |
| **`gis-viewers`** | GeoJSON, Shapefile, KML/KMZ, GPX, GeoTIFF, DEM, MBTiles, LiDAR/point cloud maps |
| **`medical-viewers`** | DICOM, NIfTI, WSI, FHIR, HL7, ECG/EEG |
| **`science-viewers`** | NetCDF, HDF5, FITS, GRIB, SEG-Y, well logs, FASTA/VCF, molecules |
| **`network-viewers`** | HAR, PCAP/PCAPNG, protocol analyzers, Nmap/Nessus/SARIF/malware reports |
| **`process-viewers`** | XES (migrated), BPMN, PNML, BPEL, DMN, EPC, process timelines |
| **`diagram-viewers`** | PlantUML, Mermaid, DOT, UML/C4, GraphML/GEXF, mind maps, ER/DBML, IaC graphs |
| **`data-explorers`** | Parquet, Avro, ORC, Feather, Arrow, Delta, SQLite, DuckDB |
| **`ml-viewers`** | ONNX, TF/PyTorch/Keras graphs, MLflow |

### Not used for this roadmap

| Lib | Why |
| --- | --- |
| `text-utilities` | Text transforms |
| `math-date-utils` | Optional coordinate calculator only |
| `browser-utils` / `fun-tools` | Unrelated |
| `features-home` | Shell only |

---

## 34. Planned New Category Modules

**Policy:** New category modules are **first-class** architecture — create them when starting that vertical’s first tool. Do **not** park CAD/GIS/medical/etc. permanently under `file-viewers`.

### Category catalog (to create)

| Lib folder | Route parent | Alias | Suggested CATEGORY_META name | Description (nav/SEO) | First tool to unlock lib |
| ---------- | ------------ | ----- | ---------------------------- | --------------------- | ------------------------ |
| `cad-viewers` | `/cad-viewers` | `@tools-workspace/cad-viewers` | CAD & Engineering Viewers | Open DWG, DXF, STEP, IFC, and PCB files in the browser | DXF or DWG Viewer |
| `gis-viewers` | `/gis-viewers` | `@tools-workspace/gis-viewers` | GIS & Mapping Viewers | Explore GeoJSON, GPX, Shapefiles, and maps online | GeoJSON Viewer |
| `medical-viewers` | `/medical-viewers` | `@tools-workspace/medical-viewers` | Medical & Healthcare Viewers | DICOM, NIfTI, FHIR, and clinical file viewers | DICOM Viewer |
| `science-viewers` | `/science-viewers` | `@tools-workspace/science-viewers` | Scientific Data Viewers | NetCDF, HDF5, FITS, seismic, and research datasets | NetCDF or HDF5 Viewer |
| `network-viewers` | `/network-viewers` | `@tools-workspace/network-viewers` | Network & Traffic Viewers | HAR, PCAP, and protocol analysis in the browser | HAR Viewer |
| `process-viewers` | `/process-viewers` | `@tools-workspace/process-viewers` | Process & Workflow Viewers | XES, BPMN, and process mining tools | BPMN Viewer (+ migrate XES) |
| `diagram-viewers` | `/diagram-viewers` | `@tools-workspace/diagram-viewers` | Diagram & Graph Viewers | Mermaid, PlantUML, Graphviz, UML, and mind maps | Mermaid or PlantUML Viewer |
| `data-explorers` | `/data-explorers` | `@tools-workspace/data-explorers` | Data Explorers | Browse Parquet, Avro, SQLite, and columnar files | Parquet Viewer |
| `ml-viewers` | `/ml-viewers` | `@tools-workspace/ml-viewers` | ML Model Viewers | Inspect ONNX and other ML model graphs | ONNX Viewer |

Optional later (only if nav demand appears): `blockchain-viewers`, `gaming-viewers`.

### Create-category checklist (match existing libs)

1. Generate library under `libs/<category-slug>/` (Angular standalone, selector prefix `lib`, same layout: `component/`, `utils/`, `types/`, `constants/`)
2. `tsconfig.base.json` paths: barrel + `"@tools-workspace/<category-slug>/*": ["libs/<category-slug>/src/lib/component/*"]`
3. `CATEGORY_META` in `apps/tools-site/scripts/lib/extract-routes.js`:
   - `name`, `description`, `faIcon`, `materialIcon`
4. `loadChildren` in `apps/tools-site/src/app/app.routes.ts` plus `src/app/routes/<category-slug>.routes.ts` with deep `loadComponent` imports
5. Export tools from `libs/<category-slug>/src/index.ts`
6. `npx nx run tools-site:generate-sitemap` (SEO catalog + sitemap + prerender)
7. Optional: AutoGA map, footer curated category lists in `features-home`

### Migrate existing tool into a new category (e.g. XES → `process-viewers`)

1. Create `process-viewers` lib + category meta + route parent
2. Move `xes-viewer` component/utils/types/constants into the new lib (or re-export temporarily)
3. Point route from `/process-viewers/xes-viewer` (and redirect old `/file-viewers/xes-viewer` if needed for SEO)
4. Update `file-viewers` `index.ts` exports; regenerate catalog

### Suggested CATEGORY_META icon hints

| Category | faIcon (hint) | materialIcon (hint) |
| -------- | ------------- | ------------------- |
| `cad-viewers` | `fas fa-drafting-compass` | `architecture` |
| `gis-viewers` | `fas fa-map-marked-alt` | `map` |
| `medical-viewers` | `fas fa-notes-medical` | `medical_services` |
| `science-viewers` | `fas fa-flask` | `science` |
| `network-viewers` | `fas fa-network-wired` | `lan` |
| `process-viewers` | `fas fa-project-diagram` | `account_tree` |
| `diagram-viewers` | `fas fa-sitemap` | `schema` |
| `data-explorers` | `fas fa-table` | `table_chart` |
| `ml-viewers` | `fas fa-brain` | `psychology` |

---

## Notes

- This document is a **product/engineering backlog + module placement guide**, not a commitment that every viewer will ship.
- Architecture: **1 category = 1 lib = 1 route parent = 1 `CATEGORY_META` entry**. New verticals get **new category modules** ([§0.2](#02-planned-new-category-modules-create-as-first-class-libs), [§34](#34-planned-new-category-modules)).
- **`file-viewers`** remains the **general** File Viewers category (office, docs, media, archive, generic 3D) — not a dumping ground for every specialized vertical.
- Intent libs stay intent-based: convert → `data-converters`; mutate → `pdf-tools` / `image-color-tools` / `media-tools`; decode → `testing-tools`; crypto utils → `security-tools`.
- For regulated domains (healthcare, security, aviation CAD), treat accuracy, privacy, and non-execution of untrusted binaries as hard requirements.
- Deduplicate overlapping formats by **content detection**, not extension alone.
- Use the [Highest Opportunity Shortlist](#3-highest-opportunity-shortlist-seo--uniqueness--ai-resistance) for sequencing; create the listed category lib when starting that tool.
- Registration: category lib (if new) → tool component → `index.ts` → `apps/tools-site/src/app/routes/<category>.routes.ts` (deep import) → `npx nx run tools-site:generate-sitemap`.
