/**
 * Hand-tuned names, descriptions, and keyword extras for SEO/catalog generation.
 * Used by generate-tool-seo-catalog.js — prefer this over generic slug fallbacks.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'or',
  'the',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'from',
  'by',
  'at',
  'as',
  'is',
  'tool',
  'tools',
  'online',
  'free',
]);

/** Route path → { name?, description?, keywords? } */
const TOOL_ENRICHMENT = {
  '/tools/home': {
    title: 'EasyToolHub - Free Online Tools for Everyone',
    description:
      'Discover 160+ free online tools for text editing, PDF editing, file conversion, image tools, calculators, developer utilities, and security. No signup — fast, private, and browser-based.',
    keywords:
      'free online tools, online utilities, text tools, PDF tools, file converter, image tools, JSON formatter, developer tools, password generator, QR code generator, unit converter, hash generator, word counter, merge PDF, compress PDF, easytoolhub',
  },
  '/file-viewers/word-viewer': {
    name: 'Word Viewer',
    description: 'Open and preview DOCX Word documents in your browser without installing Office.',
    keywords: 'word viewer online, docx viewer, open word document online, microsoft word viewer',
  },
  '/file-viewers/powerpoint-viewer': {
    name: 'PowerPoint Viewer',
    description: 'Preview PPTX presentations online with slides, notes, and zoom controls.',
    keywords: 'powerpoint viewer online, pptx viewer, open powerpoint online, presentation viewer',
  },
  '/file-viewers/text-file-viewer': {
    name: 'Text File Viewer',
    description: 'Open TXT, LOG, and plain-text files with search, wrap, and encoding support.',
    keywords: 'text file viewer, txt viewer online, open text file, log file viewer',
  },
  '/file-viewers/3d-model-viewer': {
    name: '3D Model Viewer',
    description: 'Inspect GLB, GLTF, and other 3D models with orbit, zoom, and lighting controls.',
    keywords: '3d model viewer online, glb viewer, gltf viewer, 3d file viewer',
  },
  '/file-viewers/xes-viewer': {
    name: 'XES Viewer',
    description:
      'Open and explore XES process-mining event logs in your browser. Browse cases, events, activities, and variants with PM4JS — private and free.',
    keywords:
      'xes viewer online, xes file viewer, process mining event log viewer, open xes file, pm4js viewer, event log analyzer',
  },
  '/file-viewers/epub-viewer': {
    name: 'EPUB Viewer',
    description:
      'Read EPUB chapters, table of contents, and typography locally from .epub dumps, store ZIP, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'epub viewer online, local epub chapter toc typography parser, calibre apple books alternative, epub json csv dump',
  },
  '/file-viewers/mobi-viewer': {
    name: 'MOBI Viewer',
    description:
      'Read Kindle MOBI/AZW chapters and table of contents locally from .mobi dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'mobi viewer online, local azw kindle chapter toc parser, amazon kindle calibre alternative, mobi json csv dump',
  },
  '/file-viewers/latex-viewer': {
    name: 'LaTeX Viewer',
    description:
      'Inspect LaTeX structure, preview, and source locally from .tex dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'latex viewer online, local tex section command environment parser, overleaf tex live alternative, latex json csv dump',
  },
  '/file-viewers/svg-viewer': {
    name: 'SVG Viewer',
    description:
      'Inspect SVG shapes with zoom, pan, layers, and source locally from .svg dumps, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'svg viewer online, local svg zoom source parser, inkscape illustrator alternative, svg json csv dump',
  },
  '/file-viewers/psd-viewer': {
    name: 'PSD Viewer',
    description:
      'Inspect Photoshop layers, effects, and preview locally from .psd dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'psd viewer online, local photoshop layer preview parser, gimp photoshop alternative, psd json csv dump',
  },
  '/file-viewers/ai-file-viewer': {
    name: 'AI File Viewer',
    description:
      'Inspect Adobe Illustrator artboards, layers, and preview locally from .ai dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'ai file viewer online, local illustrator artboard preview parser, adobe illustrator inkscape alternative, ai json csv dump',
  },
  '/file-viewers/heic-viewer': {
    name: 'HEIC Viewer',
    description:
      'Inspect HEIC/HEIF frames, EXIF, and preview locally from .heic dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'heic viewer online, local heif frame exif parser, apple photos preview alternative, heic json csv dump',
  },
  '/file-viewers/raw-image-viewer': {
    name: 'RAW Image Viewer',
    description:
      'Inspect camera RAW EXIF, Bayer channels, and demosaic preview locally from CR2/NEF/ARW dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'raw image viewer online, local cr2 nef arw exif parser, lightroom dcraw alternative, camera raw json csv dump',
  },
  '/file-viewers/tiff-viewer': {
    name: 'TIFF Viewer',
    description:
      'Inspect multi-page TIFF pages, metadata, and zoom locally from .tif dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'tiff viewer online, local multi-page tif parser, photoshop imagemagick alternative, tiff json csv dump',
  },
  '/file-viewers/opendocument-viewer': {
    name: 'OpenDocument Viewer',
    description:
      'Inspect OpenDocument pages, sheets, and preview locally from .odt / .ods / .odp dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'opendocument viewer online, local odt ods odp page sheet parser, libreoffice onlyoffice alternative, odf json csv dump',
  },
  '/file-viewers/rtf-viewer': {
    name: 'RTF Viewer',
    description:
      'Inspect Rich Text formatting, preview, and export locally from .rtf dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'rtf viewer online, local rich text format parser, word wordpad alternative, rtf json csv html export',
  },
  '/process-viewers/epc-diagram-viewer': {
    name: 'EPC Diagram Viewer',
    description:
      'Browse EPML event-driven process chains locally from .epc, XML, JSON, or CSV with events, XOR/AND connectors, and export — private browser tool for education and research.',
    keywords:
      'epc diagram viewer online, epml parser, event driven process chain browser, local aris epc alternative, epc csv json dump',
  },
  '/process-viewers/petri-net-viewer': {
    name: 'Petri Net Viewer',
    description:
      'Simulate Petri net token flow locally from .pnml, XML, JSON, or CSV with step firing, markings, and export — private browser tool for education and research.',
    keywords:
      'petri net viewer online, pnml token flow simulator, place transition firing browser, local pipe woped alternative, petri net csv json dump',
  },
  '/process-viewers/workflow-diagram-viewer': {
    name: 'Workflow Diagram Viewer',
    description:
      'Browse generic workflow diagrams locally from XML, .wf, JSON, or CSV with nodes, edges, and export — private browser tool for education and research.',
    keywords:
      'workflow diagram viewer online, workflow xml parser, node edge graph browser, local camunda workflow alternative, workflow csv json dump',
  },
  '/process-viewers/process-map-viewer': {
    name: 'Process Map Viewer',
    description:
      'Explore discovered process maps locally with variants, activity frequencies, and DFG-style flows from JSON, XML, or CSV — private browser tool for education and research.',
    keywords:
      'process map viewer online, discovered process variant browser, activity frequency dfg map, local disco celonis alternative, process map csv json dump',
  },
  '/process-viewers/process-mining-viewer': {
    name: 'Process Mining Viewer',
    description:
      'Mine variants and directly-follows graphs locally from XES, XML, JSON, or CSV event logs — private browser tool for education and research.',
    keywords:
      'process mining viewer online, xes dfg variant miner, local disco celonis alternative, event log process discovery, xes csv json dump',
  },
  '/process-viewers/event-log-viewer': {
    name: 'Event Log Viewer',
    description:
      'Browse process event logs locally with cases, activities, and timestamps from XES, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'event log viewer online, xes case activity browser, local pm4py xes alternative, process event log csv json dump',
  },
  '/process-viewers/trace-explorer': {
    name: 'Trace Explorer',
    description:
      'Drill into case traces locally with paths, steps, and attributes from XES, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'trace explorer online, case path attribute drill down, xes trace browser, local disco case explorer alternative, trace csv json dump',
  },
  '/process-viewers/process-timeline-viewer': {
    name: 'Process Timeline Viewer',
    description:
      'Explore gantt-like process timelines locally with case and resource lanes from XES, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'process timeline viewer online, gantt case resource lanes, xes event timeline browser, local disco timeline alternative, timeline csv json dump',
  },
  '/process-viewers/business-process-simulator': {
    name: 'Business Process Simulator',
    description:
      'Simulate BPMN and PNML token scenarios locally with step/reset traces from .bpmn, .pnml, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'business process simulator online, bpmn pnml token scenario stepper, local bimp signavio alternative, petri net bpmn simulation csv json dump',
  },
  '/diagram-viewers/mermaid-diagram-viewer': {
    name: 'Mermaid Diagram Viewer',
    description:
      'Render Mermaid flowcharts and sequence diagrams locally from .mmd, Markdown, JSON, or text — private browser tool for education and research.',
    keywords:
      'mermaid diagram viewer online, local mermaid flowchart sequence parser, mermaid.live alternative, mmd markdown json dump',
  },
  '/diagram-viewers/plantuml-viewer': {
    name: 'PlantUML Viewer',
    description:
      'Preview PlantUML class and C4 diagrams locally from .puml, Markdown, JSON, or text — private browser tool for education and research.',
    keywords:
      'plantuml viewer online, local plantuml class c4 parser, plantuml.com alternative, puml markdown json dump',
  },
  '/diagram-viewers/graphviz-dot-viewer': {
    name: 'Graphviz DOT Viewer',
    description:
      'Preview Graphviz DOT layouts locally with SVG export from .dot, .gv, Markdown, JSON, or text — private browser tool for education and research.',
    keywords:
      'graphviz dot viewer online, local graphviz layout svg export, graphviz online alternative, dot gv markdown json dump',
  },
  '/diagram-viewers/uml-viewer': {
    name: 'UML Viewer',
    description:
      'Preview UML class and sequence diagrams locally from .uml, .puml, XMI, Markdown, JSON, or text — private browser tool for education and research.',
    keywords:
      'uml viewer online, local uml class sequence parser, xmi plantuml mermaid alternative, uml puml xmi json dump',
  },
  '/diagram-viewers/class-diagram-viewer': {
    name: 'Class Diagram Viewer',
    description:
      'Browse class types, attributes, operations, and relations locally from .puml, .uml, XMI, Markdown, JSON, or text — private browser tool for education and research.',
    keywords:
      'class diagram viewer online, local uml class types relations parser, plantuml xmi alternative, class diagram csv json dump',
  },
  '/diagram-viewers/sequence-diagram-viewer': {
    name: 'Sequence Diagram Viewer',
    description:
      'Preview sequence lifelines and messages locally from .puml, Mermaid, Markdown, JSON, or XML — private browser tool for education and research.',
    keywords:
      'sequence diagram viewer online, local uml sequence lifeline message parser, plantuml mermaid alternative, sequence csv json dump',
  },
  '/diagram-viewers/architecture-diagram-viewer': {
    name: 'Architecture Diagram Viewer',
    description:
      'Browse architecture boxes and connectors locally from .puml, Mermaid, Markdown, JSON, or XML — private browser tool for education and research.',
    keywords:
      'architecture diagram viewer online, local boxes connectors parser, plantuml mermaid alternative, architecture csv json dump',
  },
  '/diagram-viewers/c4-model-viewer': {
    name: 'C4 Model Viewer',
    description:
      'Browse C4 context, container, and component models locally from PlantUML, Structurizr DSL, Markdown, JSON, or XML — private browser tool for education and research.',
    keywords:
      'c4 model viewer online, local c4 context container component parser, structurizr plantuml alternative, c4 csv json dump',
  },
  '/diagram-viewers/graphml-viewer': {
    name: 'GraphML Viewer',
    description:
      'Explore GraphML networks locally with rank layout and community detection from .graphml, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'graphml viewer online, local graphml layout community parser, gephi yed alternative, graphml csv json dump',
  },
  '/diagram-viewers/gexf-viewer': {
    name: 'GEXF Viewer',
    description:
      'Explore GEXF dynamic networks locally with timeline slices and community detection from .gexf, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'gexf viewer online, local gexf timeline community parser, gephi sigma alternative, gexf csv json dump',
  },
  '/diagram-viewers/mind-map-viewer': {
    name: 'Mind Map Viewer',
    description:
      'Explore mind maps locally with collapse and search from Markdown, Mermaid, OPML, or JSON — private browser tool for education and research.',
    keywords:
      'mind map viewer online, local markdown mermaid opml parser, freemind freeplane alternative, mind map csv json dump',
  },
  '/diagram-viewers/freemind-viewer': {
    name: 'FreeMind Viewer',
    description:
      'Browse FreeMind .mm maps locally with tree layout and node notes from .mm, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'freemind viewer online, local freemind mm tree notes parser, freeplane alternative, freemind csv json dump',
  },
  '/diagram-viewers/freeplane-viewer': {
    name: 'Freeplane Viewer',
    description:
      'Browse Freeplane .mm maps locally with nodes, builtin icons, and attributes from .mm, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'freeplane viewer online, local freeplane mm icons attributes parser, freemind alternative, freeplane csv json dump',
  },
  '/diagram-viewers/concept-map-viewer': {
    name: 'Concept Map Viewer',
    description:
      'Explore concept maps locally with labeled nodes and links from CmapTools CXL, JSON, Markdown, or DOT — private browser tool for education and research.',
    keywords:
      'concept map viewer online, local cmaptools cxl parser, concept nodes links browser, concept map csv json dump',
  },
  '/diagram-viewers/er-diagram-viewer': {
    name: 'ER Diagram Viewer',
    description:
      'Browse entity-relationship diagrams locally with entities, PK/FK keys, and cardinalities from PlantUML, Mermaid, JSON, or XML — private browser tool for education and research.',
    keywords:
      'er diagram viewer online, local plantuml mermaid erd parser, entity primary foreign key browser, er csv json dump',
  },
  '/diagram-viewers/dbml-viewer': {
    name: 'DBML Viewer',
    description:
      'Explore DBML schemas locally with tables and refs from .dbml, JSON, or XML — private browser tool for education and research.',
    keywords:
      'dbml viewer online, local dbml table ref parser, dbdiagram alternative, dbml csv json dump',
  },
  '/diagram-viewers/sql-schema-viewer': {
    name: 'SQL Schema Viewer',
    description:
      'Browse SQL DDL schemas locally with tables and foreign keys from CREATE TABLE, JSON, or XML — private browser tool for education and research.',
    keywords:
      'sql schema viewer online, local create table ddl parser, sql foreign key browser, sql csv json dump',
  },
  '/diagram-viewers/prisma-schema-viewer': {
    name: 'Prisma Schema Viewer',
    description:
      'Explore Prisma schemas locally with models, @id/@unique fields, and relations from schema.prisma, JSON, or XML — private browser tool for education and research.',
    keywords:
      'prisma schema viewer online, local prisma model relation parser, prisma studio alternative, prisma csv json dump',
  },
  '/diagram-viewers/draw-io-viewer': {
    name: 'Draw.io Viewer',
    description:
      'Browse draw.io diagrams locally with pages, shapes, connectors, and zoom from .drawio, .dio, XML, or SVG — private browser tool for education and research.',
    keywords:
      'draw.io viewer online, local drawio dio mxfile parser, diagrams.net alternative, drawio csv json dump',
  },
  '/diagram-viewers/visio-viewer': {
    name: 'Visio Viewer',
    description:
      'Browse Visio diagrams locally with pages, shapes, and connectors from .vdx, Visio XML, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'visio viewer online, local visio vdx xml parser, microsoft visio alternative, visio csv json dump',
  },
  '/diagram-viewers/terraform-graph-viewer': {
    name: 'Terraform Graph Viewer',
    description:
      'Explore Terraform graphs locally with resources and dependency edges from terraform graph DOT, JSON, or XML — private browser tool for education and research.',
    keywords:
      'terraform graph viewer online, local terraform graph dot parser, infrastructure dependency graph, terraform csv json dump',
  },
  '/diagram-viewers/kubernetes-architecture-viewer': {
    name: 'Kubernetes Architecture Viewer',
    description:
      'Explore Kubernetes architecture locally with workloads, services, ingress routes, and selector links from YAML, JSON, or XML — private browser tool for education and research.',
    keywords:
      'kubernetes architecture viewer online, local k8s yaml workload service parser, kubectl lens alternative, kubernetes csv json dump',
  },
  '/diagram-viewers/dependency-graph-viewer': {
    name: 'Dependency Graph Viewer',
    description:
      'Explore package dependency trees and cycles locally from package-lock.json, yarn.lock, package.json, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'dependency graph viewer online, local npm yarn lockfile cycle parser, package tree browser, lockfile csv json dump',
  },
  '/diagram-viewers/rdf-viewer': {
    name: 'RDF Viewer',
    description:
      'Explore RDF triples and graphs locally from Turtle, RDF/XML, N-Triples, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'rdf viewer online, local turtle rdf xml triple parser, semantic web graph browser, rdf csv json dump',
  },
  '/diagram-viewers/owl-ontology-viewer': {
    name: 'OWL Ontology Viewer',
    description:
      'Explore OWL ontologies locally with classes, object/datatype properties, and subclass axioms from .owl, Turtle, JSON, or XML — private browser tool for education and research.',
    keywords:
      'owl ontology viewer online, local owl rdf class property parser, protege alternative, owl csv json dump',
  },
  '/diagram-viewers/knowledge-graph-viewer': {
    name: 'Knowledge Graph Viewer',
    description:
      'Explore knowledge graphs locally with entities and relationship links from JSON, XML, CSV, or Markdown — private browser tool for education and research.',
    keywords:
      'knowledge graph viewer online, local kg entity link parser, neo4j graphdb alternative, knowledge graph csv json dump',
  },
  '/diagram-viewers/state-machine-viewer': {
    name: 'State Machine Viewer',
    description:
      'Explore SCXML and FSM diagrams locally with states, events, and transitions from .scxml, JSON, XML, or Markdown — private browser tool for education and research.',
    keywords:
      'state machine viewer online, local scxml fsm parser, statechart transition browser, scxml csv json dump',
  },
  '/diagram-viewers/decision-tree-viewer': {
    name: 'Decision Tree Viewer',
    description:
      'Explore decision trees locally with branches, leaves, and split labels from JSON, XML, CSV, or Markdown — private browser tool for education and research.',
    keywords:
      'decision tree viewer online, local decision tree branch leaf parser, sklearn tree alternative, decision tree csv json dump',
  },
  '/diagram-viewers/drools-rule-viewer': {
    name: 'Drools Rule Viewer',
    description:
      'Inspect Drools .drl rules and when-conditions locally from DRL, JSON, XML, or Markdown — private browser tool for education and research.',
    keywords:
      'drools rule viewer online, local drl parser, kie rule condition browser, drools csv json dump',
  },
  '/data-explorers/parquet-viewer': {
    name: 'Parquet Viewer',
    description:
      'Explore Apache Parquet tables locally with schema, sample rows, and column profiling from .parquet, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'parquet viewer online, local parquet schema row parser, spark duckdb alternative, parquet csv json dump',
  },
  '/data-explorers/avro-viewer': {
    name: 'Avro Viewer',
    description:
      'Inspect Apache Avro schemas and sample records locally from .avro, .avsc, or JSON — private browser tool for education and research.',
    keywords:
      'avro viewer online, local avro schema record parser, avro container browser, avro csv json dump',
  },
  '/data-explorers/orc-viewer': {
    name: 'ORC Viewer',
    description:
      'Explore Apache ORC tables locally with schema, preview rows, and stripe layout from .orc, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'orc viewer online, local orc schema stripe parser, hive spark alternative, orc csv json dump',
  },
  '/data-explorers/feather-viewer': {
    name: 'Feather Viewer',
    description:
      'Inspect Feather / Arrow tables locally with schema and sample rows from .feather, .arrow, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'feather viewer online, local arrow feather schema parser, pyarrow alternative, feather csv json dump',
  },
  '/data-explorers/arrow-viewer': {
    name: 'Arrow Viewer',
    description:
      'Explore Apache Arrow IPC tables locally with schema, record batches, and preview rows from .arrow, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'arrow viewer online, local arrow ipc schema parser, pyarrow alternative, arrow csv json dump',
  },
  '/data-explorers/delta-lake-viewer': {
    name: 'Delta Lake Viewer',
    description:
      'Inspect Delta Lake table logs locally with versions, schema, and sample rows from .delta, _delta_log JSON, or CSV — private browser tool for education and research.',
    keywords:
      'delta lake viewer online, local delta log version parser, databricks spark alternative, delta csv json dump',
  },
  '/data-explorers/sqlite-viewer': {
    name: 'SQLite Viewer',
    description:
      'Browse SQLite databases locally with tables, CREATE TABLE SQL, and sample rows from .sqlite, .db, SQL dumps, or CSV — private browser tool for education and research.',
    keywords:
      'sqlite viewer online, local sqlite schema sql parser, sql.js alternative, sqlite csv json dump',
  },
  '/data-explorers/duckdb-viewer': {
    name: 'DuckDB Viewer',
    description:
      'Explore DuckDB databases locally with tables, schema, and sample rows from .duckdb, SQL dumps, or CSV — private browser tool for education and research.',
    keywords:
      'duckdb viewer online, local duckdb schema parser, duckdb-wasm alternative, duckdb csv json dump',
  },
  '/data-explorers/csv-viewer': {
    name: 'CSV Viewer',
    description:
      'Explore large CSV tables locally with column types, filters, dialect detection, and preview rows from .csv, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'csv viewer online, local csv column filter parser, excel pandas alternative, csv json dump quoted fields',
  },
  '/data-explorers/tsv-viewer': {
    name: 'TSV Viewer',
    description:
      'Explore tab-separated tables locally with column types, schema, and preview rows from .tsv, .tab, JSON, or Markdown — private browser tool for education and research.',
    keywords:
      'tsv viewer online, local tab separated column parser, excel pandas alternative, tsv json dump preview',
  },
  '/data-explorers/json-viewer': {
    name: 'JSON Viewer',
    description:
      'Explore JSON trees locally with path search, schema, JSONL, and table preview from .json, .jsonl, CSV, or Markdown — private browser tool for education and research.',
    keywords:
      'json viewer online, local json tree search parser, jq alternative, jsonl csv dump schema',
  },
  '/data-explorers/xml-viewer': {
    name: 'XML Viewer',
    description:
      'Explore XML documents locally with element nodes, attributes, and repeating-row preview from .xml, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'xml viewer online, local xml node attribute parser, xmllint alternative, xml csv json dump',
  },
  '/data-explorers/yaml-viewer': {
    name: 'YAML Viewer',
    description:
      'Explore YAML trees locally with path search, validation, and table preview from .yaml, .yml, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'yaml viewer online, local yaml tree validate parser, pyyaml yamllint alternative, yaml json csv dump',
  },
  '/data-explorers/toml-viewer': {
    name: 'TOML Viewer',
    description:
      'Browse TOML tables and flattened keys locally with preview rows from .toml, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'toml viewer online, local toml table key parser, taplo alternative, toml json csv dump',
  },
  '/data-explorers/ini-viewer': {
    name: 'INI Viewer',
    description:
      'Browse INI / conf sections and keys locally with preview rows from .ini, .cfg, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'ini viewer online, local ini cfg conf section parser, configparser alternative, ini json csv dump',
  },
  '/ml-viewers/onnx-viewer': {
    name: 'ONNX Viewer',
    description:
      'Inspect ONNX model graphs locally with ops, tensors, and metadata from .onnx, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'onnx viewer online, local onnx graph tensor parser, netron alternative, onnx json csv dump',
  },
  '/ml-viewers/tensorflow-graph-viewer': {
    name: 'TensorFlow Graph Viewer',
    description:
      'Inspect TensorFlow GraphDef nodes and tensors locally from .pb, .pbtxt, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'tensorflow graph viewer online, local tensorflow graphdef parser, tensorboard alternative, tf pbtxt json csv dump',
  },
  '/ml-viewers/pytorch-model-viewer': {
    name: 'PyTorch Model Viewer',
    description:
      'Inspect PyTorch layers and parameters locally from .pt, .pth, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'pytorch model viewer online, local pytorch checkpoint parser, torch.load netron alternative, pt pth json csv dump',
  },
  '/ml-viewers/keras-model-viewer': {
    name: 'Keras Model Viewer',
    description:
      'Inspect Keras layers and tensor shapes locally from .keras, .h5, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'keras model viewer online, local keras h5 architecture parser, keras.models.load_model alternative, keras json csv dump',
  },
  '/ml-viewers/mlflow-model-viewer': {
    name: 'MLflow Model Viewer',
    description:
      'Inspect MLflow signatures, flavors, and artifact files locally from MLmodel, ZIP, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'mlflow model viewer online, local mlflow signature artifact parser, mlflow ui alternative, mlmodel yaml zip dump',
  },
  '/ml-viewers/neural-network-graph-viewer': {
    name: 'Neural Network Graph Viewer',
    description:
      'Inspect generic neural-network layers and connections locally from .nn, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'neural network graph viewer online, local nn layer connection parser, netron tensorboard alternative, nn json csv dump',
  },
  '/ml-viewers/model-architecture-viewer': {
    name: 'Model Architecture Viewer',
    description:
      'Inspect model architecture blocks and parameter tensors locally from .arch, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'model architecture viewer online, local mlp block param dump parser, compiler runtime alternative, arch json csv dump',
  },
  '/ml-viewers/tensor-visualization-viewer': {
    name: 'Tensor Visualization Viewer',
    description:
      'Inspect tensor shapes, dtypes, and dump statistics locally from .tensor, .npy, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'tensor visualization viewer online, local npy tensor shape stats parser, numpy pytorch tensorboard alternative, tensor json csv dump',
  },
  '/ml-viewers/pickle-viewer': {
    name: 'Pickle Viewer',
    description:
      'Inspect pickle type hints and safety warnings locally from .pkl, JSON, or CSV without executing opcodes — private browser tool for education and research.',
    keywords:
      'pickle viewer online, local pickle type hint scanner, pickle.loads torch.load alternative, pkl json csv dump',
  },
  '/cad-viewers/dwg-viewer': {
    name: 'DWG Viewer',
    description:
      'Inspect AutoCAD DWG layers, entities, and measurements locally from .dwg dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'dwg viewer online, local autocad dwg layer measurement parser, trueview oda alternative, dwg json csv dump',
  },
  '/cad-viewers/dxf-viewer': {
    name: 'DXF Viewer',
    description:
      'Preview ASCII DXF drawings, layers, and entities locally from .dxf, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'dxf viewer online, local ascii dxf layer entity parser, autocad dxf alternative, dxf json csv dump',
  },
  '/cad-viewers/dwf-viewer': {
    name: 'DWF Viewer',
    description:
      'Inspect Design Web Format published sheets and layers locally from .dwf dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'dwf viewer online, local dwf dwfx publish sheet parser, design review trueview alternative, dwf json csv dump',
  },
  '/cad-viewers/dgn-viewer': {
    name: 'DGN Viewer',
    description:
      'Review MicroStation DGN levels and civil features locally from .dgn dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'dgn viewer online, local microstation dgn level alignment parser, bentley view alternative, dgn json csv dump',
  },
  '/cad-viewers/step-viewer': {
    name: 'STEP Viewer',
    description:
      'Inspect ISO 10303 STEP solids, products, and measurements locally from .step / .stp dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'step viewer online, local iso 10303 step solid measurement parser, freecad occt alternative, step stp json csv dump',
  },
  '/cad-viewers/iges-viewer': {
    name: 'IGES Viewer',
    description:
      'Preview IGES surfaces and directory entities locally from .iges / .igs dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'iges viewer online, local iges 5.3 surface entity parser, igs json csv dump, step iges cad preview',
  },
  '/cad-viewers/parasolid-viewer': {
    name: 'Parasolid Viewer',
    description:
      'Inspect Parasolid XT solids, bodies, and measurements locally from .x_t / .x_b dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'parasolid viewer online, local xt xb solid measurement parser, siemens nx alternative, x_t x_b json csv dump',
  },
  '/cad-viewers/catia-viewer': {
    name: 'CATIA Viewer',
    description:
      'Review Dassault CATIA parts and assemblies locally from .catpart / .catproduct dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'catia viewer online, local catpart catproduct assembly parser, 3dexperience alternative, catia json csv dump',
  },
  '/cad-viewers/solidworks-viewer': {
    name: 'SolidWorks Viewer',
    description:
      'Inspect SolidWorks parts and assemblies locally from .sldprt / .sldasm dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'solidworks viewer online, local sldprt sldasm assembly parser, edrawings alternative, solidworks json csv dump',
  },
  '/cad-viewers/fusion-360-viewer': {
    name: 'Fusion 360 Viewer',
    description:
      'Preview Fusion 360 bodies and components locally from .f3d dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'fusion 360 viewer online, local f3d body component parser, autodesk viewer alternative, fusion json csv dump',
  },
  '/cad-viewers/inventor-viewer': {
    name: 'Inventor Viewer',
    description:
      'Inspect Autodesk Inventor parts and assemblies locally from .ipt / .iam dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'inventor viewer online, local ipt iam assembly parser, autodesk inventor alternative, inventor json csv dump',
  },
  '/cad-viewers/creo-viewer': {
    name: 'Creo Viewer',
    description:
      'Review PTC Creo parts and assemblies locally from .prt / .asm dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'creo viewer online, local prt asm assembly parser, creo view alternative, ptc creo json csv dump',
  },
  '/cad-viewers/rhino-3dm-viewer': {
    name: 'Rhino 3DM Viewer',
    description:
      'Inspect Rhinoceros surfaces and layers locally from .3dm dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'rhino 3dm viewer online, local 3dm surface layer parser, rhinoceros alternative, rhino json csv dump',
  },
  '/cad-viewers/sketchup-viewer': {
    name: 'SketchUp Viewer',
    description:
      'Preview SketchUp groups and components locally from .skp dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'sketchup viewer online, local skp group component parser, trimble sketchup alternative, skp json csv dump',
  },
  '/cad-viewers/plt-plot-viewer': {
    name: 'PLT Plot Viewer',
    description:
      'Preview HPGL/PLT vector plots and pens locally from .plt dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'plt plot viewer online, local hpgl plt pen vector parser, designjet plot alternative, plt json csv dump',
  },
  '/cad-viewers/hpgl-viewer': {
    name: 'HPGL Viewer',
    description:
      'Inspect HP-GL plotter language layers and commands locally from .hpgl/.hgl dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'hpgl viewer online, local hp-gl layer command parser, designjet hpgl alternative, hpgl hgl json csv dump',
  },
  '/cad-viewers/gerber-file-viewer': {
    name: 'Gerber File Viewer',
    description:
      'Preview Gerber RS-274X copper, silk, and mask artwork locally from .gbr/.ger dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'gerber viewer online, local rs-274x copper silk mask parser, gerberview kicad alternative, gbr ger json csv dump',
  },
  '/cad-viewers/pcb-layout-viewer': {
    name: 'PCB Layout Viewer',
    description:
      'Inspect PCB layer stack, nets, tracks, and vias locally from .pcb dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'pcb layout viewer online, local board stack net trace parser, kicad eagle altium alternative, pcb json csv dump',
  },
  '/cad-viewers/kicad-viewer': {
    name: 'KiCad Viewer',
    description:
      'Preview KiCad board and schematic locally from .kicad_pcb/.kicad_sch dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'kicad viewer online, local kicad_pcb kicad_sch parser, pcbnew eeschema alternative, kicad json csv dump',
  },
  '/cad-viewers/eagle-pcb-viewer': {
    name: 'Eagle PCB Viewer',
    description:
      'Inspect Eagle board and schematic locally from .brd/.sch dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'eagle pcb viewer online, local brd sch xml parser, autodesk eagle fusion electronics alternative, eagle json csv dump',
  },
  '/cad-viewers/altium-pcb-viewer': {
    name: 'Altium PCB Viewer',
    description:
      'Preview Altium copper layers and designators locally from .pcbdoc/.schdoc dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'altium pcb viewer online, local pcbdoc schdoc copper designator parser, altium designer 365 alternative, altium json csv dump',
  },
  '/cad-viewers/gdsii-layout-viewer': {
    name: 'GDSII Layout Viewer',
    description:
      'Inspect GDSII semiconductor layers and cells locally from .gds dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'gdsii layout viewer online, local gds gdsii layer cell parser, klayout calibre alternative, gds json csv dump',
  },
  '/cad-viewers/ifc-viewer': {
    name: 'IFC Viewer',
    description:
      'Preview IFC OpenBIM buildings locally with elements, property sets, and discipline filters from .ifc dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'ifc viewer online, local ifc4 building property discipline parser, bim vision fzk alternative, ifc json csv dump',
  },
  '/cad-viewers/revit-viewer': {
    name: 'Revit Viewer',
    description:
      'Inspect Revit families, types, and BIM instances locally from .rvt/.rfa dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'revit viewer online, local rvt rfa family type parser, autodesk revit forge alternative, revit json csv dump',
  },
  '/cad-viewers/navisworks-viewer': {
    name: 'Navisworks Viewer',
    description:
      'Preview Navisworks coordination models locally with clash context, 3D navigate, and federated models from .nwd dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'navisworks viewer online, local nwd nwf nwc clash context parser, autodesk navisworks freedom alternative, navisworks json csv dump',
  },
  '/cad-viewers/bim-clash-viewer': {
    name: 'BIM Clash Viewer',
    description:
      'Review BIM clash lists and 3D focus locally from clash report XML, IFC dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'bim clash viewer online, local clash report xml parser, navisworks clash detective solibri alternative, clash json csv dump',
  },
  '/cad-viewers/building-floor-plan-viewer': {
    name: 'Building Floor Plan Viewer',
    description:
      'Inspect building floor-plan levels and rooms locally from IFC plan dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'building floor plan viewer online, local ifc storey room level parser, revit archicad floor plan alternative, ifc json csv dump',
  },
  '/cad-viewers/mep-model-viewer': {
    name: 'MEP Model Viewer',
    description:
      'Preview MEP mechanical, electrical, and plumbing models locally with discipline filters and 3D from IFC dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'mep model viewer online, local ifc flow segment discipline parser, magicad revit mep alternative, mep json csv dump',
  },
  '/cad-viewers/structural-model-viewer': {
    name: 'Structural Model Viewer',
    description:
      'Inspect structural BIM members, sections, and properties locally from IFC dumps, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'structural model viewer online, local ifc beam column footing parser, tekla robot alternative, structural json csv dump',
  },

  '/process-viewers/bpel-viewer': {
    name: 'BPEL Viewer',
    description:
      'Browse WS-BPEL 2.0 orchestration locally with partner links, receive/invoke/reply, and branching from .bpel, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'bpel viewer online, ws-bpel 2.0 parser, partner link orchestration browser, local apache ode alternative, bpel csv json dump',
  },
  '/process-viewers/pnml-viewer': {
    name: 'PNML Viewer',
    description:
      'Explore PNML Petri nets locally with places, transitions, tokens, and enabled firings from .pnml, XML, JSON, or CSV — private browser tool for education and research.',
    keywords:
      'pnml viewer online, petri net markup parser, place transition token browser, local pipe woped alternative, pnml csv json dump',
  },
  '/process-viewers/dmn-viewer': {
    name: 'DMN Viewer',
    description:
      'Browse DMN 1.3 decision tables and DRD graphs locally from .dmn, XML, JSON, or CSV with export — private browser tool for education and research.',
    keywords:
      'dmn viewer online, dmn 1.3 decision table parser, drd graph browser, local camunda dmn alternative, dmn csv json dump',
  },
  '/process-viewers/decision-model-viewer': {
    name: 'Decision Model Viewer',
    description:
      'Explore decision models locally with tables, rules, and dependency graphs from JSON, DMN, or CSV — private browser tool for education and research.',
    keywords:
      'decision model viewer online, decision table dependency graph, rule hit policy browser, local drools dmn alternative, decision csv json dump',
  },
  '/process-viewers/bpmn-analytics-viewer': {
    name: 'BPMN Analytics Viewer',
    description:
      'Review BPMN activity frequency, wait time, and bottleneck overlays locally from JSON, CSV, or .bpmn with export — private browser tool for education and research.',
    keywords:
      'bpmn analytics viewer online, process bottleneck overlay, activity wait time frequency browser, local camunda optimize alternative, bpmn csv json dump',
  },
  '/process-viewers/bpmn-viewer': {
    name: 'BPMN Viewer',
    description:
      'Open BPMN 2.0 diagrams in your browser with bpmn-js. Pan, zoom, inspect tasks and gateways, and export SVG — private and free.',
    keywords:
      'bpmn viewer online, bpmn file viewer, open bpmn diagram, bpmn.js viewer, business process diagram viewer',
  },
  '/gis-viewers/geojson-viewer': {
    name: 'GeoJSON Viewer',
    description:
      'Open GeoJSON FeatureCollections on an interactive map. Inspect attributes, filter geometry types, and export CSV — private and free.',
    keywords:
      'geojson viewer online, geojson map viewer, open geojson file, featurecollection viewer, leaflet geojson',
  },
  '/gis-viewers/gpx-viewer': {
    name: 'GPX Viewer',
    description:
      'Open GPX tracks, routes, and waypoints on a map with elevation profile, distance, and activity stats — private and free.',
    keywords:
      'gpx viewer online, gpx map viewer, open gpx file, gps track viewer, elevation profile gpx',
  },
  '/gis-viewers/shapefile-viewer': {
    name: 'Shapefile Viewer',
    description:
      'Open ESRI Shapefiles (.shp/.dbf/.shx or .zip) on an interactive map. Inspect attributes, filter features, and export GeoJSON — private and free.',
    keywords:
      'shapefile viewer online, open shp file, shapefile map viewer, esri shapefile viewer, zip shapefile viewer',
  },
  '/gis-viewers/kml-viewer': {
    name: 'KML Viewer',
    description:
      'Open KML placemarks, paths, and polygons on an interactive map. Inspect folders and attributes, then export GeoJSON — private and free.',
    keywords:
      'kml viewer online, open kml file, google earth kml viewer, kml map viewer, placemark viewer',
  },
  '/gis-viewers/kmz-viewer': {
    name: 'KMZ Viewer',
    description:
      'Open KMZ packages (zipped KML) on an interactive map. Inspect package contents, placemarks, and attributes — private and free.',
    keywords:
      'kmz viewer online, open kmz file, google earth kmz viewer, zipped kml viewer, kmz map viewer',
  },
  '/gis-viewers/topojson-viewer': {
    name: 'TopoJSON Viewer',
    description:
      'Open TopoJSON topologies on an interactive map. Inspect objects and arcs, filter features, and export GeoJSON — private and free.',
    keywords:
      'topojson viewer online, open topojson file, topology map viewer, topojson to geojson, d3 topojson viewer',
  },
  '/gis-viewers/geopackage-viewer': {
    name: 'GeoPackage Viewer',
    description:
      'Open OGC GeoPackage (.gpkg) feature layers on an interactive map. Inspect attributes, switch layers, and export GeoJSON — private and free.',
    keywords:
      'geopackage viewer online, open gpkg file, ogc geopackage viewer, sqlite geo viewer, gpkg map viewer',
  },
  '/gis-viewers/mbtiles-viewer': {
    name: 'MBTiles Viewer',
    description:
      'Open MBTiles packages on an interactive map. Inspect metadata, zoom range, and offline raster tiles — private and free.',
    keywords:
      'mbtiles viewer online, open mbtiles file, mapbox mbtiles viewer, offline map tiles viewer, mbtiles map',
  },
  '/gis-viewers/geotiff-viewer': {
    name: 'GeoTIFF Viewer',
    description:
      'Open GeoTIFF rasters on an interactive map. Stretch bands, inspect georeferencing, and export PNG or metadata — private and free.',
    keywords:
      'geotiff viewer online, open geotiff file, tif map viewer, georeferenced tiff viewer, raster geo viewer',
  },
  '/gis-viewers/cog-viewer': {
    name: 'COG Viewer',
    description:
      'Inspect Cloud Optimized GeoTIFF (COG) compliance, overviews, and windowed previews — upload locally or load a remote URL.',
    keywords:
      'cog viewer online, cloud optimized geotiff viewer, open cog file, geotiff overviews, remote cog url',
  },
  '/gis-viewers/dem-viewer': {
    name: 'DEM Viewer',
    description:
      'Open digital elevation GeoTIFF grids on a map. View height colormaps, hillshade, elevation stats, and click-to-sample height — private and free.',
    keywords:
      'dem viewer online, digital elevation model viewer, geotiff dem viewer, hillshade elevation map, elevation raster viewer',
  },
  '/gis-viewers/terrain-viewer': {
    name: 'Terrain Viewer',
    description:
      'Visualize terrain relief from elevation GeoTIFF — hillshade, contours, shaded relief, and vertical exaggeration in your browser.',
    keywords:
      'terrain viewer online, shaded relief viewer, contour map from dem, hillshade geotiff, elevation relief viewer',
  },
  '/gis-viewers/contour-map-viewer': {
    name: 'Contour Map Viewer',
    description:
      'Generate isolines from elevation GeoTIFF or open contour GeoJSON. Adjust interval, labels, and DEM underlay — private and free.',
    keywords:
      'contour map viewer online, dem contours, isoline map, geotiff contour generator, elevation contour geojson',
  },
  '/gis-viewers/gps-track-viewer': {
    name: 'GPS Track Viewer',
    description:
      'Analyze GPS movement with speed-colored tracks, pace charts, moving time, and unit toggle — private and free.',
    keywords:
      'gps track viewer online, speed pace analytics, gpx speed map, moving time calculator, gps track csv',
  },
  '/gis-viewers/drone-flight-path-viewer': {
    name: 'Drone Flight Path Viewer',
    description:
      'Preview drone flights with altitude-colored paths, climb rates, takeoff/landing markers, and telemetry — private and free.',
    keywords:
      'drone flight path viewer, drone gpx altitude map, uav telemetry viewer, agl amsl flight profile, drone photo waypoints',
  },
  '/gis-viewers/lidar-map-viewer': {
    name: 'LiDAR Map Viewer',
    description:
      'Open LAS point clouds on a 2D map. Color by classification, elevation, or intensity with class filters — private and free.',
    keywords:
      'lidar map viewer online, las point cloud map, asprs classification viewer, lidar density map, las to geojson',
  },
  '/gis-viewers/point-cloud-viewer': {
    name: 'Point Cloud Viewer',
    description:
      'Orbit LAS, PLY, and PCD point clouds in 3D. Clip by elevation, color by intensity or RGB, and export XYZ — private and free.',
    keywords:
      'point cloud viewer online, las ply pcd viewer, 3d point cloud orbit, lidar intensity color, ascii ply viewer',
  },
  '/gis-viewers/satellite-image-viewer': {
    name: 'Satellite Image Viewer',
    description:
      'Explore EO GeoTIFF imagery with true color, false color IR, stretch, and NDVI — private and free.',
    keywords:
      'satellite image viewer online, eo geotiff viewer, false color ir, ndvi geotiff, true color satellite map',
  },
  '/gis-viewers/vector-tile-viewer': {
    name: 'Vector Tile Viewer',
    description:
      'Decode Mapbox Vector Tiles (.mvt / .pbf) on a map. Inspect layers, attributes, and export GeoJSON — private and free.',
    keywords:
      'vector tile viewer online, mvt viewer, pbf vector tile, mapbox vector tile inspect, mvt to geojson',
  },
  '/gis-viewers/raster-map-viewer': {
    name: 'Raster Map Viewer',
    description:
      'Open GeoTIFF or ASCII Grid rasters with stretch, band select, colormaps, and a color legend — private and free.',
    keywords:
      'raster map viewer online, ascii grid viewer, geotiff stretch colormap, band composite map, asc raster viewer',
  },
  '/medical-viewers/dicom-viewer': {
    name: 'DICOM Viewer',
    description:
      'Open DICOM images locally with window/level, multi-slice navigation, metadata, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'dicom viewer online, open dcm file, medical image viewer, window level dicom, dicom metadata viewer',
  },
  '/medical-viewers/nifti-viewer': {
    name: 'NIfTI Viewer',
    description:
      'Open NIfTI (.nii / .nii.gz) volumes with ortho slices, windowing, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'nifti viewer online, open nii file, neuroimaging viewer, nii.gz viewer, brain volume slice viewer',
  },
  '/medical-viewers/mri-viewer': {
    name: 'MRI Viewer',
    description:
      'Open MRI DICOM series locally with series picker, slice navigation, MRI window presets, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'mri viewer online, open mri dicom, mr series viewer, brain mri window level, dicom mri viewer',
  },
  '/medical-viewers/ct-scan-viewer': {
    name: 'CT Scan Viewer',
    description:
      'Open CT DICOM series locally with wheel scroll, HU probe, distance measure, CT window presets, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'ct scan viewer online, open ct dicom, hu probe viewer, ct window presets, measure dicom distance',
  },
  '/medical-viewers/x-ray-viewer': {
    name: 'X-Ray Viewer',
    description:
      'Open radiograph DICOM (CR/DX/XR/RF) locally with zoom, pan, rotate, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'x ray viewer online, open dicom radiograph, chest xray window level, dicom dx viewer, cr xray viewer',
  },
  '/medical-viewers/ultrasound-viewer': {
    name: 'Ultrasound Viewer',
    description:
      'Open ultrasound DICOM locally with cine playback, frame slider, metadata table, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'ultrasound viewer online, dicom us cine, open ultrasound dicom, us loop viewer, medical ultrasound metadata',
  },
  '/medical-viewers/mammography-viewer': {
    name: 'Mammography Viewer',
    description:
      'Open mammography DICOM (MG) locally with screening hanging layout (CC/MLO), zoom, window/level presets, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'mammography viewer online, dicom mg hanging, breast screening viewer, cc mlo viewer, mammogram window level',
  },
  '/medical-viewers/pet-scan-viewer': {
    name: 'PET Scan Viewer',
    description:
      'Open PET DICOM locally with hot colormap, SUV probe, slice navigation, and PT+CT fuse overlay — private browser preview for education and research (not for diagnosis).',
    keywords:
      'pet scan viewer online, dicom pt suv, pet ct fusion viewer, fdg pet viewer, nuclear medicine dicom',
  },
  '/medical-viewers/nrrd-viewer': {
    name: 'NRRD Viewer',
    description:
      'Open NRRD scientific volume grids locally with ortho slices, intensity histogram, window/level, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'nrrd viewer online, open nrrd file, nrrd slice viewer, scientific volume histogram, nearly raw raster data',
  },
  '/medical-viewers/minc-viewer': {
    name: 'MINC Viewer',
    description:
      'Open MINC 1 neuroimaging volumes locally with ortho slices, metadata table, window/level, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'minc viewer online, open minc file, minc neuroimaging viewer, netcdf classic mnc, minc metadata viewer',
  },
  '/medical-viewers/pathology-slide-viewer': {
    name: 'Pathology Slide Viewer',
    description:
      'Open digital pathology slides locally with deep zoom, H&E stain presets, point/rectangle annotations, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'pathology slide viewer online, digital pathology viewer, he slide annotations, deep zoom pathology, wsi education',
  },
  '/medical-viewers/whole-slide-image-viewer': {
    name: 'Whole Slide Image Viewer',
    description:
      'Open whole slide images locally with pyramid zoom, minimap navigation, region-of-interest tools, and PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'whole slide image viewer online, wsi viewer, pyramid zoom pathology, svs png viewer, slide regions roi',
  },
  '/medical-viewers/ecg-viewer': {
    name: 'ECG Viewer',
    description:
      'Open ECG waveform recordings locally with multi-lead display, gain and paper speed controls, caliper measurements, and JSON/PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'ecg viewer online, electrocardiogram waveform viewer, 12 lead ecg csv json, ecg calipers browser, local ecg preview',
  },
  '/medical-viewers/eeg-viewer': {
    name: 'EEG Viewer',
    description:
      'Open EEG recordings locally with multi-channel traces, referential/bipolar/average montage, time scrolling, and JSON/PNG export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'eeg viewer online, electroencephalogram trace viewer, eeg montage browser, eeg csv json channels, local eeg preview',
  },
  '/medical-viewers/hl7-message-viewer': {
    name: 'HL7 Message Viewer',
    description:
      'Decode HL7 v2 pipe-delimited messages locally with segment and field breakdown, search, and JSON export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'hl7 message viewer online, hl7 segment decoder, hl7 v2 parser browser, pid obr obx viewer, local hl7 preview',
  },
  '/medical-viewers/fhir-resource-viewer': {
    name: 'FHIR Resource Viewer',
    description:
      'Navigate FHIR JSON/XML resources locally with tree view, reference graph, date timeline, and JSON export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'fhir resource viewer online, fhir json xml browser, fhir bundle viewer, fhir reference graph, local fhir preview',
  },
  '/medical-viewers/medical-timeline-viewer': {
    name: 'Medical Timeline Viewer',
    description:
      'Build patient and encounter timelines locally from JSON, CSV, FHIR, or HL7 clinical events with filters and grouping — private browser preview for education and research (not for diagnosis).',
    keywords:
      'medical timeline viewer online, patient timeline browser, clinical events csv json, encounter timeline tool, local healthcare timeline',
  },
  '/medical-viewers/cda-viewer': {
    name: 'CDA Viewer',
    description:
      'Review HL7 Clinical Document Architecture (CDA) XML locally with structured sections, narrative rendering, and JSON export — private browser preview for education and research (not for diagnosis).',
    keywords:
      'cda viewer online, hl7 cda xml viewer, clinical document architecture browser, ccd narrative sections, local cda preview',
  },
  '/science-viewers/hdf5-viewer': {
    name: 'HDF5 Viewer',
    description:
      'Browse HDF5 hierarchical datasets locally with group tree navigation, attribute inspection, numeric array preview, and JSON export — private browser tool for education and research.',
    keywords:
      'hdf5 viewer online, hdf5 file browser, h5 dataset preview, hierarchical scientific data viewer, local hdf5 parser',
  },
  '/science-viewers/netcdf-viewer': {
    name: 'NetCDF Viewer',
    description:
      'Explore NetCDF classic climate and science grids locally with variable browser, slice preview, histogram, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'netcdf viewer online, netcdf classic browser, nc file variable viewer, climate grid slice preview, local netcdf parser',
  },
  '/science-viewers/fits-viewer': {
    name: 'FITS Viewer',
    description:
      'View astronomical FITS images locally with HDU browser, header cards, WCS metadata, stretch preview, and JSON/CSV export — private browser tool for education and research.',
    keywords:
      'fits viewer online, astronomical fits browser, fits header wcs viewer, fits image stretch preview, local fits parser',
  },
  '/science-viewers/grib-viewer': {
    name: 'GRIB Viewer',
    description:
      'Browse GRIB2 weather model messages locally with field heatmaps, grid metadata, histogram, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'grib viewer online, grib2 weather grid browser, meteorological grib parser, grib field heatmap preview, local grib2 viewer',
  },
  '/science-viewers/matlab-mat-viewer': {
    name: 'MATLAB MAT Viewer',
    description:
      'Explore MATLAB MAT v5 and v7.3 variables locally with array preview, histogram, slice browser, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'matlab mat viewer online, mat file browser, matlab array preview, mat v5 parser, local mat file viewer',
  },
  '/science-viewers/root-file-viewer': {
    name: 'ROOT File Viewer',
    description:
      'Browse ROOT histograms and tree branches locally with object browser, bar chart preview, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'root file viewer online, root histogram browser, hep root parser, ttree branch preview, local root viewer',
  },
  '/science-viewers/molecular-structure-viewer': {
    name: 'Molecular Structure Viewer',
    description:
      'Preview PDB, MOL, and SDF molecules locally with ball-and-stick, spacefill, wireframe, rotation, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'molecular structure viewer online, pdb mol sdf viewer, ball and stick molecule preview, local molecule parser',
  },
  '/science-viewers/protein-structure-viewer': {
    name: 'Protein Structure Viewer',
    description:
      'Inspect protein PDB files locally with ribbon and backbone preview, residue search, chain filter, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'protein structure viewer online, pdb ribbon viewer, residue browser pdb, local protein pdb parser',
  },
  '/science-viewers/fasta-viewer': {
    name: 'FASTA Viewer',
    description:
      'Browse multi-FASTA sequences locally with search, wrap, reverse-complement, translation, and composition charts — private browser tool for education and research.',
    keywords:
      'fasta viewer online, multi fasta browser, dna rna protein sequence viewer, local fasta parser, gc content fasta',
  },
  '/science-viewers/fastq-viewer': {
    name: 'FASTQ Viewer',
    description:
      'Inspect FASTQ sequencing reads locally with Phred quality plots, filters, and CSV/FASTQ export — private browser tool for education and research.',
    keywords:
      'fastq viewer online, phred quality browser, sequencing read viewer, local fastq parser, fastq qc preview',
  },
  '/science-viewers/genbank-viewer': {
    name: 'GenBank Viewer',
    description:
      'Inspect GenBank annotations locally with feature maps, CDS translation, sequence preview, and CSV/FASTA export — private browser tool for education and research.',
    keywords:
      'genbank viewer online, gbk feature map, cds translation viewer, local genbank parser, annotated sequence browser',
  },
  '/science-viewers/vcf-variant-viewer': {
    name: 'VCF Variant Viewer',
    description:
      'Browse VCF variants locally with chromosome filters, QUAL/PASS, genotypes, INFO, and CSV/VCF export — private browser tool for education and research.',
    keywords:
      'vcf viewer online, variant table browser, vcf genotype viewer, local vcf parser, snp indel filter',
  },
  '/science-viewers/las-well-log-viewer': {
    name: 'LAS Well Log Viewer',
    description:
      'Inspect CWLS LAS well logs locally with depth tracks, crossplots, histograms, curve stats, and CSV/LAS export — private browser tool for education and research.',
    keywords:
      'las well log viewer online, cwls las viewer, well log depth tracks, local las parser, gamma density neutron sonic',
  },
  '/science-viewers/dlis-viewer': {
    name: 'DLIS Viewer',
    description:
      'Inspect DLIS storage units locally with SUL, visible records, channel catalogs, depth-track preview, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'dlis viewer online, rp66 dlis browser, well log dlis channels, local dlis parser, eflr iflr preview',
  },
  '/science-viewers/seg-y-viewer': {
    name: 'SEG-Y Viewer',
    description:
      'Inspect SEG-Y seismic locally with section and wiggle views, gain/AGC, trace headers, and CSV/PNG export — private browser tool for education and research.',
    keywords:
      'segy viewer online, seg-y seismic section, wiggle trace viewer, local segy parser, seismic gain agc',
  },
  '/science-viewers/geological-model-viewer': {
    name: 'Geological Model Viewer',
    description:
      'Inspect layered geological models locally with map, cross-section, stratigraphic column, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'geological model viewer online, cross section geology, stratigraphic column viewer, local geojson geology parser',
  },
  '/science-viewers/borehole-viewer': {
    name: 'Borehole Viewer',
    description:
      'Inspect borehole trajectories locally with plan, section, lithology, dogleg severity, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'borehole viewer online, well trajectory viewer, deviation survey md inc azi, dogleg severity calculator, local borehole parser',
  },
  '/science-viewers/stratigraphy-viewer': {
    name: 'Stratigraphy Viewer',
    description:
      'Inspect stratigraphic columns locally with thickness, chronostratigraphy, correlation, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'stratigraphy viewer online, chronostratigraphic column, geologic time chart, local stratigraphy parser, correlation panel',
  },
  '/science-viewers/climate-data-viewer': {
    name: 'Climate Data Viewer',
    description:
      'Explore climate grids and station series locally with NetCDF, GRIB, maps, time series, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'climate data viewer online, netcdf climate map, grib time series viewer, local climate csv parser, station temperature plot',
  },
  '/science-viewers/simulation-result-viewer': {
    name: 'Simulation Result Viewer',
    description:
      'Inspect simulation scalar fields locally with slices, probes, VTK ASCII, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'simulation result viewer online, vtk structured points viewer, heat diffusion field slice, local simulation csv parser, probe time series',
  },
  '/network-viewers/har-viewer': {
    name: 'HAR Viewer',
    description:
      'Inspect browser HAR captures locally with waterfall, headers, timing breakdown, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'har viewer online, http archive waterfall, chrome har analyzer, local har parser, request timing viewer',
  },
  '/network-viewers/pcap-viewer': {
    name: 'PCAP Viewer',
    description:
      'Inspect PCAP and PCAPNG captures locally with packet list, filters, hex dump, follow-stream, and CSV export — private browser tool for education and research.',
    keywords:
      'pcap viewer online, pcapng packet analyzer, follow tcp stream browser, local pcap parser, wireshark alternative online',
  },
  '/network-viewers/pcapng-viewer': {
    name: 'PCAPNG Viewer',
    description:
      'Inspect PCAPNG captures locally with interface blocks, packet timeline, ISB stats, hex preview, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'pcapng viewer online, pcapng interface viewer, eth0 wlan0 capture analyzer, local pcapng parser, wireshark pcapng alternative',
  },
  '/network-viewers/network-traffic-viewer': {
    name: 'Network Traffic Viewer',
    description:
      'Explore conversations, protocols, and talkers locally from PCAP/PCAPNG or JSON/CSV/.flow dumps with CSV/JSON export — private browser tool for education and research.',
    keywords:
      'network traffic viewer online, flow dump analyzer, conversation talker viewer, local pcap flow parser, netflow alternative browser',
  },
  '/network-viewers/packet-analyzer': {
    name: 'Packet Analyzer',
    description:
      'Inspect packets locally with layer decode, hex dump, field offsets, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'packet analyzer online, deep packet inspection browser, pcap hex decoder, local packet dissector, wireshark alternative dpi',
  },
  '/network-viewers/protocol-analyzer': {
    name: 'Protocol Analyzer',
    description:
      'Analyze protocol mix locally with dissectors, timeline, conversation counts, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'protocol analyzer online, pcap protocol dissector, http dns tcp mix viewer, local protocol statistics, wireshark protocol browser',
  },
  '/network-viewers/http-trace-viewer': {
    name: 'HTTP Trace Viewer',
    description:
      'Review HTTP request/response conversations locally from HAR, .trace, or .http dumps with CSV/JSON export — private browser tool for education and research.',
    keywords:
      'http trace viewer online, request response conversation, har http trace parser, local http dump viewer, mitmproxy alternative browser',
  },
  '/network-viewers/api-request-viewer': {
    name: 'API Request Viewer',
    description:
      'Inspect API calls locally with pretty JSON bodies, headers, query params, and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'api request viewer online, rest collection viewer, postman json body inspector, local .http file viewer, api dump analyzer browser',
  },
  '/network-viewers/firewall-log-viewer': {
    name: 'Firewall Log Viewer',
    description:
      'Explore allow/deny/drop/reject events locally from UFW, iptables, CSV, or JSON logs with timeline and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'firewall log viewer online, ufw iptables log parser, allow deny drop timeline, local firewall csv json viewer, pfSense log browser',
  },
  '/network-viewers/siem-log-viewer': {
    name: 'SIEM Log Viewer',
    description:
      'Browse SIEM events locally with severity, MITRE mapping, rule/source correlation, and CSV/JSON export from JSON, CSV, or CEF — private browser tool for education and research.',
    keywords:
      'siem log viewer online, cef json csv siem parser, mitre tactic correlation, elastic splunk alternative browser, local soc event viewer',
  },
  '/network-viewers/syslog-viewer': {
    name: 'Syslog Viewer',
    description:
      'Browse syslog locally by facility and severity from RFC 3164/5424 logs, CSV, or JSON with CSV/JSON export — private browser tool for education and research.',
    keywords:
      'syslog viewer online, rfc 3164 5424 parser, facility severity browser, local rsyslog journalctl viewer, syslog csv json dump',
  },
  '/network-viewers/dns-log-viewer': {
    name: 'DNS Log Viewer',
    description:
      'Review DNS queries and responses locally from BIND, dnsmasq, CSV, or JSON with type timeline and CSV/JSON export — private browser tool for education and research.',
    keywords:
      'dns log viewer online, bind dnsmasq query log parser, dns qtype nxdomain timeline, local resolver log browser, dns csv json dump',
  },
  '/network-viewers/nmap-report-viewer': {
    name: 'Nmap Report Viewer',
    description:
      'Browse Nmap hosts, ports, and services locally from XML, gnmap, or JSON with CSV/JSON export — private browser tool for education and research.',
    keywords:
      'nmap report viewer online, nmap xml gnmap parser, open port host browser, local zenmap alternative, nmap csv json dump',
  },
  '/network-viewers/nessus-report-viewer': {
    name: 'Nessus Report Viewer',
    description:
      'Review Nessus findings locally by severity, host, plugin, and CVE from .nessus XML, CSV, or JSON with export — private browser tool for education and research.',
    keywords:
      'nessus report viewer online, nessus xml parser, vulnerability finding severity browser, local tenable report viewer, nessus csv json dump',
  },
  '/network-viewers/sarif-report-viewer': {
    name: 'SARIF Report Viewer',
    description:
      'Browse SARIF 2.1 static analysis results locally by rule, file location, and level from .sarif, JSON, or CSV with export — private browser tool for education and research.',
    keywords:
      'sarif report viewer online, sarif 2.1 json parser, static analysis rule location browser, local codeql semgrep sarif viewer, sast csv dump',
  },
  '/network-viewers/malware-analysis-report-viewer': {
    name: 'Malware Analysis Report Viewer',
    description:
      'Review sandbox malware reports locally with IOCs, MITRE behaviors, and dropped files from JSON, XML, CSV, or text — private browser tool for education and research.',
    keywords:
      'malware analysis report viewer online, sandbox ioc behavior parser, cuckoo cape json xml viewer, local mitre ttp browser, malware csv ioc dump',
  },
  '/network-viewers/threat-intelligence-viewer': {
    name: 'Threat Intelligence Viewer',
    description:
      'Browse STIX 2.x threat intel locally with indicators, relationships, and objects from JSON, XML, CSV, or text — private browser tool for education and research.',
    keywords:
      'threat intelligence viewer online, stix 2.1 json parser, indicator relationship browser, local misp opencti alternative, threat intel csv dump',
  },

  '/math-date-utils/number-to-words': {
    name: 'Number to Words Converter',
    description: 'Convert numbers into written words for checks, invoices, and documents.',
    keywords: 'number to words, numbers to words converter, convert number to text, cheque amount in words',
  },
  '/math-date-utils/bmi-calculator': {
    name: 'BMI Calculator',
    description: 'Calculate body mass index from height and weight with clear category results.',
    keywords: 'bmi calculator, body mass index calculator, calculate bmi online, bmi chart',
  },
  '/math-date-utils/fraction-calculator': {
    name: 'Fraction Calculator',
    description: 'Add, subtract, multiply, and divide fractions with simplified results.',
    keywords: 'fraction calculator, add fractions, simplify fractions, fraction solver',
  },
  '/math-date-utils/date-to-day-of-week': {
    name: 'Date to Day of Week',
    description: 'Find which weekday any date falls on — past, present, or future.',
    keywords: 'what day is this date, day of week calculator, date to weekday, calendar day finder',
  },
  '/pdf-tools/delete-pages': {
    name: 'Delete PDF Pages',
    description: 'Remove unwanted pages from a PDF instantly. Files stay private in your browser.',
    keywords: 'delete pdf pages, remove pages from pdf, pdf page remover, drop pdf pages',
  },
  '/pdf-tools/rotate-pages': {
    name: 'Rotate PDF Pages',
    description: 'Rotate PDF pages 90°, 180°, or 270° and save a corrected document.',
    keywords: 'rotate pdf, rotate pdf pages, fix sideways pdf, pdf page rotator',
  },
  '/pdf-tools/reorder-pages': {
    name: 'Reorder PDF Pages',
    description: 'Drag and rearrange PDF page order before downloading the new file.',
    keywords: 'reorder pdf pages, rearrange pdf, change pdf page order, organize pdf pages',
  },
  '/pdf-tools/extract-pages': {
    name: 'Extract PDF Pages',
    description: 'Pull selected pages into a new PDF without uploading to a server.',
    keywords: 'extract pdf pages, save pages from pdf, pdf page extractor, split pages from pdf',
  },
  '/pdf-tools/tables-charts-to-pdf': {
    name: 'Tables & Charts to PDF',
    description: 'Turn tables and charts into clean, printable PDF documents.',
    keywords: 'table to pdf, chart to pdf, export table pdf, convert chart to pdf',
  },
  '/pdf-tools/screenshot-to-pdf': {
    name: 'Screenshot to PDF',
    description: 'Convert screenshots and images into a multi-page PDF in seconds.',
    keywords: 'screenshot to pdf, image screenshot pdf, convert screenshot pdf',
  },
  '/pdf-tools/annotate-pdf': {
    name: 'Annotate PDF',
    description: 'Add notes, markup, and comments to PDF pages in your browser.',
    keywords: 'annotate pdf online, pdf markup, comment on pdf, pdf annotation tool',
  },
  '/pdf-tools/highlight-text': {
    name: 'Highlight PDF Text',
    description: 'Highlight important text in PDFs and export the marked-up file.',
    keywords: 'highlight pdf, pdf highlighter, mark text in pdf, highlight pdf online',
  },
  '/pdf-tools/add-signature': {
    name: 'Add Signature to PDF',
    description: 'Draw or upload a signature and place it on any PDF page.',
    keywords: 'sign pdf online, add signature to pdf, electronic signature pdf, pdf signer',
  },
  '/pdf-tools/pdf-metadata-editor': {
    name: 'PDF Metadata Editor',
    description: 'Edit PDF title, author, subject, and keywords without desktop software.',
    keywords: 'pdf metadata editor, edit pdf properties, pdf title author, change pdf metadata',
  },
  '/pdf-tools/pdf-to-base64': {
    name: 'PDF to Base64',
    description: 'Encode a PDF as Base64 for APIs, embeds, and data URLs — or decode back.',
    keywords: 'pdf to base64, encode pdf base64, base64 pdf converter, pdf data uri',
  },
  '/pdf-tools/flatten-pdf-forms': {
    name: 'Flatten PDF Forms',
    description: 'Flatten fillable PDF form fields into a non-editable document.',
    keywords: 'flatten pdf form, flatten pdf fields, make pdf non editable, pdf form flattener',
  },
  '/image-color-tools/image-to-text': {
    name: 'Image to Text (OCR)',
    description: 'Extract text from images with OCR — paste or upload and copy results.',
    keywords: 'image to text, ocr online, extract text from image, photo to text converter',
  },
  '/dev-design-tools/cors-test-tool': {
    name: 'CORS Test Tool',
    description: 'Test cross-origin request headers and CORS responses from any URL.',
    keywords: 'cors tester, cors test tool, check cors headers, cross origin test',
  },
  '/dev-design-tools/websocket-client': {
    name: 'WebSocket Client',
    description: 'Connect to WebSocket endpoints, send messages, and inspect responses live.',
    keywords: 'websocket client online, ws tester, websocket tester, socket.io client tool',
  },
  '/fun-tools/coin-toss-dice-roller': {
    name: 'Coin Toss & Dice Roller',
    description: 'Flip a coin or roll dice for quick random decisions and games.',
    keywords: 'coin toss online, dice roller, flip a coin, random dice roller',
  },
  '/fun-tools/lorem-ipsum-generator': {
    name: 'Lorem Ipsum Generator',
    description: 'Generate placeholder Lorem Ipsum paragraphs for mockups and wireframes.',
    keywords: 'lorem ipsum generator, placeholder text generator, dummy text, lipsum generator',
  },
};

/** Extra high-intent keyword phrases keyed by route (merged into generated keywords). */
const KEYWORD_EXTRAS = {
  '/text-utilities/character-counter':
    'word counter, character count, letter counter, sentence counter, reading time calculator',
  '/text-utilities/text-case-convertor':
    'uppercase converter, lowercase converter, title case, sentence case, camel case converter',
  '/text-utilities/base64-encode-and-decode':
    'base64 encoder, base64 decoder, encode base64 online, decode base64',
  '/text-utilities/url-encode-and-decode':
    'url encoder, url decoder, percent encode, decode url online',
  '/text-utilities/slug-generator': 'url slug generator, seo slug, permalink generator, slugify',
  '/text-utilities/regex-tester': 'regex tester online, regular expression tester, regex match',
  '/text-utilities/find-and-replace': 'find and replace online, text replace, regex replace',
  '/text-utilities/keyword-density': 'keyword density checker, seo keyword analyzer, word frequency',
  '/data-converters/json-formatter-beautifier-validator':
    'json formatter, json beautifier, json validator, pretty print json, json prettifier',
  '/data-converters/csv-to-json-json-to-csv': 'csv to json, json to csv, convert csv json',
  '/data-converters/yaml-to-json-json-to-yaml': 'yaml to json, json to yaml, yaml converter',
  '/pdf-tools/merge-pdfs': 'merge pdf, combine pdf, pdf merger, join pdf files',
  '/pdf-tools/split-pdfs': 'split pdf, pdf splitter, separate pdf pages',
  '/pdf-tools/compress-pdf': 'compress pdf, reduce pdf size, pdf compressor online',
  '/pdf-tools/pdf-viewer': 'pdf viewer online, view pdf in browser, free pdf reader',
  '/pdf-tools/password-protect-pdf': 'password protect pdf, encrypt pdf, lock pdf',
  '/pdf-tools/image-to-pdf': 'image to pdf, jpg to pdf, png to pdf, convert image pdf',
  '/security-tools/hash-generator': 'md5 hash, sha256 generator, sha512 hash, checksum calculator',
  '/security-tools/random-password-generator':
    'password generator, strong password, random password maker',
  '/security-tools/password-strength-checker': 'password strength meter, check password strength',
  '/security-tools/uuid-generator': 'uuid generator, guid generator, random uuid v4',
  '/fun-tools/qr-code-generator': 'qr code generator, create qr code, qr code maker',
  '/fun-tools/barcode-generator': 'barcode generator, create barcode online',
  '/math-date-utils/unit-converter': 'unit converter, metric converter, length weight converter',
  '/math-date-utils/currency-converter': 'currency converter, exchange rate calculator',
  '/math-date-utils/age-calculator': 'age calculator, calculate age from date of birth',
  '/math-date-utils/loan-emi-calculator': 'emi calculator, loan calculator, monthly emi',
  '/image-color-tools/image-resizer': 'image resizer, resize photo online, change image size',
  '/image-color-tools/image-compressor': 'image compressor, compress jpg, reduce image size',
  '/image-color-tools/color-picker': 'color picker, hex color picker, eyedropper tool',
  '/image-color-tools/hex-to-rgb': 'hex to rgb, rgb to hex, color converter',
  '/testing-tools/jwt-decoder': 'jwt decoder, decode jwt token, jwt debugger',
  '/code-file-tools/html-minifier': 'html minifier, minify html online',
  '/code-file-tools/css-minifier': 'css minifier, minify css online',
  '/code-file-tools/javascript-minifier': 'js minifier, minify javascript online',
  '/dev-design-tools/css-gradient-generator': 'css gradient generator, gradient maker',
  '/dev-design-tools/box-shadow-generator': 'box shadow generator, css box shadow',
  '/browser-utils/network-speed-test': 'internet speed test, network speed test, bandwidth test',
};

const CATEGORY_KEYWORD_HINTS = {
  'text-utilities': 'text tool, text editor online, string utility',
  'file-viewers': 'file viewer online, document viewer, open file in browser',
  'data-converters': 'data converter, format converter, json tools',
  'math-date-utils': 'calculator online, converter tool, math utility',
  'pdf-tools': 'pdf tool online, edit pdf free, pdf utility',
  'image-color-tools': 'image tool online, photo editor utility, color tool',
  'code-file-tools': 'code tool online, developer utility, minify tool',
  'dev-design-tools': 'web developer tool, css tool, api testing tool',
  'testing-tools': 'validator online, testing utility, format checker',
  'security-tools': 'security tool, crypto utility, encryption tool',
  'media-tools': 'audio tool online, video utility, media converter',
  'browser-utils': 'browser tool, system utility, web utility',
  'fun-tools': 'productivity tool, generator online, fun utility',
};

function uniqueKeywords(parts) {
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const cleaned = String(part || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function meaningfulSlugPhrases(slug) {
  const words = slug.split('-').filter((w) => w && !STOP_WORDS.has(w));
  const phrases = [];
  if (words.length) {
    phrases.push(words.join(' '));
  }
  // Keep useful 2-word combos from the slug (e.g. "merge pdf", "hash generator")
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  return phrases;
}

function buildEnhancedKeywords(name, categorySlug, routePath, enrichmentKeywords) {
  const short = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
  const slug = routePath.split('/').pop() || '';
  const categoryHint = CATEGORY_KEYWORD_HINTS[categorySlug] || '';
  const extras = KEYWORD_EXTRAS[routePath] || '';

  const parts = [
    short,
    `${short} online`,
    `free ${short}`,
    ...meaningfulSlugPhrases(slug),
    ...categoryHint.split(',').map((s) => s.trim()),
    ...extras.split(',').map((s) => s.trim()),
    ...(enrichmentKeywords || '').split(',').map((s) => s.trim()),
    'free online tool',
    'no signup',
    'easytoolhub',
  ];

  return uniqueKeywords(parts).slice(0, 16).join(', ');
}

function getEnrichment(routePath) {
  return TOOL_ENRICHMENT[routePath] || null;
}

module.exports = {
  TOOL_ENRICHMENT,
  KEYWORD_EXTRAS,
  getEnrichment,
  buildEnhancedKeywords,
};
