import React, { useState } from 'react';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import {
  GitBranch,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Network,
  Clock,
  Sparkles,
} from 'lucide-react';

interface BranchInfo {
  id: string;
  name: string;
  phase: string;
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  whyEs: string;
  whyEn: string;
  url: string;
  status: 'recommended' | 'baseline' | 'intermediate' | 'experimental';
  speedup: string;
  featuresEs: string[];
  featuresEn: string[];
  cppSnippet: string;
}

const BRANCHES: BranchInfo[] = [
  {
    id: 'isend',
    name: 'feat/mpi-phase4-metacache-isend',
    phase: 'Fase 4 (Paralela No Bloqueante)',
    titleEs: 'Variante isend: Comunicación Asíncrona con MPI_Isend y Cola PendingSend',
    titleEn: 'isend Variant: Asynchronous Communication with MPI_Isend & PendingSend Queue',
    descEs: 'Variante principal y recomendada. Dispara solicitudes no bloqueantes en ráfaga con MPI_Isend hacia todos los destinos requeridos, acumula los MPI_Request en la estructura PendingSend y realiza una única sincronización con MPI_Waitall.',
    descEn: 'Primary and recommended variant. Fires non-blocking burst requests with MPI_Isend to all required destinations, accumulates MPI_Requests in the PendingSend structure, and synchronizes once with MPI_Waitall.',
    whyEs: 'Elimina por completo la serialización del emisor impuesta por el protocolo rendezvous de MPI_Send, logrando hasta un 45% de reducción de tiempo frente a metacache en 128 procesos en FinisTerrae III.',
    whyEn: 'Completely eliminates sender serialization imposed by the rendezvous protocol in MPI_Send, achieving up to 45% time reduction over metacache at 128 processes on FinisTerrae III.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend',
    status: 'recommended',
    speedup: '4204 s (128P en 4 Nodos) - 26.8x vs Secuencial',
    featuresEs: [
      'Lanzamiento inmediato de MPI_Isend sin esperas entre destinos.',
      'Gestión de buffers pendientes con PendingSend para evitar corrupción de memoria.',
      'Sincronización agrupada con MPI_Waitall tras enviar la tanda del patrón.',
      'Caché de metadatos de proteomas (secuencias y cabeceras enviadas 1 sola vez).',
      'Streaming patrón a patrón para mantener el consumo de RAM bajo y constante.',
    ],
    featuresEn: [
      'Immediate MPI_Isend dispatch without waiting between destinations.',
      'Pending buffer management with PendingSend to prevent memory corruption.',
      'Grouped synchronization with MPI_Waitall after sending the pattern batch.',
      'Proteome metadata cache (sequences and headers transmitted only once).',
      'Pattern-by-pattern streaming keeping RAM consumption low and bounded.',
    ],
    cppSnippet: `// feat/mpi-phase4-metacache-isend
if (is_owner_of_species(r)) {
    for (int dest : needed_by_ranks[r]) {
        MPI_Request req;
        // Envío asíncrono no bloqueante
        MPI_Isend(spaced_words_buffer, count, MPI_UNSIGNED_LONG, 
                  dest, TAG_PATTERN_WORDS, MPI_COMM_WORLD, &req);
        pending_sends.push_back({req, spaced_words_buffer});
    }
    // Sincronización agrupada de la ráfaga
    MPI_Waitall(pending_sends.size(), pending_requests, MPI_STATUSES_IGNORE);
} else if (needs_species(r)) {
    MPI_Recv(recv_buffer, count, MPI_UNSIGNED_LONG, 
             owner_rank, TAG_PATTERN_WORDS, MPI_COMM_WORLD, &status);
}`,
  },
  {
    id: 'metacache',
    name: 'feat/mpi-phase4-metacache',
    phase: 'Fase 4 (Paralela Bloqueante)',
    titleEs: 'Variante metacache: Comunicación Punto a Punto con MPI_Send',
    titleEn: 'metacache Variant: Point-to-Point Communication with Blocking MPI_Send',
    descEs: 'Primera aproximación para distribuir la Fase 4. Introduce la caché de metadatos y el cálculo de media matriz triangular (j > i), pero envía los datos secuencialmente destino a destino con MPI_Send.',
    descEn: 'First approach to distribute Phase 4. Introduces metadata caching and triangular half-matrix computation (j > i), but sends data sequentially destination-by-destination using MPI_Send.',
    whyEs: 'Demuestra la viabilidad de distribuir el cálculo de distancias. Sin embargo, a partir de 64-128 procesos sufre degradación por la espera obligada a que cada receptor publique su MPI_Recv.',
    whyEn: 'Demonstrates the feasibility of distributing distance calculations. However, beyond 64-128 processes it suffers degradation due to forced stalls waiting for each receiver to post MPI_Recv.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache',
    status: 'intermediate',
    speedup: '7702 s (128P) - Sufre contención de red',
    featuresEs: [
      'Cálculo estricto de media matriz (cada par (i, j) se procesa en un único nodo).',
      'Matriz de necesidad remota con MPI_Allgather para evitar broadcasts globales.',
      'Caché de metadatos (nombres y longitudes) antes del bucle de patrones.',
      'Envío secuencial con MPI_Send bloqueante en un bucle for (dest : destinations).',
    ],
    featuresEn: [
      'Strict half-matrix computation (each pair (i, j) computed in exactly one node).',
      'Remote requirement matrix with MPI_Allgather avoiding unnecessary broadcasts.',
      'Metadata caching (names and sequence lengths) before the pattern loop.',
      'Sequential sending with blocking MPI_Send in a for (dest : destinations) loop.',
    ],
    cppSnippet: `// feat/mpi-phase4-metacache
if (is_owner_of_species(r)) {
    for (int dest : needed_by_ranks[r]) {
        // Envío bloqueante secuencial: puede serializar al emisor
        MPI_Send(spaced_words_buffer, count, MPI_UNSIGNED_LONG, 
                 dest, TAG_PATTERN_WORDS, MPI_COMM_WORLD);
    }
} else if (needs_species(r)) {
    MPI_Recv(recv_buffer, count, MPI_UNSIGNED_LONG, 
             owner_rank, TAG_PATTERN_WORDS, MPI_COMM_WORLD, &status);
}`,
  },
  {
    id: 'phase3_a',
    name: 'feat/mpi-phase3-a',
    phase: 'Fase 3 (Lectura Centralizada)',
    titleEs: 'Fase 3: Reparto de Especies con Lectura Centralizada en Rank 0',
    titleEn: 'Phase 3: Species Distribution with Centralized Reading at Rank 0',
    descEs: 'Paraleliza la extracción y ordenación de palabras espaciadas (std::sort). El Proceso 0 lee todos los ficheros FASTA de disco y distribuye los bloques de secuencias mediante MPI_Send.',
    descEn: 'Parallelizes spaced words extraction and std::sort sorting. Process 0 reads all FASTA files from disk and distributes sequence blocks via MPI_Send.',
    whyEs: 'Evita colisiones en el sistema de ficheros de red compartida (NFS/Lustre). Es la estrategia ganadora en conjuntos de 30 y 300 especies.',
    whyEn: 'Prevents I/O contention on shared cluster filesystems (NFS/Lustre). It is the winning strategy for 30 and 300 species datasets.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-a',
    status: 'intermediate',
    speedup: 'Escalabilidad cuasilineal en Fase 3 (~5.2x en 32P)',
    featuresEs: [
      'Rank 0 centraliza la lectura secuencial de proteomas.',
      'send_species() y recv_species() para transmisión de cadenas y metadatos.',
      'Paralelización automática de std::sort sin necesidad de ordenación paralela.',
      'Fase 4 se mantenía secuencial en Rank 0 en esta etapa intermedia.',
    ],
    featuresEn: [
      'Rank 0 centralizes sequential proteome reading.',
      'send_species() and recv_species() for sequence and metadata transmission.',
      'Automatic parallelization of std::sort without complex distributed sorting.',
      'Phase 4 remained sequential on Rank 0 during this intermediate milestone.',
    ],
    cppSnippet: `// feat/mpi-phase3-a (Lectura Centralizada)
if (rank == 0) {
    read_all_fasta_files(filelist);
    for (int dest = 1; dest < total_ranks; ++dest) {
        auto range = get_species_block(dest, total_species, total_ranks);
        send_species_block(dest, range);
    }
} else {
    recv_species_block(0);
}
// Cada proceso genera y ordena localmente:
compute_and_sort_spaced_words_locally();`,
  },
  {
    id: 'phase3_b',
    name: 'feat/mpi-phase3-b',
    phase: 'Fase 3 (Lectura Distribuida)',
    titleEs: 'Fase 3: Lectura Distribuida Independiente de Disco',
    titleEn: 'Phase 3: Distributed Independent Disk Reading',
    descEs: 'Estrategia alternativa donde cada proceso lee directamente del sistema de ficheros compartido únicamente los proteomas asignados a su bloque local.',
    descEn: 'Alternative strategy where each process directly reads only its locally assigned proteomes from the shared filesystem.',
    whyEs: 'Elimina la fase de comunicación inicial por MPI, pero genera accesos concurrentes a disco que pueden penalizar el rendimiento en clústeres con alto número de nodos.',
    whyEn: 'Eliminates the initial MPI communication phase, but causes concurrent disk accesses that can degrade throughput in multi-node clusters.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-b',
    status: 'intermediate',
    speedup: 'Ventaja leve en 20 especies, superada por Opción A en 300 especies',
    featuresEs: [
      'Todos los procesos leen su lista local sin comunicarse con Rank 0.',
      'Cero sobrecarga de red MPI durante la carga de secuencias.',
      'Sensible a la contención de ancho de banda de E/S del almacenamiento compartido.',
    ],
    featuresEn: [
      'All processes read their local filelist without communicating with Rank 0.',
      'Zero MPI network overhead during sequence loading.',
      'Sensitive to shared storage I/O bandwidth contention.',
    ],
    cppSnippet: `// feat/mpi-phase3-b (Lectura Distribuida)
auto local_range = get_species_block(rank, total_species, total_ranks);
for (int i = local_range.start; i < local_range.end; ++i) {
    read_single_fasta_file(filelist[i]);
}
compute_and_sort_spaced_words_locally();`,
  },
  {
    id: 'seq',
    name: 'feat/seq',
    phase: 'Base Secuencial de Referencia',
    titleEs: 'Línea Base Secuencial Limpia e Instrumentación de Checksum',
    titleEn: 'Clean Sequential Baseline & Checksum Instrumentation',
    descEs: 'Reimplementación secuencial estricta a partir de la versión OpenMP original para eliminar interferencias de hilos y servir como estándar de oro numérico.',
    descEn: 'Strict sequential reimplementation from the original OpenMP code to remove thread interference and establish a gold numeric standard.',
    whyEs: 'Permitió el profiling con perf (identificando que std::sort y calc_matches consumen el 91% del tiempo) y la verificación con write_words_checksum.',
    whyEn: 'Enabled profiling with perf (identifying that std::sort and calc_matches consume 91% of time) and verification via write_words_checksum.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/seq',
    status: 'baseline',
    speedup: 'Línea Base: 112.5 ks (>31 horas en 300 especies)',
    featuresEs: [
      'Código C++11 puro sin dependencias de hilos OpenMP.',
      'Función de checksum write_words_checksum() para validar identidad de palabras.',
      'Profiling estadístico con Linux perf (-O3 -g -fno-omit-frame-pointer).',
      'Salida PHYLIP de distancia evolutiva verificada bit a bit.',
    ],
    featuresEn: [
      'Pure C++11 code without OpenMP thread synchronization.',
      'Checksum validation function write_words_checksum() to verify word identity.',
      'Statistical profiling with Linux perf (-O3 -g -fno-omit-frame-pointer).',
      'Bitwise verified PHYLIP evolutionary distance matrix output.',
    ],
    cppSnippet: `// feat/seq (Referencia Secuencial)
// Profiling: std::sort (37.3%) + calc_matches (33.9%) = 71.2%
for (int p = 0; p < num_patterns; ++p) {
    for (int i = 0; i < N; ++i) {
        for (int j = i + 1; j < N; ++j) {
            calc_matches(species[i], species[j], patterns[p]);
        }
    }
}
write_phylip_matrix("DMat", distances);`,
  },
  {
    id: 'calcopt',
    name: 'feat/mpi-phase4-metacache-isend-calcopt',
    phase: 'Ruta Secuencial (np=1)',
    titleEs: 'Variante isend_opt: Precálculo por Patrón en Ruta Secuencial',
    titleEn: 'isend_opt Variant: Pattern Precomputation on Sequential Path (np=1)',
    descEs: 'Trasladó la optimización de precalcular las posiciones don\'t-care y longitudes de bloque a la función secuencial calc_matches cuando np=1.',
    descEn: 'Transferred the optimization of precomputing don\'t-care positions and block lengths to sequential calc_matches when np=1.',
    whyEs: 'Resultado experimental contraintuitivo: la ruta secuencial fue un 19.5% más lenta (3755 s vs 3141 s) porque el coste de construir las estructuras no se amortiza al no reutilizarse.',
    whyEn: 'Counterintuitive experimental finding: the sequential path was 19.5% slower (3755s vs 3141s) because precomputation setup overhead is not amortized without reuse.',
    url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend-calcopt',
    status: 'experimental',
    speedup: 'Descartado para línea base (+19.5% tiempo secuencial)',
    featuresEs: [
      'Precálculo de índices don\'t-care y longitudes por patrón.',
      'En ejecuciones paralelas (np > 1) su comportamiento es idéntico a isend.',
      'Enseñanza metodológica: no inflar artificialmente el speedup con una base lenta.',
    ],
    featuresEn: [
      'Precomputation of don\'t-care indexes and block sizes per pattern.',
      'In parallel executions (np > 1) behavior is completely identical to isend.',
      'Methodological insight: never artificially inflate speedup using a slower baseline.',
    ],
    cppSnippet: `// feat/mpi-phase4-metacache-isend-calcopt
// Precomputar don't care antes del bucle de pares
auto dont_care_indices = precompute_dont_care(patterns[p]);
for (int i = 0; i < N; ++i) {
    for (int j = i + 1; j < N; ++j) {
        calc_matches_opt(species[i], species[j], dont_care_indices);
    }
}`,
  },
];

export const TFMBranchExplorer: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('isend');

  const selectedBranch = BRANCHES.find((b) => b.id === selectedBranchId) || BRANCHES[0];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {t('tfm.title')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('tfm.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <a
          href="https://github.com/ana-izaguirre/ProtSpaM"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shrink-0"
        >
          <GitBranch className="w-4 h-4" />
          <span>github.com/ana-izaguirre/ProtSpaM</span>
          <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
        </a>
      </div>

      {/* Branch Selection Pills Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {BRANCHES.map((b) => {
          const isSelected = b.id === selectedBranchId;
          const isRecommended = b.status === 'recommended';
          const isBaseline = b.status === 'baseline';

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBranchId(b.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                  {b.phase}
                </span>
                {isRecommended && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    {lang === 'es' ? '★ Recomendada' : '★ Recommended'}
                  </span>
                )}
                {isBaseline && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300">
                    {lang === 'es' ? 'Línea Base' : 'Baseline'}
                  </span>
                )}
              </div>

              <div>
                <div className="font-mono text-xs font-bold text-white truncate max-w-[280px]">
                  {b.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {lang === 'es' ? b.titleEs : b.titleEn}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="font-mono text-emerald-400/90 font-medium truncate max-w-[200px]">
                  {b.speedup.split('-')[0]}
                </span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed Branch View (Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Architectural Details & Benchmarks (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  {selectedBranch.phase}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {lang === 'es' ? selectedBranch.titleEs : selectedBranch.titleEn}
                </h3>
              </div>
              <a
                href={selectedBranch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors self-start sm:self-auto shrink-0"
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedBranch.name.replace('feat/', '')}</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>

            {/* Description & Scientific Justification */}
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
                  {lang === 'es' ? 'Descripción del Enfoque:' : 'Approach Description:'}
                </div>
                <p className="text-slate-300">
                  {lang === 'es' ? selectedBranch.descEs : selectedBranch.descEn}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('tfm.whyImportant')}:</span>
                </div>
                <p className="text-slate-300">
                  {lang === 'es' ? selectedBranch.whyEs : selectedBranch.whyEn}
                </p>
              </div>
            </div>

            {/* Key Technical Features Checklist */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                {t('tfm.keyDecisions')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(lang === 'es' ? selectedBranch.featuresEs : selectedBranch.featuresEn).map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: C++ Source Snippet & HPC Performance Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Performance Badge Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>{t('tfm.summaryBadge')}</span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs text-slate-400">
                {lang === 'es' ? 'Rendimiento en 300 Especies (FinisTerrae III):' : '300 Species Benchmark (FinisTerrae III):'}
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                {selectedBranch.speedup}
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80 flex items-center justify-between font-mono">
                <span>Exactitud IEEE-754:</span>
                <span className="text-emerald-400 font-bold">Δ = 0.000000000000</span>
              </div>
            </div>
          </div>

          {/* C++ Code Viewer Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>{t('tfm.cppCode')}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                C++11 / OpenMPI
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-300">
              <pre className="whitespace-pre">
                <code>{selectedBranch.cppSnippet}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
