/** Library annex IFC snippets (education / research). */

export const IC_JSON_SAMPLE = `{
  "name": "Library Annex",
  "ifcVer": "IFC4",
  "units": "m",
  "elements": [
    { "name": "slab", "kind": "box", "ifcType": "IfcSlab", "discipline": "Architecture", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "stack", "kind": "box", "ifcType": "IfcFurnishingElement", "discipline": "Architecture", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "column", "kind": "cylinder", "ifcType": "IfcColumn", "discipline": "Structure", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "disciplines": [
    { "name": "Architecture", "description": "architectural" },
    { "name": "Structure", "description": "structural" },
    { "name": "MEP", "description": "mechanical" }
  ],
  "properties": [
    { "name": "bay-width", "pset": "Pset_SlabCommon", "element": "slab", "value": "24", "unit": "m" },
    { "name": "title", "pset": "Pset_BuildingCommon", "element": "Library", "value": "Library", "unit": "" }
  ]
}
`;

export const IC_ASCII_SAMPLE = `IFC dump Library-Annex IFC4
ELEMENT slab IfcSlab Architecture BOX 24 16 0.2 AT 12 8 0.1
ELEMENT stack IfcFurnishingElement Architecture BOX 4 2 1.8 AT 4 3 1.0
ELEMENT column IfcColumn Structure CYLINDER 0.5 4.2 AT 20 12 2.1
DISCIPLINE Architecture architectural
DISCIPLINE Structure structural
DISCIPLINE MEP mechanical
PROPERTY bay-width Pset_SlabCommon slab 12 m
PROPERTY title Pset_BuildingCommon Library Library
`;

export const IC_STEP_SAMPLE = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Library'),'2;1');
FILE_NAME('library-annex.ifc','2024-01-01T00:00:00',('Library'),('EasyToolHub'),'IFC dump','IFC dump','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSLAB('1K8n$slab','slab',$,$,$,$,$,$,.FLOOR.);
#2=IFCFURNISHINGELEMENT('1K8n$stack','stack',$,$,$,$,$,$);
#3=IFCCOLUMN('1K8n$column','column',$,$,$,$,$,$,$);
#4=IFCPROPERTYSINGLEVALUE('bay-width',$,IFCLENGTHMEASURE(24.),$);
#5=IFCPROPERTYSINGLEVALUE('title',$,IFCLABEL('Library'),$);
ENDSEC;
END-ISO-10303-21;
`;

export const IC_CSV_SAMPLE = `name,type,kind,element,discipline,value
slab,element,IfcSlab,slab,Architecture,box
stack,element,IfcFurnishingElement,stack,Architecture,box
column,element,IfcColumn,column,Structure,cylinder
Architecture,discipline,,Architecture,,architectural
Structure,discipline,,Structure,,structural
bay-width,property,Pset_SlabCommon,slab,Architecture,24
title,property,Pset_BuildingCommon,Clinic,,Clinic
`;

export const IC_MARKDOWN_SAMPLE = `# Library Annex

name: STRING
type: STRING
kind: STRING

slab | element | IfcSlab
stack | element | IfcFurnishingElement
column | element | IfcColumn
Architecture | discipline | architectural
Structure | discipline | structural
bay-width | property | Pset_SlabCommon
title | property | Library
`;
