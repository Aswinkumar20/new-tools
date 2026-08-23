/** Synthetic layered basin model for education preview. */

export const GEO_MODEL_SAMPLE = JSON.stringify(
  {
    name: 'ETH Demo Basin',
    crs: 'local',
    unit: 'm',
    extent: { xmin: 0, xmax: 4000, ymin: 0, ymax: 2500, zmin: 0, zmax: 1400 },
    layers: [
      {
        id: 'L1',
        name: 'Alluvium',
        lithology: 'Sand',
        age: 'Quaternary',
        color: '#eab308',
        top: 0,
        base: 70,
        foldAmplitude: 8,
        porosity: 0.3,
        description: 'Unconsolidated cover'
      },
      {
        id: 'L2',
        name: 'Upper Sandstone',
        lithology: 'Sandstone',
        age: 'Paleogene',
        color: '#f59e0b',
        top: 70,
        base: 220,
        foldAmplitude: 18,
        porosity: 0.22,
        description: 'Reservoir candidate'
      },
      {
        id: 'L3',
        name: 'Marine Shale',
        lithology: 'Shale',
        age: 'Late Cretaceous',
        color: '#64748b',
        top: 220,
        base: 480,
        foldAmplitude: 28,
        porosity: 0.08,
        description: 'Seal interval'
      },
      {
        id: 'L4',
        name: 'Lower Sandstone',
        lithology: 'Sandstone',
        age: 'Early Cretaceous',
        color: '#d97706',
        top: 480,
        base: 760,
        foldAmplitude: 40,
        porosity: 0.18,
        description: 'Deep reservoir'
      },
      {
        id: 'L5',
        name: 'Carbonate',
        lithology: 'Limestone',
        age: 'Jurassic',
        color: '#a8a29e',
        top: 760,
        base: 1040,
        foldAmplitude: 52,
        porosity: 0.12,
        description: 'Fractured carbonate'
      },
      {
        id: 'L6',
        name: 'Basement',
        lithology: 'Metamorphic',
        age: 'Paleozoic',
        color: '#44403c',
        top: 1040,
        base: 1400,
        foldAmplitude: 60,
        porosity: 0.02,
        description: 'Economic basement'
      }
    ],
    faults: [
      { id: 'F1', name: 'Basin Bounding Fault', x1: 900, z1: 80, x2: 1500, z2: 1280, dip: 62 },
      { id: 'F2', name: 'Central Fault', x1: 2400, z1: 120, x2: 2800, z2: 1100, dip: 55 }
    ],
    wells: [
      { id: 'W1', name: 'ETH-1', x: 1200, y: 900, td: 1180 },
      { id: 'W2', name: 'ETH-2', x: 2100, y: 1400, td: 980 },
      { id: 'W3', name: 'ETH-3', x: 3200, y: 700, td: 860 }
    ]
  },
  null,
  2
);

export const GEO_MODEL_GMOD_SAMPLE = `# GEOMODEL v1
NAME ETH Demo Basin
CRS local
UNIT m
EXTENT 0 4000 0 2500 0 1400
LAYER Alluvium Sand Quaternary 0 70 #eab308
LAYER Upper_Sandstone Sandstone Paleogene 70 220 #f59e0b
LAYER Marine_Shale Shale Cretaceous 220 480 #64748b
FAULT Basin_Bounding 900 80 1500 1280
WELL ETH-1 1200 900 1180
`;
