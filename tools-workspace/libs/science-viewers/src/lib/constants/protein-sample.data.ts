/** Tiny poly-alanine alpha helix PDB for education preview. */

function pad(n: number, width: number): string {
  const s = String(n);
  return ' '.repeat(Math.max(0, width - s.length)) + s;
}

function fmtCoord(v: number): string {
  const s = v.toFixed(3);
  return ' '.repeat(Math.max(0, 8 - s.length)) + s;
}

function buildHelixPdb(): string {
  const lines: string[] = [
    'HEADER    PROTEIN                               08-AUG-26   HELX',
    'TITLE     SAMPLE POLY-ALANINE ALPHA HELIX',
    'HELIX    1   1 ALA A    1  ALA A   12  1                                  12',
    'SEQRES   1 A   12  ALA ALA ALA ALA ALA ALA ALA ALA ALA ALA ALA ALA'
  ];
  let serial = 1;
  const rise = 1.5;
  const twist = (100 * Math.PI) / 180;
  const radius = 2.3;
  for (let i = 0; i < 12; i++) {
    const angle = i * twist;
    const z = i * rise;
    const caX = radius * Math.cos(angle);
    const caY = radius * Math.sin(angle);
    const nAngle = angle - 0.35;
    const cAngle = angle + 0.35;
    const atoms: Array<{ name: string; el: string; x: number; y: number; z: number }> = [
      { name: 'N', el: 'N', x: (radius - 0.4) * Math.cos(nAngle), y: (radius - 0.4) * Math.sin(nAngle), z: z - 0.45 },
      { name: 'CA', el: 'C', x: caX, y: caY, z },
      { name: 'C', el: 'C', x: (radius - 0.3) * Math.cos(cAngle), y: (radius - 0.3) * Math.sin(cAngle), z: z + 0.55 },
      { name: 'O', el: 'O', x: (radius + 0.6) * Math.cos(cAngle), y: (radius + 0.6) * Math.sin(cAngle), z: z + 0.85 },
      { name: 'CB', el: 'C', x: (radius + 1.4) * Math.cos(angle), y: (radius + 1.4) * Math.sin(angle), z: z - 0.2 }
    ];
    for (const atom of atoms) {
      const name = atom.name.padEnd(4, ' ');
      lines.push(
        `ATOM  ${pad(serial, 5)}  ${name}ALA A${pad(i + 1, 4)}    ${fmtCoord(atom.x)}${fmtCoord(atom.y)}${fmtCoord(atom.z)}  1.00 20.00           ${atom.el.padStart(2, ' ')}`
      );
      serial += 1;
    }
  }
  lines.push('END');
  return lines.join('\n') + '\n';
}

export const PROTEIN_SAMPLE_PDB = buildHelixPdb();
