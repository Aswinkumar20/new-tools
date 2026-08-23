/** Hospital HVAC MEP snippets (education / research). */

export const ME_JSON_SAMPLE = `{
  "name": "Hospital HVAC",
  "mepVer": "1.0",
  "units": "m",
  "disciplines": [
    { "name": "Mechanical", "description": "HVAC" },
    { "name": "Electrical", "description": "Power" },
    { "name": "Plumbing", "description": "Water" }
  ],
  "systems": [
    { "name": "SupplyAir", "discipline": "Mechanical", "description": "HVAC supply" },
    { "name": "Lighting", "discipline": "Electrical", "description": "lighting" },
    { "name": "DomesticWater", "discipline": "Plumbing", "description": "water" }
  ],
  "elements": [
    { "name": "duct", "kind": "box", "discipline": "Mechanical", "system": "SupplyAir", "cx": 10, "cy": 6, "cz": 1.2, "sx": 0.4, "sy": 2, "sz": 0.4 },
    { "name": "pipe", "kind": "box", "discipline": "Plumbing", "system": "DomesticWater", "cx": 2.5, "cy": 3, "cz": 0.35, "sx": 0.1, "sy": 4, "sz": 0.1 },
    { "name": "tray", "kind": "box", "discipline": "Electrical", "system": "Lighting", "cx": 6, "cy": 4, "cz": 2.4, "sx": 0.3, "sy": 6, "sz": 0.08 },
    { "name": "ahu", "kind": "box", "discipline": "Mechanical", "system": "SupplyAir", "cx": 9, "cy": 1.5, "cz": 0.45, "sx": 1.2, "sy": 0.8, "sz": 0.9 }
  ]
}
`;

export const ME_ASCII_SAMPLE = `MEP dump Hospital-HVAC 1.0
DISCIPLINE Mechanical HVAC
DISCIPLINE Electrical Power
DISCIPLINE Plumbing Water
SYSTEM SupplyAir Mechanical HVAC supply
SYSTEM Lighting Electrical lighting
SYSTEM DomesticWater Plumbing water
ELEMENT duct Mechanical SupplyAir BOX 0.4 2 0.4 AT 10 6 1.2
ELEMENT pipe Plumbing DomesticWater BOX 0.1 4 0.1 AT 2.5 3 0.35
ELEMENT tray Electrical Lighting BOX 0.3 6 0.08 AT 6 4 2.4
ELEMENT ahu Mechanical SupplyAir BOX 1.2 0.8 0.9 AT 9 1.5 0.45
`;

export const ME_STEP_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCDISTRIBUTIONSYSTEM('SupplyAir',$,$,$,$,$,$,$,$);
#2=IFCDISTRIBUTIONSYSTEM('Lighting',$,$,$,$,$,$,$,$);
#3=IFCDISTRIBUTIONSYSTEM('DomesticWater',$,$,$,$,$,$,$,$);
#4=IFCFLOWSEGMENT('duct',$,$,$,$,$,$,$,$);
#5=IFCFLOWSEGMENT('pipe',$,$,$,$,$,$,$,$);
#6=IFCFLOWSEGMENT('tray',$,$,$,$,$,$,$,$);
#7=IFCFLOWTERMINAL('ahu',$,$,$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
`;

export const ME_CSV_SAMPLE = `name,type,kind,discipline,system,value
Mechanical,discipline,,Mechanical,,HVAC
Electrical,discipline,,Electrical,,Power
Plumbing,discipline,,Plumbing,,Water
SupplyAir,system,,Mechanical,SupplyAir,HVAC supply
Lighting,system,,Electrical,Lighting,lighting
DomesticWater,system,,Plumbing,DomesticWater,water
duct,element,box,Mechanical,SupplyAir,duct
pipe,element,box,Plumbing,DomesticWater,pipe
tray,element,box,Electrical,Lighting,tray
ahu,element,box,Mechanical,SupplyAir,ahu
`;

export const ME_MARKDOWN_SAMPLE = `# Hospital HVAC

name: STRING
type: STRING
kind: STRING

Mechanical | discipline | hvac
Electrical | discipline | power
Plumbing | discipline | water
SupplyAir | system | mechanical
Lighting | system | electrical
DomesticWater | system | plumbing
duct | element | box
pipe | element | box
tray | element | box
ahu | element | box
`;
