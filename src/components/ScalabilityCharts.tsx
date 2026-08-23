import React, { useState, useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  LogarithmicScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { SCALABILITY_DATA } from '../data/speciesData';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  LogarithmicScale,
  Tooltip,
  Legend,
);

type ActiveTab = 'phase3_speedup' | 'phase4_speedup' | 'total_time';
type DatasetChoice = 'unbalanced' | 'balanced';

export const ScalabilityCharts: React.FC = () => {
  const { lang, t, theme } = useAppLanguageTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('phase4_speedup');
  const [datasetChoice, setDatasetChoice] = useState<DatasetChoice>('unbalanced');
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Chart.js paints to a canvas, so it cannot inherit the CSS theme: the text
  // colours have to be handed to it explicitly.
  const isLight = theme === 'light';
  const chartInk = {
    legend: isLight ? '#1e293b' : '#e2e8f0',
    axis: isLight ? '#475569' : '#64748b',
    axisTitle: isLight ? '#334155' : '#94a3b8',
    tooltipBg: isLight ? '#ffffff' : '#0f172a',
    tooltipBorder: isLight ? '#cbd5e1' : '#334155',
    tooltipTitle: isLight ? '#047857' : '#10b981',
    tooltipBody: isLight ? '#1e293b' : '#e2e8f0',
  };

  const processes = SCALABILITY_DATA.processes;
  const currentData = SCALABILITY_DATA[datasetChoice];

  useEffect(() => {
    if (!chartCanvasRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = processes.map((p) => `${p} P`);

    let datasets: any[];
    let yAxisTitle: string;

    if (activeTab === 'phase3_speedup') {
      yAxisTitle =
        lang === 'es' ? 'Aceleración Fase 3 (Sp = T1 / Tp)' : 'Phase 3 Speedup (Sp = T1 / Tp)';
      datasets = [
        {
          label:
            lang === 'es' ? 'Aceleración Ideal (Lineal Sp = P)' : 'Ideal Speedup (Linear Sp = P)',
          data: currentData.phase3.speedup_ideal,
          borderColor: '#87929a',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: '#87929a',
          tension: 0.1,
        },
        {
          label: lang === 'es' ? 'Fase 3: Spaced Words Real' : 'Phase 3: Real Spaced Words',
          data: currentData.phase3.speedup_real,
          borderColor: '#38bdf8',
          backgroundColor: '#38bdf8',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2,
        },
      ];
    } else if (activeTab === 'phase4_speedup') {
      yAxisTitle =
        lang === 'es' ? 'Aceleración Fase 4 (Sp = T1 / Tp)' : 'Phase 4 Speedup (Sp = T1 / Tp)';
      datasets = [
        {
          label: lang === 'es' ? 'Aceleración Ideal (Sp = P)' : 'Ideal Speedup (Sp = P)',
          data: [1, 2, 4, 8, 16, 32, 64, 128, 256],
          borderColor: '#64748b',
          borderDash: [6, 6],
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: '#64748b',
        },
        {
          label: lang === 'es' ? 'Fase 4: isend (No Bloqueante)' : 'Phase 4: isend (Non-Blocking)',
          data: currentData.phase4_isend.speedup,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2,
        },
        {
          label: lang === 'es' ? 'Fase 4: metacache (Bloqueante)' : 'Phase 4: metacache (Blocking)',
          data: currentData.phase4_metacache.speedup,
          borderColor: '#f43f5e',
          backgroundColor: '#f43f5e',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2,
        },
      ];
    } else {
      yAxisTitle =
        lang === 'es' ? 'Tiempo de Ejecución Total (Segundos)' : 'Total Execution Time (Seconds)';
      datasets = [
        {
          label: lang === 'es' ? 'Tiempo Total con isend' : 'Total Time with isend',
          data: currentData.total_isend.time_sec,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2,
        },
        {
          label: lang === 'es' ? 'Tiempo Total con metacache' : 'Total Time with metacache',
          data: currentData.total_metacache.time_sec,
          borderColor: '#f43f5e',
          backgroundColor: '#f43f5e',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2,
        },
      ];
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: chartInk.legend,
              font: { family: 'Inter', size: 11, weight: 500 },
              boxWidth: 14,
              boxHeight: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: chartInk.tooltipBg,
            borderColor: chartInk.tooltipBorder,
            borderWidth: 1,
            titleColor: chartInk.tooltipTitle,
            bodyColor: chartInk.tooltipBody,
            padding: 10,
            callbacks: {
              afterBody: (tooltipItems) => {
                const pIdx = tooltipItems[0].dataIndex;
                const p = processes[pIdx];

                if (p === 128 && activeTab === 'phase4_speedup') {
                  return lang === 'es'
                    ? '\n⚠️ Colapso metacache (128P): Contención en MPI_Send serializado.'
                    : '\n⚠️ metacache stall (128P): Contention in serialized MPI_Send.';
                }
                if (p === 256 && activeTab === 'phase4_speedup') {
                  return lang === 'es'
                    ? '\n🚀 Límite isend (256P): Saturación de ancho de banda y latencia de red.'
                    : '\n🚀 isend scaling threshold (256P): Network bandwidth and latency boundary.';
                }
                if (p === 128 && activeTab === 'total_time') {
                  return lang === 'es'
                    ? '\n⚠️ En 128P metacache tarda 32s vs 10.3s de isend (3.1x más rápido).'
                    : '\n⚠️ At 128P metacache takes 32s vs 10.3s for isend (3.1x faster).';
                }
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: {
              color: chartInk.axis,
              font: { family: 'JetBrains Mono', size: 11 },
            },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: {
              color: chartInk.axis,
              font: { family: 'JetBrains Mono', size: 11 },
            },
            title: {
              display: true,
              text: yAxisTitle,
              color: chartInk.axisTitle,
              font: { size: 11 },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [activeTab, datasetChoice, currentData, processes, lang, theme]);

  return (
    <div className="space-y-4">
      {/* Control Header & Tabs */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Metric Tabs */}
        <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 flex-wrap sm:flex-nowrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('phase3_speedup')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors text-center ${
              activeTab === 'phase3_speedup'
                ? 'bg-blue-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('scall.phase3Tab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phase4_speedup')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors text-center ${
              activeTab === 'phase4_speedup'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('scall.phase4Tab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('total_time')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors text-center ${
              activeTab === 'total_time'
                ? 'bg-purple-500 text-slate-50 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('scall.totalTimeTab')}
          </button>
        </div>

        {/* Dataset Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDatasetChoice('unbalanced')}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                datasetChoice === 'unbalanced'
                  ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang === 'es' ? '300 Desbalanceado (H. sapiens)' : '300 Heterogeneous (H. sapiens)'}
            </button>
            <button
              type="button"
              onClick={() => setDatasetChoice('balanced')}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                datasetChoice === 'balanced'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang === 'es' ? '300 Balanceado' : '300 Balanced'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-50">
            {lang === 'es'
              ? 'Curvas de Escalabilidad Fuerte (Strong Scaling, N=300 Especies)'
              : 'Strong Scaling Curves (N=300 Species)'}
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {datasetChoice === 'unbalanced'
              ? lang === 'es'
                ? 'Con heterogeneidad en tamaño de proteomas'
                : 'With real heterogeneous proteome distribution'
              : lang === 'es'
                ? 'Proteomas sintéticos uniformes'
                : 'Uniform synthetic proteomes'}
          </span>
        </div>

        {/* Chart Canvas */}
        <div className="h-[320px] w-full">
          <canvas ref={chartCanvasRef} />
        </div>
      </div>

      {/* HPC Critical Insights Cards (Annotated Points) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Point 1: 128 Cores Metacache Collapse */}
        <div className="bg-slate-900/50 border border-slate-800 border-l-4 border-l-rose-500 p-4 rounded-2xl space-y-1.5 text-xs">
          <div className="font-bold text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {lang === 'es'
              ? 'Caída en 128 Procesos (metacache)'
              : 'Drop at 128 Processes (metacache)'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {lang === 'es'
              ? 'A 128 ranks, el Speedup de metacache cae drásticamente de 21.2x a 18.5x (y a 11.2x en 256P). La serialización de MPI_Send y los bloqueos síncronos hacen que los procesos pasen más tiempo esperando que computando.'
              : 'At 128 ranks, metacache speedup drops sharply from 21.2x to 18.5x (and 11.2x at 256P). MPI_Send serialization causes cores to spend more time waiting than computing.'}
          </p>
        </div>

        {/* Point 2: 256 Cores isend Scaling Limit */}
        <div className="bg-slate-900/50 border border-slate-800 border-l-4 border-l-emerald-500 p-4 rounded-2xl space-y-1.5 text-xs">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {lang === 'es'
              ? 'Límite en 256 Procesos (isend)'
              : 'Threshold at 256 Processes (isend)'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {lang === 'es'
              ? 'isend alcanza un Speedup de 122.4x en 256 procesos (tiempo reducido a 7.74s). El límite de escalabilidad aquí se debe a la sobrecarga de red y la fracción secuencial de E/S según la Ley de Amdahl.'
              : "isend achieves 122.4x Speedup at 256 processes (time down to 7.74s). The scaling ceiling stems from network latency and Amdahl's sequential disk I/O."}
          </p>
        </div>

        {/* Point 3: Phase 3 Near-Ideal */}
        <div className="bg-slate-900/50 border border-slate-800 border-l-4 border-l-blue-500 p-4 rounded-2xl space-y-1.5 text-xs">
          <div className="font-bold text-blue-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {lang === 'es'
              ? 'Fase 3: Alta Eficiencia Paralela'
              : 'Phase 3: High Parallel Efficiency'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {lang === 'es'
              ? 'La indexación de palabras espaciadas (spacedwords + std::sort) es inherentemente independiente entre secuencias, logrando una eficiencia del >90% hasta 64 cores sin contención.'
              : 'Spaced words indexing (spacedwords + std::sort) is embarrassingly parallel across sequences, sustaining >90% parallel efficiency up to 64 cores.'}
          </p>
        </div>
      </div>

      {/* Scalability Detailed Data Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-50 mb-3 flex items-center justify-between">
          <span>
            {lang === 'es'
              ? 'Tabla Comparativa de Eficiencia Paralela (N=300 Especies)'
              : 'Parallel Efficiency Benchmark Table (N=300 Species)'}
          </span>
          <span className="text-[11px] text-slate-500 font-normal font-mono">Ep = Sp / P</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs text-center">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border border-slate-800">
                <th className="p-2.5 text-left">
                  {lang === 'es' ? 'Procesos (P)' : 'Processes (P)'}
                </th>
                <th className="p-2.5">{lang === 'es' ? 'T. Fase 3 (s)' : 'Phase 3 Time (s)'}</th>
                <th className="p-2.5 text-rose-400">
                  {lang === 'es' ? 'T. Metacache (s)' : 'Metacache Time (s)'}
                </th>
                <th className="p-2.5 text-emerald-400">
                  {lang === 'es' ? 'T. Isend (s)' : 'Isend Time (s)'}
                </th>
                <th className="p-2.5">
                  {lang === 'es' ? 'Speedup Isend (Sp)' : 'Isend Speedup (Sp)'}
                </th>
                <th className="p-2.5">
                  {lang === 'es' ? 'Eficiencia Isend (Ep)' : 'Isend Efficiency (Ep)'}
                </th>
                <th className="p-2.5 text-orange-400">
                  {lang === 'es' ? 'Ganancia Isend/Meta' : 'Isend/Meta Gain'}
                </th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p, idx) => {
                const tP3 = currentData.phase3.time_sec[idx];
                const tMeta = currentData.total_metacache.time_sec[idx];
                const tIsend = currentData.total_isend.time_sec[idx];
                const spIsend = (currentData.total_isend.time_sec[0] / tIsend).toFixed(2);
                const epIsend = ((parseFloat(spIsend) / p) * 100).toFixed(1);
                const gain = (tMeta / tIsend).toFixed(2);

                return (
                  <tr
                    key={p}
                    className="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-2.5 text-left font-bold text-blue-400">{p} P</td>
                    <td className="p-2.5 text-slate-200">{tP3.toFixed(2)}s</td>
                    <td className="p-2.5 text-rose-400">{tMeta.toFixed(2)}s</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">{tIsend.toFixed(2)}s</td>
                    <td className="p-2.5 text-slate-50 font-bold">{spIsend}x</td>
                    <td className="p-2.5 text-slate-200">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          parseFloat(epIsend) >= 70
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : parseFloat(epIsend) >= 40
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {epIsend}%
                      </span>
                    </td>
                    <td className="p-2.5 text-orange-400 font-bold">
                      {gain}x {lang === 'es' ? 'más rápido' : 'faster'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
