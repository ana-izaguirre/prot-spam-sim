import React, { useState, useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  SPECIES_64_HOMOGENEOUS,
  SPECIES_300_UNBALANCED,
  calculateWorkload,
  ProcessWorkload,
} from '../data/speciesData';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import {
  Layers,
  AlertTriangle,
  Cpu,
  TrendingUp,
  Info,
  Play,
  Pause,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Zap,
  Terminal,
  Copy,
  Check,
  Trash2,
  Sliders,
  BarChart3,
  Server,
  Activity,
  CheckCircle2,
} from 'lucide-react';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface ExecutionLogEntry {
  id: string;
  time: string;
  level: 'info' | 'mpi' | 'warn' | 'success';
  phase: 'INIT' | 'DATA' | 'PART' | 'COMPUTE' | 'WARN' | 'DONE';
  message: string;
  detail?: string;
}

export const WorkloadSimulator: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();

  const [numProcesses, setNumProcesses] = useState<number>(8);
  const [datasetType, setDatasetType] = useState<'64' | '300'>('300');
  const [viewMetric, setViewMetric] = useState<'maa' | 'species' | 'comparisons'>('maa');
  const [algoType, setAlgoType] = useState<'algoritmo1_cyclic' | 'naive_block'>('algoritmo1_cyclic');

  // Automated Demo Mode state
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
  const [demoSpeed, setDemoSpeed] = useState<number>(2500); // ms per step

  // Execution Log states
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'mpi' | 'warn' | 'success'>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'done'>('done');

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const processOptions = [2, 4, 8, 16, 32, 64];

  const speciesList = datasetType === '64' ? SPECIES_64_HOMOGENEOUS : SPECIES_300_UNBALANCED;
  const workloads: ProcessWorkload[] = calculateWorkload(speciesList, numProcesses, algoType);

  // Stats calculations
  const totalMaa = workloads.reduce((acc, p) => acc + p.totalMaa, 0);
  const avgMaa = totalMaa / numProcesses;
  const maxMaa = Math.max(...workloads.map((p) => p.totalMaa));
  const minMaa = Math.min(...workloads.map((p) => p.totalMaa));
  const imbalanceFactor = avgMaa > 0 ? maxMaa / avgMaa : 1;
  const bottleneckRank = workloads.find((p) => p.hasHomoSapiens)?.rank ?? 0;

  const totalComparisons = workloads.reduce((acc, p) => acc + p.comparisonsCount, 0);
  const avgComparisons = totalComparisons / numProcesses;

  // Format current timestamp helper
  const getFormattedTime = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hrs}:${mins}:${secs}.${ms}`;
  };

  // Real-time status messages generation on parameter changes
  useEffect(() => {
    setExecutionStatus('running');

    const timestamp = getFormattedTime();
    const batchId = Math.random().toString(36).substring(2, 7);

    const initMsg: ExecutionLogEntry = {
      id: `${batchId}-1`,
      time: timestamp,
      level: 'info',
      phase: 'INIT',
      message:
        lang === 'es'
          ? `Inicializando P=${numProcesses} procesos MPI (MPI_COMM_WORLD)...`
          : `Initializing P=${numProcesses} MPI processes (MPI_COMM_WORLD)...`,
      detail:
        lang === 'es'
          ? `Configuración de hardware: ${numProcesses} ranks en clúster FinisTerrae III.`
          : `Hardware topology: ${numProcesses} ranks in FinisTerrae III cluster.`,
    };

    const datasetMsg: ExecutionLogEntry = {
      id: `${batchId}-2`,
      time: timestamp,
      level: 'mpi',
      phase: 'DATA',
      message:
        lang === 'es'
          ? `Cargando conjunto de ${datasetType === '300' ? '300 Especies (Heterogéneo)' : '64 Especies (Homogéneo)'} (${totalMaa.toFixed(1)} Maa)...`
          : `Loading dataset: ${datasetType === '300' ? '300 Species (Heterogeneous)' : '64 Species (Homogeneous)'} (${totalMaa.toFixed(1)} Maa)...`,
      detail:
        lang === 'es'
          ? `${speciesList.length} proteomas indexados en memoria compartida.`
          : `${speciesList.length} proteomes indexed in shared memory.`,
    };

    const partitionMsg: ExecutionLogEntry = {
      id: `${batchId}-3`,
      time: timestamp,
      level: 'mpi',
      phase: 'PART',
      message:
        lang === 'es'
          ? `Aplicando estrategia: ${algoType === 'algoritmo1_cyclic' ? 'Algoritmo 1 (Cíclico i % P)' : 'Partición por Bloques (i / B)'}...`
          : `Applying strategy: ${algoType === 'algoritmo1_cyclic' ? 'Algorithm 1 (Cyclic i % P)' : 'Block Distribution (i / B)'}...`,
      detail:
        lang === 'es'
          ? 'Mapeando filas de la mitad superior triangular (j > i).'
          : 'Mapping rows for upper triangular half-matrix (j > i).',
    };

    const computeMsg: ExecutionLogEntry = {
      id: `${batchId}-4`,
      time: timestamp,
      level: 'info',
      phase: 'COMPUTE',
      message:
        lang === 'es'
          ? `Calculando distribución de carga para ${totalComparisons.toLocaleString()} pares...`
          : `Calculating workload distribution for ${totalComparisons.toLocaleString()} pairs...`,
    };

    let diagnosticMsg: ExecutionLogEntry | null = null;
    if (datasetType === '300' && algoType === 'algoritmo1_cyclic') {
      diagnosticMsg = {
        id: `${batchId}-5`,
        time: timestamp,
        level: imbalanceFactor > 1.3 ? 'warn' : 'info',
        phase: 'WARN',
        message:
          lang === 'es'
            ? `Asimetría biológica detectada: Rank ${bottleneckRank} procesa Homo sapiens (69.58 Maa). Factor λ = ${imbalanceFactor.toFixed(2)}x`
            : `Biological asymmetry detected: Rank ${bottleneckRank} assigned Homo sapiens (69.58 Maa). Factor λ = ${imbalanceFactor.toFixed(2)}x`,
        detail:
          lang === 'es'
            ? `Rank ${bottleneckRank} procesa ${maxMaa.toFixed(1)} Maa vs media de ${avgMaa.toFixed(1)} Maa.`
            : `Rank ${bottleneckRank} handles ${maxMaa.toFixed(1)} Maa vs average of ${avgMaa.toFixed(1)} Maa.`,
      };
    } else if (algoType === 'naive_block') {
      diagnosticMsg = {
        id: `${batchId}-5`,
        time: timestamp,
        level: 'warn',
        phase: 'WARN',
        message:
          lang === 'es'
            ? `Desbalance geométrico severo en partición por bloques: Rank 0 acumula un exceso de comparaciones.`
            : `Severe geometric skew in block distribution: Rank 0 holds disproportionate comparison volume.`,
      };
    }

    const doneMsg: ExecutionLogEntry = {
      id: `${batchId}-6`,
      time: timestamp,
      level: 'success',
      phase: 'DONE',
      message:
        lang === 'es'
          ? `Distribución completada: ${totalComparisons.toLocaleString()} pares asignados entre ${numProcesses} ranks.`
          : `Distribution complete: ${totalComparisons.toLocaleString()} pairs mapped across ${numProcesses} ranks.`,
      detail:
        lang === 'es'
          ? `Carga lista para cálculo BLOSUM62 y reducción MPI_Reduce(MPI_SUM).`
          : `Workload ready for BLOSUM62 compute and MPI_Reduce(MPI_SUM).`,
    };

    // Staggered log insertion to simulate real-time workflow
    const newBatch = [initMsg, datasetMsg, partitionMsg, computeMsg];
    if (diagnosticMsg) newBatch.push(diagnosticMsg);
    newBatch.push(doneMsg);

    const timer = setTimeout(() => {
      setLogs((prev) => {
        const updated = [...prev, ...newBatch];
        return updated.slice(-80);
      });
      setExecutionStatus('done');
    }, 150);

    return () => clearTimeout(timer);
  }, [numProcesses, datasetType, algoType, viewMetric, lang]);

  // Auto-scroll execution log container
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    const logText = logs
      .map(
        (l) =>
          `[${l.time}] [${l.phase}] [${l.level.toUpperCase()}] ${l.message}${
            l.detail ? ` (${l.detail})` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(logText);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  // Clear logs handler
  const handleClearLogs = () => {
    const timestamp = getFormattedTime();
    setLogs([
      {
        id: Math.random().toString(36).substring(2, 7),
        time: timestamp,
        level: 'info',
        phase: 'INIT',
        message:
          lang === 'es'
            ? `Registro limpiado. Monitor en escucha en P=${numProcesses}...`
            : `Log cleared. Monitoring active on P=${numProcesses}...`,
      },
    ]);
  };

  // Filtered logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'all') return true;
    return l.level === logFilter;
  });

  // Automated Demo Mode timer
  useEffect(() => {
    let interval: any = null;
    if (isDemoActive) {
      interval = setInterval(() => {
        setNumProcesses((currentP) => {
          const currentIndex = processOptions.indexOf(currentP);
          const nextIndex = (currentIndex + 1) % processOptions.length;
          return processOptions[nextIndex];
        });
      }, demoSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDemoActive, demoSpeed, processOptions]);

  // Stage explanation lookup for scaling evolution
  const getDemoStageInfo = (p: number) => {
    if (lang === 'es') {
      switch (p) {
        case 2:
          return {
            title: 'P = 2 Procesos (Reparto Binario Masivo)',
            hw: '2 Cores (Mismo Socket)',
            desc: 'La mitad superior se divide en 2 grandes particiones. El desbalance es bajo porque cada proceso acumula cientos de especies promediando los tamaños, aunque la granularidad paralela es mínima.',
            status: 'Granularidad gruesa | Eficiencia ~99%',
          };
        case 4:
          return {
            title: 'P = 4 Procesos (Escalado Inicial)',
            hw: '4 Cores (Socket 0)',
            desc: 'La distribución cíclica (i % 4) balancea con precisión geométrica el número de pares (j > i). El proteoma humano (69.58 Maa) se asigna a Rank 0.',
            status: 'Buen balance preliminar | λ = 1.08x',
          };
        case 8:
          return {
            title: 'P = 8 Procesos (1 Socket Parcial)',
            hw: '8 Cores (Sub-NUMA Domain)',
            desc: 'El número de comparaciones sigue perfectamente equilibrado (~5,600 pares por rank), pero la disparidad biológica de Maa empieza a destacar en Rank 0.',
            status: 'Emergencia de asimetría biológica',
          };
        case 16:
          return {
            title: 'P = 16 Procesos (Escalado Intra-Nodo)',
            hw: '16 Cores (1 Socket Completo)',
            desc: 'Aparece una brecha evidente: Rank 0 procesa ~78 Maa mientras los demás promedian ~24 Maa. Los ranks 1-15 terminarán antes y esperarán en la barrera.',
            status: 'Desbalance notable | λ = 1.45x',
          };
        case 32:
          return {
            title: 'P = 32 Procesos (Multi-Socket)',
            hw: '32 Cores (2 Sockets FinisTerrae III)',
            desc: 'La mayoría de los ranks solo procesan entre 10 y 14 Maa, mientras Rank 0 asume más de 72 Maa. El factor de desbalance se dispara a más de 2.2x.',
            status: 'Cuello de botella crítico en Rank 0',
          };
        case 64:
          return {
            title: 'P = 64 Procesos (Nodo Completo FinisTerrae III)',
            hw: '64 Cores (2x Intel Xeon Platinum 8352Y)',
            desc: 'Escala máxima de 1 nodo. Mientras la partición cíclica asigna ~700 pares uniformes a cada proceso, el 70% del tiempo de cómputo en Rank 0 está dominado exclusivamente por Homo sapiens.',
            status: 'Límite de escalabilidad por heterogeneidad | λ > 3.0x',
          };
        default:
          return {
            title: `P = ${p} Procesos`,
            hw: `${p} Cores MPI`,
            desc: 'Evolución de la partición de carga.',
            status: 'Análisis de balanceo',
          };
      }
    } else {
      switch (p) {
        case 2:
          return {
            title: 'P = 2 Processes (Massive Binary Split)',
            hw: '2 Cores (Same Socket)',
            desc: 'The upper half-matrix is partitioned into 2 massive chunks. Load imbalance is minimal because high species counts average out sizes, but parallel granularity is coarse.',
            status: 'Coarse granularity | Efficiency ~99%',
          };
        case 4:
          return {
            title: 'P = 4 Processes (Initial Scaling)',
            hw: '4 Cores (Socket 0)',
            desc: 'Cyclic distribution (i % 4) balances pair counts (j > i) with geometric precision. The human proteome (69.58 Maa) lands on Rank 0.',
            status: 'Good baseline balance | λ = 1.08x',
          };
        case 8:
          return {
            title: 'P = 8 Processes (Partial Socket)',
            hw: '8 Cores (Sub-NUMA Domain)',
            desc: 'Pair counts remain uniformly distributed (~5,600 pairs per rank), but the biological Maa disparity begins to stand out on Rank 0.',
            status: 'Emergence of biological asymmetry',
          };
        case 16:
          return {
            title: 'P = 16 Processes (Intra-Node Scaling)',
            hw: '16 Cores (1 Full Socket)',
            desc: 'A noticeable gap appears: Rank 0 processes ~78 Maa while others average ~24 Maa. Ranks 1-15 finish early and idle at the reduction barrier.',
            status: 'Significant imbalance | λ = 1.45x',
          };
        case 32:
          return {
            title: 'P = 32 Processes (Dual-Socket)',
            hw: '32 Cores (2 Sockets FinisTerrae III)',
            desc: 'Most ranks only handle 10-14 Maa, while Rank 0 holds over 72 Maa. The load imbalance ratio spikes above 2.2x.',
            status: 'Critical bottleneck on Rank 0',
          };
        case 64:
          return {
            title: 'P = 64 Processes (Full 1-Node FinisTerrae III)',
            hw: '64 Cores (2x Intel Xeon Platinum 8352Y)',
            desc: 'Full single-node scale. While cyclic partitioning assigns ~700 uniform pairs to every rank, 70% of Rank 0 compute time is dictated exclusively by Homo sapiens.',
            status: 'Scalability limit due to genomic heterogeneity | λ > 3.0x',
          };
        default:
          return {
            title: `P = ${p} Processes`,
            hw: `${p} MPI Cores`,
            desc: 'Workload partitioning evolution.',
            status: 'Load balance analysis',
          };
      }
    }
  };

  const stageInfo = getDemoStageInfo(numProcesses);

  // Smooth Chart.js creation & updates
  useEffect(() => {
    if (!chartCanvasRef.current) return;

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = workloads.map((p) => `R${p.rank}`);
    const dataValues = workloads.map((p) => {
      if (viewMetric === 'maa') return parseFloat(p.totalMaa.toFixed(2));
      if (viewMetric === 'comparisons') return p.comparisonsCount;
      return p.speciesCount;
    });

    const backgroundColors = workloads.map((p) => {
      if (p.hasHomoSapiens && datasetType === '300' && viewMetric === 'maa') {
        return '#f97316'; // Orange accent for bottleneck
      }
      return '#10b981'; // Emerald primary accent
    });

    const borderColors = workloads.map((p) => {
      if (p.hasHomoSapiens && datasetType === '300' && viewMetric === 'maa') {
        return '#fb923c';
      }
      return '#34d399';
    });

    const metricLabel =
      viewMetric === 'maa'
        ? lang === 'es'
          ? 'Carga en Maa (Millones de Aminoácidos)'
          : 'Workload in Maa (Million Amino Acids)'
        : viewMetric === 'comparisons'
        ? lang === 'es'
          ? 'Pares Asignados (j > i)'
          : 'Assigned Pairs (j > i)'
        : lang === 'es'
        ? 'Especies Asignadas'
        : 'Assigned Species';

    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].label = metricLabel;
      chartInstanceRef.current.data.datasets[0].data = dataValues;
      chartInstanceRef.current.data.datasets[0].backgroundColor = backgroundColors;
      chartInstanceRef.current.data.datasets[0].borderColor = borderColors;

      if (chartInstanceRef.current.options.scales?.x?.ticks) {
        chartInstanceRef.current.options.scales.x.ticks.font = {
          family: 'JetBrains Mono',
          size: numProcesses > 32 ? 9 : numProcesses > 16 ? 10 : 11,
        };
        chartInstanceRef.current.options.scales.x.ticks.maxRotation = numProcesses > 16 ? 90 : 0;
      }
      if (chartInstanceRef.current.options.scales?.y?.title) {
        chartInstanceRef.current.options.scales.y.title.text =
          viewMetric === 'maa'
            ? 'Millones de Aminoácidos (Maa)'
            : viewMetric === 'comparisons'
            ? 'Comparaciones (j > i)'
            : 'Nº Especies';
      }

      chartInstanceRef.current.update();
      return;
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: metricLabel,
            data: dataValues,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#10b981',
            bodyColor: '#e2e8f0',
            padding: 10,
            callbacks: {
              label: (context) => {
                const rankIdx = context.dataIndex;
                const p = workloads[rankIdx];
                if (!p) return '';
                const lines = [
                  `Valor: ${context.parsed.y} ${viewMetric === 'maa' ? 'Maa' : ''}`,
                  `Especies: ${p.speciesCount}`,
                  `Comparaciones (j > i): ${p.comparisonsCount.toLocaleString()}`,
                  `Total Maa: ${p.totalMaa.toFixed(2)} Maa`,
                ];
                if (p.hasHomoSapiens && datasetType === '300') {
                  lines.push('⚠️ Contiene Homo sapiens (69.58 Maa) - CUELLO DE BOTELLA');
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: numProcesses > 32 ? 9 : 11 },
              maxRotation: numProcesses > 16 ? 90 : 0,
            },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 11 },
            },
            title: {
              display: true,
              text:
                viewMetric === 'maa'
                  ? 'Millones de Aminoácidos (Maa)'
                  : viewMetric === 'comparisons'
                  ? 'Comparaciones (j > i)'
                  : 'Nº Especies',
              color: '#94a3b8',
              font: { size: 11 },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [numProcesses, datasetType, viewMetric, algoType, lang]);

  const handlePrevP = () => {
    const currIdx = processOptions.indexOf(numProcesses);
    if (currIdx > 0) {
      setNumProcesses(processOptions[currIdx - 1]);
    }
  };

  const handleNextP = () => {
    const currIdx = processOptions.indexOf(numProcesses);
    if (currIdx < processOptions.length - 1) {
      setNumProcesses(processOptions[currIdx + 1]);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full">
      {/* ========================================================================= */}
      {/* BENTO CARD 1: Automated Demo Mode & Scalability Evolution Orchestrator    */}
      {/* ========================================================================= */}
      <section
        aria-label="Automated Demo Orchestrator"
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          isDemoActive
            ? 'bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-slate-950 border-emerald-500/50 shadow-xl shadow-emerald-950/20'
            : 'bg-slate-900/60 border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDemoActive(!isDemoActive)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 min-h-[42px] ${
                isDemoActive
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 ring-2 ring-emerald-400/30 ring-offset-2 ring-offset-slate-950'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              {isDemoActive ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('workload.demoRunning')}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="whitespace-nowrap">{t('workload.demoMode')}</span>
                </>
              )}
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('workload.demoMode')} (P = 2 &rarr; 64)
                </span>
                {isDemoActive && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    AUTOPLAY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('workload.demoExplanation')}</p>
            </div>
          </div>

          {/* Stepper, Pills & Speed controls */}
          <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
            {/* Step Prev/Next */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={handlePrevP}
                disabled={numProcesses === processOptions[0]}
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title={lang === 'es' ? 'Paso Anterior' : 'Previous Step'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextP}
                disabled={numProcesses === processOptions[processOptions.length - 1]}
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title={lang === 'es' ? 'Paso Siguiente' : 'Next Step'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Stage Pills */}
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800/80 p-1 rounded-xl flex-wrap">
              {processOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setNumProcesses(opt)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all whitespace-nowrap ${
                    numProcesses === opt
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  P={opt}
                </button>
              ))}
            </div>

            {/* Demo Speed Controls */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs font-mono text-slate-400">
              <span className="text-[10px] uppercase text-slate-500 px-1 font-semibold whitespace-nowrap">
                {t('workload.demoSpeed')}:
              </span>
              {[1500, 2500, 4000].map((spd, idx) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setDemoSpeed(spd)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    demoSpeed === spd
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold'
                      : 'hover:text-slate-200'
                  }`}
                >
                  {idx === 0 ? '1.5s' : idx === 1 ? '2.5s' : '4.0s'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Stage Context Card */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                {stageInfo.title}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0 w-fit">
                {stageInfo.hw}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] pt-1">{stageInfo.desc}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="text-[10px] uppercase font-semibold text-slate-500">
              {lang === 'es' ? 'Diagnóstico de Balance' : 'Balance Diagnostic'}
            </div>
            <div className="text-xs font-mono font-bold text-white mt-1">{stageInfo.status}</div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between border-t border-slate-800/60 pt-1.5">
              <span>Ratio &lambda;:</span>
              <strong
                className={
                  imbalanceFactor > 1.4
                    ? 'text-orange-400 font-mono'
                    : 'text-emerald-400 font-mono'
                }
              >
                {imbalanceFactor.toFixed(2)}x
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* BENTO GRID: Controls Cockpit (Stacked on Mobile, 4-Cols on Desktop)       */}
      {/* & Main Workload Chart (Stacked on Mobile, 8-Cols on Desktop)              */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* ----------------------------------------------------------------------- */}
        {/* BENTO CARD 2: Control & Parameter Cockpit (Full width on mobile, col-4) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {t('workload.controlCockpit')}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                MPI_COMM
              </span>
            </div>

            {/* Slider & Rank selector */}
            <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  {t('workload.mpiProcesses')}
                </span>
                <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {numProcesses} ranks
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={processOptions.length - 1}
                step={1}
                value={processOptions.indexOf(numProcesses)}
                onChange={(e) => setNumProcesses(processOptions[parseInt(e.target.value)])}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 my-1"
                aria-label={t('workload.mpiProcesses')}
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                {processOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNumProcesses(opt)}
                    className={`px-1 py-0.5 rounded hover:text-emerald-400 transition-colors ${
                      numProcesses === opt ? 'text-emerald-400 font-bold' : ''
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Dataset Selector */}
            <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('workload.dataset')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDatasetType('64')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    datasetType === '64'
                      ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{lang === 'es' ? '64 Especies' : '64 Species'}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">
                    {lang === 'es' ? '(Homogéneo)' : '(Homogeneous)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDatasetType('300')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    datasetType === '300'
                      ? 'bg-orange-600/20 border-orange-500/80 text-orange-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{lang === 'es' ? '300 Especies' : '300 Species'}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">
                    {lang === 'es' ? '(Desbalanceado)' : '(Unbalanced)'}
                  </span>
                </button>
              </div>
            </div>

            {/* View Metric Selector */}
            <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('workload.metric')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViewMetric('maa')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    viewMetric === 'maa'
                      ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{lang === 'es' ? 'Carga (Maa)' : 'Workload (Maa)'}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">
                    {lang === 'es' ? 'Aminoácidos' : 'Amino Acids'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMetric('comparisons')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    viewMetric === 'comparisons'
                      ? 'bg-blue-600/20 border-blue-500/80 text-blue-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{lang === 'es' ? 'Pares (j > i)' : 'Pairs (j > i)'}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">
                    {lang === 'es' ? 'Media Matriz' : 'Half-Matrix'}
                  </span>
                </button>
              </div>
            </div>

            {/* Partitioning Algorithm Selector */}
            <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                {t('workload.partition')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAlgoType('algoritmo1_cyclic')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    algoType === 'algoritmo1_cyclic'
                      ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{t('workload.cyclic')}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">(i % P)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAlgoType('naive_block')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center min-h-[44px] ${
                    algoType === 'naive_block'
                      ? 'bg-rose-600/20 border-rose-500/80 text-rose-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className="whitespace-nowrap">{t('workload.block')}</span>
                  <span className="text-[10px] font-normal opacity-80 whitespace-nowrap">
                    {lang === 'es' ? '(Bloques)' : '(Blocks)'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets Footnote */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
            <span className="text-slate-500">{t('workload.presets')}:</span>
            <div className="flex items-center gap-1 font-mono">
              <button
                type="button"
                onClick={() => setNumProcesses(16)}
                className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                1-Sock(16)
              </button>
              <button
                type="button"
                onClick={() => setNumProcesses(32)}
                className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                2-Sock(32)
              </button>
              <button
                type="button"
                onClick={() => setNumProcesses(64)}
                className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                Node(64)
              </button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* BENTO CARD 3: Workload Chart (Full width on mobile, col-8 on desktop)   */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                {t('workload.chartTitle')}
              </h3>
              {datasetType === '300' && viewMetric === 'maa' && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                  Rank {bottleneckRank} (Homo sapiens)
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {algoType === 'algoritmo1_cyclic'
                ? lang === 'es'
                  ? 'Cíclico (i % P)'
                  : 'Cyclic (i % P)'
                : lang === 'es'
                ? 'Bloques (i / B)'
                : 'Blocks (i / B)'}
            </div>
          </div>

          {/* Chart.js Canvas with robust mobile height */}
          <div className="h-[290px] sm:h-[340px] md:h-[380px] lg:h-[400px] w-full relative">
            <canvas ref={chartCanvasRef} />
          </div>

          {/* Chart Context Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
              <span>{lang === 'es' ? 'Carga balanceada' : 'Balanced load'}</span>
              {datasetType === '300' && (
                <>
                  <span className="w-2.5 h-2.5 rounded bg-orange-500 inline-block ml-2" />
                  <span className="text-orange-400 font-semibold">{lang === 'es' ? 'Homo sapiens (69.58 Maa)' : 'Homo sapiens (69.58 Maa)'}</span>
                </>
              )}
            </div>
            <div className="font-mono text-slate-500 text-[10px]">
              FINISTERRAE III &bull; {numProcesses} MPI RANKS
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BENTO CARDS 4-7: Real-Time Diagnostic KPIs                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Imbalance */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{t('workload.kpiImbalance')}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1.5">
            {imbalanceFactor.toFixed(2)}x
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {imbalanceFactor > 1.3 ? (
              <span className="text-orange-400 font-medium">
                {lang === 'es'
                  ? `⚠️ Alto (${((imbalanceFactor - 1) * 100).toFixed(0)}% sobre media)`
                  : `⚠️ High (${((imbalanceFactor - 1) * 100).toFixed(0)}% over mean)`}
              </span>
            ) : (
              <span className="text-emerald-400 font-medium">
                {lang === 'es' ? '✔ Carga bien balanceada' : '✔ Well balanced load'}
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Bottleneck */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="truncate">{t('workload.kpiBottleneck')}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-orange-400 mt-1.5">
            Rank {bottleneckRank}
          </div>
          <div
            className="text-[11px] text-slate-500 mt-1 truncate"
            title="Homo sapiens (69.58 Maa)"
          >
            {datasetType === '300'
              ? 'Homo sapiens (69.58 Maa)'
              : lang === 'es'
              ? 'Especie máx (~16 Maa)'
              : 'Max species (~16 Maa)'}
          </div>
        </div>

        {/* KPI 3: Max vs Min */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">{t('workload.kpiMaxMin')}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1.5">
            {maxMaa.toFixed(1)} / {minMaa.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">Maa</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {lang === 'es' ? 'Media teórica: ' : 'Mean: '}
            <span className="font-mono text-blue-400">{avgMaa.toFixed(1)} Maa</span>
          </div>
        </div>

        {/* KPI 4: Triangular Pairs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">{t('workload.kpiPairs')}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1.5">
            {totalComparisons.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {lang === 'es' ? 'Media por rank: ' : 'Avg per rank: '}
            <span className="font-mono">{Math.round(avgComparisons).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BENTO CARDS 8 & 9: Real-Time Execution Log & Algorithm 1 Principle Card   */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        {/* ----------------------------------------------------------------------- */}
        {/* BENTO CARD 8: Real-Time MPI Execution Log (col-7 on desktop)            */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-7 xl:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
          {/* Terminal Header Bar */}
          <div className="bg-slate-900/90 border-b border-slate-800/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Window Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/50" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/50" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/50" />
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  {t('workload.executionLog')}
                </span>
              </div>

              {/* Execution Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
                  executionStatus === 'running'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    executionStatus === 'running' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                {executionStatus === 'running'
                  ? t('workload.logStatusRunning')
                  : t('workload.logStatusDone')}
              </span>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setLogFilter('all')}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === 'all'
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('workload.logFilterAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('info')}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === 'info'
                      ? 'bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  INFO
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('mpi')}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === 'mpi'
                      ? 'bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  MPI
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('warn')}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === 'warn'
                      ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  WARN
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter('success')}
                  className={`px-2 py-1 rounded transition-colors ${
                    logFilter === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  DONE
                </button>
              </div>

              {/* Auto-scroll toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                  autoScroll
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
                title={t('workload.autoScroll')}
              >
                {autoScroll ? '⚡ Scroll: ON' : 'Scroll: OFF'}
              </button>

              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyLogs}
                className="p-1.5 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-mono"
                title={t('workload.copyLog')}
              >
                {copiedToast ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">{t('workload.logCopied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{t('workload.copyLog')}</span>
                  </>
                )}
              </button>

              {/* Clear button */}
              <button
                type="button"
                onClick={handleClearLogs}
                className="p-1.5 bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 rounded-lg transition-colors"
                title={t('workload.clearLog')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal Body & Stream of Logs */}
          <div
            ref={logContainerRef}
            className="p-4 max-h-56 min-h-[160px] overflow-y-auto font-mono text-xs space-y-1.5 bg-slate-950 text-slate-300 select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-6">
                {lang === 'es'
                  ? 'No hay registros para el filtro seleccionado.'
                  : 'No logs found for the selected filter.'}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isWarn = log.level === 'warn';
                const isSuccess = log.level === 'success';
                const isMpi = log.level === 'mpi';

                return (
                  <div
                    key={log.id}
                    className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2.5 py-1 leading-relaxed transition-colors rounded px-1.5 ${
                      isWarn
                        ? 'bg-orange-500/10 border-l-2 border-orange-500 text-orange-200'
                        : isSuccess
                        ? 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-200'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 text-[11px] shrink-0 font-mono">{log.time}</span>

                    {/* Phase Badge */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 w-fit ${
                        log.phase === 'INIT'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : log.phase === 'DATA'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : log.phase === 'PART'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : log.phase === 'COMPUTE'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : log.phase === 'WARN'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      [{log.phase}]
                    </span>

                    {/* Log Text & Details */}
                    <div className="flex-1">
                      <span
                        className={`${
                          isWarn
                            ? 'text-orange-300 font-semibold'
                            : isSuccess
                            ? 'text-emerald-300 font-semibold'
                            : isMpi
                            ? 'text-purple-300'
                            : 'text-slate-200'
                        }`}
                      >
                        {log.message}
                      </span>
                      {log.detail && (
                        <div className="text-[11px] text-slate-500 mt-0.5 italic">
                          &rarr; {log.detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Terminal Footer Status Bar */}
          <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono gap-2">
            <div className="flex items-center gap-3">
              <span>COMM: <strong className="text-slate-400">MPI_COMM_WORLD</strong></span>
              <span>RANKS: <strong className="text-emerald-400">P={numProcesses}</strong></span>
              <span>DATASET: <strong className="text-slate-400">{datasetType} species</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <span>PAIRS: <strong className="text-blue-400">{totalComparisons.toLocaleString()}</strong></span>
              <span>ENTRIES: <strong className="text-slate-400">{filteredLogs.length}</strong></span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* BENTO CARD 9: Algorithmic & Mathematical Insight (col-5 on desktop)     */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-5 xl:col-span-4 bg-slate-900/50 border border-slate-800 border-l-4 border-l-emerald-500 p-4 sm:p-5 rounded-2xl text-xs text-slate-300 leading-relaxed flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'es'
                  ? 'Principio del Algoritmo 1 en ProtSpam'
                  : 'Algorithm 1 Principle in ProtSpam'}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed text-[11px]">
              {lang === 'es' ? (
                <>
                  Al calcular la mitad superior de la matriz de distancias filogenómicas (
                  <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    j &gt; i
                  </code>
                  ), la fila 0 requiere{' '}
                  <span className="font-mono text-emerald-300">N - 1</span> comparaciones mientras la
                  fila N-2 solo requiere <span className="font-mono text-emerald-300">1</span>. Una
                  partición por bloques contiguos colapsaría el balance (Rank 0 asumiría hasta el 50%
                  de las comparaciones).
                </>
              ) : (
                <>
                  When computing the upper half of the phylogenomic distance matrix (
                  <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    j &gt; i
                  </code>
                  ), row 0 requires <span className="font-mono text-emerald-300">N - 1</span> pairwise
                  comparisons while row N-2 requires only{' '}
                  <span className="font-mono text-emerald-300">1</span>. Contiguous block partitioning
                  collapses load balance (Rank 0 would handle up to 50% of the workload).
                </>
              )}
            </p>

            <p className="text-slate-300 leading-relaxed text-[11px]">
              {lang === 'es' ? (
                <>
                  El <strong>Algoritmo 1</strong> distribuye las filas cíclicamente (
                  <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    Rank = i mod P
                  </code>
                  ). Sin embargo, en el conjunto de 300 especies, la disparidad biológica del
                  proteoma humano (<strong className="text-orange-400">69.58 Maa</strong> frente a ~1.5
                  Maa de bacterias) impone una barrera de espera en{' '}
                  <code className="text-purple-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    MPI_Reduce
                  </code>
                  .
                </>
              ) : (
                <>
                  <strong>Algorithm 1</strong> distributes rows cyclically (
                  <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    Rank = i mod P
                  </code>
                  ). However, in the 300 species dataset, the biological asymmetry of the human
                  proteome (<strong className="text-orange-400">69.58 Maa</strong> vs ~1.5 Maa in
                  bacteria) imposes an inevitable barrier wait at{' '}
                  <code className="text-purple-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    MPI_Reduce
                  </code>
                  .
                </>
              )}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>COMPLEXITY: O(N²/2P)</span>
            <span className="text-emerald-400">AMDAHL BOTTLENECK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
