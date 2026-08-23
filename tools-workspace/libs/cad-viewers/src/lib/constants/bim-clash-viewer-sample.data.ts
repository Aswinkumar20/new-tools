/** Duct-beam clash snippets snippets (education / research). */

export const BC_JSON_SAMPLE = `{
  "name": "Duct-Beam Clash",
  "reportVer": "1.0",
  "units": "m",
  "tests": [
    { "name": "HVAC-Frame", "description": "duct vs beam" }
  ],
  "items": [
    { "name": "slab", "kind": "box", "test": "HVAC-Frame", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "beam", "kind": "box", "test": "HVAC-Frame", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "column", "kind": "cylinder", "test": "HVAC-Frame", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 },
    { "name": "duct", "kind": "box", "test": "HVAC-Frame", "cx": 10, "cy": 6, "cz": 1.2, "sx": 0.4, "sy": 2, "sz": 0.4 }
  ],
  "clashes": [
    { "name": "CL-01", "clashType": "hard", "status": "active", "test": "HVAC-Frame", "itemA": "column", "itemB": "duct", "distance": 0.12, "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "CL-02", "clashType": "clearance", "status": "reviewed", "test": "HVAC-Frame", "itemA": "beam", "itemB": "slab", "distance": 0.05, "cx": 2.5, "cy": 1.6, "cz": 0.45 }
  ]
}
`;

export const BC_ASCII_SAMPLE = `BIM clash dump Duct-Beam-Clash 1.0
TEST HVAC-Frame duct vs beam
ITEM slab BOX 20 12 0.3 AT 10 6 0.15
ITEM beam BOX 14 0.35 0.55 AT 10 6 3.1
ITEM column CYLINDER 0.4 3.6 AT 16 9 1.8
ITEM duct BOX 0.55 3.5 0.45 AT 16 9 1.8
CLASH CL-01 hard active HVAC-Frame column duct 0.12 AT 16 9 1.8
CLASH CL-02 clearance reviewed HVAC-Frame beam slab 0.05 AT 10 6 3.1
`;

export const BC_XML_SAMPLE = `<clashreport name="Duct-Beam Clash" version="1.0">
  <clashtest name="HVAC-Frame" description="duct vs beam">
    <clash name="CL-01" type="hard" status="active" distance="0.12" itema="column" itemb="duct" x="10" y="6" z="1.2"/>
    <clash name="CL-02" type="clearance" status="reviewed" distance="0.05" itema="beam" itemb="slab" x="2.5" y="1.6" z="0.45"/>
  </clashtest>
  <item name="slab" kind="box" sx="20" sy="12" sz="0.3" cx="10" cy="6" cz="0.15"/>
  <item name="beam" kind="box" sx="3" sy="1.2" sz="0.9" cx="2.5" cy="1.6" cz="0.45"/>
  <item name="column" kind="cylinder" r="0.35" h="2.4" cx="10" cy="6" cz="1.2"/>
  <item name="duct" kind="box" sx="0.4" sy="2" sz="0.4" cx="10" cy="6" cz="1.2"/>
</clashreport>
`;

export const BC_CSV_SAMPLE = `name,type,kind,test,clash,value
HVAC-Frame,test,,HVAC-Frame,,duct vs beam
slab,item,box,HVAC-Frame,,slab
beam,item,box,HVAC-Frame,,beam
column,item,cylinder,HVAC-Frame,,column
duct,item,box,HVAC-Frame,,duct
CL-01,clash,hard,HVAC-Frame,CL-01,column
CL-02,clash,clearance,HVAC-Frame,CL-02,beam
`;

export const BC_MARKDOWN_SAMPLE = `# Duct-Beam Clash

name: STRING
type: STRING
kind: STRING

HVAC-Frame | test | hard
slab | item | box
beam | item | box
column | item | cylinder
duct | item | box
CL-01 | clash | hard
CL-02 | clash | clearance
`;
