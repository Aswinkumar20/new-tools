// AUTO-GENERATED — do not edit manually.
// Regenerate: node apps/tools-site/scripts/generate-tool-seo-catalog.js

export interface ToolCatalogEntry {
  name: string;
  description: string;
  path: string;
}

export interface ToolCategoryCatalog {
  name: string;
  description: string;
  path: string;
  faIcon: string;
  materialIcon: string;
  subCategories: ToolCatalogEntry[];
}

/** Routed tools only — synced with app.routes.ts */
export const TOOL_CATEGORIES: ToolCategoryCatalog[] = [
  {
    name: 'System / Browser Utilities',
    description: 'System information and browser tools',
    path: 'browser-utils',
    faIcon: 'fas fa-desktop',
    materialIcon: 'computer',
    subCategories: [
      {
        name: 'Screen Resolution Info',
        description: 'Surface dimensions, DPR, and orientation details.',
        path: '/browser-utils/screen-resolution-info',
      },
      {
        name: 'Battery Status Viewer',
        description: 'Monitor charging state and capacity in real time.',
        path: '/browser-utils/battery-status-viewer',
      },
      {
        name: 'Device Orientation Logger',
        description: 'Track motion data for hardware testing.',
        path: '/browser-utils/device-orientation-logger',
      },
      {
        name: 'Storage Viewer',
        description: 'Explore localStorage and sessionStorage contents.',
        path: '/browser-utils/storage-viewer',
      },
      {
        name: 'Cookie Editor',
        description: 'Edit, delete, and clone cookies securely.',
        path: '/browser-utils/cookie-editor',
      },
      {
        name: 'Network Speed Test',
        description: 'Measure download, upload, and latency benchmarks.',
        path: '/browser-utils/network-speed-test',
      },
    ],
  },
  {
    name: 'CAD & Engineering Viewers',
    description: 'Open DWG, DXF, STEP, IFC, and PCB files in the browser.',
    path: 'cad-viewers',
    faIcon: 'fas fa-drafting-compass',
    materialIcon: 'architecture',
    subCategories: [
      {
        name: 'DWG Viewer',
        description: 'Inspect AutoCAD DWG layers, entities, and measurements locally from .dwg dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/dwg-viewer',
      },
      {
        name: 'DXF Viewer',
        description: 'Preview ASCII DXF drawings, layers, and entities locally from .dxf, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/dxf-viewer',
      },
      {
        name: 'DWF Viewer',
        description: 'Inspect Design Web Format published sheets and layers locally from .dwf dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/dwf-viewer',
      },
      {
        name: 'DGN Viewer',
        description: 'Review MicroStation DGN levels and civil features locally from .dgn dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/dgn-viewer',
      },
      {
        name: 'STEP Viewer',
        description: 'Inspect ISO 10303 STEP solids, products, and measurements locally from .step / .stp dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/step-viewer',
      },
      {
        name: 'IGES Viewer',
        description: 'Preview IGES surfaces and directory entities locally from .iges / .igs dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/iges-viewer',
      },
      {
        name: 'Parasolid Viewer',
        description: 'Inspect Parasolid XT solids, bodies, and measurements locally from .x_t / .x_b dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/parasolid-viewer',
      },
      {
        name: 'CATIA Viewer',
        description: 'Review Dassault CATIA parts and assemblies locally from .catpart / .catproduct dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/catia-viewer',
      },
      {
        name: 'SolidWorks Viewer',
        description: 'Inspect SolidWorks parts and assemblies locally from .sldprt / .sldasm dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/solidworks-viewer',
      },
      {
        name: 'Fusion 360 Viewer',
        description: 'Preview Fusion 360 bodies and components locally from .f3d dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/fusion-360-viewer',
      },
      {
        name: 'Inventor Viewer',
        description: 'Inspect Autodesk Inventor parts and assemblies locally from .ipt / .iam dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/inventor-viewer',
      },
      {
        name: 'Creo Viewer',
        description: 'Review PTC Creo parts and assemblies locally from .prt / .asm dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/creo-viewer',
      },
      {
        name: 'Rhino 3DM Viewer',
        description: 'Inspect Rhinoceros surfaces and layers locally from .3dm dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/rhino-3dm-viewer',
      },
      {
        name: 'SketchUp Viewer',
        description: 'Preview SketchUp groups and components locally from .skp dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/sketchup-viewer',
      },
      {
        name: 'PLT Plot Viewer',
        description: 'Preview HPGL/PLT vector plots and pens locally from .plt dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/plt-plot-viewer',
      },
      {
        name: 'HPGL Viewer',
        description: 'Inspect HP-GL plotter language layers and commands locally from .hpgl/.hgl dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/hpgl-viewer',
      },
      {
        name: 'Gerber File Viewer',
        description: 'Preview Gerber RS-274X copper, silk, and mask artwork locally from .gbr/.ger dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/gerber-file-viewer',
      },
      {
        name: 'PCB Layout Viewer',
        description: 'Inspect PCB layer stack, nets, tracks, and vias locally from .pcb dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/pcb-layout-viewer',
      },
      {
        name: 'KiCad Viewer',
        description: 'Preview KiCad board and schematic locally from .kicad_pcb/.kicad_sch dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/kicad-viewer',
      },
      {
        name: 'Eagle PCB Viewer',
        description: 'Inspect Eagle board and schematic locally from .brd/.sch dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/eagle-pcb-viewer',
      },
      {
        name: 'Altium PCB Viewer',
        description: 'Preview Altium copper layers and designators locally from .pcbdoc/.schdoc dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/altium-pcb-viewer',
      },
      {
        name: 'GDSII Layout Viewer',
        description: 'Inspect GDSII semiconductor layers and cells locally from .gds dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/gdsii-layout-viewer',
      },
      {
        name: 'IFC Viewer',
        description: 'Preview IFC OpenBIM buildings locally with elements, property sets, and discipline filters from .ifc dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/ifc-viewer',
      },
      {
        name: 'Revit Viewer',
        description: 'Inspect Revit families, types, and BIM instances locally from .rvt/.rfa dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/revit-viewer',
      },
      {
        name: 'Navisworks Viewer',
        description: 'Preview Navisworks coordination models locally with clash context, 3D navigate, and federated models from .nwd dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/navisworks-viewer',
      },
      {
        name: 'BIM Clash Viewer',
        description: 'Review BIM clash lists and 3D focus locally from clash report XML, IFC dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/bim-clash-viewer',
      },
      {
        name: 'Building Floor Plan Viewer',
        description: 'Inspect building floor-plan levels and rooms locally from IFC plan dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/building-floor-plan-viewer',
      },
      {
        name: 'MEP Model Viewer',
        description: 'Preview MEP mechanical, electrical, and plumbing models locally with discipline filters and 3D from IFC dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/mep-model-viewer',
      },
      {
        name: 'Structural Model Viewer',
        description: 'Inspect structural BIM members, sections, and properties locally from IFC dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/cad-viewers/structural-model-viewer',
      },
    ],
  },
  {
    name: 'File & Code Tools',
    description: 'Code formatting and file utilities',
    path: 'code-file-tools',
    faIcon: 'fas fa-code',
    materialIcon: 'code',
    subCategories: [
      {
        name: 'HTML Minifier',
        description: 'Reduce file size with whitespace-aware minification.',
        path: '/code-file-tools/html-minifier',
      },
      {
        name: 'CSS Minifier',
        description: 'Optimise stylesheets for production deployments.',
        path: '/code-file-tools/css-minifier',
      },
      {
        name: 'JavaScript Minifier',
        description: 'Compress scripts without breaking behaviour.',
        path: '/code-file-tools/javascript-minifier',
      },
      {
        name: 'HTML Entity Encoder',
        description: 'Escape HTML entities for safer rendering.',
        path: '/code-file-tools/html-entity-encoder',
      },
      {
        name: 'Clipboard Viewer',
        description: 'Inspect text, HTML, and images stored in your clipboard.',
        path: '/code-file-tools/clipboard-viewer',
      },
      {
        name: 'Clipboard History',
        description: 'Keep multiple snippets ready for reuse.',
        path: '/code-file-tools/clipboard-history',
      },
      {
        name: 'File Metadata Viewer',
        description: 'Understand file fingerprints right inside the browser.',
        path: '/code-file-tools/file-metadata-viewer',
      },
      {
        name: 'Markdown to PDF',
        description: 'Turn technical documentation into polished PDFs.',
        path: '/code-file-tools/markdown-to-pdf',
      },
      {
        name: 'HTML Table Exporter',
        description: 'Export tables to CSV, JSON, or Markdown.',
        path: '/code-file-tools/html-table-exporter',
      },
    ],
  },
  {
    name: 'JSON / Data Converters',
    description: 'Tools to convert, format, and validate JSON and data formats',
    path: 'data-converters',
    faIcon: 'fas fa-database',
    materialIcon: 'data_object',
    subCategories: [
      {
        name: 'JSON Formatter & Validator',
        description: 'Beautify, validate, and explore structured payloads effortlessly.',
        path: '/data-converters/json-formatter-beautifier-validator',
      },
      {
        name: 'CSV ↔ JSON',
        description: 'Switch between spreadsheets and APIs instantly.',
        path: '/data-converters/csv-to-json-json-to-csv',
      },
      {
        name: 'YAML ↔ JSON',
        description: 'Keep configuration files in sync across systems.',
        path: '/data-converters/yaml-to-json-json-to-yaml',
      },
      {
        name: 'HTML Table → JSON',
        description: 'Turn tabular content into structured objects.',
        path: '/data-converters/html-table-to-json',
      },
      {
        name: 'Markdown → HTML',
        description: 'Publish-ready markup from clean Markdown.',
        path: '/data-converters/markdown-to-html',
      },
      {
        name: 'JSON Linter Viewer',
        description: 'Surface syntax errors with contextual guidance.',
        path: '/data-converters/json-linter-viewer',
      },
      {
        name: 'Excel → JSON',
        description: 'Upload spreadsheets and export structured data.',
        path: '/data-converters/excel-to-json',
      },
      {
        name: 'JSON Parser & Explorer',
        description: 'Navigate nested structures with a live tree view.',
        path: '/data-converters/json-parser',
      },
    ],
  },
  {
    name: 'Data Explorers',
    description: 'Browse Parquet, Avro, SQLite, and columnar files.',
    path: 'data-explorers',
    faIcon: 'fas fa-table',
    materialIcon: 'table_chart',
    subCategories: [
      {
        name: 'Parquet Viewer',
        description: 'Explore Apache Parquet tables locally with schema, sample rows, and column profiling from .parquet, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/parquet-viewer',
      },
      {
        name: 'Avro Viewer',
        description: 'Inspect Apache Avro schemas and sample records locally from .avro, .avsc, or JSON — private browser tool for education and research.',
        path: '/data-explorers/avro-viewer',
      },
      {
        name: 'ORC Viewer',
        description: 'Explore Apache ORC tables locally with schema, preview rows, and stripe layout from .orc, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/orc-viewer',
      },
      {
        name: 'Feather Viewer',
        description: 'Inspect Feather / Arrow tables locally with schema and sample rows from .feather, .arrow, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/feather-viewer',
      },
      {
        name: 'Arrow Viewer',
        description: 'Explore Apache Arrow IPC tables locally with schema, record batches, and preview rows from .arrow, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/arrow-viewer',
      },
      {
        name: 'Delta Lake Viewer',
        description: 'Inspect Delta Lake table logs locally with versions, schema, and sample rows from .delta, _delta_log JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/delta-lake-viewer',
      },
      {
        name: 'SQLite Viewer',
        description: 'Browse SQLite databases locally with tables, CREATE TABLE SQL, and sample rows from .sqlite, .db, SQL dumps, or CSV — private browser tool for education and research.',
        path: '/data-explorers/sqlite-viewer',
      },
      {
        name: 'DuckDB Viewer',
        description: 'Explore DuckDB databases locally with tables, schema, and sample rows from .duckdb, SQL dumps, or CSV — private browser tool for education and research.',
        path: '/data-explorers/duckdb-viewer',
      },
      {
        name: 'CSV Viewer',
        description: 'Explore large CSV tables locally with column types, filters, dialect detection, and preview rows from .csv, JSON, or Markdown — private browser tool for education and research.',
        path: '/data-explorers/csv-viewer',
      },
      {
        name: 'TSV Viewer',
        description: 'Explore tab-separated tables locally with column types, schema, and preview rows from .tsv, .tab, JSON, or Markdown — private browser tool for education and research.',
        path: '/data-explorers/tsv-viewer',
      },
      {
        name: 'JSON Viewer',
        description: 'Explore JSON trees locally with path search, schema, JSONL, and table preview from .json, .jsonl, CSV, or Markdown — private browser tool for education and research.',
        path: '/data-explorers/json-viewer',
      },
      {
        name: 'XML Viewer',
        description: 'Explore XML documents locally with element nodes, attributes, and repeating-row preview from .xml, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/xml-viewer',
      },
      {
        name: 'YAML Viewer',
        description: 'Explore YAML trees locally with path search, validation, and table preview from .yaml, .yml, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/yaml-viewer',
      },
      {
        name: 'TOML Viewer',
        description: 'Browse TOML tables and flattened keys locally with preview rows from .toml, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/toml-viewer',
      },
      {
        name: 'INI Viewer',
        description: 'Browse INI / conf sections and keys locally with preview rows from .ini, .cfg, JSON, or CSV — private browser tool for education and research.',
        path: '/data-explorers/ini-viewer',
      },
    ],
  },
  {
    name: 'Design & Web Dev Tools',
    description: 'CSS tools, responsive design helpers, and web dev utilities',
    path: 'dev-design-tools',
    faIcon: 'fas fa-laptop-code',
    materialIcon: 'developer_mode',
    subCategories: [
      {
        name: 'CSS Gradient Generator',
        description: 'Craft brand-ready gradients with instant CSS output.',
        path: '/dev-design-tools/css-gradient-generator',
      },
      {
        name: 'Box Shadow Generator',
        description: 'Preview elevation tokens with live CSS.',
        path: '/dev-design-tools/box-shadow-generator',
      },
      {
        name: 'Border Radius Preview',
        description: 'Test corner radii across card layouts.',
        path: '/dev-design-tools/border-radius-preview',
      },
      {
        name: 'Pixel to REM',
        description: 'Translate measurements into scalable typography.',
        path: '/dev-design-tools/pixel-to-rem',
      },
      {
        name: 'Responsive Breakpoint Tester',
        description: 'Validate breakpoints alongside device data.',
        path: '/dev-design-tools/responsive-breakpoint-tester',
      },
      {
        name: 'Viewport Size Detector',
        description: 'Inspect live viewport dimensions and media queries.',
        path: '/dev-design-tools/viewport-size-detector',
      },
      {
        name: 'Postman Lite',
        description: 'Send HTTP requests without leaving the browser.',
        path: '/dev-design-tools/postman-lite',
      },
      {
        name: 'CORS Test Tool',
        description: 'Test cross-origin request headers and CORS responses from any URL.',
        path: '/dev-design-tools/cors-test-tool',
      },
      {
        name: 'HTTP Header Decoder',
        description: 'Inspect and validate request headers instantly.',
        path: '/dev-design-tools/http-header-decoder',
      },
      {
        name: 'WebSocket Client',
        description: 'Connect to WebSocket endpoints, send messages, and inspect responses live.',
        path: '/dev-design-tools/websocket-client',
      },
      {
        name: 'HTTP Request Generator',
        description: 'Test endpoints with configurable payloads.',
        path: '/dev-design-tools/http-request-generator',
      },
      {
        name: 'Mock JSON Generator',
        description: 'Seed prototypes with realistic dataset templates.',
        path: '/dev-design-tools/mock-json-generator',
      },
    ],
  },
  {
    name: 'Diagram & Graph Viewers',
    description: 'Mermaid, PlantUML, Graphviz, UML, and mind maps.',
    path: 'diagram-viewers',
    faIcon: 'fas fa-sitemap',
    materialIcon: 'schema',
    subCategories: [
      {
        name: 'Mermaid Diagram Viewer',
        description: 'Render Mermaid flowcharts and sequence diagrams locally from .mmd, Markdown, JSON, or text — private browser tool for education and research.',
        path: '/diagram-viewers/mermaid-diagram-viewer',
      },
      {
        name: 'PlantUML Viewer',
        description: 'Preview PlantUML class and C4 diagrams locally from .puml, Markdown, JSON, or text — private browser tool for education and research.',
        path: '/diagram-viewers/plantuml-viewer',
      },
      {
        name: 'Graphviz DOT Viewer',
        description: 'Preview Graphviz DOT layouts locally with SVG export from .dot, .gv, Markdown, JSON, or text — private browser tool for education and research.',
        path: '/diagram-viewers/graphviz-dot-viewer',
      },
      {
        name: 'UML Viewer',
        description: 'Preview UML class and sequence diagrams locally from .uml, .puml, XMI, Markdown, JSON, or text — private browser tool for education and research.',
        path: '/diagram-viewers/uml-viewer',
      },
      {
        name: 'Class Diagram Viewer',
        description: 'Browse class types, attributes, operations, and relations locally from .puml, .uml, XMI, Markdown, JSON, or text — private browser tool for education and research.',
        path: '/diagram-viewers/class-diagram-viewer',
      },
      {
        name: 'Sequence Diagram Viewer',
        description: 'Preview sequence lifelines and messages locally from .puml, Mermaid, Markdown, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/sequence-diagram-viewer',
      },
      {
        name: 'Architecture Diagram Viewer',
        description: 'Browse architecture boxes and connectors locally from .puml, Mermaid, Markdown, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/architecture-diagram-viewer',
      },
      {
        name: 'C4 Model Viewer',
        description: 'Browse C4 context, container, and component models locally from PlantUML, Structurizr DSL, Markdown, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/c4-model-viewer',
      },
      {
        name: 'GraphML Viewer',
        description: 'Explore GraphML networks locally with rank layout and community detection from .graphml, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/graphml-viewer',
      },
      {
        name: 'GEXF Viewer',
        description: 'Explore GEXF dynamic networks locally with timeline slices and community detection from .gexf, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/gexf-viewer',
      },
      {
        name: 'Mind Map Viewer',
        description: 'Explore mind maps locally with collapse and search from Markdown, Mermaid, OPML, or JSON — private browser tool for education and research.',
        path: '/diagram-viewers/mind-map-viewer',
      },
      {
        name: 'FreeMind Viewer',
        description: 'Browse FreeMind .mm maps locally with tree layout and node notes from .mm, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/freemind-viewer',
      },
      {
        name: 'Freeplane Viewer',
        description: 'Browse Freeplane .mm maps locally with nodes, builtin icons, and attributes from .mm, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/freeplane-viewer',
      },
      {
        name: 'Concept Map Viewer',
        description: 'Explore concept maps locally with labeled nodes and links from CmapTools CXL, JSON, Markdown, or DOT — private browser tool for education and research.',
        path: '/diagram-viewers/concept-map-viewer',
      },
      {
        name: 'ER Diagram Viewer',
        description: 'Browse entity-relationship diagrams locally with entities, PK/FK keys, and cardinalities from PlantUML, Mermaid, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/er-diagram-viewer',
      },
      {
        name: 'DBML Viewer',
        description: 'Explore DBML schemas locally with tables and refs from .dbml, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/dbml-viewer',
      },
      {
        name: 'SQL Schema Viewer',
        description: 'Browse SQL DDL schemas locally with tables and foreign keys from CREATE TABLE, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/sql-schema-viewer',
      },
      {
        name: 'Prisma Schema Viewer',
        description: 'Explore Prisma schemas locally with models, @id/@unique fields, and relations from schema.prisma, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/prisma-schema-viewer',
      },
      {
        name: 'Draw.io Viewer',
        description: 'Browse draw.io diagrams locally with pages, shapes, connectors, and zoom from .drawio, .dio, XML, or SVG — private browser tool for education and research.',
        path: '/diagram-viewers/draw-io-viewer',
      },
      {
        name: 'Visio Viewer',
        description: 'Browse Visio diagrams locally with pages, shapes, and connectors from .vdx, Visio XML, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/visio-viewer',
      },
      {
        name: 'Terraform Graph Viewer',
        description: 'Explore Terraform graphs locally with resources and dependency edges from terraform graph DOT, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/terraform-graph-viewer',
      },
      {
        name: 'Kubernetes Architecture Viewer',
        description: 'Explore Kubernetes architecture locally with workloads, services, ingress routes, and selector links from YAML, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/kubernetes-architecture-viewer',
      },
      {
        name: 'Dependency Graph Viewer',
        description: 'Explore package dependency trees and cycles locally from package-lock.json, yarn.lock, package.json, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/dependency-graph-viewer',
      },
      {
        name: 'RDF Viewer',
        description: 'Explore RDF triples and graphs locally from Turtle, RDF/XML, N-Triples, JSON, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/rdf-viewer',
      },
      {
        name: 'OWL Ontology Viewer',
        description: 'Explore OWL ontologies locally with classes, object/datatype properties, and subclass axioms from .owl, Turtle, JSON, or XML — private browser tool for education and research.',
        path: '/diagram-viewers/owl-ontology-viewer',
      },
      {
        name: 'Knowledge Graph Viewer',
        description: 'Explore knowledge graphs locally with entities and relationship links from JSON, XML, CSV, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/knowledge-graph-viewer',
      },
      {
        name: 'State Machine Viewer',
        description: 'Explore SCXML and FSM diagrams locally with states, events, and transitions from .scxml, JSON, XML, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/state-machine-viewer',
      },
      {
        name: 'Decision Tree Viewer',
        description: 'Explore decision trees locally with branches, leaves, and split labels from JSON, XML, CSV, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/decision-tree-viewer',
      },
      {
        name: 'Drools Rule Viewer',
        description: 'Inspect Drools .drl rules and when-conditions locally from DRL, JSON, XML, or Markdown — private browser tool for education and research.',
        path: '/diagram-viewers/drools-rule-viewer',
      },
    ],
  },
  {
    name: 'File Viewers',
    description: 'Easily open, preview, and explore different file types directly in your browser.',
    path: 'file-viewers',
    faIcon: 'fas fa-file-alt',
    materialIcon: 'insert_drive_file',
    subCategories: [
      {
        name: 'Image Viewer',
        description: 'Preview formats from PNG to WebP without plugins.',
        path: '/file-viewers/image-viewer',
      },
      {
        name: 'PDF Viewer',
        description: 'Navigate documents with tabs, outlines, and zoom.',
        path: '/file-viewers/pdf-viewer',
      },
      {
        name: 'Word Viewer',
        description: 'Open and preview DOCX Word documents in your browser without installing Office.',
        path: '/file-viewers/word-viewer',
      },
      {
        name: 'PowerPoint Viewer',
        description: 'Preview PPTX presentations online with slides, notes, and zoom controls.',
        path: '/file-viewers/powerpoint-viewer',
      },
      {
        name: 'Text File Viewer',
        description: 'Open TXT, LOG, and plain-text files with search, wrap, and encoding support.',
        path: '/file-viewers/text-file-viewer',
      },
      {
        name: 'Markdown Previewer',
        description: 'Check headings, code blocks, and typography fast.',
        path: '/file-viewers/markdown-previewer',
      },
      {
        name: 'Excel Viewer',
        description: 'Inspect spreadsheet cells, formulas, and sheets.',
        path: '/file-viewers/excel-viewer',
      },
      {
        name: 'Log Viewer',
        description: 'Search and filter large logs in the browser.',
        path: '/file-viewers/log-viewer',
      },
      {
        name: 'Audio Player',
        description: 'Stream and scrub audio files instantly.',
        path: '/file-viewers/audio-player',
      },
      {
        name: 'Video Player',
        description: 'Review MP4, WEBM, and more with custom controls.',
        path: '/file-viewers/video-player',
      },
      {
        name: 'Font Viewer',
        description: 'Audit glyph sets before you embed fonts.',
        path: '/file-viewers/font-viewer',
      },
      {
        name: '3D Model Viewer',
        description: 'Inspect GLB, GLTF, and other 3D models with orbit, zoom, and lighting controls.',
        path: '/file-viewers/3d-model-viewer',
      },
      {
        name: 'Archive Viewer',
        description: 'Peek inside ZIP and TAR archives without extracting.',
        path: '/file-viewers/archive-viewer',
      },
      {
        name: 'XES Viewer',
        description: 'Open and explore XES process-mining event logs in your browser. Browse cases, events, activities, and variants with PM4JS — private and free.',
        path: '/file-viewers/xes-viewer',
      },
      {
        name: 'EPUB Viewer',
        description: 'Read EPUB chapters, table of contents, and typography locally from .epub dumps, store ZIP, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/epub-viewer',
      },
      {
        name: 'MOBI Viewer',
        description: 'Read Kindle MOBI/AZW chapters and table of contents locally from .mobi dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/mobi-viewer',
      },
      {
        name: 'LaTeX Viewer',
        description: 'Inspect LaTeX structure, preview, and source locally from .tex dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/latex-viewer',
      },
      {
        name: 'SVG Viewer',
        description: 'Inspect SVG shapes with zoom, pan, layers, and source locally from .svg dumps, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/svg-viewer',
      },
      {
        name: 'PSD Viewer',
        description: 'Inspect Photoshop layers, effects, and preview locally from .psd dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/psd-viewer',
      },
      {
        name: 'AI File Viewer',
        description: 'Inspect Adobe Illustrator artboards, layers, and preview locally from .ai dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/ai-file-viewer',
      },
      {
        name: 'HEIC Viewer',
        description: 'Inspect HEIC/HEIF frames, EXIF, and preview locally from .heic dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/heic-viewer',
      },
      {
        name: 'RAW Image Viewer',
        description: 'Inspect camera RAW EXIF, Bayer channels, and demosaic preview locally from CR2/NEF/ARW dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/raw-image-viewer',
      },
      {
        name: 'TIFF Viewer',
        description: 'Inspect multi-page TIFF pages, metadata, and zoom locally from .tif dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/tiff-viewer',
      },
      {
        name: 'OpenDocument Viewer',
        description: 'Inspect OpenDocument pages, sheets, and preview locally from .odt / .ods / .odp dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/opendocument-viewer',
      },
      {
        name: 'RTF Viewer',
        description: 'Inspect Rich Text formatting, preview, and export locally from .rtf dumps, JSON, or CSV — private browser tool for education and research.',
        path: '/file-viewers/rtf-viewer',
      },
      {
        name: 'ICS Calendar Viewer',
        description: 'Open and preview .ics / iCalendar files in your browser. Month, week, day, agenda, and year views with search, filters, recurrence, and timezones — strictly read-only.',
        path: '/file-viewers/ics-viewer',
      },
      {
        name: 'Subtitle Viewer',
        description: 'Free online subtitle viewer — fast, private, and browser-based.',
        path: '/file-viewers/subtitle-viewer',
      },
      {
        name: 'Midi Viewer',
        description: 'Free online midi viewer — fast, private, and browser-based.',
        path: '/file-viewers/midi-viewer',
      },
      {
        name: 'Musicxml Viewer',
        description: 'Free online musicxml viewer — fast, private, and browser-based.',
        path: '/file-viewers/musicxml-viewer',
      },
      {
        name: 'Apk Viewer',
        description: 'Free online apk viewer — fast, private, and browser-based.',
        path: '/file-viewers/apk-viewer',
      },
      {
        name: 'Ipa Viewer',
        description: 'Free online ipa viewer — fast, private, and browser-based.',
        path: '/file-viewers/ipa-viewer',
      },
      {
        name: 'Elf Binary Viewer',
        description: 'Free online elf binary viewer — fast, private, and browser-based.',
        path: '/file-viewers/elf-binary-viewer',
      },
      {
        name: 'Pe Binary Viewer',
        description: 'Free online pe binary viewer — fast, private, and browser-based.',
        path: '/file-viewers/pe-binary-viewer',
      },
      {
        name: 'Wav Spectrum Viewer',
        description: 'Free online wav spectrum viewer — fast, private, and browser-based.',
        path: '/file-viewers/wav-spectrum-viewer',
      },
      {
        name: 'Spectrogram Viewer',
        description: 'Free online spectrogram viewer — fast, private, and browser-based.',
        path: '/file-viewers/spectrogram-viewer',
      },
      {
        name: 'Minecraft World Viewer',
        description: 'Free online minecraft world viewer — fast, private, and browser-based.',
        path: '/file-viewers/minecraft-world-viewer',
      },
      {
        name: 'Unity Asset Viewer',
        description: 'Free online unity asset viewer — fast, private, and browser-based.',
        path: '/file-viewers/unity-asset-viewer',
      },
      {
        name: 'Game Save Viewer',
        description: 'Free online game save viewer — fast, private, and browser-based.',
        path: '/file-viewers/game-save-viewer',
      },
      {
        name: 'Nft Metadata Viewer',
        description: 'Free online nft metadata viewer — fast, private, and browser-based.',
        path: '/file-viewers/nft-metadata-viewer',
      },
      {
        name: 'Smart Contract Viewer',
        description: 'Free online smart contract viewer — fast, private, and browser-based.',
        path: '/file-viewers/smart-contract-viewer',
      },
      {
        name: 'Invoice Data Viewer',
        description: 'Free online invoice data viewer — fast, private, and browser-based.',
        path: '/file-viewers/invoice-data-viewer',
      },
      {
        name: 'Audit Log Viewer',
        description: 'Free online audit log viewer — fast, private, and browser-based.',
        path: '/file-viewers/audit-log-viewer',
      },
      {
        name: 'Figma Export Viewer',
        description: 'Free online figma export viewer — fast, private, and browser-based.',
        path: '/file-viewers/figma-export-viewer',
      },
      {
        name: 'Sketch File Viewer',
        description: 'Free online sketch file viewer — fast, private, and browser-based.',
        path: '/file-viewers/sketch-file-viewer',
      },
      {
        name: 'Indesign Viewer',
        description: 'Free online indesign viewer — fast, private, and browser-based.',
        path: '/file-viewers/indesign-viewer',
      },
    ],
  },
  {
    name: 'Fun & Productivity Tools',
    description: 'Entertainment and productivity helpers',
    path: 'fun-tools',
    faIcon: 'fas fa-gamepad',
    materialIcon: 'sports_esports',
    subCategories: [
      {
        name: 'QR Code Generator',
        description: 'Create scannable QR codes with custom content in seconds.',
        path: '/fun-tools/qr-code-generator',
      },
      {
        name: 'Barcode Generator',
        description: 'Produce retail-ready barcodes on demand.',
        path: '/fun-tools/barcode-generator',
      },
      {
        name: 'Stopwatch & Timer',
        description: 'Track precise durations and countdowns.',
        path: '/fun-tools/stopwatch-timer',
      },
      {
        name: 'Random Number Generator',
        description: 'Draw fair numbers for raffles and tests.',
        path: '/fun-tools/random-number-generator',
      },
      {
        name: 'Coin Toss & Dice Roller',
        description: 'Flip a coin or roll dice for quick random decisions and games.',
        path: '/fun-tools/coin-toss-dice-roller',
      },
      {
        name: 'Lorem Ipsum Generator',
        description: 'Generate placeholder Lorem Ipsum paragraphs for mockups and wireframes.',
        path: '/fun-tools/lorem-ipsum-generator',
      },
      {
        name: 'Timezone Converter',
        description: 'Plan meetings globally without confusion.',
        path: '/fun-tools/timezone-converter',
      },
      {
        name: 'Typing Speed Test',
        description: 'Benchmark typing speed with live analytics.',
        path: '/fun-tools/typing-speed-test',
      },
      {
        name: 'Pomodoro Timer',
        description: 'Stay on task with rhythm-based sprints.',
        path: '/fun-tools/pomodoro-timer',
      },
      {
        name: 'Flashcard Quiz Generator',
        description: 'Create study decks for any subject.',
        path: '/fun-tools/flashcard-quiz-generator',
      },
      {
        name: 'Motivational Quote Generator',
        description: 'Get inspired with curated daily quotes.',
        path: '/fun-tools/motivational-quote-generator',
      },
    ],
  },
  {
    name: 'GIS & Mapping Viewers',
    description: 'Explore GeoJSON, GPX, Shapefiles, and maps online.',
    path: 'gis-viewers',
    faIcon: 'fas fa-map-marked-alt',
    materialIcon: 'map',
    subCategories: [
      {
        name: 'GeoJSON Viewer',
        description: 'Open GeoJSON FeatureCollections on an interactive map. Inspect attributes, filter geometry types, and export CSV — private and free.',
        path: '/gis-viewers/geojson-viewer',
      },
      {
        name: 'Shapefile Viewer',
        description: 'Open ESRI Shapefiles (.shp/.dbf/.shx or .zip) on an interactive map. Inspect attributes, filter features, and export GeoJSON — private and free.',
        path: '/gis-viewers/shapefile-viewer',
      },
      {
        name: 'KML Viewer',
        description: 'Open KML placemarks, paths, and polygons on an interactive map. Inspect folders and attributes, then export GeoJSON — private and free.',
        path: '/gis-viewers/kml-viewer',
      },
      {
        name: 'KMZ Viewer',
        description: 'Open KMZ packages (zipped KML) on an interactive map. Inspect package contents, placemarks, and attributes — private and free.',
        path: '/gis-viewers/kmz-viewer',
      },
      {
        name: 'GPX Viewer',
        description: 'Open GPX tracks, routes, and waypoints on a map with elevation profile, distance, and activity stats — private and free.',
        path: '/gis-viewers/gpx-viewer',
      },
      {
        name: 'TopoJSON Viewer',
        description: 'Open TopoJSON topologies on an interactive map. Inspect objects and arcs, filter features, and export GeoJSON — private and free.',
        path: '/gis-viewers/topojson-viewer',
      },
      {
        name: 'GeoPackage Viewer',
        description: 'Open OGC GeoPackage (.gpkg) feature layers on an interactive map. Inspect attributes, switch layers, and export GeoJSON — private and free.',
        path: '/gis-viewers/geopackage-viewer',
      },
      {
        name: 'MBTiles Viewer',
        description: 'Open MBTiles packages on an interactive map. Inspect metadata, zoom range, and offline raster tiles — private and free.',
        path: '/gis-viewers/mbtiles-viewer',
      },
      {
        name: 'GeoTIFF Viewer',
        description: 'Open GeoTIFF rasters on an interactive map. Stretch bands, inspect georeferencing, and export PNG or metadata — private and free.',
        path: '/gis-viewers/geotiff-viewer',
      },
      {
        name: 'COG Viewer',
        description: 'Inspect Cloud Optimized GeoTIFF (COG) compliance, overviews, and windowed previews — upload locally or load a remote URL.',
        path: '/gis-viewers/cog-viewer',
      },
      {
        name: 'DEM Viewer',
        description: 'Open digital elevation GeoTIFF grids on a map. View height colormaps, hillshade, elevation stats, and click-to-sample height — private and free.',
        path: '/gis-viewers/dem-viewer',
      },
      {
        name: 'Terrain Viewer',
        description: 'Visualize terrain relief from elevation GeoTIFF — hillshade, contours, shaded relief, and vertical exaggeration in your browser.',
        path: '/gis-viewers/terrain-viewer',
      },
      {
        name: 'Contour Map Viewer',
        description: 'Generate isolines from elevation GeoTIFF or open contour GeoJSON. Adjust interval, labels, and DEM underlay — private and free.',
        path: '/gis-viewers/contour-map-viewer',
      },
      {
        name: 'GPS Track Viewer',
        description: 'Analyze GPS movement with speed-colored tracks, pace charts, moving time, and unit toggle — private and free.',
        path: '/gis-viewers/gps-track-viewer',
      },
      {
        name: 'Drone Flight Path Viewer',
        description: 'Preview drone flights with altitude-colored paths, climb rates, takeoff/landing markers, and telemetry — private and free.',
        path: '/gis-viewers/drone-flight-path-viewer',
      },
      {
        name: 'LiDAR Map Viewer',
        description: 'Open LAS point clouds on a 2D map. Color by classification, elevation, or intensity with class filters — private and free.',
        path: '/gis-viewers/lidar-map-viewer',
      },
      {
        name: 'Point Cloud Viewer',
        description: 'Orbit LAS, PLY, and PCD point clouds in 3D. Clip by elevation, color by intensity or RGB, and export XYZ — private and free.',
        path: '/gis-viewers/point-cloud-viewer',
      },
      {
        name: 'Satellite Image Viewer',
        description: 'Explore EO GeoTIFF imagery with true color, false color IR, stretch, and NDVI — private and free.',
        path: '/gis-viewers/satellite-image-viewer',
      },
      {
        name: 'Vector Tile Viewer',
        description: 'Decode Mapbox Vector Tiles (.mvt / .pbf) on a map. Inspect layers, attributes, and export GeoJSON — private and free.',
        path: '/gis-viewers/vector-tile-viewer',
      },
      {
        name: 'Raster Map Viewer',
        description: 'Open GeoTIFF or ASCII Grid rasters with stretch, band select, colormaps, and a color legend — private and free.',
        path: '/gis-viewers/raster-map-viewer',
      },
    ],
  },
  {
    name: 'Image & Color Tools',
    description: 'Image manipulation and color utilities',
    path: 'image-color-tools',
    faIcon: 'fas fa-palette',
    materialIcon: 'palette',
    subCategories: [
      {
        name: 'Image to Base64',
        description: 'Convert images to embeddable Base64 strings.',
        path: '/image-color-tools/image-to-base64',
      },
      {
        name: 'Image Resizer',
        description: 'Crop and scale assets with pixel-perfect control.',
        path: '/image-color-tools/image-resizer',
      },
      {
        name: 'Image Compressor',
        description: 'Optimise supporting media before publishing.',
        path: '/image-color-tools/image-compressor',
      },
      {
        name: 'Color Picker',
        description: 'Sample, harmonise, and store brand colours.',
        path: '/image-color-tools/color-picker',
      },
      {
        name: 'HEX ↔ RGB',
        description: 'Translate colour models instantly.',
        path: '/image-color-tools/hex-to-rgb',
      },
      {
        name: 'Gradient Generator',
        description: 'Design smooth gradients with CSS output.',
        path: '/image-color-tools/gradient-generator',
      },
      {
        name: 'Palette Generator',
        description: 'Build colour systems from images and inspiration shots.',
        path: '/image-color-tools/palette-generator',
      },
      {
        name: 'Image to Text (OCR)',
        description: 'Extract text from images with OCR — paste or upload and copy results.',
        path: '/image-color-tools/image-to-text',
      },
      {
        name: 'Favicon Generator',
        description: 'Create multi-size favicons and manifest icons.',
        path: '/image-color-tools/favicon-generator',
      },
      {
        name: 'Drawing Pad',
        description: 'Sketch UI ideas or annotate screenshots.',
        path: '/image-color-tools/drawing-pad',
      },
    ],
  },
  {
    name: 'Number & Date Tools',
    description: 'Calculators, converters, and date utilities',
    path: 'math-date-utils',
    faIcon: 'fas fa-calculator',
    materialIcon: 'calculate',
    subCategories: [
      {
        name: 'Unit Converter',
        description: 'Go between metric, imperial, and scientific units quickly.',
        path: '/math-date-utils/unit-converter',
      },
      {
        name: 'Number to Words Converter',
        description: 'Convert numbers into written words for checks, invoices, and documents.',
        path: '/math-date-utils/number-to-words',
      },
      {
        name: 'Percentage Calculator',
        description: 'Solve increase, decrease, and proportion questions.',
        path: '/math-date-utils/percentage-calculator',
      },
      {
        name: 'Age Calculator',
        description: 'Compute birthdays and anniversaries accurately.',
        path: '/math-date-utils/age-calculator',
      },
      {
        name: 'Date Difference',
        description: 'Count days, weeks, or months between key events.',
        path: '/math-date-utils/date-difference-calculator',
      },
      {
        name: 'Simple & Compound Interest',
        description: 'Model returns across time horizons.',
        path: '/math-date-utils/simple-compound-interest-calculator',
      },
      {
        name: 'BMI Calculator',
        description: 'Calculate body mass index from height and weight with clear category results.',
        path: '/math-date-utils/bmi-calculator',
      },
      {
        name: 'Loan EMI Calculator',
        description: 'Project repayments for mortgages and loans.',
        path: '/math-date-utils/loan-emi-calculator',
      },
      {
        name: 'Tip Calculator',
        description: 'Split bills fairly with friends or teams.',
        path: '/math-date-utils/tip-calculator',
      },
      {
        name: 'Currency Converter',
        description: 'Check live conversion rates for common currencies.',
        path: '/math-date-utils/currency-converter',
      },
      {
        name: 'Fraction Calculator',
        description: 'Add, subtract, multiply, and divide fractions with simplified results.',
        path: '/math-date-utils/fraction-calculator',
      },
      {
        name: 'Date to Day of Week',
        description: 'Find which weekday any date falls on — past, present, or future.',
        path: '/math-date-utils/date-to-day-of-week',
      },
      {
        name: 'Zodiac Finder',
        description: 'Discover astrological signs from any date.',
        path: '/math-date-utils/zodiac-finder',
      },
    ],
  },
  {
    name: 'Media & Audio Tools',
    description: 'Audio, video, and media utilities',
    path: 'media-tools',
    faIcon: 'fas fa-music',
    materialIcon: 'music_note',
    subCategories: [
      {
        name: 'Voice Recorder',
        description: 'Capture voice notes with local storage.',
        path: '/media-tools/voice-recorder',
      },
      {
        name: 'Audio Player',
        description: 'Preview tracks with waveform and timeline controls.',
        path: '/media-tools/audio-player',
      },
      {
        name: 'Audio Trimmer',
        description: 'Clip and export audio snippets right in your browser.',
        path: '/media-tools/audio-trimmer',
      },
      {
        name: 'Video to GIF',
        description: 'Create shareable loops without desktop software.',
        path: '/media-tools/video-to-gif',
      },
      {
        name: 'Webcam Snapshot',
        description: 'Take photos from your webcam in a click.',
        path: '/media-tools/webcam-snapshot',
      },
    ],
  },
  {
    name: 'Medical & Healthcare Viewers',
    description: 'DICOM, NIfTI, FHIR, and clinical file viewers.',
    path: 'medical-viewers',
    faIcon: 'fas fa-notes-medical',
    materialIcon: 'medical_services',
    subCategories: [
      {
        name: 'DICOM Viewer',
        description: 'Open DICOM images locally with window/level, multi-slice navigation, metadata, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/dicom-viewer',
      },
      {
        name: 'NIfTI Viewer',
        description: 'Open NIfTI (.nii / .nii.gz) volumes with ortho slices, windowing, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/nifti-viewer',
      },
      {
        name: 'MRI Viewer',
        description: 'Open MRI DICOM series locally with series picker, slice navigation, MRI window presets, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/mri-viewer',
      },
      {
        name: 'CT Scan Viewer',
        description: 'Open CT DICOM series locally with wheel scroll, HU probe, distance measure, CT window presets, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/ct-scan-viewer',
      },
      {
        name: 'X-Ray Viewer',
        description: 'Open radiograph DICOM (CR/DX/XR/RF) locally with zoom, pan, rotate, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/x-ray-viewer',
      },
      {
        name: 'Ultrasound Viewer',
        description: 'Open ultrasound DICOM locally with cine playback, frame slider, metadata table, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/ultrasound-viewer',
      },
      {
        name: 'Mammography Viewer',
        description: 'Open mammography DICOM (MG) locally with screening hanging layout (CC/MLO), zoom, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/mammography-viewer',
      },
      {
        name: 'PET Scan Viewer',
        description: 'Open PET DICOM locally with hot colormap, SUV probe, slice navigation, and PT+CT fuse overlay — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/pet-scan-viewer',
      },
      {
        name: 'NRRD Viewer',
        description: 'Open NRRD scientific volume grids locally with ortho slices, intensity histogram, window/level, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/nrrd-viewer',
      },
      {
        name: 'MINC Viewer',
        description: 'Open MINC 1 neuroimaging volumes locally with ortho slices, metadata table, window/level, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/minc-viewer',
      },
      {
        name: 'Pathology Slide Viewer',
        description: 'Open digital pathology slides locally with deep zoom, H&E stain presets, point/rectangle annotations, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/pathology-slide-viewer',
      },
      {
        name: 'Whole Slide Image Viewer',
        description: 'Open whole slide images locally with pyramid zoom, minimap navigation, region-of-interest tools, and PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/whole-slide-image-viewer',
      },
      {
        name: 'ECG Viewer',
        description: 'Open ECG waveform recordings locally with multi-lead display, gain and paper speed controls, caliper measurements, and JSON/PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/ecg-viewer',
      },
      {
        name: 'EEG Viewer',
        description: 'Open EEG recordings locally with multi-channel traces, referential/bipolar/average montage, time scrolling, and JSON/PNG export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/eeg-viewer',
      },
      {
        name: 'HL7 Message Viewer',
        description: 'Decode HL7 v2 pipe-delimited messages locally with segment and field breakdown, search, and JSON export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/hl7-message-viewer',
      },
      {
        name: 'FHIR Resource Viewer',
        description: 'Navigate FHIR JSON/XML resources locally with tree view, reference graph, date timeline, and JSON export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/fhir-resource-viewer',
      },
      {
        name: 'Medical Timeline Viewer',
        description: 'Build patient and encounter timelines locally from JSON, CSV, FHIR, or HL7 clinical events with filters and grouping — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/medical-timeline-viewer',
      },
      {
        name: 'CDA Viewer',
        description: 'Review HL7 Clinical Document Architecture (CDA) XML locally with structured sections, narrative rendering, and JSON export — private browser preview for education and research (not for diagnosis).',
        path: '/medical-viewers/cda-viewer',
      },
    ],
  },
  {
    name: 'ML Model Viewers',
    description: 'Inspect ONNX and other ML model graphs.',
    path: 'ml-viewers',
    faIcon: 'fas fa-brain',
    materialIcon: 'psychology',
    subCategories: [
      {
        name: 'ONNX Viewer',
        description: 'Inspect ONNX model graphs locally with ops, tensors, and metadata from .onnx, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/onnx-viewer',
      },
      {
        name: 'TensorFlow Graph Viewer',
        description: 'Inspect TensorFlow GraphDef nodes and tensors locally from .pb, .pbtxt, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/tensorflow-graph-viewer',
      },
      {
        name: 'PyTorch Model Viewer',
        description: 'Inspect PyTorch layers and parameters locally from .pt, .pth, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/pytorch-model-viewer',
      },
      {
        name: 'Keras Model Viewer',
        description: 'Inspect Keras layers and tensor shapes locally from .keras, .h5, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/keras-model-viewer',
      },
      {
        name: 'MLflow Model Viewer',
        description: 'Inspect MLflow signatures, flavors, and artifact files locally from MLmodel, ZIP, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/mlflow-model-viewer',
      },
      {
        name: 'Neural Network Graph Viewer',
        description: 'Inspect generic neural-network layers and connections locally from .nn, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/neural-network-graph-viewer',
      },
      {
        name: 'Model Architecture Viewer',
        description: 'Inspect model architecture blocks and parameter tensors locally from .arch, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/model-architecture-viewer',
      },
      {
        name: 'Tensor Visualization Viewer',
        description: 'Inspect tensor shapes, dtypes, and dump statistics locally from .tensor, .npy, JSON, or CSV — private browser tool for education and research.',
        path: '/ml-viewers/tensor-visualization-viewer',
      },
      {
        name: 'Pickle Viewer',
        description: 'Inspect pickle type hints and safety warnings locally from .pkl, JSON, or CSV without executing opcodes — private browser tool for education and research.',
        path: '/ml-viewers/pickle-viewer',
      },
    ],
  },
  {
    name: 'Network & Traffic Viewers',
    description: 'HAR, PCAP, and protocol analysis in the browser.',
    path: 'network-viewers',
    faIcon: 'fas fa-network-wired',
    materialIcon: 'lan',
    subCategories: [
      {
        name: 'HAR Viewer',
        description: 'Inspect browser HAR captures locally with waterfall, headers, timing breakdown, and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/har-viewer',
      },
      {
        name: 'PCAP Viewer',
        description: 'Inspect PCAP and PCAPNG captures locally with packet list, filters, hex dump, follow-stream, and CSV export — private browser tool for education and research.',
        path: '/network-viewers/pcap-viewer',
      },
      {
        name: 'PCAPNG Viewer',
        description: 'Inspect PCAPNG captures locally with interface blocks, packet timeline, ISB stats, hex preview, and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/pcapng-viewer',
      },
      {
        name: 'Network Traffic Viewer',
        description: 'Explore conversations, protocols, and talkers locally from PCAP/PCAPNG or JSON/CSV/.flow dumps with CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/network-traffic-viewer',
      },
      {
        name: 'Packet Analyzer',
        description: 'Inspect packets locally with layer decode, hex dump, field offsets, and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/packet-analyzer',
      },
      {
        name: 'Protocol Analyzer',
        description: 'Analyze protocol mix locally with dissectors, timeline, conversation counts, and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/protocol-analyzer',
      },
      {
        name: 'HTTP Trace Viewer',
        description: 'Review HTTP request/response conversations locally from HAR, .trace, or .http dumps with CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/http-trace-viewer',
      },
      {
        name: 'API Request Viewer',
        description: 'Inspect API calls locally with pretty JSON bodies, headers, query params, and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/api-request-viewer',
      },
      {
        name: 'Firewall Log Viewer',
        description: 'Explore allow/deny/drop/reject events locally from UFW, iptables, CSV, or JSON logs with timeline and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/firewall-log-viewer',
      },
      {
        name: 'SIEM Log Viewer',
        description: 'Browse SIEM events locally with severity, MITRE mapping, rule/source correlation, and CSV/JSON export from JSON, CSV, or CEF — private browser tool for education and research.',
        path: '/network-viewers/siem-log-viewer',
      },
      {
        name: 'Syslog Viewer',
        description: 'Browse syslog locally by facility and severity from RFC 3164/5424 logs, CSV, or JSON with CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/syslog-viewer',
      },
      {
        name: 'DNS Log Viewer',
        description: 'Review DNS queries and responses locally from BIND, dnsmasq, CSV, or JSON with type timeline and CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/dns-log-viewer',
      },
      {
        name: 'Nmap Report Viewer',
        description: 'Browse Nmap hosts, ports, and services locally from XML, gnmap, or JSON with CSV/JSON export — private browser tool for education and research.',
        path: '/network-viewers/nmap-report-viewer',
      },
      {
        name: 'Nessus Report Viewer',
        description: 'Review Nessus findings locally by severity, host, plugin, and CVE from .nessus XML, CSV, or JSON with export — private browser tool for education and research.',
        path: '/network-viewers/nessus-report-viewer',
      },
      {
        name: 'SARIF Report Viewer',
        description: 'Browse SARIF 2.1 static analysis results locally by rule, file location, and level from .sarif, JSON, or CSV with export — private browser tool for education and research.',
        path: '/network-viewers/sarif-report-viewer',
      },
      {
        name: 'Malware Analysis Report Viewer',
        description: 'Review sandbox malware reports locally with IOCs, MITRE behaviors, and dropped files from JSON, XML, CSV, or text — private browser tool for education and research.',
        path: '/network-viewers/malware-analysis-report-viewer',
      },
      {
        name: 'Threat Intelligence Viewer',
        description: 'Browse STIX 2.x threat intel locally with indicators, relationships, and objects from JSON, XML, CSV, or text — private browser tool for education and research.',
        path: '/network-viewers/threat-intelligence-viewer',
      },
    ],
  },
  {
    name: 'PDF Tools',
    description: 'View, edit, generate, and secure PDFs',
    path: 'pdf-tools',
    faIcon: 'fas fa-file-pdf',
    materialIcon: 'picture_as_pdf',
    subCategories: [
      {
        name: 'PDF Studio',
        description: 'View, edit, and optimise PDF documents end-to-end.',
        path: '/pdf-tools/pdf-viewer',
      },
      {
        name: 'Merge PDFs',
        description: 'Combine files into a single deliverable.',
        path: '/pdf-tools/merge-pdfs',
      },
      {
        name: 'Split PDFs',
        description: 'Extract specific ranges into new documents.',
        path: '/pdf-tools/split-pdfs',
      },
      {
        name: 'Delete PDF Pages',
        description: 'Remove unwanted pages from a PDF instantly. Files stay private in your browser.',
        path: '/pdf-tools/delete-pages',
      },
      {
        name: 'Rotate PDF Pages',
        description: 'Rotate PDF pages 90°, 180°, or 270° and save a corrected document.',
        path: '/pdf-tools/rotate-pages',
      },
      {
        name: 'Reorder PDF Pages',
        description: 'Drag and rearrange PDF page order before downloading the new file.',
        path: '/pdf-tools/reorder-pages',
      },
      {
        name: 'Extract PDF Pages',
        description: 'Pull selected pages into a new PDF without uploading to a server.',
        path: '/pdf-tools/extract-pages',
      },
      {
        name: 'Compress PDF',
        description: 'Reduce file size for quicker sharing.',
        path: '/pdf-tools/compress-pdf',
      },
      {
        name: 'Create PDF from HTML',
        description: 'Export responsive pages into accessible PDFs.',
        path: '/pdf-tools/create-pdf-from-html',
      },
      {
        name: 'Tables & Charts to PDF',
        description: 'Turn tables and charts into clean, printable PDF documents.',
        path: '/pdf-tools/tables-charts-to-pdf',
      },
      {
        name: 'Resume & Invoice Generator',
        description: 'Build professional docs with guided templates.',
        path: '/pdf-tools/resume-invoice-generator',
      },
      {
        name: 'Text to PDF',
        description: 'Convert plain text into a formatted PDF document.',
        path: '/pdf-tools/text-to-pdf',
      },
      {
        name: 'Screenshot to PDF',
        description: 'Convert screenshots and images into a multi-page PDF in seconds.',
        path: '/pdf-tools/screenshot-to-pdf',
      },
      {
        name: 'Annotate PDF',
        description: 'Add notes, markup, and comments to PDF pages in your browser.',
        path: '/pdf-tools/annotate-pdf',
      },
      {
        name: 'Highlight PDF Text',
        description: 'Highlight important text in PDFs and export the marked-up file.',
        path: '/pdf-tools/highlight-text',
      },
      {
        name: 'Add Signature to PDF',
        description: 'Draw or upload a signature and place it on any PDF page.',
        path: '/pdf-tools/add-signature',
      },
      {
        name: 'Fill PDF Forms',
        description: 'Complete form fields and save persistently.',
        path: '/pdf-tools/fill-pdf-forms',
      },
      {
        name: 'PDF Metadata Editor',
        description: 'Edit PDF title, author, subject, and keywords without desktop software.',
        path: '/pdf-tools/pdf-metadata-editor',
      },
      {
        name: 'Add Watermark',
        description: 'Brand documents before distribution.',
        path: '/pdf-tools/add-watermark',
      },
      {
        name: 'PDF to Base64',
        description: 'Encode a PDF as Base64 for APIs, embeds, and data URLs — or decode back.',
        path: '/pdf-tools/pdf-to-base64',
      },
      {
        name: 'PDF Password Protect',
        description: 'Lock sensitive documents before you share them.',
        path: '/pdf-tools/password-protect-pdf',
      },
      {
        name: 'Flatten PDF Forms',
        description: 'Flatten fillable PDF form fields into a non-editable document.',
        path: '/pdf-tools/flatten-pdf-forms',
      },
      {
        name: 'HTML to PDF',
        description: 'Render HTML with styles and export a print-ready PDF.',
        path: '/pdf-tools/html-to-pdf',
      },
      {
        name: 'Tables to PDF',
        description: 'Export editable tables into formatted PDF documents.',
        path: '/pdf-tools/tables-to-pdf',
      },
      {
        name: 'Charts to PDF',
        description: 'Preview charts and export them to PDF.',
        path: '/pdf-tools/charts-to-pdf',
      },
      {
        name: 'Resume Generator',
        description: 'Build a professional resume PDF from structured fields.',
        path: '/pdf-tools/resume-generator',
      },
      {
        name: 'Invoice Generator',
        description: 'Create invoices with line items, tax, and totals.',
        path: '/pdf-tools/invoice-generator',
      },
      {
        name: 'Image to PDF',
        description: 'Combine multiple images into a single PDF.',
        path: '/pdf-tools/image-to-pdf',
      },
      {
        name: 'Add Page Numbers',
        description: 'Stamp page numbers with custom position and format.',
        path: '/pdf-tools/add-page-numbers',
      },
      {
        name: 'Barcode to PDF',
        description: 'Generate a barcode inside a PDF document.',
        path: '/pdf-tools/barcode-to-pdf',
      },
      {
        name: 'QR Code to PDF',
        description: 'Generate a QR code inside a PDF document.',
        path: '/pdf-tools/qr-code-to-pdf',
      },
    ],
  },
  {
    name: 'Process & Workflow Viewers',
    description: 'BPMN, DMN, Petri nets, and process mining tools.',
    path: 'process-viewers',
    faIcon: 'fas fa-project-diagram',
    materialIcon: 'account_tree',
    subCategories: [
      {
        name: 'BPMN Viewer',
        description: 'Open BPMN 2.0 diagrams in your browser with bpmn-js. Pan, zoom, inspect tasks and gateways, and export SVG — private and free.',
        path: '/process-viewers/bpmn-viewer',
      },
      {
        name: 'BPMN Analytics Viewer',
        description: 'Review BPMN activity frequency, wait time, and bottleneck overlays locally from JSON, CSV, or .bpmn with export — private browser tool for education and research.',
        path: '/process-viewers/bpmn-analytics-viewer',
      },
      {
        name: 'DMN Viewer',
        description: 'Browse DMN 1.3 decision tables and DRD graphs locally from .dmn, XML, JSON, or CSV with export — private browser tool for education and research.',
        path: '/process-viewers/dmn-viewer',
      },
      {
        name: 'Decision Model Viewer',
        description: 'Explore decision models locally with tables, rules, and dependency graphs from JSON, DMN, or CSV — private browser tool for education and research.',
        path: '/process-viewers/decision-model-viewer',
      },
      {
        name: 'EPC Diagram Viewer',
        description: 'Browse EPML event-driven process chains locally from .epc, XML, JSON, or CSV with events, XOR/AND connectors, and export — private browser tool for education and research.',
        path: '/process-viewers/epc-diagram-viewer',
      },
      {
        name: 'PNML Viewer',
        description: 'Explore PNML Petri nets locally with places, transitions, tokens, and enabled firings from .pnml, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/pnml-viewer',
      },
      {
        name: 'Petri Net Viewer',
        description: 'Simulate Petri net token flow locally from .pnml, XML, JSON, or CSV with step firing, markings, and export — private browser tool for education and research.',
        path: '/process-viewers/petri-net-viewer',
      },
      {
        name: 'BPEL Viewer',
        description: 'Browse WS-BPEL 2.0 orchestration locally with partner links, receive/invoke/reply, and branching from .bpel, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/bpel-viewer',
      },
      {
        name: 'Workflow Diagram Viewer',
        description: 'Browse generic workflow diagrams locally from XML, .wf, JSON, or CSV with nodes, edges, and export — private browser tool for education and research.',
        path: '/process-viewers/workflow-diagram-viewer',
      },
      {
        name: 'Process Map Viewer',
        description: 'Explore discovered process maps locally with variants, activity frequencies, and DFG-style flows from JSON, XML, or CSV — private browser tool for education and research.',
        path: '/process-viewers/process-map-viewer',
      },
      {
        name: 'Process Mining Viewer',
        description: 'Mine variants and directly-follows graphs locally from XES, XML, JSON, or CSV event logs — private browser tool for education and research.',
        path: '/process-viewers/process-mining-viewer',
      },
      {
        name: 'Event Log Viewer',
        description: 'Browse process event logs locally with cases, activities, and timestamps from XES, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/event-log-viewer',
      },
      {
        name: 'Trace Explorer',
        description: 'Drill into case traces locally with paths, steps, and attributes from XES, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/trace-explorer',
      },
      {
        name: 'Process Timeline Viewer',
        description: 'Explore gantt-like process timelines locally with case and resource lanes from XES, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/process-timeline-viewer',
      },
      {
        name: 'Business Process Simulator',
        description: 'Simulate BPMN and PNML token scenarios locally with step/reset traces from .bpmn, .pnml, XML, JSON, or CSV — private browser tool for education and research.',
        path: '/process-viewers/business-process-simulator',
      },
    ],
  },
  {
    name: 'Scientific Data Viewers',
    description: 'NetCDF, HDF5, FITS, seismic, and research datasets.',
    path: 'science-viewers',
    faIcon: 'fas fa-flask',
    materialIcon: 'science',
    subCategories: [
      {
        name: 'HDF5 Viewer',
        description: 'Browse HDF5 hierarchical datasets locally with group tree navigation, attribute inspection, numeric array preview, and JSON export — private browser tool for education and research.',
        path: '/science-viewers/hdf5-viewer',
      },
      {
        name: 'NetCDF Viewer',
        description: 'Explore NetCDF classic climate and science grids locally with variable browser, slice preview, histogram, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/netcdf-viewer',
      },
      {
        name: 'FITS Viewer',
        description: 'View astronomical FITS images locally with HDU browser, header cards, WCS metadata, stretch preview, and JSON/CSV export — private browser tool for education and research.',
        path: '/science-viewers/fits-viewer',
      },
      {
        name: 'GRIB Viewer',
        description: 'Browse GRIB2 weather model messages locally with field heatmaps, grid metadata, histogram, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/grib-viewer',
      },
      {
        name: 'MATLAB MAT Viewer',
        description: 'Explore MATLAB MAT v5 and v7.3 variables locally with array preview, histogram, slice browser, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/matlab-mat-viewer',
      },
      {
        name: 'ROOT File Viewer',
        description: 'Browse ROOT histograms and tree branches locally with object browser, bar chart preview, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/root-file-viewer',
      },
      {
        name: 'Molecular Structure Viewer',
        description: 'Preview PDB, MOL, and SDF molecules locally with ball-and-stick, spacefill, wireframe, rotation, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/molecular-structure-viewer',
      },
      {
        name: 'Protein Structure Viewer',
        description: 'Inspect protein PDB files locally with ribbon and backbone preview, residue search, chain filter, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/protein-structure-viewer',
      },
      {
        name: 'FASTA Viewer',
        description: 'Browse multi-FASTA sequences locally with search, wrap, reverse-complement, translation, and composition charts — private browser tool for education and research.',
        path: '/science-viewers/fasta-viewer',
      },
      {
        name: 'FASTQ Viewer',
        description: 'Inspect FASTQ sequencing reads locally with Phred quality plots, filters, and CSV/FASTQ export — private browser tool for education and research.',
        path: '/science-viewers/fastq-viewer',
      },
      {
        name: 'GenBank Viewer',
        description: 'Inspect GenBank annotations locally with feature maps, CDS translation, sequence preview, and CSV/FASTA export — private browser tool for education and research.',
        path: '/science-viewers/genbank-viewer',
      },
      {
        name: 'VCF Variant Viewer',
        description: 'Browse VCF variants locally with chromosome filters, QUAL/PASS, genotypes, INFO, and CSV/VCF export — private browser tool for education and research.',
        path: '/science-viewers/vcf-variant-viewer',
      },
      {
        name: 'LAS Well Log Viewer',
        description: 'Inspect CWLS LAS well logs locally with depth tracks, crossplots, histograms, curve stats, and CSV/LAS export — private browser tool for education and research.',
        path: '/science-viewers/las-well-log-viewer',
      },
      {
        name: 'DLIS Viewer',
        description: 'Inspect DLIS storage units locally with SUL, visible records, channel catalogs, depth-track preview, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/dlis-viewer',
      },
      {
        name: 'SEG-Y Viewer',
        description: 'Inspect SEG-Y seismic locally with section and wiggle views, gain/AGC, trace headers, and CSV/PNG export — private browser tool for education and research.',
        path: '/science-viewers/seg-y-viewer',
      },
      {
        name: 'Geological Model Viewer',
        description: 'Inspect layered geological models locally with map, cross-section, stratigraphic column, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/geological-model-viewer',
      },
      {
        name: 'Borehole Viewer',
        description: 'Inspect borehole trajectories locally with plan, section, lithology, dogleg severity, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/borehole-viewer',
      },
      {
        name: 'Stratigraphy Viewer',
        description: 'Inspect stratigraphic columns locally with thickness, chronostratigraphy, correlation, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/stratigraphy-viewer',
      },
      {
        name: 'Climate Data Viewer',
        description: 'Explore climate grids and station series locally with NetCDF, GRIB, maps, time series, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/climate-data-viewer',
      },
      {
        name: 'Simulation Result Viewer',
        description: 'Inspect simulation scalar fields locally with slices, probes, VTK ASCII, and CSV/JSON export — private browser tool for education and research.',
        path: '/science-viewers/simulation-result-viewer',
      },
    ],
  },
  {
    name: 'Security & Crypto Tools',
    description: 'Hashing, encryption, and secure utilities',
    path: 'security-tools',
    faIcon: 'fas fa-lock',
    materialIcon: 'lock',
    subCategories: [
      {
        name: 'Hash Generator',
        description: 'Compute hashes across SHA, MD5, and more.',
        path: '/security-tools/hash-generator',
      },
      {
        name: 'UUID Generator',
        description: 'Create unique identifiers for anything you ship.',
        path: '/security-tools/uuid-generator',
      },
      {
        name: 'Password Strength Checker',
        description: 'Audit passwords against best practices.',
        path: '/security-tools/password-strength-checker',
      },
      {
        name: 'Random Password Generator',
        description: 'Generate strong credentials with policy-ready presets.',
        path: '/security-tools/random-password-generator',
      },
      {
        name: 'Text Encrypt & Decrypt',
        description: 'Symmetric encryption for quick message sharing.',
        path: '/security-tools/text-encrypt-decrypt',
      },
      {
        name: 'Secure Clipboard',
        description: 'Keep snippets encrypted until you need them.',
        path: '/security-tools/secure-clipboard',
      },
      {
        name: 'Private Notes',
        description: 'Draft notes that never leave your browser.',
        path: '/security-tools/private-notes',
      },
    ],
  },
  {
    name: 'Validation & Testing Tools',
    description: 'Validators and testing utilities',
    path: 'testing-tools',
    faIcon: 'fas fa-check-circle',
    materialIcon: 'rule',
    subCategories: [
      {
        name: 'JSON Schema Validator',
        description: 'Check payloads against schema definitions.',
        path: '/testing-tools/json-schema-validator',
      },
      {
        name: 'Password Rule Validator',
        description: 'Test policies against live credentials.',
        path: '/testing-tools/password-rule-validator',
      },
      {
        name: 'Email, URL & IP Checker',
        description: 'Verify addresses before persisting them.',
        path: '/testing-tools/email-url-ip-checker',
      },
      {
        name: 'User Agent Parser',
        description: 'Parse headers into readable device profiles.',
        path: '/testing-tools/user-agent-parser',
      },
      {
        name: 'Credit Card Validator',
        description: 'Confirm card numbers with Luhn and brand rules.',
        path: '/testing-tools/credit-card-validator',
      },
      {
        name: 'JWT Decoder',
        description: 'Inspect JSON Web Tokens without sending them to a server.',
        path: '/testing-tools/jwt-decoder',
      },
    ],
  },
  {
    name: 'Text & Utilities',
    description: 'Tools for text manipulation and utilities',
    path: 'text-utilities',
    faIcon: 'fas fa-font',
    materialIcon: 'text_fields',
    subCategories: [
      {
        name: 'Word & Character Counter',
        description: 'Measure characters, words, reading time, and more in real time.',
        path: '/text-utilities/character-counter',
      },
      {
        name: 'Text Case Converter',
        description: 'Switch text between lowercase, uppercase, sentence case, or custom formats.',
        path: '/text-utilities/text-case-convertor',
      },
      {
        name: 'Text to ASCII Converter',
        description: 'Transform any text into ASCII codes for encoding or debugging.',
        path: '/text-utilities/text-to-ascii',
      },
      {
        name: 'Remove Duplicate Lines',
        description: 'Clean up repeated lines from pasted text while keeping order intact.',
        path: '/text-utilities/remove-duplicate-lines',
      },
      {
        name: 'Reverse Text & Palindrome Checker',
        description: 'Flip strings instantly and verify whether phrases read the same both ways.',
        path: '/text-utilities/text-reversal-and-palindrome-checker',
      },
      {
        name: 'Base64 Encode & Decode',
        description: 'Encode files or strings to Base64 and decode them back effortlessly.',
        path: '/text-utilities/base64-encode-and-decode',
      },
      {
        name: 'Slug Generator',
        description: 'Convert titles into clean, SEO-friendly URL slugs with smart formatting.',
        path: '/text-utilities/slug-generator',
      },
      {
        name: 'Text Difference Checker',
        description: 'Compare two blocks of text and highlight additions, removals, or edits.',
        path: '/text-utilities/text-difference',
      },
      {
        name: 'Code Merge',
        description: 'Merge and reconcile code snippets with a clear diff-aware editor.',
        path: '/text-utilities/code-merge',
      },
      {
        name: 'URL Encode & Decode',
        description: 'Percent-encode or decode URL strings, query values, and Unicode text.',
        path: '/text-utilities/url-encode-and-decode',
      },
      {
        name: 'Unicode Escape & Unescape',
        description: 'Convert text to \\\\uXXXX escape sequences and back for debugging.',
        path: '/text-utilities/unicode-escape-unescape',
      },
      {
        name: 'HTML Tag Stripper',
        description: 'Remove HTML markup and get clean plain text instantly.',
        path: '/text-utilities/html-tag-stripper',
      },
      {
        name: 'Sort Lines',
        description: 'Sort lines alphabetically, by length, or numerically.',
        path: '/text-utilities/sort-lines',
      },
      {
        name: 'Trim & Normalize Whitespace',
        description: 'Trim lines, collapse spaces, and remove empty lines.',
        path: '/text-utilities/trim-normalize-whitespace',
      },
      {
        name: 'Find & Replace',
        description: 'Search and replace text with plain or regex patterns.',
        path: '/text-utilities/find-and-replace',
      },
      {
        name: 'Line Number Tool',
        description: 'Add or remove line numbers from any text block.',
        path: '/text-utilities/line-number-tool',
      },
      {
        name: 'Split & Join Text',
        description: 'Split by delimiter or join lines with a custom separator.',
        path: '/text-utilities/split-join-text',
      },
      {
        name: 'Regex Tester',
        description: 'Test regular expressions and view matches in real time.',
        path: '/text-utilities/regex-tester',
      },
      {
        name: 'Text Similarity Checker',
        description: 'Compare two strings with Levenshtein distance and similarity score.',
        path: '/text-utilities/text-similarity',
      },
      {
        name: 'Invisible Character Detector',
        description: 'Find zero-width spaces and hidden Unicode characters.',
        path: '/text-utilities/invisible-character-detector',
      },
      {
        name: 'Word Wrap & Unwrap',
        description: 'Wrap text at a column width or unwrap hard line breaks.',
        path: '/text-utilities/word-wrap-unwrap',
      },
      {
        name: 'Extract Emails & URLs',
        description: 'Pull email addresses and links from any text blob.',
        path: '/text-utilities/extract-emails-urls',
      },
      {
        name: 'JSON String Escape & Unescape',
        description: 'Escape or unescape strings for safe JSON embedding.',
        path: '/text-utilities/json-string-escape-unescape',
      },
      {
        name: 'Hex Encode & Decode',
        description: 'Convert text to hexadecimal and decode hex to text.',
        path: '/text-utilities/hex-encode-decode',
      },
      {
        name: 'ROT13 & Caesar Cipher',
        description: 'Apply ROT13 or custom Caesar cipher shifts to text.',
        path: '/text-utilities/rot13-cipher',
      },
      {
        name: 'Binary Text Converter',
        description: 'Convert text to binary and decode binary back to text.',
        path: '/text-utilities/binary-text-converter',
      },
      {
        name: 'Morse Code Converter',
        description: 'Encode text to Morse code and decode it back.',
        path: '/text-utilities/morse-code-converter',
      },
      {
        name: 'Readability Analyzer',
        description: 'Get Flesch Reading Ease and grade-level scores for any text.',
        path: '/text-utilities/readability-analyzer',
      },
      {
        name: 'Keyword Density Checker',
        description: 'Analyze word frequency and keyword density for SEO.',
        path: '/text-utilities/keyword-density',
      },
      {
        name: 'Pako Compress & Decompress',
        description: 'Compress or decompress text with zlib deflate, raw deflate, or gzip.',
        path: '/text-utilities/pako-encode-and-decode',
      },
    ],
  },
];
