/** Synthetic Illumina-like FASTQ (Phred+33) for education preview. */

function qChars(scores: number[]): string {
  return scores.map((q) => String.fromCharCode(Math.max(0, Math.min(93, q)) + 33)).join('');
}

function ramp(len: number, start: number, mid: number, end: number): number[] {
  const out: number[] = [];
  const third = Math.max(1, Math.floor(len / 3));
  for (let i = 0; i < len; i++) {
    if (i < third) {
      out.push(Math.round(start + ((mid - start) * i) / third));
    } else if (i < third * 2) {
      out.push(mid);
    } else {
      out.push(Math.round(mid + ((end - mid) * (i - third * 2)) / Math.max(1, len - third * 2)));
    }
  }
  return out;
}

function buildSampleFastq(): string {
  const reads: Array<{ id: string; seq: string; scores: number[] }> = [
    {
      id: 'EasyToolHub:read_001 1:N:0:ATCACG',
      seq: 'ACGATCGATCGATCGATCGATCGATCGATCGATCGATCGA',
      scores: ramp(40, 38, 36, 28)
    },
    {
      id: 'EasyToolHub:read_002 1:N:0:ATCACG',
      seq: 'GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA',
      scores: ramp(40, 36, 30, 12)
    },
    {
      id: 'EasyToolHub:read_003 1:N:0:ATCACG',
      seq: 'TTGACCTGGAACCTGGAACCTGGAACCTGGAACCTGGAAA',
      scores: ramp(40, 40, 34, 22)
    },
    {
      id: 'EasyToolHub:read_004 1:N:0:ATCACG',
      seq: 'NNGCATGCATGCATGCATGCATGCATGCATGCATGCATGC',
      scores: ramp(40, 18, 24, 10)
    },
    {
      id: 'EasyToolHub:read_005 1:N:0:GGCTAC',
      seq: 'CGTACGTACGTACGTACGTACGTACGTACGTACGTACGTA',
      scores: ramp(40, 37, 35, 30)
    },
    {
      id: 'EasyToolHub:read_006 1:N:0:GGCTAC',
      seq: 'AAATTTCCCGGGAAATTTCCCGGGAAATTTCCCGGGAAAT',
      scores: ramp(40, 33, 20, 8)
    }
  ];
  return reads
    .map((read) => `@${read.id}\n${read.seq}\n+\n${qChars(read.scores)}`)
    .join('\n') + '\n';
}

export const FASTQ_SAMPLE = buildSampleFastq();
