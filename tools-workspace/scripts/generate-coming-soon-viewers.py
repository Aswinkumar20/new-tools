#!/usr/bin/env python3
"""Generate coming-soon category libs + routes from the future-file-viewers roadmap."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LIVE_MESSAGE = "Soon this tool will be live"

CATEGORIES = {
    "cad-viewers": {
        "name": "CAD & Engineering Viewers",
        "description": "Open DWG, DXF, STEP, IFC, and PCB files in the browser.",
        "faIcon": "fas fa-drafting-compass",
        "materialIcon": "architecture",
        "component": "ComingSoonPageComponent",
        "selector": "lib-coming-soon-page",
    },
    "gis-viewers": {
        "name": "GIS & Mapping Viewers",
        "description": "Explore GeoJSON, GPX, Shapefiles, and maps online.",
        "faIcon": "fas fa-map-marked-alt",
        "materialIcon": "map",
        "component": "ComingSoonPageComponent",
        "selector": "lib-coming-soon-page",
    },
    "medical-viewers": {
        "name": "Medical & Healthcare Viewers",
        "description": "DICOM, NIfTI, FHIR, and clinical file viewers.",
        "faIcon": "fas fa-notes-medical",
        "materialIcon": "medical_services",
        "component": "ComingSoonPageComponent",
        "selector": "lib-coming-soon-page",
    },
    "science-viewers": {
        "name": "Scientific Data Viewers",
        "description": "NetCDF, HDF5, FITS, seismic, and research datasets.",
        "faIcon": "fas fa-flask",
        "materialIcon": "science",
        "component": "ScienceComingSoonPageComponent",
        "selector": "lib-science-coming-soon-page",
    },
    "network-viewers": {
        "name": "Network & Traffic Viewers",
        "description": "HAR, PCAP, and protocol analysis in the browser.",
        "faIcon": "fas fa-network-wired",
        "materialIcon": "lan",
        "component": "NetworkComingSoonPageComponent",
        "selector": "lib-network-coming-soon-page",
    },
    "process-viewers": {
        "name": "Process & Workflow Viewers",
        "description": "BPMN, DMN, Petri nets, and process mining tools.",
        "faIcon": "fas fa-project-diagram",
        "materialIcon": "account_tree",
        "component": "ProcessComingSoonPageComponent",
        "selector": "lib-process-coming-soon-page",
    },
    "diagram-viewers": {
        "name": "Diagram & Graph Viewers",
        "description": "Mermaid, PlantUML, Graphviz, UML, and mind maps.",
        "faIcon": "fas fa-sitemap",
        "materialIcon": "schema",
        "component": "DiagramComingSoonPageComponent",
        "selector": "lib-diagram-coming-soon-page",
    },
    "data-explorers": {
        "name": "Data Explorers",
        "description": "Browse Parquet, Avro, SQLite, and columnar files.",
        "faIcon": "fas fa-table",
        "materialIcon": "table_chart",
        "component": "DataExplorersComingSoonPageComponent",
        "selector": "lib-data-explorers-coming-soon-page",
    },
    "ml-viewers": {
        "name": "ML Model Viewers",
        "description": "Inspect ONNX and other ML model graphs.",
        "faIcon": "fas fa-brain",
        "materialIcon": "psychology",
        "component": "MlComingSoonPageComponent",
        "selector": "lib-ml-coming-soon-page",
    },
    "file-viewers": {
        "name": "File Viewers",
        "existing": True,
    },
}


def slugify(title: str) -> str:
    s = title.lower()
    s = s.replace("/", " ")
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s.endswith("-viewer") and "viewer" not in s and "analyzer" not in s and "explorer" not in s and "browser" not in s and "simulator" not in s:
        s = f"{s}-viewer"
    return s


def tool(title: str, formats: str, tagline: str, *roadmap: str) -> dict:
    return {
        "slug": slugify(title),
        "title": title if title.lower().endswith("viewer") or "analyzer" in title.lower() or "explorer" in title.lower() or "browser" in title.lower() or "simulator" in title.lower() else f"{title}",
        "tagline": tagline,
        "formatsLabel": formats,
        "roadmap": list(roadmap) or ["Interactive preview", "Local file parsing", "Export / share views"],
        "liveMessage": LIVE_MESSAGE,
    }


# Curated from docs/future-file-viewers.md §4–§31 (deduped; skip already-shipped file-viewers).
TOOLS: dict[str, list[dict]] = {
    "cad-viewers": [
        tool("DWG Viewer", ".dwg", "Open AutoCAD drawings in the browser.", "Layers", "Pan / zoom", "Measurements"),
        tool("DXF Viewer", ".dxf", "Preview open CAD exchange drawings.", "2D drawing", "Layers", "Entity inspect"),
        tool("DWF Viewer", ".dwf, .dwfx", "Lightweight Design Web Format preview.", "Publish preview", "Pan / zoom"),
        tool("DGN Viewer", ".dgn", "Review MicroStation / Bentley drawings.", "Civil CAD review", "Layers"),
        tool("STEP Viewer", ".step, .stp", "Inspect ISO 10303 solid models.", "3D solids", "Rotate", "Measure"),
        tool("IGES Viewer", ".iges, .igs", "Legacy surface CAD inspection.", "Surface preview", "3D navigation"),
        tool("Parasolid Viewer", ".x_t, .x_b", "Industrial CAD kernel solids.", "Solid geometry", "Measure"),
        tool("CATIA Viewer", ".catpart, .catproduct", "Dassault CATIA part review.", "Parts", "Assemblies"),
        tool("SolidWorks Viewer", ".sldprt, .sldasm", "SolidWorks parts and assemblies.", "Mechanical review", "3D inspect"),
        tool("Fusion 360 Viewer", ".f3d", "Autodesk Fusion design preview.", "Maker / product design", "3D view"),
        tool("Inventor Viewer", ".ipt, .iam", "Autodesk Inventor models.", "Parts", "Assemblies"),
        tool("Creo Viewer", ".prt", "PTC Creo product models.", "Engineering models", "3D navigate"),
        tool("Rhino 3DM Viewer", ".3dm", "Rhinoceros freeform models.", "Freeform design", "3D view"),
        tool("SketchUp Viewer", ".skp", "Architecture concept models.", "Concept preview", "Orbit"),
        tool("PLT Plot Viewer", ".plt", "Legacy plotter output preview.", "Vector plot", "Zoom"),
        tool("HPGL Viewer", ".hpgl, .hgl", "Plotter language inspection.", "Vector plot", "Layers"),
        tool("Gerber File Viewer", ".gbr, .ger", "PCB fabrication artwork.", "Copper / silk / mask", "Layer toggle"),
        tool("PCB Layout Viewer", "PCB project files", "Electronics board layout review.", "Layer stack", "Inspect nets"),
        tool("KiCad Viewer", "KiCad project / PCB", "Open-source EDA board & schematic.", "Board", "Schematic"),
        tool("Eagle PCB Viewer", ".brd, .sch", "Legacy Eagle PCB projects.", "Board", "Schematic"),
        tool("Altium PCB Viewer", "Altium PCB", "Professional PCB review.", "Copper layers", "Designators"),
        tool("GDSII Layout Viewer", ".gds", "IC / photomask layout review.", "Semiconductor layers", "Zoom"),
        tool("IFC Viewer", ".ifc", "OpenBIM building model navigation.", "3D building", "Properties", "Discipline filters"),
        tool("Revit Viewer", ".rvt, .rfa", "Autodesk Revit model preview.", "BIM navigate", "Families"),
        tool("Navisworks Viewer", "Navisworks models", "AEC coordination model review.", "Clash context", "3D navigate"),
        tool("BIM Clash Viewer", "clash reports / IFC", "Clash detection review.", "Clash list", "3D focus"),
        tool("Building Floor Plan Viewer", "floor plans / IFC plans", "Floor-plan oriented BIM views.", "Levels", "Rooms"),
        tool("MEP Model Viewer", "MEP IFC / models", "Mechanical / electrical / plumbing.", "Discipline filters", "3D"),
        tool("Structural Model Viewer", "structural IFC", "Structural BIM review.", "Members", "Properties"),
    ],
    "gis-viewers": [
        tool("GeoJSON Viewer", ".geojson, .json", "Interactive map for GeoJSON features.", "Map", "Feature inspect", "Attributes"),
        tool("Shapefile Viewer", ".shp (+ .dbf, .shx)", "Classic GIS shapefile exploration.", "Map", "Attribute table"),
        tool("KML Viewer", ".kml", "Geographic annotations on a map.", "Placemarks", "Paths", "Overlays"),
        tool("KMZ Viewer", ".kmz", "Compressed KML packages on a map.", "Placemarks", "Overlays"),
        tool("GPX Viewer", ".gpx", "GPS tracks with elevation and stats.", "Map", "Elevation profile", "Stats"),
        tool("TopoJSON Viewer", ".topojson", "Topology-preserving map data.", "Map", "Feature inspect"),
        tool("GeoPackage Viewer", ".gpkg", "OGC GeoPackage layers.", "Layers", "Attributes"),
        tool("MBTiles Viewer", ".mbtiles", "Tile package map preview.", "Raster / vector tiles", "Zoom"),
        tool("GeoTIFF Viewer", ".tif, .tiff", "Georeferenced raster imagery.", "Map stretch", "Coords"),
        tool("COG Viewer", "Cloud Optimized GeoTIFF", "Stream large GeoTIFFs in-browser.", "Overview levels", "Window"),
        tool("DEM Viewer", "DEM rasters", "Digital elevation models.", "Hillshade", "Elevation"),
        tool("Terrain Viewer", "terrain grids", "Terrain visualization.", "3D / hillshade", "Contours"),
        tool("Contour Map Viewer", "contour data", "Contour visualization.", "Isolines", "Labels"),
        tool("GPS Track Viewer", ".gpx, tracks", "Movement track analytics.", "Map", "Speed / pace"),
        tool("Drone Flight Path Viewer", "drone tracks / logs", "Drone flight paths on a map.", "Path", "Altitude"),
        tool("LiDAR Map Viewer", ".las, .laz", "LiDAR as map / point preview.", "Point density", "Classify"),
        tool("Point Cloud Viewer", ".las, .laz, .ply, .e57, .pcd", "Spatial 3D point navigation.", "Orbit", "Clip", "Color by intensity"),
        tool("Satellite Image Viewer", "GeoTIFF / COG", "Satellite imagery exploration.", "Bands", "Stretch"),
        tool("Vector Tile Viewer", "MVT / tiles", "Vector tile map inspect.", "Layers", "Attributes"),
    ],
    "medical-viewers": [
        tool("DICOM Viewer", ".dcm", "Medical imaging with window/level.", "Window / level", "Multi-slice", "Metadata"),
        tool("NIfTI Viewer", ".nii, .nii.gz", "Neuroimaging volume slices.", "Ortho views", "Windowing"),
        tool("MRI Viewer", "DICOM MRI series", "MRI series review.", "Series navigate", "Window / level"),
        tool("CT Scan Viewer", "DICOM CT series", "CT volume inspection.", "Scroll slices", "Measure"),
        tool("X-Ray Viewer", "DICOM XR", "Radiograph viewing.", "Window / level", "Zoom"),
        tool("Ultrasound Viewer", "DICOM US", "Ultrasound frame review.", "Cine", "Metadata"),
        tool("Mammography Viewer", "DICOM MG", "Mammography review.", "Hangings", "Zoom"),
        tool("PET Scan Viewer", "DICOM PT", "PET / nuclear medicine views.", "SUV context", "Fuse"),
        tool("NRRD Viewer", ".nrrd", "Scientific / medical volume grids.", "Slices", "Histogram"),
        tool("MINC Viewer", ".mnc", "MINC neuroimaging volumes.", "Ortho", "Metadata"),
        tool("Pathology Slide Viewer", "WSI", "Digital pathology slides.", "Deep zoom", "Annotations"),
        tool("Whole Slide Image Viewer", ".svs, WSI", "Whole-slide image navigation.", "Pyramid zoom", "Regions"),
        tool("ECG Viewer", ".ecg, waveforms", "Electrocardiogram waveforms.", "Leads", "Calipers"),
        tool("EEG Viewer", "EEG recordings", "Electroencephalogram traces.", "Channels", "Montage"),
        tool("HL7 Message Viewer", ".hl7", "Decode HL7 clinical messages.", "Segments", "Fields"),
        tool("FHIR Resource Viewer", "FHIR JSON/XML", "Navigate FHIR clinical resources.", "Resource graph", "Timeline"),
        tool("Medical Timeline Viewer", "clinical events", "Patient / encounter timelines.", "Events", "Filters"),
        tool("CDA Viewer", "HL7 CDA", "Clinical Document Architecture.", "Sections", "Narrative"),
    ],
    "science-viewers": [
        tool("HDF5 Viewer", ".h5, .hdf5", "Browse hierarchical scientific datasets.", "Tree browser", "Array preview"),
        tool("NetCDF Viewer", ".nc", "Slice climate and science grids.", "Variables", "Maps", "Charts"),
        tool("FITS Viewer", ".fits", "Astronomical images and headers.", "Stretch", "WCS", "Overlays"),
        tool("GRIB Viewer", ".grib, .grb", "Weather model grids.", "Fields", "Maps"),
        tool("MATLAB MAT Viewer", ".mat", "MATLAB array exploration.", "Variables", "Shapes"),
        tool("ROOT File Viewer", ".root", "HEP ROOT file browsing.", "Trees", "Histograms"),
        tool("Molecular Structure Viewer", ".pdb, .mol, .sdf", "3D molecular structures.", "Ball-stick", "Rotate"),
        tool("Protein Structure Viewer", ".pdb", "Protein 3D inspection.", "Ribbon", "Residues"),
        tool("FASTA Viewer", ".fasta, .fa", "Sequence file browsing.", "Sequences", "Search"),
        tool("FASTQ Viewer", ".fastq, .fq", "Sequencing read inspection.", "Quality", "Sample"),
        tool("GenBank Viewer", ".gb, .gbk", "Annotated sequence records.", "Features", "Sequence"),
        tool("VCF Variant Viewer", ".vcf", "Genomic variant tables.", "Filter", "Sample columns"),
        tool("LAS Well Log Viewer", ".las (well)", "Oil & gas well log curves.", "Depth track", "Curves"),
        tool("DLIS Viewer", ".dlis", "Digital well log interchange.", "Channels", "Depth"),
        tool("SEG-Y Viewer", ".sgy, .segy", "Seismic section visualization.", "Traces", "Gain"),
        tool("Geological Model Viewer", "geo models", "Geological model preview.", "Layers", "Cross-section"),
        tool("Borehole Viewer", "borehole data", "Borehole / well paths.", "Depth", "Lithology"),
        tool("Stratigraphy Viewer", "stratigraphy", "Stratigraphic columns.", "Units", "Ages"),
        tool("Climate Data Viewer", "NetCDF / GRIB", "Climate dataset exploration.", "Maps", "Time series"),
        tool("Simulation Result Viewer", "sim outputs", "Simulation result plots.", "Fields", "Slices"),
    ],
    "network-viewers": [
        tool("HAR Viewer", ".har", "Browser waterfall and request analysis.", "Waterfall", "Headers", "Timing"),
        tool("PCAP Viewer", ".pcap, .pcapng", "Packet timeline and protocol decode.", "Packets", "Filters", "Follow stream"),
        tool("PCAPNG Viewer", ".pcapng", "Next-gen packet capture analysis.", "Interfaces", "Packets"),
        tool("Network Traffic Viewer", "captures", "High-level traffic exploration.", "Flows", "Protocols"),
        tool("Packet Analyzer", ".pcap", "Deep packet inspection UI.", "Decode", "Hex"),
        tool("Protocol Analyzer", "protocol traces", "Protocol-centric analysis.", "Dissectors", "Timeline"),
        tool("HTTP Trace Viewer", "HTTP traces", "HTTP conversation review.", "Requests", "Responses"),
        tool("API Request Viewer", "API dumps", "API call inspection.", "Bodies", "Headers"),
        tool("Firewall Log Viewer", "firewall logs", "Firewall event exploration.", "Filter", "Timeline"),
        tool("SIEM Log Viewer", "SIEM exports", "Security event browsing.", "Correlate", "Search"),
        tool("Syslog Viewer", "syslog", "Syslog message viewer.", "Facilities", "Severity"),
        tool("DNS Log Viewer", "DNS logs", "DNS query/response review.", "Query types", "Timeline"),
        tool("Nmap Report Viewer", "Nmap XML", "Port scan report visualization.", "Hosts", "Ports"),
        tool("Nessus Report Viewer", "Nessus exports", "Vulnerability report review.", "Findings", "Severity"),
        tool("SARIF Report Viewer", ".sarif", "Static analysis results.", "Rules", "Locations"),
        tool("Malware Analysis Report Viewer", "malware reports", "Malware report exploration.", "IOC", "Behavior"),
        tool("Threat Intelligence Viewer", "TI feeds / STIX", "Threat intel structures.", "Indicators", "Relationships"),
    ],
    "process-viewers": [
        tool("BPMN Viewer", ".bpmn", "Interactive business process diagrams.", "Diagram", "Validation", "Zoom"),
        tool("BPMN Analytics Viewer", ".bpmn + logs", "Process analytics on BPMN.", "Bottlenecks", "Overlays"),
        tool("DMN Viewer", ".dmn", "Decision Model and Notation.", "Decision tables", "DRD"),
        tool("Decision Model Viewer", "DMN / rules", "Decision logic exploration.", "Tables", "Dependencies"),
        tool("EPC Diagram Viewer", "EPC", "Event-driven process chains.", "Diagram", "Events"),
        tool("PNML Viewer", ".pnml", "Petri net markup visualization.", "Places", "Transitions", "Tokens"),
        tool("Petri Net Viewer", ".pnml", "Petri net simulation-ready view.", "Graph", "Token flow"),
        tool("BPEL Viewer", ".bpel", "Executable workflow visualization.", "Orchestration", "Partners"),
        tool("Workflow Diagram Viewer", "workflow XML", "Generic workflow diagrams.", "Nodes", "Edges"),
        tool("Process Map Viewer", "process maps", "Discovered process maps.", "Variants", "Frequencies"),
        tool("Process Mining Viewer", ".xes / maps", "Process mining exploration.", "Variants", "DFG"),
        tool("Event Log Viewer", "event logs", "Event log browsing.", "Cases", "Activities"),
        tool("Trace Explorer", "traces", "Case / trace drill-down.", "Path", "Attributes"),
        tool("Process Timeline Viewer", "events", "Process timelines.", "Gantt-like", "Filters"),
        tool("Business Process Simulator", "BPMN / PNML", "Lightweight process simulation.", "Tokens", "Scenarios"),
    ],
    "diagram-viewers": [
        tool("Mermaid Diagram Viewer", ".mmd, mermaid", "Render Mermaid diagrams locally.", "Flowcharts", "Sequence", "Export"),
        tool("PlantUML Viewer", ".puml, .plantuml", "PlantUML diagram rendering.", "UML", "C4", "Export"),
        tool("Graphviz DOT Viewer", ".dot, .gv", "Graphviz DOT layout preview.", "Layouts", "Export SVG"),
        tool("UML Viewer", "UML sources", "UML diagram viewing.", "Class", "Sequence"),
        tool("Class Diagram Viewer", "class diagrams", "Class structure diagrams.", "Types", "Relations"),
        tool("Sequence Diagram Viewer", "sequence diagrams", "Interaction diagrams.", "Lifelines", "Messages"),
        tool("Architecture Diagram Viewer", "architecture diagrams", "System architecture views.", "Boxes", "Connectors"),
        tool("C4 Model Viewer", "C4 / Structurizr", "C4 architecture models.", "Context", "Container", "Component"),
        tool("GraphML Viewer", ".graphml", "Interactive GraphML networks.", "Layout", "Communities"),
        tool("GEXF Viewer", ".gexf", "Dynamic network visualization.", "Timeline", "Communities"),
        tool("Mind Map Viewer", "mind maps", "Mind map exploration.", "Collapse", "Search"),
        tool("FreeMind Viewer", ".mm", "FreeMind mind maps.", "Tree", "Notes"),
        tool("Freeplane Viewer", ".mm", "Freeplane mind maps.", "Nodes", "Icons"),
        tool("Concept Map Viewer", "concept maps", "Concept relationships.", "Nodes", "Links"),
        tool("ER Diagram Viewer", "ER diagrams", "Entity-relationship diagrams.", "Entities", "Keys"),
        tool("DBML Viewer", ".dbml", "Database markup diagrams.", "Tables", "Refs"),
        tool("SQL Schema Viewer", ".sql schema", "Schema from SQL DDL.", "Tables", "FKs"),
        tool("Prisma Schema Viewer", "schema.prisma", "Prisma data models.", "Models", "Relations"),
        tool("Draw.io Viewer", ".drawio, .dio", "Draw.io diagram preview.", "Pages", "Zoom"),
        tool("Visio Viewer", ".vsdx", "Visio diagram review.", "Pages", "Shapes"),
        tool("Terraform Graph Viewer", "Terraform graph", "Infrastructure dependency graphs.", "Resources", "Edges"),
        tool("Kubernetes Architecture Viewer", "K8s YAML", "Cluster architecture diagrams.", "Workloads", "Services"),
        tool("Dependency Graph Viewer", "lockfiles / graphs", "Package dependency graphs.", "Tree", "Cycles"),
        tool("RDF Viewer", ".rdf, .ttl", "Semantic web graphs.", "Triples", "Graph"),
        tool("OWL Ontology Viewer", ".owl", "Ontology exploration.", "Classes", "Properties"),
        tool("Knowledge Graph Viewer", "KG exports", "Knowledge graph navigation.", "Entities", "Links"),
        tool("State Machine Viewer", "SCXML / FSM", "State machine diagrams.", "States", "Transitions"),
        tool("Decision Tree Viewer", "decision trees", "Decision tree visualization.", "Branches", "Leaves"),
        tool("Drools Rule Viewer", ".drl", "Rule engine inspection.", "Rules", "Conditions"),
    ],
    "data-explorers": [
        tool("Parquet Viewer", ".parquet", "Columnar schema and preview.", "Schema", "Sample rows", "Profiling"),
        tool("Avro Viewer", ".avro", "Avro schema and records.", "Schema", "Sample"),
        tool("ORC Viewer", ".orc", "ORC columnar exploration.", "Schema", "Preview"),
        tool("Feather Viewer", ".feather", "Arrow Feather tables.", "Schema", "Preview"),
        tool("Arrow Viewer", ".arrow, IPC", "Apache Arrow tables.", "Schema", "Preview"),
        tool("Delta Lake Viewer", "Delta tables", "Delta Lake table inspect.", "Versions", "Schema"),
        tool("SQLite Viewer", ".sqlite, .db", "Browse SQLite databases.", "Tables", "SQL preview"),
        tool("DuckDB Viewer", ".duckdb", "DuckDB database explore.", "Tables", "Preview"),
        tool("CSV Viewer", ".csv", "Large CSV exploration.", "Columns", "Filter"),
        tool("TSV Viewer", ".tsv", "Tab-separated exploration.", "Columns", "Preview"),
        tool("JSON Viewer", ".json", "Structured JSON tree/table.", "Tree", "Search"),
        tool("XML Viewer", ".xml", "XML tree exploration.", "Nodes", "Attributes"),
        tool("YAML Viewer", ".yaml, .yml", "YAML structure viewer.", "Tree", "Validate"),
        tool("TOML Viewer", ".toml", "TOML config exploration.", "Tables", "Keys"),
        tool("INI Viewer", ".ini", "INI / conf file viewer.", "Sections", "Keys"),
    ],
    "ml-viewers": [
        tool("ONNX Viewer", ".onnx", "ML model graph and tensors.", "Ops graph", "Tensors", "Metadata"),
        tool("TensorFlow Graph Viewer", "TF SavedModel / PB", "TensorFlow graph inspect.", "Nodes", "Tensors"),
        tool("PyTorch Model Viewer", ".pt, .pth", "PyTorch module graphs.", "Layers", "Params"),
        tool("Keras Model Viewer", ".h5, .keras", "Keras architecture view.", "Layers", "Shapes"),
        tool("MLflow Model Viewer", "MLflow artifacts", "MLflow model artifacts.", "Signature", "Files"),
        tool("Neural Network Graph Viewer", "NN graphs", "Generic NN graph view.", "Layers", "Connections"),
        tool("Model Architecture Viewer", "model specs", "Architecture summaries.", "Blocks", "Params"),
        tool("Tensor Visualization Viewer", "tensors", "Tensor shape / value peek.", "Shapes", "Stats"),
        tool("Pickle Viewer", ".pkl", "Safe metadata peek for pickles.", "Type hints", "Warnings"),
    ],
    "file-viewers": [
        tool("EPUB Viewer", ".epub", "Ebook reading in the browser.", "Chapters", "TOC", "Typography"),
        tool("MOBI Viewer", ".mobi, .azw", "Kindle-format ebook preview.", "Chapters", "TOC"),
        tool("LaTeX Viewer", ".tex", "LaTeX source preview helpers.", "Structure", "Preview"),
        tool("SVG Viewer", ".svg", "Scalable vector inspection.", "Zoom", "Source"),
        tool("PSD Viewer", ".psd", "Photoshop document preview.", "Layers", "Preview"),
        tool("AI File Viewer", ".ai", "Adobe Illustrator preview.", "Artboards", "Preview"),
        tool("HEIC Viewer", ".heic, .heif", "Apple HEIC image preview.", "Decode", "Export"),
        tool("RAW Image Viewer", "CR2, NEF, ARW…", "Camera RAW preview.", "Demosaic", "EXIF"),
        tool("TIFF Viewer", ".tif, .tiff", "Multi-page TIFF preview.", "Pages", "Zoom"),
        tool("OpenDocument Viewer", ".odt, .ods, .odp", "ODF document preview.", "Pages", "Sheets"),
        tool("RTF Viewer", ".rtf", "Rich Text Format preview.", "Formatting", "Export"),
        tool("Subtitle Viewer", ".srt, .vtt", "Subtitle timeline review.", "Cues", "Search"),
        tool("MIDI Viewer", ".mid, .midi", "MIDI event / piano-roll view.", "Tracks", "Notes"),
        tool("MusicXML Viewer", ".musicxml, .mxl", "Sheet music markup preview.", "Staves", "Playback cues"),
        tool("APK Viewer", ".apk", "Android package metadata.", "Manifest", "Permissions"),
        tool("IPA Viewer", ".ipa", "iOS package metadata.", "Info.plist", "Entitlements"),
        tool("ELF Binary Viewer", "ELF binaries", "ELF headers and sections.", "Headers", "Sections"),
        tool("PE Binary Viewer", ".exe, .dll", "Windows PE inspection.", "Headers", "Imports"),
        tool("WAV Spectrum Viewer", ".wav", "Audio spectrum / waveform.", "Waveform", "FFT"),
        tool("Spectrogram Viewer", "audio files", "Spectrogram visualization.", "STFT", "Zoom"),
        tool("Minecraft World Viewer", "Minecraft worlds", "World map preview.", "Chunks", "Biomes"),
        tool("Unity Asset Viewer", "Unity assets", "Unity asset peek.", "Metadata", "Preview"),
        tool("Game Save Viewer", "save files", "Game save structure explore.", "Slots", "Fields"),
        tool("NFT Metadata Viewer", "NFT JSON", "NFT metadata inspection.", "Traits", "Media links"),
        tool("Smart Contract Viewer", ".sol / ABI", "Contract source / ABI browse.", "ABI", "Methods"),
        tool("Invoice Data Viewer", "invoice JSON/XML", "Invoice field exploration.", "Line items", "Totals"),
        tool("Audit Log Viewer", "audit exports", "Enterprise audit trails.", "Actors", "Timeline"),
        tool("Figma Export Viewer", "Figma exports", "Design export preview.", "Frames", "Assets"),
        tool("Sketch File Viewer", ".sketch", "Sketch document preview.", "Pages", "Symbols"),
        tool("InDesign Viewer", ".indd / IDML", "InDesign package peek.", "Spreads", "Stories"),
    ],
}


def ensure_unique_slugs(tools: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out = []
    for t in tools:
        slug = t["slug"]
        base = slug
        i = 2
        while slug in seen:
            slug = f"{base}-{i}"
            i += 1
        seen.add(slug)
        t = {**t, "slug": slug}
        out.append(t)
    return out


for cat, tools in list(TOOLS.items()):
    TOOLS[cat] = ensure_unique_slugs(tools)


CONSTANTS_TS = """import type {{ ComingSoonToolConfig }} from '../types/coming-soon-tool.types';

export const DEFAULT_COMING_SOON_TOOL: ComingSoonToolConfig = {{
  slug: 'coming-soon',
  title: 'Coming Soon Viewer',
  tagline: 'A specialized file viewer is on the way.',
  formatsLabel: 'Multiple formats planned',
  roadmap: ['Local parsing', 'Interactive preview', 'Export helpers'],
  liveMessage: '{live}',
}};

export const COMING_SOON_TOOLS: Record<string, ComingSoonToolConfig> = {{
{entries}
}};
"""


def coming_soon_entries(tools: list[dict]) -> str:
    entries = []
    for t in tools:
        entries.append(
            f"  '{t['slug']}': {{\n"
            f"    slug: '{t['slug']}',\n"
            f"    title: {json.dumps(t['title'])},\n"
            f"    tagline: {json.dumps(t['tagline'])},\n"
            f"    formatsLabel: {json.dumps(t['formatsLabel'])},\n"
            f"    roadmap: {json.dumps(t['roadmap'])},\n"
            f"    liveMessage: {json.dumps(t['liveMessage'])},\n"
            f"  }}"
        )
    return ",\n".join(entries)


def write_shared_coming_soon_tools(tools: list[dict]) -> None:
    dest = ROOT / "libs/features-home/src/lib/constants/coming-soon-tools.ts"
    dest.write_text(CONSTANTS_TS.format(live=LIVE_MESSAGE, entries=coming_soon_entries(tools)))


def write_lib(slug: str, meta: dict, tools: list[dict]) -> None:
    lib = ROOT / "libs" / slug
    src = lib / "src"
    lib_dir = src / "lib"
    lib_dir.mkdir(parents=True, exist_ok=True)
    index = src / "index.ts"
    if not index.exists():
        index.write_text("")
    (src / "test-setup.ts").write_text(
        "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';\n\n"
        "setupZoneTestEnv({\n  errorOnUnknownElements: true,\n  errorOnUnknownProperties: true,\n});\n"
    )
    (lib / "project.json").write_text(
        json.dumps(
            {
                "name": slug,
                "$schema": "../../node_modules/nx/schemas/project-schema.json",
                "sourceRoot": f"libs/{slug}/src",
                "prefix": "lib",
                "projectType": "library",
                "tags": ["type:feature", f"scope:{slug}"],
                "targets": {
                    "test": {
                        "executor": "@nx/jest:jest",
                        "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
                        "options": {
                            "jestConfig": f"libs/{slug}/jest.config.ts",
                            "tsConfig": f"libs/{slug}/tsconfig.spec.json",
                        },
                    },
                    "lint": {"executor": "@nx/eslint:lint"},
                },
            },
            indent=2,
        )
        + "\n"
    )
    (lib / "jest.config.ts").write_text(
        f"""export default {{
  displayName: '{slug}',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/{slug}',
  transform: {{
    '^.+\\\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {{
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\\\.(html|svg)$',
      }},
    ],
  }},
  transformIgnorePatterns: ['node_modules/(?!.*\\\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
}};
"""
    )
    (lib / "tsconfig.json").write_text(
        """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "typeCheckHostBindings": true,
    "strictTemplates": true
  },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
"""
    )
    (lib / "tsconfig.lib.json").write_text(
        """{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "exclude": [
    "src/**/*.spec.ts",
    "src/test-setup.ts",
    "jest.config.ts",
    "src/**/*.test.ts"
  ],
  "include": ["src/**/*.ts"]
}
"""
    )
    (lib / "tsconfig.spec.json").write_text(
        """{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "target": "es2016",
    "types": ["jest", "node"],
    "moduleResolution": "node10"
  },
  "files": ["src/test-setup.ts"],
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ]
}
"""
    )


def patch_tsconfig() -> None:
    path = ROOT / "tsconfig.base.json"
    data = json.loads(path.read_text())
    paths = data["compilerOptions"]["paths"]
    for slug, meta in CATEGORIES.items():
        if meta.get("existing"):
            continue
        key = f"@tools-workspace/{slug}"
        paths[key] = [f"libs/{slug}/src/index.ts"]
        paths[f"{key}/*"] = [f"libs/{slug}/src/lib/component/*"]
    path.write_text(json.dumps(data, indent=2) + "\n")


def patch_category_meta() -> None:
    path = ROOT / "apps/tools-site/scripts/lib/extract-routes.js"
    text = path.read_text()
    if "'cad-viewers'" in text:
        return
    insert = ""
    for slug, meta in CATEGORIES.items():
        if meta.get("existing"):
            continue
        insert += (
            f"  '{slug}': {{\n"
            f"    name: '{meta['name']}',\n"
            f"    description: '{meta['description']}',\n"
            f"    faIcon: '{meta['faIcon']}',\n"
            f"    materialIcon: '{meta['materialIcon']}',\n"
            f"  }},\n"
        )
    text = text.replace(
        "  'fun-tools': {\n    name: 'Fun & Productivity Tools',\n    description: 'Entertainment and productivity helpers',\n    faIcon: 'fas fa-gamepad',\n    materialIcon: 'sports_esports',\n  },\n};",
        "  'fun-tools': {\n    name: 'Fun & Productivity Tools',\n    description: 'Entertainment and productivity helpers',\n    faIcon: 'fas fa-gamepad',\n    materialIcon: 'sports_esports',\n  },\n"
        + insert
        + "};",
    )
    path.write_text(text)


def route_const_name(slug: str) -> str:
    return slug.upper().replace("-", "_") + "_ROUTES"


def coming_soon_load_component() -> str:
    return (
        "      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page')"
        ".then(m => m.ComingSoonPageComponent),"
    )


def build_category_routes_file(slug: str, tools: list[dict]) -> str:
    lines = [
        "import { Routes } from '@angular/router';",
        "",
        f"export const {route_const_name(slug)}: Routes = [",
        "  {",
        "    path: '',",
        "    loadComponent: () =>",
        "      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),",
        "  },",
    ]
    for t in tools:
        lines.append("  {")
        lines.append(f"    path: '{t['slug']}',")
        lines.append("    loadComponent: () =>")
        lines.append(coming_soon_load_component())
        lines.append("  },")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def patch_file_viewers_coming_soon() -> None:
    path = ROOT / "apps/tools-site/src/app/routes/file-viewers.routes.ts"
    text = path.read_text()
    fv_tools = TOOLS["file-viewers"]
    write_shared_coming_soon_tools(fv_tools)
    extra: list[str] = []
    for t in fv_tools:
        if f"path: '{t['slug']}'" in text:
            continue
        extra.append("  {")
        extra.append(f"    path: '{t['slug']}',")
        extra.append("    loadComponent: () =>")
        extra.append(coming_soon_load_component())
        extra.append("  },")
    if not extra:
        return
    stripped = text.rstrip()
    if not stripped.endswith("];"):
        raise SystemExit("file-viewers.routes.ts does not end with ];")
    body = stripped[:-2].rstrip()
    if not body.endswith(","):
        body += ","
    path.write_text(body + "\n" + "\n".join(extra) + "\n];\n")


def patch_app_routes() -> None:
    app_routes = ROOT / "apps/tools-site/src/app/app.routes.ts"
    text = app_routes.read_text()
    patch_file_viewers_coming_soon()

    injections: list[str] = []
    for slug, meta in CATEGORIES.items():
        if meta.get("existing"):
            continue
        write_lib(slug, meta, TOOLS[slug])
        routes_file = ROOT / f"apps/tools-site/src/app/routes/{slug}.routes.ts"
        if not routes_file.exists():
            routes_file.write_text(build_category_routes_file(slug, TOOLS[slug]))
        if f"path: '{slug}'" in text:
            continue
        const = route_const_name(slug)
        injections.append(
            "  {\n"
            f"    path: '{slug}',\n"
            f"    loadChildren: () => import('./routes/{slug}.routes').then(m => m.{const}),\n"
            "  },"
        )

    if injections:
        marker = "  { path: '', redirectTo: 'tools', pathMatch: 'full' },"
        if marker not in text:
            raise SystemExit("redirect marker missing in app.routes.ts")
        text = text.replace(marker, "\n".join(injections) + "\n" + marker)
        app_routes.write_text(text)


def main() -> None:
    counts = {k: len(v) for k, v in TOOLS.items()}
    print("Tool counts:", counts, "total", sum(counts.values()))
    patch_tsconfig()
    patch_category_meta()
    for slug, meta in CATEGORIES.items():
        if meta.get("existing"):
            continue
        write_lib(slug, meta, TOOLS[slug])
    patch_app_routes()
    print("Generated category libs and patched routes.")


if __name__ == "__main__":
    main()
