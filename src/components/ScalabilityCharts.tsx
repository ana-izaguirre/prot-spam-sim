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
import { THESIS_TABLES } from '../data/speciesData';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import { TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

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

/**
 * The measured results, plotted exactly as the thesis tabulates them.
 *
 * The three tabs are three *different experiments*, not three views of one
 * curve, and they are kept apart on purpose: the thesis' own rule is that
 * measurements taken under different conditions are never put on the same axis.
 *
 *  - Phase 3 reading (cuadro 6.2): 10/20/30 species, one node, np 1…32.
 *  - Controlled case (cuadro 6.3): 64 species, one node, np 1…64 — the only
 *    experiment with an np = 1 baseline of the MPI version itself, and so the
 *    only one whose numbers are a parallel speedup.
 *  - Main case (cuadro 6.4): 300 species, 32 processes per node, np 32…256,
 *    where isend does not complete at 256.
 *
 * Nothing is interpolated. A point the thesis did not measure is absent.
 */

type ActiveTab = 'phase3' | 'set64' | 'set300';
type ReadingSet = '10' | '20' | '30';
type DatasetChoice = 'balanced' | 'unbalanced';

export const ScalabilityCharts: React.FC = () => {
  const { lang, t, theme } = useAppLanguageTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('set64');
  const [readingSet, setReadingSet] = useState<ReadingSet>('30');
  const [datasetChoice, setDatasetChoice] = useState<DatasetChoice>('balanced');
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

  const es = lang === 'es';
  const t62 = THESIS_TABLES.phase3Reading;
  const t63 = THESIS_TABLES.phase4Set64;
  const t64 = THESIS_TABLES.set300;
  const set300 = t64[datasetChoice];

  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const line = (label: string, data: Array<number | null>, color: string, dashed = false) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: dashed ? 1.5 : 2.5,
      borderDash: dashed ? [6, 6] : undefined,
      pointRadius: dashed ? 3 : 5,
      pointHoverRadius: dashed ? 4 : 7,
      tension: 0.2,
      spanGaps: false,
    });

    let labels: string[];
    let datasets: ReturnType<typeof line>[];
    let yAxisTitle: string;

    if (activeTab === 'phase3') {
      labels = t62.processes.map((p) => `${p} P`);
      const set = t62.sets[readingSet];
      yAxisTitle = es ? 'Tiempo de la Fase 3 (s)' : 'Phase 3 time (s)';
      datasets = [
        line(es ? 'Opción A · centralizada' : 'Option A · centralised', [...set.A], '#10b981'),
        line(es ? 'Opción B · distribuida' : 'Option B · distributed', [...set.B], '#38bdf8'),
      ];
    } else if (activeTab === 'set64') {
      labels = t63.processes.map((p) => `${p} P`);
      yAxisTitle = es ? 'Aceleración (base np = 1)' : 'Speedup (np = 1 baseline)';
      datasets = [
        line(es ? 'Ideal (Sp = P)' : 'Ideal (Sp = P)', [...t63.processes], '#64748b', true),
        line('isend', [...t63.speedup.isend], '#10b981'),
        line('metacache', [...t63.speedup.metacache], '#f43f5e'),
      ];
    } else {
      labels = t64.processes.map((p, i) => `${p} P · ${t64.nodes[i]}n`);
      yAxisTitle = es ? 'Tiempo total (s)' : 'Total time (s)';
      datasets = [
        line('isend', [...set300.isend], '#10b981'),
        line('metacache', [...set300.metacache], '#f43f5e'),
      ];
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        interaction: { mode: 'index', intersect: false },
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
              // Annotations state only what the thesis states. Where it declines
              // to attribute a cause, so does the tooltip.
              afterBody: (items) => {
                const i = items[0].dataIndex;
                if (activeTab === 'set300' && t64.processes[i] === 256) {
                  return es
                    ? '\nisend no completa: MPI_ERR_INTERN en una recepción, reproducible en los dos conjuntos.'
                    : '\nisend does not complete: MPI_ERR_INTERN on a receive, reproducible on both sets.';
                }
                if (activeTab === 'set300' && t64.processes[i] === 128) {
                  return es
                    ? '\nmetacache es no monótona entre 32 y 128 P. El TFM lo reporta sin atribuirlo a un único factor.'
                    : '\nmetacache is non-monotonic between 32 and 128 P. The thesis reports it without attributing a single cause.';
                }
                if (activeTab === 'set64' && t63.processes[i] === 64) {
                  return es
                    ? '\nEficiencia de isend: 11 %. Coherente con las dos cotas estructurales, no una anomalía.'
                    : '\nisend efficiency: 11 %. Consistent with the two structural bounds, not an anomaly.';
                }
                if (activeTab === 'phase3' && t62.processes[i] === 1) {
                  return es
                    ? '\nnp = 1 no compara estrategias: ambas ejecutan la misma ruta y proceden de tandas independientes.'
                    : '\nnp = 1 is not a comparison: both run the same path and come from independent batches.';
                }
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: { color: chartInk.axis, font: { family: 'JetBrains Mono', size: 11 } },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: { color: chartInk.axis, font: { family: 'JetBrains Mono', size: 11 } },
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
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [
    activeTab,
    readingSet,
    datasetChoice,
    es,
    theme,
    chartInk.axis,
    chartInk.axisTitle,
    chartInk.legend,
    chartInk.tooltipBg,
    chartInk.tooltipBody,
    chartInk.tooltipBorder,
    chartInk.tooltipTitle,
    set300,
    t62,
    t63,
    t64,
  ]);

  const TAB_META: Record<ActiveTab, { label: string; source: string; tone: string }> = {
    phase3: {
      label: t('scall.phase3Tab'),
      source: 'Cuadro 6.2',
      tone: 'bg-blue-500 text-slate-950',
    },
    set64: {
      label: t('scall.set64Tab'),
      source: 'Cuadro 6.3',
      tone: 'bg-emerald-500 text-slate-950',
    },
    set300: {
      label: t('scall.set300Tab'),
      source: 'Cuadro 6.4',
      tone: 'bg-purple-500 text-slate-50',
    },
  };

  return (
    <div className="space-y-4">
      {/* Header, tabs and per-tab selector */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-50">{t('scall.title')}</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-4xl leading-relaxed">
            {t('scall.subtitle')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 flex-wrap sm:flex-nowrap gap-1">
            {(Object.keys(TAB_META) as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors text-center ${
                  activeTab === tab
                    ? `${TAB_META[tab].tone} shadow`
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {TAB_META[tab].label}
              </button>
            ))}
          </div>

          {activeTab === 'phase3' && (
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/90">
              {(['10', '20', '30'] as ReadingSet[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReadingSet(s)}
                  className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                    readingSet === s
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s} {es ? 'especies' : 'species'}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'set300' && (
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/90">
              <button
                type="button"
                onClick={() => setDatasetChoice('balanced')}
                className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                  datasetChoice === 'balanced'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {es ? '300 balanceado · ratio 14,6' : '300 balanced · ratio 14.6'}
              </button>
              <button
                type="button"
                onClick={() => setDatasetChoice('unbalanced')}
                className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                  datasetChoice === 'unbalanced'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {es ? '300 desbalanceado · ratio 205,4' : '300 unbalanced · ratio 205.4'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">{t('scall.provenance')}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-50">
            {activeTab === 'phase3'
              ? es
                ? `Fase 3 · lectura centralizada frente a distribuida · ${readingSet} especies`
                : `Phase 3 · centralised vs distributed reading · ${readingSet} species`
              : activeTab === 'set64'
                ? es
                  ? 'Fase 4 · caso controlado de 64 especies en un nodo'
                  : 'Phase 4 · controlled 64-species case on one node'
                : es
                  ? 'Fase 4 · 300 especies, 32 procesos por nodo'
                  : 'Phase 4 · 300 species, 32 processes per node'}
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            {TAB_META[activeTab].source} · {t('scall.meanOf')} {activeTab === 'phase3' ? 5 : 3}{' '}
            {t('scall.reps')}
          </span>
        </div>

        <div className="h-[320px] w-full">
          <canvas ref={chartCanvasRef} />
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed mt-3 max-w-4xl">
          {activeTab === 'phase3'
            ? t('scall.captionPhase3')
            : activeTab === 'set64'
              ? t('scall.captionSet64')
              : t('scall.captionSet300')}
        </p>
      </div>

      {/* What the thesis concludes from this experiment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeTab === 'phase3' && (
          <>
            <InsightCard tone="blue" icon={CheckCircle2} title={t('scall.i31')}>
              {t('scall.i31body')}
            </InsightCard>
            <InsightCard tone="amber" icon={AlertTriangle} title={t('scall.i32')}>
              {t('scall.i32body')}
            </InsightCard>
            <InsightCard tone="emerald" icon={TrendingUp} title={t('scall.i33')}>
              {t('scall.i33body')}
            </InsightCard>
          </>
        )}
        {activeTab === 'set64' && (
          <>
            <InsightCard tone="emerald" icon={TrendingUp} title={t('scall.i641')}>
              {t('scall.i641body')}
            </InsightCard>
            <InsightCard tone="amber" icon={AlertTriangle} title={t('scall.i642')}>
              {t('scall.i642body')}
            </InsightCard>
            <InsightCard tone="blue" icon={Info} title={t('scall.i643')}>
              {t('scall.i643body')}
            </InsightCard>
          </>
        )}
        {activeTab === 'set300' && (
          <>
            <InsightCard tone="emerald" icon={TrendingUp} title={t('scall.i3001')}>
              {t('scall.i3001body')}
            </InsightCard>
            <InsightCard tone="amber" icon={AlertTriangle} title={t('scall.i3002')}>
              {t('scall.i3002body')}
            </InsightCard>
            <InsightCard tone="rose" icon={AlertTriangle} title={t('scall.i3003')}>
              {t('scall.i3003body')}
            </InsightCard>
          </>
        )}
      </div>

      {/* The table itself */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span>{TAB_META[activeTab].source}</span>
          <span className="text-[11px] text-slate-500 font-normal font-mono">
            {t('scall.transcribed')}
          </span>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'phase3' && (
            <table className="w-full border-collapse font-mono text-xs text-center min-w-[420px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border border-slate-800">
                  <th className="p-2.5 text-left">np</th>
                  <th className="p-2.5 text-emerald-400">A (s)</th>
                  <th className="p-2.5 text-sky-400">B (s)</th>
                  <th className="p-2.5">{es ? 'Diferencia' : 'Difference'}</th>
                </tr>
              </thead>
              <tbody>
                {t62.processes.map((p, i) => {
                  const a = t62.sets[readingSet].A[i];
                  const b = t62.sets[readingSet].B[i];
                  const pct = ((b - a) / a) * 100;
                  return (
                    <tr key={p} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                      <td className="p-2.5 text-left font-bold text-blue-400">{p}</td>
                      <td className="p-2.5 text-slate-200">{a.toFixed(1)}</td>
                      <td className="p-2.5 text-slate-200">{b.toFixed(1)}</td>
                      <td className="p-2.5">
                        {i === 0 ? (
                          <span className="text-slate-500">
                            {es ? 'no comparable' : 'not comparable'}
                          </span>
                        ) : (
                          <span className={pct > 0 ? 'text-emerald-400' : 'text-sky-400'}>
                            {pct > 0 ? `A −${pct.toFixed(1)} %` : `B −${(-pct).toFixed(1)} %`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'set64' && (
            <table className="w-full border-collapse font-mono text-xs text-center min-w-[620px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border border-slate-800">
                  <th className="p-2.5 text-left">np</th>
                  <th className="p-2.5 text-rose-400">metacache (s)</th>
                  <th className="p-2.5 text-emerald-400">isend (s)</th>
                  <th className="p-2.5 text-slate-400">isend_opt (s)</th>
                  <th className="p-2.5">Sp metacache</th>
                  <th className="p-2.5">Sp isend</th>
                  <th className="p-2.5">Ep isend</th>
                </tr>
              </thead>
              <tbody>
                {t63.processes.map((p, i) => (
                  <tr key={p} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                    <td className="p-2.5 text-left font-bold text-blue-400">{p}</td>
                    <td className="p-2.5 text-slate-200">{t63.time.metacache[i].toFixed(1)}</td>
                    <td className="p-2.5 text-emerald-400 font-semibold">
                      {t63.time.isend[i].toFixed(1)}
                    </td>
                    <td className="p-2.5 text-slate-400">{t63.time.isend_opt[i].toFixed(1)}</td>
                    <td className="p-2.5 text-slate-200">{t63.speedup.metacache[i].toFixed(2)}×</td>
                    <td className="p-2.5 text-slate-50 font-bold">
                      {t63.speedup.isend[i].toFixed(2)}×
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          t63.efficiencyIsend[i] >= 0.7
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : t63.efficiencyIsend[i] >= 0.4
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {(t63.efficiencyIsend[i] * 100).toFixed(0)} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'set300' && (
            <table className="w-full border-collapse font-mono text-xs text-center min-w-[520px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border border-slate-800">
                  <th className="p-2.5 text-left">np ({es ? 'nodos' : 'nodes'})</th>
                  <th className="p-2.5 text-rose-400">metacache (s)</th>
                  <th className="p-2.5 text-emerald-400">isend (s)</th>
                  <th className="p-2.5">{es ? 'Ventaja de isend' : 'isend advantage'}</th>
                </tr>
              </thead>
              <tbody>
                {t64.processes.map((p, i) => {
                  const meta = set300.metacache[i];
                  const isend = set300.isend[i];
                  return (
                    <tr key={p} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                      <td className="p-2.5 text-left font-bold text-blue-400">
                        {p} ({t64.nodes[i]})
                      </td>
                      <td className="p-2.5 text-slate-200">{meta}</td>
                      <td className="p-2.5 text-emerald-400 font-semibold">
                        {isend === null ? (
                          <span className="text-rose-400" title="MPI_ERR_INTERN">
                            —
                          </span>
                        ) : (
                          isend
                        )}
                      </td>
                      <td className="p-2.5 text-orange-400 font-bold">
                        {isend === null ? (
                          <span className="text-slate-500 font-normal">
                            {es ? 'no completa' : 'does not complete'}
                          </span>
                        ) : (
                          `${(((meta - isend) / meta) * 100).toFixed(0)} %`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {activeTab === 'set300' && (
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-4xl">
            {t('scall.seqRef')}{' '}
            {t64.sequentialRef[datasetChoice].toLocaleString(es ? 'es-ES' : 'en-GB')} s
            {datasetChoice === 'unbalanced' ? ` · ${t('scall.daggerNote')}` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

const TONE = {
  blue: 'border-l-blue-500 text-blue-400',
  emerald: 'border-l-emerald-500 text-emerald-400',
  amber: 'border-l-amber-500 text-amber-400',
  rose: 'border-l-rose-500 text-rose-400',
} as const;

function InsightCard({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof TONE;
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const [border, text] = TONE[tone].split(' ');
  return (
    <div
      className={`bg-slate-900/50 border border-slate-800 border-l-4 ${border} p-4 rounded-2xl space-y-1.5 text-xs`}
    >
      <div className={`font-bold flex items-center gap-1.5 ${text}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{children}</p>
    </div>
  );
}
