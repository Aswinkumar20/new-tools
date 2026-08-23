/** Campus federated Navisworks snippets (education / research). */

export const NW_JSON_SAMPLE = `{
  "name": "Campus Fed",
  "navisVer": "2024",
  "units": "m",
  "models": [
    { "name": "Architecture", "description": "campus architecture" },
    { "name": "Structure", "description": "campus structure" },
    { "name": "MEP", "description": "campus MEP" }
  ],
  "items": [
    { "name": "slab", "kind": "box", "model": "Architecture", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "beam", "kind": "box", "model": "Architecture", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "column", "kind": "cylinder", "model": "Structure", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 },
    { "name": "duct", "kind": "box", "model": "MEP", "cx": 10, "cy": 6, "cz": 1.2, "sx": 0.4, "sy": 2, "sz": 0.4 }
  ],
  "clashes": [
    { "name": "CL-01", "clashType": "hard", "status": "active", "itemA": "column", "itemB": "duct", "distance": 0.12, "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "CL-02", "clashType": "clearance", "status": "reviewed", "itemA": "beam", "itemB": "slab", "distance": 0.05, "cx": 2.5, "cy": 1.6, "cz": 0.45 }
  ]
}
`;

export const NW_ASCII_SAMPLE = `NAVIS dump Campus-Fed 2024
MODEL Architecture campus architecture
MODEL Structure campus structure
MODEL MEP campus MEP
ITEM slab Architecture BOX 30 18 0.25 AT 15 9 0.13
ITEM beam Architecture BOX 12 0.4 0.6 AT 15 9 3.2
ITEM column Structure CYLINDER 0.45 4.0 AT 24 14 2.0
ITEM duct MEP BOX 0.6 4 0.5 AT 24 14 2.0
CLASH CL-01 hard active column duct 0.12 AT 24 14 2.0
CLASH CL-02 clearance reviewed beam slab 0.05 AT 15 9 3.2
`;

export const NW_CSV_SAMPLE = `name,type,kind,model,clash,value
Architecture,model,,Architecture,,campus architecture
Structure,model,,Structure,,campus structure
MEP,model,,MEP,,campus MEP
slab,item,box,Architecture,,slab
beam,item,box,Architecture,,beam
column,item,cylinder,Structure,,column
duct,item,box,MEP,,duct
CL-01,clash,hard,MEP,CL-01,column
CL-02,clash,clearance,Architecture,CL-02,beam
`;

export const NW_MARKDOWN_SAMPLE = `# Campus Fed

name: STRING
type: STRING
kind: STRING

Architecture | model | arch
Structure | model | struct
MEP | model | mep
slab | item | box
beam | item | box
column | item | cylinder
duct | item | box
CL-01 | clash | hard
CL-02 | clash | clearance
`;
