/** Arduino shield Eagle snippets Eagle snippets (education / research). */

export const EG_ASCII_SAMPLE = `Eagle dump Arduino-Shield 9.6.2
LAYER 1 Top copper 0
LAYER 16 Bottom copper 1
LAYER 21 tPlace silk 2
LAYER 29 tStop mask 3
NET GND ground
NET 5V power
NET A0 signal
WIRE south 1 GND 0 0 12 0 0.2
WIRE east 1 GND 10 0 10 7 0.2
WIRE north 1 GND 10 7 0 7 0.2
WIRE west 1 GND 0 7 0 0 0.2
WIRE aisle 1 5V 6 1 6 7 0.15
RECT counter 1 GND 1,1 4,1 4,2.2 1,2.2 1,1
VIA via1 GND 10 6 0.35
PAD 5v-pad 5V 1 2 2 0.4
TEXT title 21 4.2 4.2 ARDUINO-SHIELD
INSTANCE U1 A0 2 6
SCHWIRE w1 A0 2 6 6 6
PIN U1-5V 5V 2 7
LABEL A0 A0 6 6
`;

export const EG_XML_SAMPLE = `<?xml version="1.0"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
<drawing>
<board>
<layers>
<layer number="1" name="Top"/>
<layer number="21" name="tPlace"/>
</layers>
<signals>
<signal name="GND">
<wire x1="0" y1="0" x2="10" y2="0" width="0.2" layer="1"/>
<via x="10" y="6" drill="0.35"/>
</signal>
<signal name="5V">
<wire x1="6" y1="1" x2="6" y2="7" width="0.15" layer="1"/>
</signal>
</signals>
<plain>
<text x="4.2" y="4.2" layer="21">ARDUINO-SHIELD</text>
</plain>
</board>
<schematic>
<parts>
<part name="U1"/>
</parts>
<sheets>
<sheet>
<instances>
<instance part="U1" x="2" y="6"/>
</instances>
<nets>
<net name="A0">
<segment>
<wire x1="2" y1="6" x2="6" y2="6"/>
<label x="6" y="6">A0</label>
</segment>
</net>
</nets>
</sheet>
</sheets>
</schematic>
</drawing>
</eagle>
`;

export const EG_JSON_SAMPLE = `{
  "name": "Arduino Shield",
  "eagleVer": "9.6.2",
  "units": "mm",
  "layers": [
    { "name": "1", "function": "copper", "stackIndex": 0, "color": 4 },
    { "name": "16", "function": "copper", "stackIndex": 1, "color": 5 },
    { "name": "21", "function": "silk", "stackIndex": 2, "color": 7 },
    { "name": "29", "function": "mask", "stackIndex": 3, "color": 3 }
  ],
  "nets": [
    { "name": "GND", "netClass": "ground" },
    { "name": "5V", "netClass": "power" },
    { "name": "A0", "netClass": "signal" }
  ],
  "boardItems": [
    { "name": "south", "type": "wire", "layer": "1", "net": "GND", "x": 0, "y": 0, "x2": 10, "y2": 0, "width": 0.2 },
    { "name": "east", "type": "wire", "layer": "1", "net": "GND", "x": 10, "y": 0, "x2": 10, "y2": 7, "width": 0.2 },
    { "name": "north", "type": "wire", "layer": "1", "net": "GND", "x": 10, "y": 8, "x2": 0, "y2": 7, "width": 0.2 },
    { "name": "west", "type": "wire", "layer": "1", "net": "GND", "x": 0, "y": 7, "x2": 0, "y2": 0, "width": 0.2 },
    { "name": "aisle", "type": "wire", "layer": "1", "net": "5V", "x": 6, "y": 1, "x2": 6, "y2": 7, "width": 0.15 },
    { "name": "counter", "type": "rect", "layer": "1", "net": "GND", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "via1", "type": "via", "layer": "1", "net": "GND", "x": 10, "y": 6, "r": 0.35 },
    { "name": "5v-pad", "type": "pad", "layer": "1", "net": "5V", "x": 2, "y": 2, "r": 0.4 },
    { "name": "title", "type": "text", "layer": "21", "x": 4.2, "y": 4.2, "text": "ARDUINO-SHIELD" }
  ],
  "schItems": [
    { "name": "U1", "type": "instance", "net": "A0", "x": 2, "y": 6, "text": "U1" },
    { "name": "w1", "type": "schwire", "net": "A0", "x": 2, "y": 6, "x2": 6, "y2": 6 },
    { "name": "U1-5V", "type": "pin", "net": "5V", "x": 2, "y": 7, "r": 0.12 },
    { "name": "A0", "type": "label", "net": "A0", "x": 6, "y": 6, "text": "A0" }
  ]
}
`;

export const EG_CSV_SAMPLE = `name,type,layer,net,domain,x,y,x2,y2,r,text
1,layer,1,,,,,,,
GND,net,,GND,,,,,,
south,wire,1,GND,board,0,0,10,0,,
via1,via,1,GND,board,10,6,,,0.35,
U1,instance,,A0,schematic,2,6,,,,U1
w1,schwire,,A0,schematic,2,6,6,6,,
title,text,21,,board,4.2,4.2,,,,ARDUINO-SHIELD
`;

export const EG_MARKDOWN_SAMPLE = `# Arduino Shield

name: STRING
type: STRING
layer: STRING
net: STRING
domain: STRING

1 | layer | 1
GND | net | | GND
south | wire | 1 | GND | board
via1 | via | 1 | GND | board
U1 | instance | | A0 | schematic
title | text | 21 | | board
`;
