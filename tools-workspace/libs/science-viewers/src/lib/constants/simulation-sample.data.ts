/** Synthetic 2D heat-diffusion simulation sample (education / research). */

export interface SimulationSampleObject {
  name: string;
  solver: string;
  fieldName: string;
  unit: string;
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  times: number[];
  fields: number[][];
  probes: Array<{ id: string; name: string; i: number; j: number; values: number[] }>;
  metrics: Array<{ name: string; values: number[] }>;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildSimulationSampleObject(nx = 40, ny = 28, nt = 16, dt = 0.08, alpha = 0.22): SimulationSampleObject {
  const cx = (nx - 1) / 2;
  const cy = (ny - 1) / 2;
  let u = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const dx = i - cx;
      const dy = j - cy;
      u[j * nx + i] = 300 + 80 * Math.exp(-(dx * dx + dy * dy) / 48);
    }
  }
  const fields: number[][] = [Array.from(u, round3)];
  const times = [0];
  for (let step = 1; step < nt; step++) {
    const next = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = u[j * nx + i];
        const left = i > 0 ? u[j * nx + i - 1] : c;
        const right = i < nx - 1 ? u[j * nx + i + 1] : c;
        const down = j > 0 ? u[(j - 1) * nx + i] : c;
        const up = j < ny - 1 ? u[(j + 1) * nx + i] : c;
        next[j * nx + i] = c + alpha * dt * (left + right + down + up - 4 * c);
      }
    }
    u = next;
    fields.push(Array.from(u, round3));
    times.push(round3(step * dt));
  }

  const probes = [
    { id: 'center', name: 'Center hotspot', i: Math.round(cx), j: Math.round(cy) },
    { id: 'mid-right', name: 'Mid-right', i: Math.round(cx + nx * 0.28), j: Math.round(cy) },
    { id: 'edge', name: 'South edge', i: Math.round(cx), j: 2 }
  ].map((probe) => ({
    ...probe,
    values: fields.map((field) => field[probe.j * nx + probe.i] ?? 0)
  }));

  const metrics = [
    {
      name: 'maxT',
      values: fields.map((field) => round3(field.reduce((max, v) => (v > max ? v : max), -Infinity)))
    },
    {
      name: 'meanT',
      values: fields.map((field) => round3(field.reduce((sum, v) => sum + v, 0) / field.length))
    }
  ];

  return {
    name: 'Heat diffusion demo',
    solver: 'FTCS',
    fieldName: 'temperature',
    unit: 'K',
    nx,
    ny,
    dx: 1,
    dy: 1,
    times,
    fields,
    probes,
    metrics
  };
}

export const SIMULATION_JSON_SAMPLE = JSON.stringify(buildSimulationSampleObject(), null, 2);

export const SIMULATION_CSV_SAMPLE = [
  't,i,j,value',
  '0,0,0,300.1',
  '0,1,0,301.4',
  '0,0,1,302.2',
  '0,1,1,310.8',
  '0.1,0,0,300.4',
  '0.1,1,0,301.6',
  '0.1,0,1,302.0',
  '0.1,1,1,308.2',
  '0.2,0,0,300.6',
  '0.2,1,0,301.7',
  '0.2,0,1,301.9',
  '0.2,1,1,306.4'
].join('\n');

export const SIMULATION_VTK_SAMPLE = `# vtk DataFile Version 2.0
Heat diffusion slice
ASCII
DATASET STRUCTURED_POINTS
DIMENSIONS 4 3 2
ORIGIN 0 0 0
SPACING 1 1 0.1
POINT_DATA 24
SCALARS temperature float 1
LOOKUP_TABLE default
300.1 301.4 302.8 304.0
302.2 310.8 312.1 305.0
301.0 304.2 306.0 303.1
300.4 301.6 302.4 303.2
302.0 308.2 309.4 304.1
300.9 303.6 304.8 302.7
`;

export const SIMULATION_SIM_SAMPLE = `# SIMULATION Heat diffusion
SOLVER FTCS
FIELD temperature K
GRID 2 2
SPACING 1 1
TIMES 0 0.1 0.2
FIELD_T 0
300.1 301.4
302.2 310.8
FIELD_T 0.1
300.4 301.6
302.0 308.2
FIELD_T 0.2
300.6 301.7
301.9 306.4
PROBE center 1 1 310.8 308.2 306.4
METRIC maxT 310.8 308.2 306.4
`;
