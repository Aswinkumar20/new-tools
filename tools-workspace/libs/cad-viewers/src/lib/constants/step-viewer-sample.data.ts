/** Hinge leaf STEP snippets STEP snippets (education / research). */

export const ST_JSON_SAMPLE = `{
  "name": "Hinge Leaf",
  "schema": "AUTOMOTIVE_DESIGN",
  "units": "m",
  "products": [
    { "name": "HingeLeaf", "description": "hinge" }
  ],
  "solids": [
    { "name": "leaf", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "knuckle", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "pin", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "measurements": [
    { "name": "leaf-length", "type": "distance", "value": 4, "unit": "m", "label": "4 m length" },
    { "name": "knuckle-width", "type": "distance", "value": 3, "unit": "m", "label": "0.9 m knuckle" },
    { "name": "pin-height", "type": "distance", "value": 2.4, "unit": "m", "label": "0.5 m pin" }
  ]
}
`;

export const ST_ASCII_SAMPLE = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('HingeLeaf'),'2;1');
FILE_NAME('hinge-leaf.step','2026-01-01T00:00:00',('EasyToolHub'),('EasyToolHub'),'ST-PREVIEW','HingeLeaf','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#10=PRODUCT('HingeLeaf','HingeLeaf','mount',(#12));
#20=CARTESIAN_POINT('',(0.,0.,0.));
#21=CARTESIAN_POINT('',(4.,0.,0.));
#22=CARTESIAN_POINT('',(4.,2.5,0.));
#23=CARTESIAN_POINT('',(0.,2.5,0.));
#24=CARTESIAN_POINT('',(0.,0.,0.5));
#40=MANIFOLD_SOLID_BREP('knuckle',#41);
#50=MANIFOLD_SOLID_BREP('pin',#51);
ENDSEC;
END-ISO-10303-21;
`;

export const ST_CSV_SAMPLE = `name,type,kind,cx,cy,cz,sx,sy,sz,r,h,value
HingeLeaf,product,,,,,,,,,,
leaf,solid,box,2,1.25,0.2,4,2.5,0.4,,,
knuckle,solid,box,2.8,1.6,0.45,0.9,0.7,0.5,,,
pin,solid,cylinder,3.4,1.9,0.25,,,,0.12,0.5,
leaf-length,distance,,,,,,,,,4
`;

export const ST_MARKDOWN_SAMPLE = `# Hinge Leaf

name: STRING
type: STRING
kind: STRING

HingeLeaf | product | assembly
leaf | solid | box
knuckle | solid | box
pin | solid | cylinder
leaf-length | distance | measure
`;
