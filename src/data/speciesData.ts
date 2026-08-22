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
  { name: 'Homo sapiens (Humano)', shortCode: 'HSA', maa: 69.58, proteins: 20431, taxon: 'Mammalia', isHuman: true },
  { name: 'Mus musculus (Ratón)', shortCode: 'MMU', maa: 58.20, proteins: 17200, taxon: 'Mammalia' },
  { name: 'Rattus norvegicus', shortCode: 'RNO', maa: 52.40, proteins: 16100, taxon: 'Mammalia' },
  { name: 'Gallus gallus (Pollo)', shortCode: 'GGA', maa: 44.30, proteins: 15300, taxon: 'Aves' },
  { name: 'Arabidopsis thaliana', shortCode: 'ATH', maa: 42.10, proteins: 27400, taxon: 'Plantae' },
  { name: 'Danio rerio (Pez cebra)', shortCode: 'DRE', maa: 39.80, proteins: 14200, taxon: 'Actinopterygii' },
  { name: 'Drosophila melanogaster', shortCode: 'DME', maa: 33.40, proteins: 13900, taxon: 'Insecta' },
  { name: 'Caenorhabditis elegans', shortCode: 'CEL', maa: 25.10, proteins: 20100, taxon: 'Nematoda' },
  { name: 'Saccharomyces cerevisiae', shortCode: 'SCE', maa: 12.80, proteins: 6275, taxon: 'Fungi' },
  { name: 'Schizosaccharomyces pombe', shortCode: 'SPO', maa: 10.40, proteins: 5120, taxon: 'Fungi' },
  { name: 'Escherichia coli K-12', shortCode: 'ECO', maa: 4.10, proteins: 4288, taxon: 'Bacteria' },
  { name: 'Bacillus subtilis', shortCode: 'BSU', maa: 3.80, proteins: 4100, taxon: 'Bacteria' },
  { name: 'Mycobacterium tuberculosis', shortCode: 'MTU', maa: 3.20, proteins: 3990, taxon: 'Bacteria' },
  { name: 'Methanocaldococcus jannaschii', shortCode: 'MJA', maa: 1.75, proteins: 1780, taxon: 'Archaea' },
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
  algorithmType: 'algoritmo1_cyclic' | 'naive_block' = 'algoritmo1_cyclic'
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
      processes[rank].comparisonsCount += (n - 1 - i);
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
      processes[rank].comparisonsCount += (n - 1 - i);
    }
  }

  return processes;
}

// Datos experimentales de escalabilidad (Fase 3, Fase 4 y Tiempo Total)
// Para 300 especies: Balanceado vs Desbalanceado, metacache vs isend
export const SCALABILITY_DATA = {
  processes: [1, 2, 4, 8, 16, 32, 64, 128, 256],
  
  // 300 Especies Desbalanceado
  unbalanced: {
    phase3: {
      speedup_ideal: [1, 2, 4, 8, 16, 32, 64, 128, 256],
      speedup_real: [1.0, 1.94, 3.82, 7.35, 14.1, 26.8, 48.2, 74.5, 96.0],
      time_sec: [342.0, 176.3, 89.5, 46.5, 24.2, 12.7, 7.1, 4.6, 3.56],
    },
    phase4_metacache: {
      speedup: [1.0, 1.88, 3.45, 6.2, 10.8, 16.4, 21.2, 18.5, 11.2], // Caída severa en 128 por contención bloqueante
      time_sec: [512.0, 272.3, 148.4, 82.5, 47.4, 31.2, 24.1, 27.6, 45.7],
    },
    phase4_isend: {
      speedup: [1.0, 1.95, 3.86, 7.52, 14.6, 28.1, 52.4, 89.6, 122.4], // Escala mucho mejor hasta 256 procesos
      time_sec: [512.0, 262.5, 132.6, 68.1, 35.0, 18.2, 9.77, 5.71, 4.18],
    },
    total_metacache: {
      time_sec: [854.0, 448.6, 237.9, 129.0, 71.6, 43.9, 31.2, 32.2, 49.3],
    },
    total_isend: {
      time_sec: [854.0, 438.8, 222.1, 114.6, 59.2, 30.9, 16.87, 10.31, 7.74],
    }
  },

  // 300 Especies Balanceado (sin el cuello de botella extremo de Homo sapiens)
  balanced: {
    phase3: {
      speedup_ideal: [1, 2, 4, 8, 16, 32, 64, 128, 256],
      speedup_real: [1.0, 1.98, 3.92, 7.75, 15.2, 29.8, 57.6, 108.4, 184.0],
      time_sec: [280.0, 141.4, 71.4, 36.1, 18.4, 9.4, 4.86, 2.58, 1.52],
    },
    phase4_metacache: {
      speedup: [1.0, 1.91, 3.65, 6.9, 12.5, 20.1, 28.4, 24.0, 14.8],
      time_sec: [420.0, 219.9, 115.1, 60.8, 33.6, 20.9, 14.8, 17.5, 28.4],
    },
    phase4_isend: {
      speedup: [1.0, 1.97, 3.90, 7.68, 15.1, 29.4, 56.8, 104.2, 172.0],
      time_sec: [420.0, 213.2, 107.7, 54.7, 27.8, 14.3, 7.39, 4.03, 2.44],
    },
    total_metacache: {
      time_sec: [700.0, 361.3, 186.5, 96.9, 52.0, 30.3, 19.66, 20.08, 29.92],
    },
    total_isend: {
      time_sec: [700.0, 354.6, 179.1, 90.8, 46.2, 23.7, 12.25, 6.61, 3.96],
    }
  }
};

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
  { spA: 'Homo sapiens', spB: 'Mus musculus', seqValue: 0.142857142857, mpiValue: 0.142857142857, delta: 0.0, rankComputed: 0, matchesK: 6 },
  { spA: 'Homo sapiens', spB: 'Rattus norv.', seqValue: 0.166666666667, mpiValue: 0.166666666667, delta: 0.0, rankComputed: 0, matchesK: 5 },
  { spA: 'Homo sapiens', spB: 'Gallus gallus', seqValue: 0.250000000000, mpiValue: 0.250000000000, delta: 0.0, rankComputed: 0, matchesK: 3 },
  { spA: 'Homo sapiens', spB: 'Arabidopsis', seqValue: 0.500000000000, mpiValue: 0.500000000000, delta: 0.0, rankComputed: 0, matchesK: 1 },
  { spA: 'Homo sapiens', spB: 'Danio rerio', seqValue: 0.333333333333, mpiValue: 0.333333333333, delta: 0.0, rankComputed: 0, matchesK: 2 },
  { spA: 'Homo sapiens', spB: 'Drosophila', seqValue: 0.500000000000, mpiValue: 0.500000000000, delta: 0.0, rankComputed: 0, matchesK: 1 },
  { spA: 'Homo sapiens', spB: 'C. elegans', seqValue: 0.500000000000, mpiValue: 0.500000000000, delta: 0.0, rankComputed: 0, matchesK: 1 },
  { spA: 'Homo sapiens', spB: 'S. cerevisiae', seqValue: 1.000000000000, mpiValue: 1.000000000000, delta: 0.0, rankComputed: 0, matchesK: 0 },
  { spA: 'Mus musculus', spB: 'Rattus norv.', seqValue: 0.090909090909, mpiValue: 0.090909090909, delta: 0.0, rankComputed: 1, matchesK: 10 },
  { spA: 'Mus musculus', spB: 'Gallus gallus', seqValue: 0.200000000000, mpiValue: 0.200000000000, delta: 0.0, rankComputed: 1, matchesK: 4 },
  { spA: 'Mus musculus', spB: 'Arabidopsis', seqValue: 0.500000000000, mpiValue: 0.500000000000, delta: 0.0, rankComputed: 1, matchesK: 1 },
  { spA: 'Gallus gallus', spB: 'Danio rerio', seqValue: 0.250000000000, mpiValue: 0.250000000000, delta: 0.0, rankComputed: 3, matchesK: 3 },
  { spA: 'Drosophila', spB: 'C. elegans', seqValue: 0.333333333333, mpiValue: 0.333333333333, delta: 0.0, rankComputed: 6, matchesK: 2 },
  { spA: 'E. coli K-12', spB: 'B. subtilis', seqValue: 0.200000000000, mpiValue: 0.200000000000, delta: 0.0, rankComputed: 10, matchesK: 4 },
  { spA: 'B. subtilis', spB: 'M. tubercul.', seqValue: 0.333333333333, mpiValue: 0.333333333333, delta: 0.0, rankComputed: 11, matchesK: 2 },
  { spA: 'M. jannaschii', spB: 'M. genital.', seqValue: 1.000000000000, mpiValue: 1.000000000000, delta: 0.0, rankComputed: 13, matchesK: 0 },
];
