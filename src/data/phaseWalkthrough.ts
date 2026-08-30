/**
 * Execution walkthrough for the five ProtSpaM variants.
 *
 * Every step below is a call the corresponding branch actually makes, in the
 * order the program makes it. Nothing here is a timing model: the module shows
 * *what runs and in what order*, and the measured seconds stay where they were
 * measured — the scalability module, transcribed from the thesis.
 *
 * The scenario is a miniature (6 species, 3 ranks, 2 patterns) chosen so a whole
 * execution fits on one screen. The partition, the owners, the pair assignment
 * and the remote-need matrix are *computed here* with the same formulas as the
 * C++ (`species_range`, `owners[]`, the `i < j` rule, `rank_needs_remote_species`),
 * so the numbers the module shows are derived, never typed in by hand.
 */

export interface Bilingual {
  es: string;
  en: string;
}

/** What a rank is doing during one step. Drives the colour of its lane. */
export type RankStatus =
  | 'io' // touching the file system
  | 'compute' // useful work
  | 'send' // inside a send call
  | 'recv' // inside a receive call
  | 'collective' // inside Bcast / Allgather / Reduce
  | 'wait' // blocked with nothing to do
  | 'idle' // has not been given anything yet
  | 'off'; // MPI_Finalize already called

export interface RankState {
  status: RankStatus;
  label: Bilingual;
}

export interface WalkMessage {
  from: number;
  to: number;
  payload: Bilingual;
  /** `serial` renders as "waits its turn", `burst` as "in flight together". */
  kind: 'serial' | 'burst' | 'collective';
  /** Position within a serialised batch, for the blocking variant. */
  order?: number;
}

export interface StepNote {
  kind: 'why' | 'flag' | 'data';
  text: Bilingual;
}

export interface WalkStep {
  /** Stage of the five-stage algorithm this step belongs to. */
  stage: 1 | 2 | 3 | 4 | 5;
  /** Which of the thesis' two timers is accumulating during this step. */
  timer: 'none' | 'phase3' | 'phase4';
  title: Bilingual;
  detail: Bilingual;
  /** The literal call being executed. */
  call: string;
  code?: string;
  ranks: RankState[];
  messages?: WalkMessage[];
  notes?: StepNote[];
  /** Cumulative pairs resolved by each rank at the end of this step. */
  pairsDone?: number[];
}

export interface VariantSummaryRow {
  label: Bilingual;
  value: Bilingual;
}

export interface Variant {
  id: string;
  /** Short name used on the tab. */
  name: string;
  branch: string;
  ranks: number;
  tagline: Bilingual;
  /** The one thing this variant changes with respect to the previous one. */
  changes: Bilingual;
  steps: WalkStep[];
  summary: VariantSummaryRow[];
  url: string;
}

/* ------------------------------------------------------------------ */
/* The miniature scenario                                             */
/* ------------------------------------------------------------------ */

export interface WalkSpecies {
  index: number;
  code: string;
  name: string;
  maa: number;
}

/**
 * Six species, ordered so the two sources of imbalance do not coincide. Rank 0
 * gets the most *pairs* while rank 1 gets the most *amino acids* — which is the
 * thesis' 55-species instrumentation (rank 8 computes for twice as long as
 * rank 0 despite owning fewer pairs) reproduced at a size that fits on screen.
 *
 * Sizes are the same proteome figures the other modules use.
 */
export const WALK_SPECIES: WalkSpecies[] = [
  { index: 0, code: 'MGE', name: 'Mycoplasma genitalium', maa: 0.58 },
  { index: 1, code: 'ECO', name: 'Escherichia coli K-12', maa: 4.1 },
  { index: 2, code: 'HSA', name: 'Homo sapiens', maa: 69.58 },
  { index: 3, code: 'MTU', name: 'Mycobacterium tuberculosis', maa: 3.2 },
  { index: 4, code: 'SCE', name: 'Saccharomyces cerevisiae', maa: 12.8 },
  { index: 5, code: 'MJA', name: 'Methanocaldococcus jannaschii', maa: 1.75 },
];

export const WALK_N = WALK_SPECIES.length;
export const WALK_P = 3;
export const WALK_M = 2;

/**
 * `species_range()` from the C++, transcribed: a contiguous block per rank, the
 * remainder spread over the first ranks so no two ranks differ by more than one
 * species. It balances the *count* of species, never the volume of work — which
 * is the point the thesis makes and measures.
 */
export function speciesRange(total: number, rank: number, size: number): number[] {
  const base = Math.floor(total / size);
  const remainder = total % size;
  const count = base + (rank < remainder ? 1 : 0);
  const begin = rank * base + Math.min(rank, remainder);
  return Array.from({ length: count }, (_, k) => begin + k);
}

/** `owners[j]` — which rank holds species j. */
export function ownersOf(total: number, size: number): number[] {
  const owners = new Array<number>(total).fill(0);
  for (let rank = 0; rank < size; rank++) {
    for (const index of speciesRange(total, rank, size)) owners[index] = rank;
  }
  return owners;
}

export interface RankPlan {
  rank: number;
  species: number[];
  /** Pairs (i, j) with i < j whose i this rank owns. */
  pairs: Array<[number, number]>;
  /** Amino acids of the species this rank holds. */
  ownMaa: number;
  /**
   * Comparison cost proxy: for every pair, the amino acids of both members.
   * `calc_matches` walks both sorted word lists, so its cost grows with
   * |words(i)| + |words(j)|, and word count is proportional to amino acids.
   * It is a proxy for *relative structural load*, not a time.
   */
  pairMaa: number;
  /** Remote species this rank must receive (`rank_needs_remote_species`). */
  needs: number[];
}

export function buildPlan(species: WalkSpecies[], size: number): RankPlan[] {
  const total = species.length;
  const owners = ownersOf(total, size);

  return Array.from({ length: size }, (_, rank) => {
    const mine = speciesRange(total, rank, size);
    const pairs: Array<[number, number]> = [];
    for (const i of mine) {
      for (let j = i + 1; j < total; j++) pairs.push([i, j]);
    }
    const needs: number[] = [];
    for (let j = 0; j < total; j++) {
      if (owners[j] === rank) continue;
      if (mine.some((i) => i < j)) needs.push(j);
    }
    return {
      rank,
      species: mine,
      pairs,
      ownMaa: mine.reduce((sum, i) => sum + species[i].maa, 0),
      pairMaa: pairs.reduce((sum, [i, j]) => sum + species[i].maa + species[j].maa, 0),
      needs,
    };
  });
}

export const WALK_PLAN = buildPlan(WALK_SPECIES, WALK_P);
export const WALK_OWNERS = ownersOf(WALK_N, WALK_P);
export const WALK_TOTAL_PAIRS = (WALK_N * (WALK_N - 1)) / 2;

/* ------------------------------------------------------------------ */
/* Shared rank states                                                 */
/* ------------------------------------------------------------------ */

const busy = (es: string, en: string, status: RankStatus = 'compute'): RankState => ({
  status,
  label: { es, en },
});

const allRanks = (state: RankState): RankState[] => Array.from({ length: WALK_P }, () => state);

const CODE_SPECIES_RANGE = `Range species_range(int total, int rank, int size)
{
    int base      = total / size;
    int remainder = total % size;

    Range range;
    range.count = base + (rank < remainder ? 1 : 0);
    range.begin = rank * base + min(rank, remainder);
    return range;
}`;

const CODE_NEED = `// Un rank necesita una especie remota j si tiene alguna especie local i
// con i < j. Solo se calculan esos pares para no duplicar trabajo.
bool rank_needs_remote_species(int remote_index, const vector<int> &local_indices)
{
    for (int global_i : local_indices)
        if (global_i < remote_index) return true;
    return false;
}`;

const CODE_BLOCKING_SEND = `for (int dest = 0; dest < size; ++dest)
    if (dest != owner && rank_needs_remote[dest])
        send_words(words, dest);   // MPI_Send: uno detras de otro`;

const CODE_ISEND = `vector<int> dests;
for (int dest = 0; dest < size; ++dest)
    if (dest != owner && rank_needs_remote[dest])
        dests.push_back(dest);     // solo apunto a quien hay que mandarlo

if (!dests.empty()) {
    PendingSend pending;
    isend_words_multi(words, dests, TAG_WORDS, pending);  // publica TODOS los Isend
    wait_all_pending(pending);                            // una sola espera
}`;

const CODE_STREAM_STATE = `struct StreamMatchState
{
    unsigned int skip             = 0;
    int          total_mismatches = 0;
    int          total_dc         = 0;
    long long    mismatch_sum     = 0;
    long long    dc_sum           = 0;
    bool         multi_done       = false;
};`;

const CODE_REDUCE = `MPI_Reduce(local_distance.data(),
           rank == 0 ? global_distance.data() : nullptr,
           total_species * total_species, MPI_DOUBLE,
           MPI_SUM, 0, MPI_COMM_WORLD);`;

/* ------------------------------------------------------------------ */
/* Steps shared by every MPI variant                                  */
/* ------------------------------------------------------------------ */

const STEP_MPI_INIT: WalkStep = {
  stage: 1,
  timer: 'none',
  title: { es: 'MPI_Init · arrancan 3 procesos', en: 'MPI_Init · three processes start' },
  detail: {
    es: 'Los tres procesos ejecutan el mismo binario y todos procesan los parámetros, así que todos tienen en memoria la lista completa de ficheros. Lo único que los distingue es su rank.',
    en: 'All three processes run the same binary and all of them parse the parameters, so every one holds the full file list in memory. The only thing that tells them apart is their rank.',
  },
  call: 'MPI_Init() · MPI_Comm_rank() · MPI_Comm_size()',
  ranks: allRanks(busy('parseParameters()', 'parseParameters()')),
};

const STEP_BCAST_PATTERNS: WalkStep = {
  stage: 1,
  timer: 'none',
  title: {
    es: 'Etapa 1 · Los mismos patrones en los tres procesos',
    en: 'Stage 1 · The same patterns on all three processes',
  },
  detail: {
    es: 'Solo rank 0 carga los 2 patrones y después los difunde. Si cada rank los generase por su cuenta con rasbhari, que es probabilístico, cada uno usaría patrones distintos y la matriz no significaría nada.',
    en: 'Only rank 0 loads the two patterns and then broadcasts them. If each rank generated its own with rasbhari, which is probabilistic, every rank would use different patterns and the matrix would mean nothing.',
  },
  call: 'broadcast_patterns(patterns, rank) → MPI_Bcast',
  ranks: [
    busy('MPI_Bcast (root)', 'MPI_Bcast (root)', 'collective'),
    busy('MPI_Bcast (recibe)', 'MPI_Bcast (receives)', 'collective'),
    busy('MPI_Bcast (recibe)', 'MPI_Bcast (receives)', 'collective'),
  ],
  messages: [
    { from: 0, to: 1, payload: { es: 'patrones', en: 'patterns' }, kind: 'collective' },
    { from: 0, to: 2, payload: { es: 'patrones', en: 'patterns' }, kind: 'collective' },
  ],
  notes: [
    {
      kind: 'why',
      text: {
        es: 'Por eso todas las medidas del TFM se lanzan con -p patterns_clean.txt: con los patrones congelados en disco, dos ejecuciones con distinto número de procesos son comparables y la matriz es reproducible.',
        en: 'This is why every measurement in the thesis runs with -p patterns_clean.txt: with the patterns frozen on disk, two runs with different process counts are comparable and the matrix is reproducible.',
      },
    },
  ],
};

const STEP_CENTRALISED_READ: WalkStep = {
  stage: 2,
  timer: 'none',
  title: {
    es: 'Etapa 2 · Solo rank 0 lee el disco (opción A)',
    en: 'Stage 2 · Only rank 0 reads from disk (option A)',
  },
  detail: {
    es: 'Lectura centralizada: rank 0 abre los 6 FASTA, codifica cada aminoácido a un entero 0..23 y rellena header, seq y starts. Los ranks 1 y 2 todavía no tienen nada que hacer.',
    en: 'Centralised reading: rank 0 opens the six FASTA files, encodes every amino acid to an integer 0..23 and fills header, seq and starts. Ranks 1 and 2 have nothing to do yet.',
  },
  call: 'sw_parser(inFiles, species, patterns)',
  ranks: [
    busy('lee 6 FASTA', 'reads 6 FASTA', 'io'),
    busy('sin trabajo', 'no work yet', 'idle'),
    busy('sin trabajo', 'no work yet', 'idle'),
  ],
  notes: [
    {
      kind: 'flag',
      text: {
        es: 'Dos de los tres procesos están parados. Es el precio de la opción A — y aun así el TFM mide que A gana a B en el conjunto de 30 especies, hasta un 11 % a partir de np 4.',
        en: 'Two of the three processes are stopped. That is the cost of option A — and even so the thesis measures A beating B on the 30-species set, by up to 11 % from np 4 onwards.',
      },
    },
  ],
};

const STEP_BLOCK_PARTITION: WalkStep = {
  stage: 2,
  timer: 'none',
  title: {
    es: 'Reparto estático por bloques contiguos',
    en: 'Static contiguous-block partition',
  },
  detail: {
    es: 'Puro cálculo aritmético: no hay comunicación para decidirlo. Los tres procesos aplican la misma fórmula y llegan a la misma respuesta. base = 2, resto = 0 → rank 0 recibe {0, 1}, rank 1 recibe {2, 3} y rank 2 recibe {4, 5}.',
    en: 'Pure arithmetic: no communication is needed to decide it. All three processes apply the same formula and reach the same answer. base = 2, remainder = 0 → rank 0 gets {0, 1}, rank 1 gets {2, 3} and rank 2 gets {4, 5}.',
  },
  call: 'species_range(6, rank, 3) → base = 2, remainder = 0',
  code: CODE_SPECIES_RANGE,
  ranks: allRanks(busy('calcula su rango', 'computes its range')),
  notes: [
    {
      kind: 'flag',
      text: {
        es: 'Reparte NÚMERO de especies, no volumen de trabajo. Aquí rank 1 se lleva Homo sapiens (69,58 Maa) y rank 0 se lleva dos proteomas que suman 4,68. Misma cuenta de especies, cargas incomparables: es la primera de las dos fuentes de desbalance del TFM.',
        en: 'It balances the NUMBER of species, not the volume of work. Here rank 1 takes Homo sapiens (69.58 Maa) while rank 0 takes two proteomes adding up to 4.68. Same species count, incomparable loads: this is the first of the thesis’ two sources of imbalance.',
      },
    },
  ],
};

const STEP_WORKERS_EXIT: WalkStep = {
  stage: 3,
  timer: 'none',
  title: { es: 'Los trabajadores se retiran', en: 'The workers step out' },
  detail: {
    es: 'El paralelismo termina literalmente aquí. Los ranks 1 y 2 ya entregaron sus palabras espaciadas y no participan ni en la etapa 4 ni en la escritura: salen del programa.',
    en: 'Parallelism ends literally here. Ranks 1 and 2 have handed over their spaced words and take no part in stage 4 or in writing the matrix: they leave the program.',
  },
  call: 'if (rank != 0) { MPI_Finalize(); return EXIT_SUCCESS; }',
  ranks: [
    busy('continúa solo', 'carries on alone'),
    busy('MPI_Finalize()', 'MPI_Finalize()', 'off'),
    busy('MPI_Finalize()', 'MPI_Finalize()', 'off'),
  ],
};

const STEP_PHASE4_ON_RANK0: WalkStep = {
  stage: 4,
  timer: 'phase4',
  title: {
    es: 'Etapa 4 · rank 0 calcula los 15 pares, él solo',
    en: 'Stage 4 · rank 0 computes all 15 pairs on its own',
  },
  detail: {
    es: 'La etapa cuadrática sigue siendo secuencial. Los 15 pares los resuelve un único proceso mientras los otros dos ya no existen.',
    en: 'The quadratic stage is still sequential. A single process resolves all 15 pairs while the other two no longer exist.',
  },
  call: 'calculate_distance_matrix(species, …) → calc_matches()',
  ranks: [
    busy('15 pares', '15 pairs'),
    busy('terminado', 'finished', 'off'),
    busy('terminado', 'finished', 'off'),
  ],
  pairsDone: [15, 0, 0],
  notes: [
    {
      kind: 'flag',
      text: {
        es: 'Amdahl en directo. Esta rama paraleliza una etapa Θ(m · Σnᵢ log nᵢ) y deja secuencial una Θ(m · N² · n̄). El TFM lo mide: con 30 especies, el bloque no paralelizado pasa del 58 % del tiempo con 1 proceso al 88 % con 32. Paralelizar la Fase 4 dejó de ser una opción de diseño.',
        en: 'Amdahl, live. This branch parallelises a Θ(m · Σnᵢ log nᵢ) stage and leaves a Θ(m · N² · n̄) one sequential. The thesis measures it: on 30 species the non-parallelised block goes from 58 % of the time with 1 process to 88 % with 32. Parallelising Phase 4 stopped being a design option.',
      },
    },
  ],
};

const STEP_WRITE_PHYLIP_RANK0: WalkStep = {
  stage: 5,
  timer: 'none',
  title: { es: 'Etapa 5 · rank 0 escribe la matriz', en: 'Stage 5 · rank 0 writes the matrix' },
  detail: {
    es: 'Se escribe el PHYLIP 6×6 con las cabeceras y se cierra MPI. La matriz debe ser idéntica —no parecida— a la de la referencia secuencial.',
    en: 'The 6×6 PHYLIP matrix is written with its headers and MPI is closed. The matrix must be identical — not similar — to the sequential reference.',
  },
  call: 'outputDistanceMatrix(…) · MPI_Finalize()',
  ranks: [
    busy('escribe PHYLIP', 'writes PHYLIP', 'io'),
    busy('terminado', 'finished', 'off'),
    busy('terminado', 'finished', 'off'),
  ],
};

/* ------------------------------------------------------------------ */
/* Phase-4 variants: the steps metacache and isend share               */
/* ------------------------------------------------------------------ */

const STEP_OWNERS: WalkStep = {
  stage: 2,
  timer: 'none',
  title: {
    es: 'Reparto por bloques + quién posee qué',
    en: 'Block partition + who owns what',
  },
  detail: {
    es: 'El mismo reparto de la fase 3, y además se difunde el vector owners: qué proceso posee cada especie. Con eso, los 15 pares se reparten con una sola regla — el par (i, j) con i < j lo calcula el propietario de i.',
    en: 'The same partition as phase 3, plus a broadcast of the owners vector: which process holds each species. With that, all 15 pairs are assigned by one rule — the pair (i, j) with i < j is computed by the owner of i.',
  },
  call: 'build_block_assignments() · MPI_Bcast(owners.data(), …)',
  code: CODE_SPECIES_RANGE,
  ranks: allRanks(busy('MPI_Bcast(owners)', 'MPI_Bcast(owners)', 'collective')),
  notes: [
    {
      kind: 'data',
      text: {
        es: 'De los 15 pares, rank 0 se queda 9, rank 1 se queda 5 y rank 2 se queda 1. Esa es la carga triangular, y no depende del tamaño del conjunto: es una propiedad del reparto por bloques. En el TFM, con 55 especies y 32 procesos, el proceso 0 recibe 107 pares y el 31 recibe cero.',
        en: 'Of the 15 pairs, rank 0 keeps 9, rank 1 keeps 5 and rank 2 keeps 1. That is the triangular load, and it does not depend on the size of the set: it is a property of block partitioning. In the thesis, with 55 species and 32 processes, process 0 receives 107 pairs and process 31 receives none.',
      },
    },
  ],
};

const STEP_RANK0_FREES: WalkStep = {
  stage: 2,
  timer: 'none',
  title: {
    es: 'rank 0 deja de ser un cuello de memoria',
    en: 'rank 0 stops being a memory bottleneck',
  },
  detail: {
    es: 'Una vez repartidas las especies, rank 0 se queda solo con las cabeceras —es lo único que necesita para escribir el PHYLIP al final— y devuelve el resto de la RAM al sistema.',
    en: 'Once the species are distributed, rank 0 keeps only the headers — the only thing it needs to write the PHYLIP at the end — and returns the rest of the RAM to the system.',
  },
  call: 'collect_headers(species) · species.clear() · species.shrink_to_fit()',
  code: `if (rank == 0) {
    output_headers = collect_headers(species);   // guardo solo los nombres...
}
distribute_species(species, local_species, local_indices, owners, total_species, rank, size);

if (rank == 0) {
    species.clear();
    species.shrink_to_fit();                     // ...y devuelvo la RAM al sistema
}`,
  ranks: [
    busy('libera species', 'frees species'),
    busy('recibe {2, 3}', 'receives {2, 3}', 'recv'),
    busy('recibe {4, 5}', 'receives {4, 5}', 'recv'),
  ],
  messages: [
    { from: 0, to: 1, payload: { es: 'especies 2, 3', en: 'species 2, 3' }, kind: 'serial' },
    { from: 0, to: 2, payload: { es: 'especies 4, 5', en: 'species 4, 5' }, kind: 'serial' },
  ],
};

const STEP_NEED_MATRIX: WalkStep = {
  stage: 4,
  timer: 'phase4',
  title: { es: 'La matriz de necesidad remota', en: 'The remote-need matrix' },
  detail: {
    es: 'Cada rank calcula qué especies remotas necesita: necesita j si posee alguna i local con i < j. Un único MPI_Allgather convierte esos vectores en conocimiento común, así que todo emisor sabe exactamente a quién debe mandar y a quién no. Aquí: rank 0 necesita {2, 3, 4, 5}, rank 1 necesita {4, 5} y rank 2 no necesita nada.',
    en: 'Each rank computes which remote species it needs: it needs j if it owns some local i with i < j. A single MPI_Allgather turns those vectors into common knowledge, so every sender knows exactly who to send to and who not to. Here: rank 0 needs {2, 3, 4, 5}, rank 1 needs {4, 5} and rank 2 needs nothing.',
  },
  call: 'build_remote_need_matrix() → MPI_Allgather',
  code: CODE_NEED,
  ranks: allRanks(busy('MPI_Allgather', 'MPI_Allgather', 'collective')),
  notes: [
    {
      kind: 'why',
      text: {
        es: 'El propietario se puede deducir de la fórmula de reparto, y el TFM lo dice. Pero la colectiva construye información distinta: QUIÉN NECESITA QUÉ. Eso permite que el propietario envíe solo a quien la va a usar en lugar de retransmitir a todos — en multinodo, cada envío evitado es tráfico que no cruza la red de interconexión.',
        en: 'The owner can be derived from the partition formula, and the thesis says so. But the collective builds different information: WHO NEEDS WHAT. That lets the owner send only to whoever will use the species instead of broadcasting to everyone — across nodes, every avoided send is traffic that never crosses the interconnect.',
      },
    },
    {
      kind: 'data',
      text: {
        es: 'rank 2 no necesita ninguna especie remota, porque posee las dos de índice más alto. Va a recibir cero mensajes y a calcular un solo par.',
        en: 'rank 2 needs no remote species at all, because it holds the two highest indices. It will receive zero messages and compute a single pair.',
      },
    },
  ],
};

const STEP_PATTERN_LOCAL_WORDS = (pattern: number): WalkStep => ({
  stage: 3,
  timer: 'phase3',
  title: {
    es: `Patrón ${pattern} · palabras locales`,
    en: `Pattern ${pattern} · local words`,
  },
  detail: {
    es: `Empieza la vuelta ${pattern + 1} del pipeline. Lo primero es sorted_words.clear(): el patrón anterior muere ahí. Cada rank genera y ordena las palabras del patrón ${pattern} de sus 2 especies y precalcula key_run_lengths, que sustituye la búsqueda repetida de multiMatch por un acceso O(1).`,
    en: `Pipeline turn ${pattern + 1} begins. The first thing is sorted_words.clear(): the previous pattern dies there. Each rank generates and sorts the words of pattern ${pattern} for its 2 species and precomputes key_run_lengths, replacing multiMatch's repeated scan with an O(1) lookup.`,
  },
  call: 'calculate_local_spaced_words_for_pattern(local_species, patterns[p]) · key_run_lengths()',
  ranks: [
    busy('4,68 Maa · 2 especies', '4.68 Maa · 2 species'),
    busy('72,78 Maa · 2 especies', '72.78 Maa · 2 species'),
    busy('14,55 Maa · 2 especies', '14.55 Maa · 2 species'),
  ],
  notes:
    pattern === 0
      ? [
          {
            kind: 'flag',
            text: {
              es: 'En la ruta paralela la Fase 3 deja de ser una etapa previa e independiente: queda entrelazada dentro del bucle de la Fase 4. El bloque de código de la Fase 3 solo se ejecuta como tal cuando np = 1. Por eso el temporizador de la Fase 3 acumula este cálculo, y así las cifras siguen siendo comparables con la ejecución de un solo proceso.',
              en: 'On the parallel path Phase 3 stops being a separate preceding stage: it is interleaved inside the Phase 4 loop. The Phase 3 code block only runs as such when np = 1. That is why the Phase 3 timer accumulates this computation, keeping the figures comparable with the single-process run.',
            },
          },
        ]
      : undefined,
});

const STEP_ACCUMULATE = (pattern: number): WalkStep => ({
  stage: 4,
  timer: 'phase4',
  title: {
    es: `Patrón ${pattern} · acumular en cada par`,
    en: `Pattern ${pattern} · accumulate into each pair`,
  },
  detail: {
    es: 'Cada rank recorre sus pares y actualiza el acumulador de cada uno. Es lo único que sobrevive de un patrón al siguiente: unas decenas de bytes por par, frente a los millones de Word que se acaban de descartar.',
    en: 'Each rank walks its pairs and updates the accumulator of each one. It is the only thing that survives from one pattern to the next: a few dozen bytes per pair, against the millions of Words just discarded.',
  },
  call: 'process_streamed_pattern(…) → StreamMatchState',
  code: pattern === 0 ? CODE_STREAM_STATE : undefined,
  ranks: [
    busy('9 pares · 198,1 Maa', '9 pairs · 198.1 Maa'),
    busy('5 pares · 247,4 Maa', '5 pairs · 247.4 Maa'),
    busy('1 par, luego espera', '1 pair, then waits', 'wait'),
  ],
  pairsDone: [9, 5, 1],
  notes:
    pattern === 0
      ? [
          {
            kind: 'data',
            text: {
              es: 'Aquí está el resultado central del TFM en miniatura: rank 1 tiene 5 pares y rank 0 tiene 9, pero rank 1 procesa 247,4 Maa frente a los 198,1 de rank 0. Menos pares, más trabajo — las dos fuentes de desbalance superpuestas. Es exactamente lo que la instrumentación de 55 especies midió: el proceso 8, con 75 pares, calcula más del doble que el proceso 0, que tiene 107.',
              en: 'Here is the thesis’ central result in miniature: rank 1 has 5 pairs and rank 0 has 9, yet rank 1 processes 247.4 Maa against rank 0’s 198.1. Fewer pairs, more work — the two sources of imbalance superimposed. It is exactly what the 55-species instrumentation measured: process 8, with 75 pairs, computes for more than twice as long as process 0, which has 107.',
            },
          },
          {
            kind: 'flag',
            text: {
              es: 'Y los procesos descargados no terminan antes: esperan. rank 2 acaba su único par y se queda parado hasta que rank 1 termina. El tiempo de la fase lo marca el más lento — en el TFM, el proceso 31 emplea 511,6 de sus 511,6 segundos aguardando.',
              en: 'And lightly loaded processes do not finish sooner: they wait. rank 2 finishes its single pair and stops until rank 1 is done. The phase takes as long as the slowest process — in the thesis, process 31 spends 511.6 of its 511.6 seconds waiting.',
            },
          },
        ]
      : undefined,
});

const STEP_DISCARD: WalkStep = {
  stage: 3,
  timer: 'phase4',
  title: { es: 'Descartar el patrón y volver a empezar', en: 'Discard the pattern and loop' },
  detail: {
    es: 'local_run_lengths y los sorted_words se declaran dentro del bucle de patrones, así que se liberan al empezar el siguiente. El pico de memoria queda dividido por el número de patrones — en el TFM, con 5 patrones, un factor 5.',
    en: 'local_run_lengths and the sorted_words are declared inside the pattern loop, so they are freed as the next turn begins. Peak memory is divided by the number of patterns — in the thesis, with 5 patterns, a factor of 5.',
  },
  call: 'los vectores del patrón salen de ámbito · sorted_words.clear()',
  ranks: allRanks(busy('libera el patrón', 'frees the pattern')),
};

const STEP_REDUCE: WalkStep = {
  stage: 4,
  timer: 'phase4',
  title: { es: 'Reunir la matriz con MPI_Reduce', en: 'Assemble the matrix with MPI_Reduce' },
  detail: {
    es: 'Cada rank rellena una matriz 6×6 con ceros salvo en sus pares. Como cada par lo calcula exactamente un proceso, sumarlas reconstruye la global sin conflictos: una sola colectiva sustituye a N² mensajes. El flag tooDistant se reúne con MPI_MAX, que sobre 0/1 es el OR lógico.',
    en: 'Each rank fills a 6×6 matrix with zeros except at its own pairs. Since each pair is computed by exactly one process, summing them reconstructs the global matrix without conflicts: one collective replaces N² messages. The tooDistant flag is reduced with MPI_MAX, which over 0/1 is the logical OR.',
  },
  call: 'MPI_Reduce(…, MPI_SUM, 0, …) · MPI_Reduce(…, MPI_MAX, 0, …)',
  code: CODE_REDUCE,
  ranks: allRanks(busy('MPI_Reduce', 'MPI_Reduce', 'collective')),
  notes: [
    {
      kind: 'why',
      text: {
        es: 'De aquí sale la equivalencia numérica EXACTA, no aproximada. Cada par lo calcula un único proceso, con el mismo orden de operaciones y el mismo orden del bucle de patrones que la versión secuencial: no hay reasociación en coma flotante. Y en la reducción, para cada entrada de la matriz hay un único proceso con valor no nulo y los demás aportan cero exacto.',
        en: 'This is where EXACT numerical equivalence comes from — exact, not approximate. Each pair is computed by a single process, with the same operation order and the same pattern-loop order as the sequential version: there is no floating-point reassociation. And in the reduction, for every matrix entry there is exactly one process with a non-zero value while the rest contribute exact zero.',
      },
    },
  ],
};

const STEP_WRITE_PHYLIP_PHASE4: WalkStep = {
  stage: 5,
  timer: 'none',
  title: { es: 'Etapa 5 · escribir el PHYLIP', en: 'Stage 5 · write the PHYLIP' },
  detail: {
    es: 'rank 0 reconstruye especies vacías que solo llevan el nombre —las cabeceras que guardó antes de liberar la memoria— y escribe la matriz. Verificada contra la referencia secuencial: idéntica, dígito a dígito, en las tres variantes y en todos los conjuntos.',
    en: 'rank 0 rebuilds empty species carrying only their names — the headers it kept before freeing memory — and writes the matrix. Verified against the sequential reference: identical, digit for digit, across all three variants and every dataset.',
  },
  call: 'build_output_species(output_headers) · outputDistanceMatrix(…)',
  ranks: [
    busy('escribe PHYLIP', 'writes PHYLIP', 'io'),
    busy('MPI_Finalize()', 'MPI_Finalize()', 'off'),
    busy('MPI_Finalize()', 'MPI_Finalize()', 'off'),
  ],
};

/* ------------------------------------------------------------------ */
/* The five variants                                                  */
/* ------------------------------------------------------------------ */

export const VARIANTS: Variant[] = [
  {
    id: 'seq',
    name: 'seq',
    branch: 'feat/seq',
    ranks: 1,
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/seq',
    tagline: {
      es: 'Un solo proceso, las cinco etapas en orden. Es la referencia con la que se compara todo lo demás.',
      en: 'One process, the five stages in order. It is the reference everything else is compared against.',
    },
    changes: {
      es: 'Punto de partida: se retira OpenMP para poder perfilar sin la interferencia de la sincronización entre hilos y para tener una base de tiempos y de corrección limpia.',
      en: 'Starting point: OpenMP is removed so profiling is free of thread-synchronisation interference and so there is a clean timing and correctness baseline.',
    },
    steps: [
      {
        stage: 1,
        timer: 'none',
        title: { es: 'Etapa 1 · Cargar los patrones', en: 'Stage 1 · Load the patterns' },
        detail: {
          es: 'Lee del disco los 2 patrones binarios. Cada patrón tiene w = 6 unos (posiciones que deben coincidir) y dc = 40 ceros (posiciones indiferentes), ℓ = 46 en total. Están congelados en un fichero, no generados con rasbhari.',
          en: 'Reads the two binary patterns from disk. Each has w = 6 ones (match positions) and dc = 40 zeros (don’t-care positions), ℓ = 46 in total. They are frozen in a file, not generated with rasbhari.',
        },
        call: 'parsePatterns("patterns_clean.txt")',
        ranks: [busy('lee patterns_clean.txt', 'reads patterns_clean.txt', 'io')],
      },
      {
        stage: 2,
        timer: 'none',
        title: { es: 'Etapa 2 · Leer los 6 proteomas', en: 'Stage 2 · Read the six proteomes' },
        detail: {
          es: 'Abre los 6 FASTA del filelist y codifica cada aminoácido a un entero 0..23. Cada Species queda con su header de 10 caracteres (el formato PHYLIP lo exige), su seq concatenada y los starts de cada proteína.',
          en: 'Opens the six FASTA files of the filelist and encodes every amino acid to an integer 0..23. Each Species ends up with its 10-character header (PHYLIP requires it), its concatenated seq and the starts of each protein.',
        },
        call: 'sw_parser(fileNames, species, patterns)',
        ranks: [busy('6 FASTA · 92,01 Maa', '6 FASTA · 92.01 Maa', 'io')],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: {
          es: 'Etapa 3 · Palabras espaciadas del patrón 0',
          en: 'Stage 3 · Spaced words for pattern 0',
        },
        detail: {
          es: 'Para cada especie recorre la secuencia posición a posición, empaqueta los 6 aminoácidos de las posiciones de coincidencia en una clave de 30 bits, guarda la posición de origen y ordena el vector con std::sort.',
          en: 'For each species it walks the sequence position by position, packs the six amino acids of the match positions into a 30-bit key, records the origin position and sorts the vector with std::sort.',
        },
        call: 'spacedWords(species[i], patterns[0]) → std::sort',
        ranks: [busy('6 especies × 1 patrón', '6 species × 1 pattern')],
        notes: [
          {
            kind: 'data',
            text: {
              es: 'En el perfilado del TFM esa ordenación sola es el 37,33 % del tiempo, la función más cara del programa. Y aun así no se optimizó: al repartir las especies entre procesos, cada uno ordena solo las suyas, así que la ordenación se paraleliza sola. La ordenación por claves enteras queda como trabajo futuro.',
              en: 'In the thesis’ profile that sort alone is 37.33 % of the time, the most expensive function in the program. And it was still not optimised: once species are split across processes, each one sorts only its own, so the sort parallelises by itself. Radix/counting sort over integer keys is left as future work.',
            },
          },
        ],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: {
          es: 'Etapa 3 · Palabras espaciadas del patrón 1',
          en: 'Stage 3 · Spaced words for pattern 1',
        },
        detail: {
          es: 'Se repite para el segundo patrón. Al terminar la etapa, sorted_words guarda m × N vectores a la vez: todos los patrones de todas las especies viven en memoria simultáneamente.',
          en: 'The same for the second pattern. When the stage ends, sorted_words holds m × N vectors at once: every pattern of every species is in memory simultaneously.',
        },
        call: 'spacedWords(species[i], patterns[1]) → std::sort',
        ranks: [busy('pico de memoria: m × N', 'peak memory: m × N')],
        notes: [
          {
            kind: 'why',
            text: {
              es: 'Ese pico es exactamente lo que metacache eliminará invirtiendo el orden de los bucles: procesar un patrón, comunicarlo, acumularlo y descartarlo antes de pasar al siguiente.',
              en: 'That peak is exactly what metacache removes by inverting the loop order: process one pattern, communicate it, accumulate it and discard it before moving to the next.',
            },
          },
        ],
      },
      {
        stage: 4,
        timer: 'phase4',
        title: { es: 'Etapa 4 · fila i = 0 · 5 pares', en: 'Stage 4 · row i = 0 · 5 pairs' },
        detail: {
          es: 'El bucle exterior recorre i; el interior recorre j hacia atrás, desde N−1 hasta i+1. Solo el triángulo superior, porque la comparación es simétrica. Cada par se resuelve entero —los 2 patrones— antes de pasar al siguiente.',
          en: 'The outer loop walks i; the inner one walks j backwards, from N−1 down to i+1. Only the upper triangle, because the comparison is symmetric. Each pair is resolved in full — both patterns — before moving on.',
        },
        call: 'calc_matches(species[0], species[j], weight, dc, threshold, patterns, outputScores)',
        code: `for (unsigned int i = 0; i < species.size(); ++i) {
    distance[i][i] = 0;
    for (auto j = species.size() - 1; j > i; --j) {
        double mismatch_rate = calc_matches(species[i], species[j], ...);
        distance[i][j] = calc_distance(mismatch_rate);
        distance[j][i] = distance[i][j];
        if (mismatch_rate > 0.8541) tooDistant = true;
    }
}`,
        ranks: [busy('5 de 15 pares', '5 of 15 pairs')],
        pairsDone: [5],
        notes: [
          {
            kind: 'why',
            text: {
              es: 'El bucle interior va hacia atrás por herencia del original, que lo hacía para que el planificador de OpenMP repartiera mejor. Al quitar el #pragma el sentido es irrelevante para el resultado, pero se conserva: así el orden de acumulación en coma flotante es idéntico al del programa original y las matrices se pueden comparar byte a byte.',
              en: 'The inner loop runs backwards, inherited from the original, where it helped OpenMP’s scheduler. With the pragma gone the direction no longer matters for the result — but it is kept, so the floating-point accumulation order matches the original program and the matrices can be compared byte for byte.',
            },
          },
        ],
      },
      {
        stage: 4,
        timer: 'phase4',
        title: { es: 'Etapa 4 · fila i = 1 · 4 pares', en: 'Stage 4 · row i = 1 · 4 pairs' },
        detail: {
          es: 'Cada fila tiene un par menos que la anterior. Es la estructura triangular, y en la versión paralela será la primera fuente de desbalance — aquí, con un solo proceso, solo significa que el bucle se va acortando.',
          en: 'Each row has one pair fewer than the previous one. That is the triangular structure, and in the parallel version it becomes the first source of imbalance — here, with a single process, it just means the loop keeps shortening.',
        },
        call: 'calc_matches(species[1], species[j], …)',
        ranks: [busy('9 de 15 pares', '9 of 15 pairs')],
        pairsDone: [9],
      },
      {
        stage: 4,
        timer: 'phase4',
        title: {
          es: 'Etapa 4 · filas i = 2, 3, 4 · 6 pares',
          en: 'Stage 4 · rows i = 2, 3, 4 · 6 pairs',
        },
        detail: {
          es: 'Las tres últimas filas aportan 3, 2 y 1 pares. La fila i = 5 no aporta ninguno: no hay ninguna especie de índice mayor con la que compararla.',
          en: 'The last three rows contribute 3, 2 and 1 pairs. Row i = 5 contributes none: there is no higher-indexed species left to compare it with.',
        },
        call: 'calc_matches(species[i], species[j], …)',
        ranks: [busy('15 de 15 pares', '15 of 15 pairs')],
        pairsDone: [15],
        notes: [
          {
            kind: 'data',
            text: {
              es: '15 pares = N(N−1)/2. Con 300 especies son 44 850, y esta etapa sola es el 98 % del tiempo secuencial: 112 500 s, más de 31 horas. Ahí está todo el trabajo del TFM.',
              en: '15 pairs = N(N−1)/2. With 300 species that is 44 850, and this stage alone is 98 % of the sequential time: 112 500 s, more than 31 hours. That is where the whole thesis is aimed.',
            },
          },
        ],
      },
      {
        stage: 5,
        timer: 'none',
        title: {
          es: 'Etapa 5 · Escribir la matriz PHYLIP',
          en: 'Stage 5 · Write the PHYLIP matrix',
        },
        detail: {
          es: 'Escribe la matriz 6×6 con las cabeceras. Esta matriz es la referencia de corrección: todas las versiones paralelas se validan comparándose con ella, y la exigencia es que sean idénticas, no parecidas.',
          en: 'Writes the 6×6 matrix with its headers. This matrix is the correctness reference: every parallel version is validated against it, and the requirement is that they be identical, not similar.',
        },
        call: 'outputDistanceMatrix(species, output, distance, tooDistant)',
        ranks: [busy('escribe PHYLIP 6×6', 'writes 6×6 PHYLIP', 'io')],
      },
    ],
    summary: [
      {
        label: { es: 'Qué comunica', en: 'What it communicates' },
        value: { es: 'Nada. Un solo proceso.', en: 'Nothing. A single process.' },
      },
      {
        label: { es: 'Dónde está el límite', en: 'Where the limit is' },
        value: {
          es: 'N(N−1)/2 pares en serie. La etapa 4 crece con N² y acaba dominándolo todo.',
          en: 'N(N−1)/2 pairs in series. Stage 4 grows with N² and ends up dominating everything.',
        },
      },
      {
        label: { es: 'Qué mide el TFM aquí', en: 'What the thesis measures here' },
        value: {
          es: '112 500 s (más de 31 h) con 300 especies balanceadas. Perfilado con 10 proteomas: Fase 3 = 56,8 %, Fase 4 = 33,9 %, juntas ≈ 91 %.',
          en: '112 500 s (over 31 h) on 300 balanced species. Profiled on 10 proteomes: Phase 3 = 56.8 %, Phase 4 = 33.9 %, together ≈ 91 %.',
        },
      },
    ],
  },

  {
    id: 'phase3a',
    name: 'fase 3a',
    branch: 'feat/mpi-phase3-a',
    ranks: WALK_P,
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-a',
    tagline: {
      es: 'La etapa 3 en MPI con lectura centralizada: rank 0 lee todo el disco y reparte las secuencias por la red.',
      en: 'Stage 3 in MPI with centralised reading: rank 0 reads the whole disk and distributes the sequences over the network.',
    },
    changes: {
      es: 'Frente a seq: se paraleliza únicamente el cálculo de palabras espaciadas. Las etapas 1, 2, 4 y 5 siguen en rank 0. Es un paso deliberadamente conservador — aísla una etapa y permite medirla sin que la etapa 4 contamine los tiempos.',
      en: 'Against seq: only the spaced-word computation is parallelised. Stages 1, 2, 4 and 5 stay on rank 0. A deliberately conservative step — it isolates one stage so it can be measured without stage 4 contaminating the timings.',
    },
    steps: [
      STEP_MPI_INIT,
      STEP_BCAST_PATTERNS,
      STEP_CENTRALISED_READ,
      STEP_BLOCK_PARTITION,
      {
        stage: 2,
        timer: 'none',
        title: {
          es: 'Reparto de las secuencias por la red',
          en: 'Sequences distributed over the network',
        },
        detail: {
          es: 'Cada especie viaja en tres mensajes —header, seq y starts— y cada uno con el mismo protocolo de dos pasos: primero el tamaño, después los datos, para que el receptor pueda dimensionar el búfer antes de recibir.',
          en: 'Each species travels in three messages — header, seq and starts — each with the same two-step protocol: size first, data second, so the receiver can size its buffer before receiving.',
        },
        call: 'distribute_species() → send_species() → MPI_Send / MPI_Recv',
        code: `void send_char_vector(const vector<char> &values, int dest, int tag)
{
    int size = static_cast<int>(values.size());
    MPI_Send(&size, 1, MPI_INT, dest, tag, MPI_COMM_WORLD);      // 1) cuantos

    if (size > 0)
        MPI_Send(values.data(), size, MPI_CHAR, dest, tag, MPI_COMM_WORLD);  // 2) que
}`,
        ranks: [
          busy('envía 4 especies', 'sends 4 species', 'send'),
          busy('recibe {2, 3}', 'receives {2, 3}', 'recv'),
          busy('recibe {4, 5}', 'receives {4, 5}', 'recv'),
        ],
        messages: [
          {
            from: 0,
            to: 1,
            payload: { es: 'header + seq + starts ×2', en: 'header + seq + starts ×2' },
            kind: 'serial',
            order: 1,
          },
          {
            from: 0,
            to: 2,
            payload: { es: 'header + seq + starts ×2', en: 'header + seq + starts ×2' },
            kind: 'serial',
            order: 2,
          },
        ],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: {
          es: 'Etapa 3 · cada rank calcula lo suyo. Cero comunicación.',
          en: 'Stage 3 · each rank computes its own. Zero communication.',
        },
        detail: {
          es: 'Cada proceso genera y ordena las palabras espaciadas de sus 2 especies para los 2 patrones. Dentro de este bucle no hay ni una sola llamada MPI: es el caso ideal, y es exactamente lo que el cronómetro de la Fase 3 mide.',
          en: 'Each process generates and sorts the spaced words of its 2 species for both patterns. There is not a single MPI call inside this loop: it is the ideal case, and exactly what the Phase 3 timer measures.',
        },
        call: 'calculate_local_spaced_words(local_species, patterns)',
        code: `// Fase 3 paralela: cada proceso calcula los spaced-words de su subconjunto local.
// No hay comunicacion dentro de este bucle.
for (Species &species : local_species) {
    species.sorted_words.clear();
    for (const vector<char> &pattern : patterns)
        spacedWords(species, pattern);
}`,
        ranks: [
          busy('4,68 Maa', '4.68 Maa'),
          busy('72,78 Maa', '72.78 Maa'),
          busy('14,55 Maa', '14.55 Maa'),
        ],
        notes: [
          {
            kind: 'data',
            text: {
              es: 'Y aquí se ve la primera fuente de desbalance sin necesidad de medir nada: rank 1 tiene 72,78 Maa que procesar y rank 0 tiene 4,68, con el mismo número de especies. El tiempo de la etapa lo marca el más lento, así que rank 0 y rank 2 acabarán esperando.',
              en: 'And the first source of imbalance is visible without measuring anything: rank 1 has 72.78 Maa to process and rank 0 has 4.68, with the same species count. The stage takes as long as the slowest process, so rank 0 and rank 2 will end up waiting.',
            },
          },
        ],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: { es: 'Recolección en rank 0', en: 'Gathered back to rank 0' },
        detail: {
          es: 'Cada trabajador devuelve sus sorted_words etiquetados con el índice GLOBAL de la especie, para que rank 0 los recoloque en su posición original y el orden de la matriz no dependa del reparto. Las Word no viajan una a una —un proteoma genera millones—: se transponen a dos arrays homogéneos, claves y posiciones, y cruzan la red en dos mensajes grandes.',
          en: 'Each worker returns its sorted_words tagged with the GLOBAL species index, so rank 0 can put them back in place and the matrix order does not depend on the partition. Words do not travel one by one — a proteome generates millions: they are transposed into two homogeneous arrays, keys and positions, and cross the network as two large messages.',
        },
        call: 'gather_spaced_words() → send_words() (AoS → SoA)',
        code: `vector<unsigned long long> keys(word_count);      // dos arrays homogeneos...
vector<unsigned int>       positions(word_count);

for (int i = 0; i < word_count; ++i) {
    keys[i]      = words[i].key;
    positions[i] = words[i].pos;
}

MPI_Send(keys.data(),      word_count, MPI_UNSIGNED_LONG_LONG, dest, TAG_WORDS, MPI_COMM_WORLD);
MPI_Send(positions.data(), word_count, MPI_UNSIGNED,           dest, TAG_WORDS, MPI_COMM_WORLD);
                                                  // ...dos mensajes, no 2 millones`,
        ranks: [
          busy('recoloca por índice global', 'reorders by global index', 'recv'),
          busy('envía sorted_words', 'sends sorted_words', 'send'),
          busy('envía sorted_words', 'sends sorted_words', 'send'),
        ],
        messages: [
          {
            from: 1,
            to: 0,
            payload: { es: 'sorted_words {2, 3}', en: 'sorted_words {2, 3}' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'sorted_words {4, 5}', en: 'sorted_words {4, 5}' },
            kind: 'serial',
          },
        ],
        notes: [
          {
            kind: 'flag',
            text: {
              es: 'Este coste no existía en la versión secuencial. Paralelizar la etapa 3 añade tráfico que antes no había, y además rank 0 vuelve a alojarlo todo.',
              en: 'This cost did not exist in the sequential version. Parallelising stage 3 adds traffic that was not there before — and rank 0 ends up holding everything again.',
            },
          },
        ],
      },
      STEP_WORKERS_EXIT,
      STEP_PHASE4_ON_RANK0,
      STEP_WRITE_PHYLIP_RANK0,
    ],
    summary: [
      {
        label: { es: 'Qué comunica', en: 'What it communicates' },
        value: {
          es: 'Bcast de patrones · Send/Recv de las secuencias · recolección de sorted_words a rank 0.',
          en: 'Bcast of patterns · Send/Recv of the sequences · sorted_words gathered back to rank 0.',
        },
      },
      {
        label: { es: 'Dónde está el límite', en: 'Where the limit is' },
        value: {
          es: 'La etapa 4 sigue entera en rank 0. Como crece con N², la fracción paralelizada BAJA al crecer el problema.',
          en: 'Stage 4 stays entirely on rank 0. Since it grows with N², the parallelised fraction FALLS as the problem grows.',
        },
      },
      {
        label: { es: 'Qué mide el TFM aquí', en: 'What the thesis measures here' },
        value: {
          es: 'Con 30 especies, el bloque no paralelizado pasa del 58 % del tiempo con 1 proceso al 88 % con 32. La Fase 3 se reduce entre 4 y 5 veces; el resto se queda clavado (533,5 → 536,4 s).',
          en: 'On 30 species the non-parallelised block goes from 58 % of the time with 1 process to 88 % with 32. Phase 3 shrinks 4–5×; the rest barely moves (533.5 → 536.4 s).',
        },
      },
    ],
  },

  {
    id: 'phase3b',
    name: 'fase 3b',
    branch: 'feat/mpi-phase3-b',
    ranks: WALK_P,
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-b',
    tagline: {
      es: 'La misma etapa paralelizada, el mismo reparto, el mismo resultado. Cambia una sola decisión: quién toca el disco.',
      en: 'The same parallelised stage, the same partition, the same result. One decision changes: who touches the disk.',
    },
    changes: {
      es: 'Frente a 3a: cada proceso abre directamente los ficheros que le tocan, en vez de recibirlos de rank 0. Desaparecen distribute_species() y los send_species de entrada; a cambio, la recolección tiene que devolver también cabeceras y secuencias.',
      en: 'Against 3a: each process opens its own files directly instead of receiving them from rank 0. distribute_species() and the inbound send_species calls disappear; in exchange, the gather has to return headers and sequences too.',
    },
    steps: [
      STEP_MPI_INIT,
      STEP_BCAST_PATTERNS,
      STEP_BLOCK_PARTITION,
      {
        stage: 2,
        timer: 'none',
        title: {
          es: 'Etapa 2 · cada rank abre su bloque de ficheros (opción B)',
          en: 'Stage 2 · each rank opens its own block of files (option B)',
        },
        detail: {
          es: 'Todos los ranks tienen el filelist completo, así que cada uno recorta su rebanada con la misma fórmula de reparto y llama a sw_parser solo sobre ella. La E/S ocurre en paralelo sobre el sistema de ficheros compartido y las secuencias no cruzan la red ni una vez.',
          en: 'Every rank has the full filelist, so each one slices out its own share with the same partition formula and calls sw_parser on it alone. I/O happens in parallel over the shared file system and the sequences never cross the network.',
        },
        call: 'sw_parser(local_files, local_species, patterns)',
        code: `total_species = static_cast<int>(inFiles.size());
species_range(total_species, rank, size, local_begin, local_count);

vector<string> local_files;
local_files.reserve(local_count);
for (int i = 0; i < local_count; ++i)
    local_files.push_back(inFiles[local_begin + i]);      // solo lo mio

sw_parser(local_files, local_species, patterns);           // E/S en paralelo`,
        ranks: [
          busy('lee {0, 1}', 'reads {0, 1}', 'io'),
          busy('lee {2, 3}', 'reads {2, 3}', 'io'),
          busy('lee {4, 5}', 'reads {4, 5}', 'io'),
        ],
        notes: [
          {
            kind: 'flag',
            text: {
              es: 'Con lectura distribuida, el fallo original de sw_parser —que recorría fileNames.size() − 1— dejaría de perder «la última especie» para pasar a perder «la última especie de CADA bloque»: con 32 procesos, hasta 32 especies, y el número perdido dependería del número de procesos. Todas las ramas MPI lo corrigen.',
              en: 'With distributed reading, sw_parser’s original bug — walking fileNames.size() − 1 — would stop losing "the last species" and start losing "the last species of EACH block": with 32 processes, up to 32 species, and the count lost would depend on the process count. Every MPI branch fixes it.',
            },
          },
        ],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: {
          es: 'Etapa 3 · cada rank calcula lo suyo. Cero comunicación.',
          en: 'Stage 3 · each rank computes its own. Zero communication.',
        },
        detail: {
          es: 'Idéntico a 3a: cada proceso genera y ordena las palabras espaciadas de sus 2 especies para los 2 patrones. El cálculo no cambia entre las dos opciones; lo único que cambia es cómo llegaron los datos hasta aquí.',
          en: 'Identical to 3a: each process generates and sorts the spaced words of its 2 species for both patterns. The computation is the same in both options; the only difference is how the data got here.',
        },
        call: 'calculate_local_spaced_words(local_species, patterns)',
        ranks: [
          busy('4,68 Maa', '4.68 Maa'),
          busy('72,78 Maa', '72.78 Maa'),
          busy('14,55 Maa', '14.55 Maa'),
        ],
      },
      {
        stage: 3,
        timer: 'phase3',
        title: {
          es: 'Recolección — ahora hay que devolver más cosas',
          en: 'Gather — now there is more to return',
        },
        detail: {
          es: 'En 3a rank 0 ya tenía todas las Species: las había leído él. En 3b nunca ha visto las ajenas —no conoce sus cabeceras ni sus secuencias— y las necesita para etiquetar la matriz PHYLIP y para calcular la etapa 4. Por eso la recolección devuelve header, seq y starts ADEMÁS de las palabras.',
          en: 'In 3a rank 0 already had every Species: it had read them itself. In 3b it has never seen the others — it knows neither their headers nor their sequences — and it needs them to label the PHYLIP matrix and to compute stage 4. So the gather returns header, seq and starts AS WELL AS the words.',
        },
        call: 'gather_species_results() → send_species() + send_words()',
        code: `for (int i = 0; i < local_count; ++i) {
    int global_index = global_begin + i;
    MPI_Send(&global_index, 1, MPI_INT, dest, TAG_WORDS, MPI_COMM_WORLD);

    send_species(local_species[i], dest);   // <- header + seq + starts, que 3a no mandaba

    int pattern_count = static_cast<int>(local_species[i].sorted_words.size());
    MPI_Send(&pattern_count, 1, MPI_INT, dest, TAG_WORDS, MPI_COMM_WORLD);
    for (int p = 0; p < pattern_count; ++p) { /* keys + positions */ }
}`,
        ranks: [
          busy('recibe especies + words', 'receives species + words', 'recv'),
          busy('envía especies + words', 'sends species + words', 'send'),
          busy('envía especies + words', 'sends species + words', 'send'),
        ],
        messages: [
          {
            from: 1,
            to: 0,
            payload: { es: 'Species {2, 3} + sorted_words', en: 'Species {2, 3} + sorted_words' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'Species {4, 5} + sorted_words', en: 'Species {4, 5} + sorted_words' },
            kind: 'serial',
          },
        ],
        notes: [
          {
            kind: 'flag',
            text: {
              es: '3b quita la comunicación de entrada, pero engorda la de salida. Su ventaja real y defendible es otra: la memoria de entrada nunca se concentra en un solo proceso y la E/S aprovecha el sistema de ficheros paralelo. La lección que 3a y 3b dejan juntas es la misma: mientras la etapa 4 no se paralelice, todo camino termina en rank 0.',
              en: '3b removes the inbound communication but fattens the outbound one. Its real, defensible advantage is a different one: input memory is never concentrated in a single process and I/O uses the parallel file system. The lesson 3a and 3b give together is the same: until stage 4 is parallelised, every road ends at rank 0.',
            },
          },
        ],
      },
      STEP_WORKERS_EXIT,
      {
        ...STEP_PHASE4_ON_RANK0,
        notes: [
          {
            kind: 'data',
            text: {
              es: 'El TFM compara las dos opciones y el dato contradice la intuición: la teoría favorece a B —reparte el coste de lectura y elimina la comunicación inicial— pero A gana en el conjunto de 30 especies, el mayor evaluado, en todos los puntos a partir de np 4 y con hasta un 11 % de ventaja. B solo gana en el de 20, y por márgenes menores.',
              en: 'The thesis compares both options and the data contradicts intuition: theory favours B — it spreads the read cost and removes the initial communication — but A wins on the 30-species set, the largest evaluated, at every point from np 4 onwards and by up to 11 %. B only wins on the 20-species set, by smaller margins.',
            },
          },
          {
            kind: 'why',
            text: {
              es: 'La hipótesis razonable es la contención del sistema de ficheros cuando muchos procesos leen a la vez. Pero el temporizador mide el intervalo completo de la Fase 3 y no permite atribuir la diferencia a una sola operación: se presenta como resultado medido, no como causa demostrada. Por eso las ramas de fase 4 heredan la opción A.',
              en: 'The reasonable hypothesis is contention on the shared file system when many processes read at once. But the timer measures the whole Phase 3 interval and cannot attribute the difference to a single operation: it is reported as a measured result, not a demonstrated cause. This is why the phase-4 branches inherit option A.',
            },
          },
        ],
      },
      STEP_WRITE_PHYLIP_RANK0,
    ],
    summary: [
      {
        label: { es: 'Qué comunica', en: 'What it communicates' },
        value: {
          es: 'Bcast de patrones · nada de entrada · recolección de Species completas + sorted_words.',
          en: 'Bcast of patterns · nothing inbound · full Species + sorted_words gathered back.',
        },
      },
      {
        label: { es: 'Dónde está el límite', en: 'Where the limit is' },
        value: {
          es: 'El mismo que en 3a: la etapa 4 sigue en rank 0. Y aquí la recolección es más pesada, porque también viajan cabeceras y secuencias.',
          en: 'The same as 3a: stage 4 still runs on rank 0. And here the gather is heavier, because headers and sequences travel too.',
        },
      },
      {
        label: { es: 'Qué mide el TFM aquí', en: 'What the thesis measures here' },
        value: {
          es: 'A gana a B en 10 y 30 especies (hasta 11 % a partir de np 4); B solo gana en 20 y por menos. Se eligió A porque gana en el conjunto mayor y con más procesos.',
          en: 'A beats B on 10 and 30 species (up to 11 % from np 4 onwards); B only wins on 20, by less. A was chosen because it wins on the largest set and with more processes.',
        },
      },
    ],
  },

  {
    id: 'metacache',
    name: 'metacache',
    branch: 'feat/mpi-phase4-metacache',
    ranks: WALK_P,
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache',
    tagline: {
      es: 'La etapa cuadrática en MPI. Cuatro decisiones para comunicar lo mínimo, y los envíos multi-destino con MPI_Send bloqueante.',
      en: 'The quadratic stage in MPI. Four decisions to communicate the bare minimum, with multi-destination sends over blocking MPI_Send.',
    },
    changes: {
      es: 'Frente a 3a: se ataca la etapa 4. Media matriz, matriz de necesidad remota vía Allgather, caché de metadatos y streaming patrón a patrón. La etapa 3 deja de ser una fase previa y queda entrelazada dentro del bucle de la 4.',
      en: 'Against 3a: stage 4 is attacked. Half the matrix, a remote-need matrix via Allgather, a metadata cache and pattern-by-pattern streaming. Stage 3 stops being a preceding phase and is interleaved inside the stage-4 loop.',
    },
    steps: [
      STEP_MPI_INIT,
      STEP_BCAST_PATTERNS,
      STEP_CENTRALISED_READ,
      STEP_OWNERS,
      STEP_RANK0_FREES,
      STEP_NEED_MATRIX,
      {
        stage: 4,
        timer: 'phase4',
        title: {
          es: 'La caché de metadatos — el nombre de la rama',
          en: 'The metadata cache — where the branch gets its name',
        },
        detail: {
          es: 'header, seq y starts no cambian de un patrón a otro, así que se comunican UNA sola vez, antes del bucle. Enviar la secuencia completa una vez por patrón multiplicaría por m el tráfico más pesado del programa. Aquí son 6 envíos en total y se acaban.',
          en: 'header, seq and starts do not change from one pattern to the next, so they are communicated ONCE, before the loop. Sending the full sequence once per pattern would multiply the program’s heaviest traffic by m. Here it is six sends in total, and then it is over.',
        },
        call: 'build_remote_metadata_cache() → stream_species_metadata_for_phase4()',
        ranks: [
          busy('recibe 4 metadatos', 'receives 4 metadata', 'recv'),
          busy('envía 2 · recibe 2', 'sends 2 · receives 2', 'send'),
          busy('envía 4 metadatos', 'sends 4 metadata', 'send'),
        ],
        messages: [
          {
            from: 1,
            to: 0,
            payload: { es: 'metadata j = 2', en: 'metadata j = 2' },
            kind: 'serial',
          },
          {
            from: 1,
            to: 0,
            payload: { es: 'metadata j = 3', en: 'metadata j = 3' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'metadata j = 4', en: 'metadata j = 4' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'metadata j = 4', en: 'metadata j = 4' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'metadata j = 5', en: 'metadata j = 5' },
            kind: 'serial',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'metadata j = 5', en: 'metadata j = 5' },
            kind: 'serial',
          },
        ],
        notes: [
          {
            kind: 'data',
            text: {
              es: 'Las especies 0 y 1 no viajan nunca: nadie posee un índice menor que ellas, así que nadie las necesita. Eso es la matriz de necesidad haciendo su trabajo — un broadcast ingenuo las habría mandado igual.',
              en: 'Species 0 and 1 never travel: nobody owns a lower index, so nobody needs them. That is the need matrix doing its job — a naive broadcast would have sent them anyway.',
            },
          },
        ],
      },
      STEP_PATTERN_LOCAL_WORDS(0),
      {
        stage: 4,
        timer: 'phase4',
        title: {
          es: 'Patrón 0 · comunicar, destino a destino',
          en: 'Pattern 0 · communicate, destination by destination',
        },
        detail: {
          es: 'Para cada especie j, su propietario envía las palabras del patrón actual con MPI_Send bloqueante, en un bucle. rank 2 manda la especie 4 a rank 0 y solo cuando ese envío retorna empieza el de rank 1. El coste es la SUMA de los dos.',
          en: 'For each species j, its owner sends the current pattern’s words with blocking MPI_Send, in a loop. rank 2 sends species 4 to rank 0, and only once that send returns does the one to rank 1 begin. The cost is the SUM of the two.',
        },
        call: 'stream_pattern_words_for_phase4() → send_words() → MPI_Send',
        code: CODE_BLOCKING_SEND,
        ranks: [
          busy('recibe 4 tandas', 'receives 4 batches', 'recv'),
          busy('envía, luego recibe', 'sends, then receives', 'send'),
          busy('envía en serie', 'sends in series', 'send'),
        ],
        messages: [
          {
            from: 1,
            to: 0,
            payload: { es: 'words j = 2', en: 'words j = 2' },
            kind: 'serial',
            order: 1,
          },
          {
            from: 1,
            to: 0,
            payload: { es: 'words j = 3', en: 'words j = 3' },
            kind: 'serial',
            order: 2,
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'words j = 4', en: 'words j = 4' },
            kind: 'serial',
            order: 3,
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'words j = 4 · espera su turno', en: 'words j = 4 · waits its turn' },
            kind: 'serial',
            order: 4,
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'words j = 5', en: 'words j = 5' },
            kind: 'serial',
            order: 5,
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'words j = 5 · espera su turno', en: 'words j = 5 · waits its turn' },
            kind: 'serial',
            order: 6,
          },
        ],
        notes: [
          {
            kind: 'why',
            text: {
              es: 'Con mensajes grandes MPI puede usar el protocolo rendezvous: negocia primero con el receptor y el MPI_Send no retorna hasta que ese receptor ha publicado su MPI_Recv. Enviar a muchos destinos uno a uno introduce esperas visibles, sobre todo entre nodos. A cambio, el bloqueo da un control de flujo implícito que la variante isend pierde.',
              en: 'For large messages MPI may use the rendezvous protocol: it negotiates with the receiver first, and MPI_Send does not return until that receiver has posted its MPI_Recv. Sending to many destinations one at a time introduces visible waits, especially across nodes. In exchange, blocking gives implicit flow control that the isend variant loses.',
            },
          },
          {
            kind: 'flag',
            text: {
              es: 'Esta línea, send_words(words, dest) dentro del bucle de destinos, es lo ÚNICO que la rama isend cambia. Todo lo demás —reparto, necesidad remota, caché, streaming, acumulación y reducción— es idéntico. Por eso la comparación entre las dos es limpia.',
              en: 'This line, send_words(words, dest) inside the destination loop, is the ONLY thing the isend branch changes. Everything else — partition, remote need, cache, streaming, accumulation and reduction — is identical. That is what makes the comparison between them clean.',
            },
          },
        ],
      },
      STEP_ACCUMULATE(0),
      STEP_DISCARD,
      {
        ...STEP_PATTERN_LOCAL_WORDS(1),
        title: {
          es: 'Patrón 1 · calcular y comunicar otra vez',
          en: 'Pattern 1 · compute and communicate again',
        },
        call: 'calculate_local_spaced_words_for_pattern(…) · stream_pattern_words_for_phase4() → MPI_Send',
        detail: {
          es: 'Segunda y última vuelta del pipeline: mismo cálculo local, misma comunicación bloqueante destino a destino, misma acumulación. Lo que NO se repite son los metadatos — cabeceras, secuencias y starts ya están en la caché y no se vuelven a enviar. Ese ahorro es exactamente lo que da nombre a la rama.',
          en: 'Second and final pipeline turn: same local computation, same blocking destination-by-destination communication, same accumulation. What is NOT repeated is the metadata — headers, sequences and starts are already in the cache and are never sent again. That saving is exactly what gives the branch its name.',
        },
      },
      { ...STEP_ACCUMULATE(1), pairsDone: [9, 5, 1] },
      STEP_REDUCE,
      STEP_WRITE_PHYLIP_PHASE4,
    ],
    summary: [
      {
        label: { es: 'Qué comunica', en: 'What it communicates' },
        value: {
          es: 'Bcast de patrones y owners · Allgather de necesidades · metadatos una sola vez · words por patrón con MPI_Send bloqueante · Reduce final.',
          en: 'Bcast of patterns and owners · Allgather of needs · metadata once · per-pattern words over blocking MPI_Send · a final Reduce.',
        },
      },
      {
        label: { es: 'Dónde está el límite', en: 'Where the limit is' },
        value: {
          es: 'El emisor se serializa: envía destino a destino. Y por debajo, el reparto estático concentra el trabajo — la cota triangular limita la Fase 4 en torno al 50 % aunque los proteomas fueran idénticos.',
          en: 'The sender serialises: it sends destination by destination. And underneath, the static partition concentrates the work — the triangular bound limits Phase 4 to around 50 % even with identical proteomes.',
        },
      },
      {
        label: { es: 'Qué mide el TFM aquí', en: 'What the thesis measures here' },
        value: {
          es: '5,42× con 64 procesos (64 especies, base np = 1). Con 300 especies y 256 procesos: 4331 s. No es monótona entre 32 y 128 procesos (6582 s → 7702 s) y el TFM lo reporta sin sobreexplicarlo.',
          en: '5.42× with 64 processes (64 species, np = 1 baseline). On 300 species with 256 processes: 4331 s. It is not monotonic between 32 and 128 processes (6582 s → 7702 s) and the thesis reports that without over-explaining it.',
        },
      },
    ],
  },

  {
    id: 'isend',
    name: 'isend',
    branch: 'feat/mpi-phase4-metacache-isend',
    ranks: WALK_P,
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend',
    tagline: {
      es: 'Mismo algoritmo, mismo reparto, mismo resultado numérico. Cambia una sola cosa: cómo se emiten los envíos multi-destino.',
      en: 'Same algorithm, same partition, same numerical result. One thing changes: how multi-destination sends are issued.',
    },
    changes: {
      es: 'Frente a metacache: el bucle sobre los destinos ya no envía, solo recoge la lista. Después se publican todos los MPI_Isend de la tanda sin esperar entre ellos y se espera UNA vez con MPI_Waitall. Es el cambio más pequeño del TFM y el que más dice sobre el rendimiento en multinodo.',
      en: 'Against metacache: the loop over destinations no longer sends, it only collects the list. Then every MPI_Isend of the batch is posted without waiting in between, and there is ONE MPI_Waitall. It is the smallest change in the thesis and the one that says the most about multi-node performance.',
    },
    steps: [
      STEP_MPI_INIT,
      STEP_BCAST_PATTERNS,
      STEP_CENTRALISED_READ,
      STEP_OWNERS,
      STEP_RANK0_FREES,
      STEP_NEED_MATRIX,
      {
        stage: 4,
        timer: 'phase4',
        title: {
          es: 'La caché de metadatos, ya en tandas no bloqueantes',
          en: 'The metadata cache, already in non-blocking batches',
        },
        detail: {
          es: 'Los mismos seis envíos que en metacache, con otra mecánica: se recoge primero la lista de destinos y se publican todos los Isend. Son tres tandas independientes —cabecera, secuencia y starts— porque son tres búferes distintos, cada uno con su PendingSend.',
          en: 'The same six sends as in metacache, with different mechanics: the destination list is collected first and all the Isends are posted. Three independent batches — header, sequence and starts — because they are three different buffers, each with its own PendingSend.',
        },
        call: 'isend_species_multi(metadata, dests, TAG_SPECIES, …) · wait_all_pending() ×3',
        ranks: [
          busy('recibe 4 metadatos', 'receives 4 metadata', 'recv'),
          busy('Isend ×1 · recibe 2', 'Isend ×1 · receives 2', 'send'),
          busy('Isend ×2 en vuelo', 'Isend ×2 in flight', 'send'),
        ],
        messages: [
          {
            from: 1,
            to: 0,
            payload: { es: 'metadata j = 2', en: 'metadata j = 2' },
            kind: 'burst',
          },
          {
            from: 1,
            to: 0,
            payload: { es: 'metadata j = 3', en: 'metadata j = 3' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'metadata j = 4', en: 'metadata j = 4' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'metadata j = 4', en: 'metadata j = 4' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'metadata j = 5', en: 'metadata j = 5' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'metadata j = 5', en: 'metadata j = 5' },
            kind: 'burst',
          },
        ],
      },
      STEP_PATTERN_LOCAL_WORDS(0),
      {
        stage: 4,
        timer: 'phase4',
        title: {
          es: 'Patrón 0 · publicar toda la tanda y esperar una vez',
          en: 'Pattern 0 · post the whole batch, wait once',
        },
        detail: {
          es: 'El bucle sobre los destinos ya no envía: solo apunta a quién hay que mandarlo. Después isend_words_multi publica todos los MPI_Isend de la tanda sin esperar entre ellos, y wait_all_pending hace un único MPI_Waitall. rank 2 lanza sus dos envíos de la especie 4 a la vez: el coste pasa de la SUMA de los dos al MÁXIMO.',
          en: 'The loop over destinations no longer sends: it only notes who to send to. Then isend_words_multi posts every MPI_Isend of the batch without waiting in between, and wait_all_pending performs a single MPI_Waitall. rank 2 fires both of its species-4 sends at once: the cost goes from the SUM of the two to the MAXIMUM.',
        },
        call: 'isend_words_multi(words, dests, TAG_WORDS, pending) · MPI_Waitall',
        code: CODE_ISEND,
        ranks: [
          busy('recibe 4 tandas', 'receives 4 batches', 'recv'),
          busy('Isend ×1 · recibe 2', 'Isend ×1 · receives 2', 'send'),
          busy('Isend ×2 en vuelo', 'Isend ×2 in flight', 'send'),
        ],
        messages: [
          { from: 1, to: 0, payload: { es: 'words j = 2', en: 'words j = 2' }, kind: 'burst' },
          { from: 1, to: 0, payload: { es: 'words j = 3', en: 'words j = 3' }, kind: 'burst' },
          {
            from: 2,
            to: 0,
            payload: { es: 'words j = 4 · en vuelo', en: 'words j = 4 · in flight' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'words j = 4 · en vuelo', en: 'words j = 4 · in flight' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 0,
            payload: { es: 'words j = 5 · en vuelo', en: 'words j = 5 · in flight' },
            kind: 'burst',
          },
          {
            from: 2,
            to: 1,
            payload: { es: 'words j = 5 · en vuelo', en: 'words j = 5 · in flight' },
            kind: 'burst',
          },
        ],
        notes: [
          {
            kind: 'why',
            text: {
              es: 'MPI_Isend no garantiza haber copiado el búfer al retornar. Si el búfer fuese una variable local que se destruye al salir de la función, MPI seguiría leyendo memoria liberada: corrupción silenciosa. PendingSend mantiene vivos a la vez los búferes y las peticiones hasta el Waitall. Los destinos comparten el mismo búfer, y es correcto y deliberado: MPI solo LEE del búfer de envío.',
              en: 'MPI_Isend does not guarantee the buffer has been copied when it returns. If the buffer were a local variable destroyed on leaving the function, MPI would keep reading freed memory: silent corruption. PendingSend keeps the buffers and the requests alive together until the Waitall. All destinations share the same buffer, which is correct and deliberate: MPI only READS from the send buffer.',
            },
          },
          {
            kind: 'flag',
            text: {
              es: 'Matiz que conviene decir antes de que lo pregunten: esto es no bloqueante, pero NO solapa comunicación con cómputo. Entre el Isend y el Waitall no se ejecuta ningún trabajo útil, y el receptor sigue usando MPI_Recv bloqueante. El objetivo no era solapar, sino que el emisor no se serialice. Un solapamiento real exigiría también MPI_Irecv y reestructurar el bucle de cómputo.',
              en: 'A qualification worth saying before being asked: this is non-blocking, but it does NOT overlap communication with computation. No useful work runs between the Isend and the Waitall, and the receiver still uses blocking MPI_Recv. The goal was not overlap, but keeping the sender from serialising. Real overlap would also need MPI_Irecv and a restructured computation loop.',
            },
          },
        ],
      },
      STEP_ACCUMULATE(0),
      STEP_DISCARD,
      {
        ...STEP_PATTERN_LOCAL_WORDS(1),
        title: {
          es: 'Patrón 1 · calcular y comunicar otra vez',
          en: 'Pattern 1 · compute and communicate again',
        },
        call: 'calculate_local_spaced_words_for_pattern(…) · isend_words_multi() · MPI_Waitall',
        detail: {
          es: 'Segunda y última vuelta del pipeline: mismo cálculo local, misma tanda no bloqueante con un único Waitall, misma acumulación. Los metadatos ya están en la caché y no se vuelven a enviar.',
          en: 'Second and final pipeline turn: same local computation, same non-blocking batch with a single Waitall, same accumulation. The metadata is already cached and never sent again.',
        },
      },
      { ...STEP_ACCUMULATE(1), pairsDone: [9, 5, 1] },
      STEP_REDUCE,
      STEP_WRITE_PHYLIP_PHASE4,
    ],
    summary: [
      {
        label: { es: 'Qué comunica', en: 'What it communicates' },
        value: {
          es: 'Exactamente lo mismo que metacache. Solo cambia el mecanismo: Isend para toda la tanda y un único Waitall. Verificado con git diff: entre las dos ramas solo se tocan main.cpp, el README y src/calc_matches.cpp.',
          en: 'Exactly the same as metacache. Only the mechanism changes: Isend for the whole batch and a single Waitall. Verified with git diff: between the two branches only main.cpp, the README and src/calc_matches.cpp are touched.',
        },
      },
      {
        label: { es: 'Dónde está el límite', en: 'Where the limit is' },
        value: {
          es: 'Sin control de flujo. Falla de forma reproducible con 256 procesos sobre 300 especies (error interno de MPI en una recepción); metacache completa esa misma configuración sin incidencias. Y por debajo sigue el desbalance del reparto estático, que es estructural.',
          en: 'No flow control. It fails reproducibly with 256 processes on 300 species (an internal MPI error on a receive); metacache completes that same configuration without trouble. And underneath, the static partition’s imbalance is still there, and it is structural.',
        },
      },
      {
        label: { es: 'Qué mide el TFM aquí', en: 'What the thesis measures here' },
        value: {
          es: '6,88× con 64 procesos frente a 5,42× de metacache, con ventaja máxima del 26,7 % en np = 32. Sobre 300 especies, hasta un 45 % más rápida en np = 128 y el mejor tiempo completado: 4204 s sobre 4 nodos — el mismo resultado que metacache, con la mitad de nodos.',
          en: '6.88× with 64 processes against metacache’s 5.42×, with a maximum 26.7 % advantage at np = 32. On 300 species, up to 45 % faster at np = 128 and the best completed time: 4204 s on 4 nodes — the same result as metacache, with half the nodes.',
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Stage labels                                                       */
/* ------------------------------------------------------------------ */

export const STAGE_LABELS: Array<{ stage: 1 | 2 | 3 | 4 | 5; label: Bilingual; cost: Bilingual }> =
  [
    {
      stage: 1,
      label: { es: 'Patrones', en: 'Patterns' },
      cost: { es: 'despreciable', en: 'negligible' },
    },
    {
      stage: 2,
      label: { es: 'Leer FASTA', en: 'Read FASTA' },
      cost: { es: 'E/S, lineal', en: 'I/O, linear' },
    },
    {
      stage: 3,
      label: { es: 'Palabras espaciadas', en: 'Spaced words' },
      cost: { es: 'Θ(m · Σ nᵢ log nᵢ)', en: 'Θ(m · Σ nᵢ log nᵢ)' },
    },
    {
      stage: 4,
      label: { es: 'Comparar pares', en: 'Compare pairs' },
      cost: { es: 'Θ(m · N² · n̄)', en: 'Θ(m · N² · n̄)' },
    },
    {
      stage: 5,
      label: { es: 'Escribir PHYLIP', en: 'Write PHYLIP' },
      cost: { es: 'despreciable', en: 'negligible' },
    },
  ];
