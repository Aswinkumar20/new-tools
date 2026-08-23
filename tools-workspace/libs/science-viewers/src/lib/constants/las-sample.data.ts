/** Synthetic CWLS LAS 2.0 well log for education preview. */

function fmt(n: number, w = 10, d = 2): string {
  return n.toFixed(d).padStart(w, ' ');
}

function buildLasSample(): string {
  const strt = 100;
  const stop = 140;
  const step = 0.5;
  const rows: string[] = [];
  for (let d = strt; d <= stop + 1e-9; d += step) {
    const t = (d - strt) / (stop - strt);
    const shale = d > 118 && d < 126 ? 1 : 0;
    const gr = 42 + 28 * Math.sin(t * 7.2) + 12 * Math.sin(t * 19) + shale * 38;
    const rhob = 2.38 + 0.12 * Math.cos(t * 6.1) - shale * 0.14;
    const nphi = 0.18 - 0.07 * Math.cos(t * 6.1) + shale * 0.09;
    const dt = 78 + 14 * Math.sin(t * 5.4) + shale * 16;
    rows.push(`${fmt(d)}${fmt(gr)}${fmt(rhob)}${fmt(nphi, 10, 3)}${fmt(dt)}`);
  }
  return `~VERSION INFORMATION
VERS.                          2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
WRAP.                          NO  : ONE LINE PER DEPTH STEP
~WELL INFORMATION
#MNEM.UNIT              DATA                         DESCRIPTION
STRT.M                       100.0000 : START DEPTH
STOP.M                       140.0000 : STOP DEPTH
STEP.M                         0.5000 : STEP
NULL.                       -999.2500 : NULL VALUE
COMP.               EasyToolHub : COMPANY
WELL.               SAMPLE-1 : WELL
FLD.                DEMO FIELD : FIELD
LOC.                Education preview : LOCATION
PROV.               — : PROVINCE
SRVC.               ETH : SERVICE COMPANY
DATE.               08-Aug-2026 : DATE
UWI.                ETH.DEMO.0001 : UNIQUE WELL ID
~CURVE INFORMATION
#MNEM.UNIT       API CODE     CURVE DESCRIPTION
DEPT.M                        : DEPTH
GR  .GAPI                     : GAMMA RAY
RHOB.G/C3                     : BULK DENSITY
NPHI.V/V                      : NEUTRON POROSITY
DT  .US/F                     : SONIC SLOWNESS
~PARAMETER INFORMATION
#MNEM.UNIT              VALUE                        DESCRIPTION
BHT .DEGC                    78.0000 : BOTTOM HOLE TEMPERATURE
BS  .IN                       8.5000 : BIT SIZE
~OTHER
EasyToolHub synthetic well log for local education preview.
~A  DEPT           GR        RHOB        NPHI          DT
${rows.join('\n')}
`;
}

export const LAS_SAMPLE = buildLasSample();
