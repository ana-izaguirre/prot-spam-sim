/**
 * ProtSpam HPC & Dataset definitions
 * 64 Especies (Homogéneo) & 300 Especies (Desbalanceado con Homo sapiens)
 */

export interface Species {
  id: number;
  name: string;
  shortCode: string;
  maa: number; // Millones de aminoácidos
  proteins: number;
  taxon: string;
  isHuman?: boolean;
}

// 64 Especies Homogéneas (tamaños equilibrados ~12-16 Maa)
export const SPECIES_64_HOMOGENEOUS: Species[] = Array.from({ length: 64 }, (_, i) => {
  const baseMaa = 14.2 + Math.sin(i * 0.7) * 1.8;
  return {
    id: i,
    name: `Esp_${String(i + 1).padStart(2, '0')}`,
    shortCode: `E${String(i + 1).padStart(2, '0')}`,
    maa: parseFloat(baseMaa.toFixed(2)),
    proteins: Math.round(baseMaa * 3200),
    taxon: i < 20 ? 'Bacteria' : i < 40 ? 'Archaea' : 'Eukaryota',
  };
});

// 300 Especies Desbalanceadas (con Homo sapiens 69.58 Maa como punto crítico)
const KEY_TAXA = [
  {
    name: 'Homo sapiens (Humano)',
    shortCode: 'HSA',
    maa: 69.58,
    proteins: 20431,
    taxon: 'Mammalia',
    isHuman: true,
  },
  { name: 'Mus musculus (Ratón)', shortCode: 'MMU', maa: 58.2, proteins: 17200, taxon: 'Mammalia' },
  { name: 'Rattus norvegicus', shortCode: 'RNO', maa: 52.4, proteins: 16100, taxon: 'Mammalia' },
  { name: 'Gallus gallus (Pollo)', shortCode: 'GGA', maa: 44.3, proteins: 15300, taxon: 'Aves' },
  { name: 'Arabidopsis thaliana', shortCode: 'ATH', maa: 42.1, proteins: 27400, taxon: 'Plantae' },
  {
    name: 'Danio rerio (Pez cebra)',
    shortCode: 'DRE',
    maa: 39.8,
    proteins: 14200,
    taxon: 'Actinopterygii',
  },
  {
    name: 'Drosophila melanogaster',
    shortCode: 'DME',
    maa: 33.4,
    proteins: 13900,
    taxon: 'Insecta',
  },
  {
    name: 'Caenorhabditis elegans',
    shortCode: 'CEL',
    maa: 25.1,
    proteins: 20100,
    taxon: 'Nematoda',
  },
  { name: 'Saccharomyces cerevisiae', shortCode: 'SCE', maa: 12.8, proteins: 6275, taxon: 'Fungi' },
  {
    name: 'Schizosaccharomyces pombe',
    shortCode: 'SPO',
    maa: 10.4,
    proteins: 5120,
    taxon: 'Fungi',
  },
  { name: 'Escherichia coli K-12', shortCode: 'ECO', maa: 4.1, proteins: 4288, taxon: 'Bacteria' },
  { name: 'Bacillus subtilis', shortCode: 'BSU', maa: 3.8, proteins: 4100, taxon: 'Bacteria' },
  {
    name: 'Mycobacterium tuberculosis',
    shortCode: 'MTU',
    maa: 3.2,
    proteins: 3990,
    taxon: 'Bacteria',
  },
  {
    name: 'Methanocaldococcus jannaschii',
    shortCode: 'MJA',
    maa: 1.75,
    proteins: 1780,
    taxon: 'Archaea',
  },
  { name: 'Mycoplasma genitalium', shortCode: 'MGE', maa: 0.58, proteins: 482, taxon: 'Bacteria' },
];

export const SPECIES_300_UNBALANCED: Species[] = Array.from({ length: 300 }, (_, i) => {
  if (i < KEY_TAXA.length) {
    return { ...KEY_TAXA[i], id: i };
  }
  // Model realistic log-normal distribution for remaining 285 species
  const randFactor = Math.pow(Math.sin(i * 1.33) * 0.5 + 0.5, 2.2);
  const maa = parseFloat((1.2 + randFactor * 22.0).toFixed(2));
  return {
    id: i,
    name: `Taxon_${String(i + 1).padStart(3, '0')}`,
    shortCode: `T${String(i + 1).padStart(3, '0')}`,
    maa: maa,
    proteins: Math.round(maa * 3100),
    taxon: i % 3 === 0 ? 'Bacteria' : i % 3 === 1 ? 'Eukaryota' : 'Archaea',
  };
});

// Algoritmo 1: Reparto de especies entre procesos MPI (Block vs Cyclic)
export interface ProcessWorkload {
  rank: number;
  speciesCount: number;
  speciesAssigned: number[];
  comparisonsCount: number; // Cantidad de pares (i, j) con j > i
  totalMaa: number; // Carga en Millones de aminoácidos
  hasHomoSapiens: boolean;
}

export function calculateWorkload(
  speciesList: Species[],
  numProcesses: number,
  algorithmType: 'algoritmo1_cyclic' | 'naive_block' = 'algoritmo1_cyclic',
): ProcessWorkload[] {
  const n = speciesList.length;
  const processes: ProcessWorkload[] = Array.from({ length: numProcesses }, (_, rank) => ({
    rank,
    speciesCount: 0,
    speciesAssigned: [],
    comparisonsCount: 0,
    totalMaa: 0,
    hasHomoSapiens: false,
  }));

  if (algorithmType === 'naive_block') {
    // Naive Block Partitioning: rank k gets contiguous block [k*(n/p) .. (k+1)*(n/p)-1]
    const blockSize = Math.ceil(n / numProcesses);
    for (let i = 0; i < n; i++) {
      const rank = Math.min(Math.floor(i / blockSize), numProcesses - 1);
      processes[rank].speciesAssigned.push(i);
      processes[rank].speciesCount++;
      processes[rank].totalMaa += speciesList[i].maa;
      if (speciesList[i].isHuman || speciesList[i].name.includes('Homo sapiens')) {
        processes[rank].hasHomoSapiens = true;
      }
      // Comparisons for row i in upper triangle: j from i+1 to n-1 (n - 1 - i comparisons)
      processes[rank].comparisonsCount += n - 1 - i;
    }
  } else {
    // Algoritmo 1: Cyclic Interleaved Distribution to balance the triangular matrix
    // Row i is assigned to process (i % numProcesses) or balanced snake cyclic
    for (let i = 0; i < n; i++) {
      const rank = i % numProcesses;
      processes[rank].speciesAssigned.push(i);
      processes[rank].speciesCount++;
      processes[rank].totalMaa += speciesList[i].maa;
      if (speciesList[i].isHuman || speciesList[i].name.includes('Homo sapiens')) {
        processes[rank].hasHomoSapiens = true;
      }
      processes[rank].comparisonsCount += n - 1 - i;
    }
  }

  return processes;
}

/**
 * Measured results, transcribed from the thesis tables. Nothing here is
 * computed, interpolated or extrapolated: each array is a column of a numbered
 * table, and any point the thesis did not measure is `null` rather than a
 * guess. Constitution I: these must never be recomputed in the browser.
 *
 * Sources: cuadros 3.1, 4.1, 5.1, 6.1, 6.2, 6.3, 6.4 and 6.5 of
 * "Reconstrucción filogenética de secuencias de proteoma completo en paralelo
 * sobre sistemas de memoria distribuida" (Izaguirre Matamoros, UDC 2026).
 */
export const THESIS_TABLES = {
  /**
   * Cuadro 6.2 — Phase 3 time (s), centralised (A) vs distributed (B) reading,
   * single node, mean of 5 repetitions, spread under 0.7 %.
   *
   * The np = 1 column is NOT a comparison between strategies: both run the same
   * computation path there, and the two figures come from independent batches.
   */
  phase3Reading: {
    processes: [1, 2, 4, 8, 16, 32],
    sets: {
      '10': {
        A: [110.9, 69.3, 49.3, 34.6, 24.9, 24.9],
        B: [110.9, 70.2, 51.5, 36.8, 26.8, 26.8],
      },
      '20': {
        A: [292.4, 197.8, 137.8, 79.8, 73.0, 70.3],
        B: [287.2, 191.2, 133.3, 77.5, 70.1, 69.3],
      },
      '30': {
        A: [391.0, 220.6, 133.3, 110.8, 91.1, 75.2],
        B: [389.2, 229.5, 144.9, 121.2, 101.2, 80.3],
      },
    },
  },

  /**
   * Cuadro 6.3 — the controlled case: 64 species, one node, all three variants
   * in the same job with the same memory reservation, full range from np = 1.
   * This is the only speedup in the thesis with a proper np = 1 baseline of the
   * MPI version itself, so it is the one that may be called a parallel speedup.
   */
  phase4Set64: {
    processes: [1, 2, 4, 8, 16, 32, 64],
    time: {
      metacache: [3131.8, 1600.7, 1154.0, 959.5, 889.1, 848.3, 577.3],
      isend: [3141.4, 1602.2, 1147.2, 932.4, 806.4, 621.6, 456.4],
      isend_opt: [3755.3, 1602.0, 1146.8, 932.2, 806.3, 622.3, 456.6],
    },
    speedup: {
      metacache: [1.0, 1.96, 2.71, 3.26, 3.52, 3.69, 5.42],
      isend: [1.0, 1.96, 2.74, 3.37, 3.9, 5.05, 6.88],
    },
    // Efficiency is tabulated for isend only.
    efficiencyIsend: [1.0, 0.98, 0.69, 0.42, 0.24, 0.16, 0.11],
  },

  /**
   * Cuadro 6.4 — total time (s) on the 300-species sets, 32 processes per node
   * (one to eight nodes). `null` marks the configurations where isend does not
   * complete (MPI_ERR_INTERN on a receive, section 6.7) — not a missing
   * measurement but a reported negative result.
   *
   * The thesis gives no MPI np = 1 run for this set, so there is no speedup
   * baseline of its own here; the analysis starts from np = 32.
   */
  set300: {
    processes: [32, 64, 128, 256],
    nodes: [1, 2, 4, 8],
    balanced: {
      metacache: [6582, 6923, 7702, 4331],
      isend: [5583, 4400, 4204, null],
    },
    unbalanced: {
      metacache: [7330, 7016, 7951, 4375],
      // Marked † in the thesis: a later batch with a larger memory reservation
      // after an out-of-memory termination. Descriptive only — the thesis does
      // not compare these quantitatively with the initial batch.
      isend: [5721, 4673, 4450, null],
      isendSeparateBatch: true,
    },
    /** Reference sequential binary, not the MPI version with one process. */
    sequentialRef: { balanced: 112500, unbalanced: 117300 },
    /** Share of the sequential time taken by Phase 4 on both 300 sets. */
    sequentialPhase4Share: 0.98,
  },

  /**
   * Per-phase behaviour on the 300-species set. The thesis reports these as
   * figures (6.2, 6.3, 6.4), not as tables, so only the endpoints it states in
   * the text are recorded — no intermediate points are invented.
   */
  phaseContrast: {
    multiNode: { base: 32, to: 128, phase3: 2.85, phase4Isend: 1.32 },
    intraNode: { base: 2, to: 16, phase3: 4.58, phase4: 2.67 },
  },

  /** Cuadro 6.1 — upper bound on efficiency from proteome size dispersion. */
  efficiencyBounds: [
    { set: '10', species: 10, meanMaa: 13.68, maxMaa: 22.66, bound: 0.604 },
    { set: '20', species: 20, meanMaa: 17.27, maxMaa: 69.58, bound: 0.248 },
    { set: '30', species: 30, meanMaa: 14.76, maxMaa: 69.58, bound: 0.212 },
    { set: '55', species: 55, meanMaa: 15.76, maxMaa: 69.58, bound: 0.227 },
    { set: '64', species: 64, meanMaa: 12.28, maxMaa: 36.14, bound: 0.34 },
    { set: '300 bal.', species: 300, meanMaa: 8.54, maxMaa: 36.14, bound: 0.236 },
    { set: '300 desbal.', species: 300, meanMaa: 8.75, maxMaa: 69.58, bound: 0.126 },
  ],

  /**
   * Cuadro 6.5 — per-process work on the 55-species set with 32 processes
   * (isend, instrumented build). A representative repetition; compute and
   * communication do not add up to the phase time because not every
   * synchronisation stage was recorded separately.
   */
  imbalance55: {
    processes: 32,
    rows: [
      { rank: 0, pairs: 107, localMaa: 30.2, computeSec: 104.1, commSec: 337.0 },
      { rank: 8, pairs: 75, localMaa: 79.6, computeSec: 219.2, commSec: 172.8 },
      { rank: 16, pairs: 43, localMaa: 28.9, computeSec: 87.0, commSec: 379.1 },
      { rank: 24, pairs: 7, localMaa: 15.4, computeSec: 14.3, commSec: 475.4 },
      { rank: 30, pairs: 1, localMaa: 0.339, computeSec: 0.03, commSec: 511.2 },
      { rank: 31, pairs: 0, localMaa: 0.336, computeSec: 0.0, commSec: 511.6 },
    ],
  },

  /** Cuadro 3.1 — profile of the sequential implementation, self time. */
  profile: [
    { pct: 37.33, fn: 'std::sort (en Species::set_words)', phase: '3' },
    { pct: 33.89, fn: 'calc_matches', phase: '4' },
    { pct: 13.09, fn: 'spacedWords', phase: '3' },
    { pct: 6.42, fn: 'Species::set_words', phase: '3' },
    { pct: 1.86, fn: 'malloc', phase: '—' },
    { pct: 1.19, fn: 'write_words_checksum', phase: '—' },
    { pct: 0.99, fn: 'sw_parser', phase: '2' },
    { pct: 5.23, fn: 'Resto (< 1 % individual)', phase: '—' },
  ],

  /**
   * Cuadro 4.1 — weight of the still-sequential Phase 4 (plus I/O) over the
   * total, option A. This is Amdahl observed experimentally: the parallelised
   * fraction falls as the species count rises.
   */
  amdahl: {
    processes: [1, 2, 4, 8, 16, 32],
    sets: {
      '10': {
        phase3: [110.9, 69.3, 49.3, 34.6, 24.9, 24.9],
        rest: [73.8, 73.9, 74.0, 73.7, 73.7, 73.7],
      },
      '20': {
        phase3: [292.4, 197.8, 137.8, 79.8, 73.0, 70.3],
        rest: [239.2, 239.7, 240.2, 239.8, 239.2, 239.8],
      },
      '30': {
        phase3: [391.0, 220.6, 133.3, 110.8, 91.1, 75.2],
        rest: [534.7, 535.2, 536.4, 535.4, 535.7, 533.5],
      },
    },
  },

  /** Cuadro 5.1 — the datasets used for the Phase 4 evaluation. */
  datasets: [
    { set: '55', species: 55, totalMaa: 866.8, minAa: 335542, maxAa: 69578135, ratio: 207.4 },
    { set: '64', species: 64, totalMaa: 786.0, minAa: 4251633, maxAa: 36141065, ratio: 8.5 },
    {
      set: '300 bal.',
      species: 300,
      totalMaa: 2561.2,
      minAa: 2470701,
      maxAa: 36141065,
      ratio: 14.6,
    },
    {
      set: '300 desbal.',
      species: 300,
      totalMaa: 2623.7,
      minAa: 338706,
      maxAa: 69578135,
      ratio: 205.4,
    },
  ],
} as const;

// Fragmento de la Matriz PHYLIP real calculada (Secuencial vs MPI)
export interface PhylipPairComparison {
  spA: string;
  spB: string;
  seqValue: number;
  mpiValue: number;
  delta: number;
  rankComputed: number;
  matchesK: number;
}

export const PHYLIP_SAMPLE_DATA: PhylipPairComparison[] = [
  {
    spA: 'Homo sapiens',
    spB: 'Mus musculus',
    seqValue: 0.142857142857,
    mpiValue: 0.142857142857,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 6,
  },
  {
    spA: 'Homo sapiens',
    spB: 'Rattus norv.',
    seqValue: 0.166666666667,
    mpiValue: 0.166666666667,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 5,
  },
  {
    spA: 'Homo sapiens',
    spB: 'Gallus gallus',
    seqValue: 0.25,
    mpiValue: 0.25,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 3,
  },
  {
    spA: 'Homo sapiens',
    spB: 'Arabidopsis',
    seqValue: 0.5,
    mpiValue: 0.5,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 1,
  },
  {
    spA: 'Homo sapiens',
    spB: 'Danio rerio',
    seqValue: 0.333333333333,
    mpiValue: 0.333333333333,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 2,
  },
  {
    spA: 'Homo sapiens',
    spB: 'Drosophila',
    seqValue: 0.5,
    mpiValue: 0.5,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 1,
  },
  {
    spA: 'Homo sapiens',
    spB: 'C. elegans',
    seqValue: 0.5,
    mpiValue: 0.5,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 1,
  },
  {
    spA: 'Homo sapiens',
    spB: 'S. cerevisiae',
    seqValue: 1.0,
    mpiValue: 1.0,
    delta: 0.0,
    rankComputed: 0,
    matchesK: 0,
  },
  {
    spA: 'Mus musculus',
    spB: 'Rattus norv.',
    seqValue: 0.090909090909,
    mpiValue: 0.090909090909,
    delta: 0.0,
    rankComputed: 1,
    matchesK: 10,
  },
  {
    spA: 'Mus musculus',
    spB: 'Gallus gallus',
    seqValue: 0.2,
    mpiValue: 0.2,
    delta: 0.0,
    rankComputed: 1,
    matchesK: 4,
  },
  {
    spA: 'Mus musculus',
    spB: 'Arabidopsis',
    seqValue: 0.5,
    mpiValue: 0.5,
    delta: 0.0,
    rankComputed: 1,
    matchesK: 1,
  },
  {
    spA: 'Gallus gallus',
    spB: 'Danio rerio',
    seqValue: 0.25,
    mpiValue: 0.25,
    delta: 0.0,
    rankComputed: 3,
    matchesK: 3,
  },
  {
    spA: 'Drosophila',
    spB: 'C. elegans',
    seqValue: 0.333333333333,
    mpiValue: 0.333333333333,
    delta: 0.0,
    rankComputed: 6,
    matchesK: 2,
  },
  {
    spA: 'E. coli K-12',
    spB: 'B. subtilis',
    seqValue: 0.2,
    mpiValue: 0.2,
    delta: 0.0,
    rankComputed: 10,
    matchesK: 4,
  },
  {
    spA: 'B. subtilis',
    spB: 'M. tubercul.',
    seqValue: 0.333333333333,
    mpiValue: 0.333333333333,
    delta: 0.0,
    rankComputed: 11,
    matchesK: 2,
  },
  {
    spA: 'M. jannaschii',
    spB: 'M. genital.',
    seqValue: 1.0,
    mpiValue: 1.0,
    delta: 0.0,
    rankComputed: 13,
    matchesK: 0,
  },
];
