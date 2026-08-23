/** Synthetic deviation survey + lithology for education preview. */

export const BOREHOLE_SAMPLE = JSON.stringify(
  {
    name: 'ETH-1 trajectory',
    well: 'ETH-1',
    kb: 12.5,
    unit: 'm',
    survey: [
      { md: 0, inc: 0, azi: 0 },
      { md: 80, inc: 1.2, azi: 42 },
      { md: 160, inc: 4.5, azi: 48 },
      { md: 240, inc: 9.8, azi: 52 },
      { md: 320, inc: 16.4, azi: 55 },
      { md: 420, inc: 24.1, azi: 58 },
      { md: 520, inc: 32.6, azi: 60 },
      { md: 640, inc: 41.2, azi: 61 },
      { md: 760, inc: 48.5, azi: 62 },
      { md: 900, inc: 54.0, azi: 63 },
      { md: 1040, inc: 57.2, azi: 64 },
      { md: 1180, inc: 58.4, azi: 64.5 },
      { md: 1320, inc: 58.8, azi: 65 }
    ],
    lithology: [
      { id: 'L1', name: 'Alluvium', lithology: 'Sand', topMd: 0, baseMd: 80, color: '#eab308', description: 'Unconsolidated cover' },
      { id: 'L2', name: 'Upper Sandstone', lithology: 'Sandstone', topMd: 80, baseMd: 240, color: '#f59e0b', description: 'Reservoir candidate' },
      { id: 'L3', name: 'Marine Shale', lithology: 'Shale', topMd: 240, baseMd: 520, color: '#64748b', description: 'Seal interval' },
      { id: 'L4', name: 'Lower Sandstone', lithology: 'Sandstone', topMd: 520, baseMd: 900, color: '#d97706', description: 'Deep reservoir' },
      { id: 'L5', name: 'Carbonate', lithology: 'Limestone', topMd: 900, baseMd: 1180, color: '#a8a29e', description: 'Fractured carbonate' },
      { id: 'L6', name: 'Basement', lithology: 'Metamorphic', topMd: 1180, baseMd: 1320, color: '#44403c', description: 'Economic basement' }
    ],
    markers: [
      { id: 'M1', name: 'Top Cretaceous', md: 240 },
      { id: 'M2', name: 'Top Jurassic', md: 900 },
      { id: 'M3', name: 'TD', md: 1320 }
    ]
  },
  null,
  2
);

export const BOREHOLE_BHL_SAMPLE = `# BOREHOLE v1
NAME ETH-1 trajectory
WELL ETH-1
KB 12.5
UNIT m
SURVEY
0 0 0
100 8 50
220 22 58
400 40 62
600 55 64
LITHO
0 100 Sand #eab308
100 220 Shale #64748b
220 600 Sandstone #d97706
MARKER Top_Cretaceous 220
`;
