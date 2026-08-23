/** Synthetic multi-column stratigraphy for education preview. */

export const STRATIGRAPHY_SAMPLE = JSON.stringify(
  {
    name: 'Western Basin composite',
    region: 'ETH Demo Field',
    unit: 'm',
    timeUnit: 'Ma',
    columns: [
      {
        id: 'C1',
        name: 'ETH-1 Composite',
        units: [
          { id: 'U1', name: 'Alluvium', lithology: 'Sand', era: 'Cenozoic', period: 'Quaternary', ageTop: 0, ageBase: 2.58, thickness: 40, color: '#eab308', unconformity: false, description: 'Cover' },
          { id: 'U2', name: 'Upper Sandstone', lithology: 'Sandstone', era: 'Cenozoic', period: 'Paleogene', ageTop: 2.58, ageBase: 23, thickness: 90, color: '#f59e0b', unconformity: false, description: 'Reservoir' },
          { id: 'U3', name: 'Marine Shale', lithology: 'Shale', era: 'Mesozoic', period: 'Late Cretaceous', ageTop: 66, ageBase: 89, thickness: 160, color: '#64748b', unconformity: true, description: 'Seal; K-Pg hiatus above' },
          { id: 'U4', name: 'Lower Sandstone', lithology: 'Sandstone', era: 'Mesozoic', period: 'Early Cretaceous', ageTop: 89, ageBase: 113, thickness: 210, color: '#d97706', unconformity: false, description: 'Deep reservoir' },
          { id: 'U5', name: 'Carbonate', lithology: 'Limestone', era: 'Mesozoic', period: 'Jurassic', ageTop: 145, ageBase: 174, thickness: 180, color: '#a8a29e', unconformity: true, description: 'J-K unconformity above' },
          { id: 'U6', name: 'Basement', lithology: 'Metamorphic', era: 'Paleozoic', period: 'Permian', ageTop: 252, ageBase: 299, thickness: 80, color: '#44403c', unconformity: true, description: 'Economic basement' }
        ]
      },
      {
        id: 'C2',
        name: 'ETH-2 Composite',
        units: [
          { id: 'V1', name: 'Alluvium', lithology: 'Sand', era: 'Cenozoic', period: 'Quaternary', ageTop: 0, ageBase: 2.58, thickness: 25, color: '#eab308', unconformity: false, description: 'Thinner cover' },
          { id: 'V2', name: 'Upper Sandstone', lithology: 'Sandstone', era: 'Cenozoic', period: 'Paleogene', ageTop: 2.58, ageBase: 23, thickness: 70, color: '#f59e0b', unconformity: false, description: 'Reservoir' },
          { id: 'V3', name: 'Marine Shale', lithology: 'Shale', era: 'Mesozoic', period: 'Late Cretaceous', ageTop: 66, ageBase: 89, thickness: 120, color: '#64748b', unconformity: true, description: 'Seal' },
          { id: 'V4', name: 'Lower Sandstone', lithology: 'Sandstone', era: 'Mesozoic', period: 'Early Cretaceous', ageTop: 89, ageBase: 113, thickness: 150, color: '#d97706', unconformity: false, description: 'Deep reservoir' },
          { id: 'V5', name: 'Carbonate', lithology: 'Limestone', era: 'Mesozoic', period: 'Jurassic', ageTop: 145, ageBase: 174, thickness: 240, color: '#a8a29e', unconformity: true, description: 'Thicker carbonate' },
          { id: 'V6', name: 'Basement', lithology: 'Metamorphic', era: 'Paleozoic', period: 'Permian', ageTop: 252, ageBase: 299, thickness: 60, color: '#44403c', unconformity: true, description: 'Basement' }
        ]
      }
    ],
    markers: [
      { id: 'KPG', name: 'K-Pg', age: 66, kind: 'boundary' },
      { id: 'JK', name: 'J-K', age: 145, kind: 'unconformity' },
      { id: 'PT', name: 'P-T', age: 252, kind: 'boundary' }
    ]
  },
  null,
  2
);

export const STRATIGRAPHY_STR_SAMPLE = `# STRATIGRAPHY v1
NAME Western Basin
REGION Demo
UNIT m
TIME Ma
COLUMN ETH-1
UNIT Alluvium Sand Quaternary 0 2.58 40 #eab308
UNIT Marine_Shale Shale Cretaceous 66 89 160 #64748b
UNIT Carbonate Limestone Jurassic 145 174 180 #a8a29e
MARKER K-Pg 66 boundary
`;
