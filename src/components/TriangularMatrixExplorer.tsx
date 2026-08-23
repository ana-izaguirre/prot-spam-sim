import React, { useState } from 'react';
import { SPECIES_300_UNBALANCED } from '../data/speciesData';
import type { Species } from '../data/speciesData';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import { Grid, Eye, Cpu, Zap, Sparkles } from 'lucide-react';

export const TriangularMatrixExplorer: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();
  const [matrixSize, setMatrixSize] = useState<number>(12);
  const [numProcesses, setNumProcesses] = useState<number>(4);
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>({ i: 0, j: 1 });
  const [partitionMethod, setPartitionMethod] = useState<'cyclic' | 'block'>('cyclic');

  // Subsample species for visual display
  const speciesSubset: Species[] = SPECIES_300_UNBALANCED.slice(0, matrixSize);

  // Determine which rank owns row i
  const getOwnerRank = (rowIdx: number): number => {
    if (partitionMethod === 'cyclic') {
      return rowIdx % numProcesses;
    } else {
      const blockSize = Math.ceil(matrixSize / numProcesses);
      return Math.min(Math.floor(rowIdx / blockSize), numProcesses - 1);
    }
  };

  // Rank colors palette
  const rankColors = [
    '#38bdf8', // Cyan
    '#4edea3', // Emerald
    '#ffc174', // Amber
    '#a855f7', // Purple
    '#f472b6', // Pink
    '#60a5fa', // Blue
    '#34d399', // Green
    '#fb923c', // Orange
  ];

  // Calculations for current matrix state
  const totalUpperCells = (matrixSize * (matrixSize - 1)) / 2;
  const rankCounts = Array.from({ length: numProcesses }, (_, rank) => {
    let count = 0;
    let maaWeight = 0;
    for (let i = 0; i < matrixSize; i++) {
      if (getOwnerRank(i) === rank) {
        count += matrixSize - 1 - i;
        for (let j = i + 1; j < matrixSize; j++) {
          maaWeight += speciesSubset[i].maa * speciesSubset[j].maa;
        }
      }
    }
    return { rank, count, maaWeight };
  });

  const selectedPair = selectedCell
    ? {
        spA: speciesSubset[selectedCell.i],
        spB: speciesSubset[selectedCell.j],
        rank: getOwnerRank(selectedCell.i),
        isUpper: selectedCell.j > selectedCell.i,
        isDiagonal: selectedCell.j === selectedCell.i,
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Matrix Size Slider */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{t('matrix.dimension')}</span>
            <span className="font-mono text-purple-400 font-bold text-sm bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
              {matrixSize} &times; {matrixSize}
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={20}
            step={2}
            value={matrixSize}
            onChange={(e) => {
              setMatrixSize(parseInt(e.target.value));
              setSelectedCell({ i: 0, j: 1 });
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono font-medium">
            <span>6x6</span>
            <span>12x12</span>
            <span>20x20</span>
          </div>
        </div>

        {/* Processes P */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{t('workload.mpiProcesses')}</span>
            <span className="font-mono text-blue-400 font-bold text-sm bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
              {numProcesses} ranks
            </span>
          </div>
          <div className="flex gap-2">
            {[2, 4, 8].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNumProcesses(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  numProcesses === p
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/60 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {p} Ranks
              </button>
            ))}
          </div>
        </div>

        {/* Partition Method */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('matrix.strategy')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPartitionMethod('cyclic')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center ${
                partitionMethod === 'cyclic'
                  ? 'bg-emerald-600/20 border-emerald-500/70 text-emerald-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span>{lang === 'es' ? 'Algoritmo 1' : 'Algorithm 1'}</span>
              <span className="text-[10px] font-normal opacity-80">{lang === 'es' ? '(Cíclico)' : '(Cyclic)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPartitionMethod('block')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center flex flex-col items-center justify-center ${
                partitionMethod === 'block'
                  ? 'bg-rose-600/20 border-rose-500/70 text-rose-400 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span>{lang === 'es' ? 'Por Bloques' : 'By Blocks'}</span>
              <span className="text-[10px] font-normal opacity-80">{lang === 'es' ? '(Ingenuo)' : '(Naive)'}</span>
            </button>
          </div>
        </div>

        {/* Hover/Filter by Rank */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {lang === 'es' ? 'Resaltar Proceso MPI' : 'Highlight MPI Process'}
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setHoveredRank(null)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                hoveredRank === null
                  ? 'bg-purple-600/20 border-purple-500/60 text-purple-300 font-bold'
                  : 'bg-slate-800/80 border-slate-700/70 text-slate-400'
              }`}
            >
              {lang === 'es' ? 'Todos' : 'All'}
            </button>
            {Array.from({ length: numProcesses }, (_, rank) => (
              <button
                key={rank}
                onMouseEnter={() => setHoveredRank(rank)}
                onClick={() => setHoveredRank(hoveredRank === rank ? null : rank)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                  hoveredRank === rank
                    ? 'border-white font-bold shadow-md'
                    : 'bg-slate-800/80 border-slate-700/70 text-slate-400'
                }`}
                style={{
                  color: rankColors[rank % rankColors.length],
                  borderColor: hoveredRank === rank ? rankColors[rank % rankColors.length] : undefined,
                  backgroundColor: hoveredRank === rank ? `${rankColors[rank % rankColors.length]}22` : undefined,
                }}
              >
                R{rank}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid & Inspector View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Triangular Matrix Heatmap (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-50">
                {lang === 'es' ? 'Media Matriz Triangular Superior (j > i)' : 'Upper Triangular Half-Matrix (j > i)'}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700 inline-block opacity-50" />
                {lang === 'es' ? 'j ≤ i (Atenuado)' : 'j ≤ i (Dimmed)'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />
                {lang === 'es' ? 'j > i (Calculado)' : 'j > i (Computed)'}
              </span>
            </div>
          </div>

          {/* Matrix Scrollable Container */}
          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse text-center text-xs font-mono select-none">
              <thead>
                <tr>
                  <th className="p-1.5 text-[10px] text-slate-500 bg-slate-950 border border-slate-800 font-normal">
                    i \ j
                  </th>
                  {speciesSubset.map((sp, j) => (
                    <th
                      key={j}
                      className="p-1.5 text-[10px] text-slate-400 bg-slate-950 border border-slate-800 font-medium max-w-[44px] truncate"
                      title={`${sp.name} (${sp.maa} Maa)`}
                    >
                      {sp.shortCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {speciesSubset.map((spI, i) => {
                  const ownerRank = getOwnerRank(i);
                  const color = rankColors[ownerRank % rankColors.length];
                  const isRankHighlighted = hoveredRank === null || hoveredRank === ownerRank;

                  return (
                    <tr key={i}>
                      {/* Row Header with Rank Badge */}
                      <th
                        className="p-1.5 text-[10px] bg-slate-950 border border-slate-800 text-left flex items-center justify-between gap-1 min-w-[76px]"
                        onMouseEnter={() => setHoveredRank(ownerRank)}
                        onMouseLeave={() => hoveredRank !== null && setHoveredRank(null)}
                      >
                        <span className="text-slate-200 font-semibold">{spI.shortCode}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            backgroundColor: `${color}22`,
                            color: color,
                            border: `1px solid ${color}66`,
                          }}
                        >
                          R{ownerRank}
                        </span>
                      </th>

                      {/* Matrix Columns */}
                      {speciesSubset.map((spJ, j) => {
                        const isDiagonal = i === j;
                        const isLower = j < i;
                        const isSelected = selectedCell?.i === i && selectedCell?.j === j;

                        if (isDiagonal) {
                          return (
                            <td
                              key={j}
                              onClick={() => setSelectedCell({ i, j })}
                              className={`p-1.5 border border-slate-800 bg-slate-950 text-slate-600 text-[10px] cursor-pointer hover:border-purple-400 ${
                                isSelected ? 'ring-2 ring-purple-400 font-bold text-slate-50' : ''
                              }`}
                            >
                              0.0
                            </td>
                          );
                        }

                        if (isLower) {
                          return (
                            <td
                              key={j}
                              onClick={() => setSelectedCell({ i, j })}
                              className={`p-1.5 border border-slate-800/50 bg-slate-950/60 text-slate-700 text-[9px] cursor-pointer hover:bg-slate-900 ${
                                isSelected ? 'ring-2 ring-purple-400 text-slate-400' : ''
                              }`}
                              title={lang === 'es' ? 'Espejo simétrico (no recalculado en MPI)' : 'Symmetric mirror (omitted in MPI compute)'}
                            >
                              &middot;
                            </td>
                          );
                        }

                        // Upper Triangle (Calculated by ownerRank)
                        return (
                          <td
                            key={j}
                            onClick={() => setSelectedCell({ i, j })}
                            className={`p-1.5 border border-slate-800 cursor-pointer transition-all ${
                              isSelected ? 'ring-2 ring-white font-bold scale-105 z-10' : ''
                            }`}
                            style={{
                              backgroundColor: isRankHighlighted ? `${color}33` : '#0f172a',
                              color: isRankHighlighted ? color : '#64748b',
                              borderColor: isRankHighlighted ? `${color}88` : '#1e293b',
                              opacity: isRankHighlighted ? 1 : 0.25,
                            }}
                          >
                            <span className="text-[10px]">
                              {spI.isHuman || spJ.isHuman ? '🔥' : `${spI.shortCode[1]}${spJ.shortCode[1]}`}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Process Workload Balance Table */}
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {rankCounts.map((rc) => {
              const color = rankColors[rc.rank % rankColors.length];
              const pct = ((rc.count / totalUpperCells) * 100).toFixed(1);
              return (
                <div
                  key={rc.rank}
                  onMouseEnter={() => setHoveredRank(rc.rank)}
                  onMouseLeave={() => hoveredRank !== null && setHoveredRank(null)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    hoveredRank === rc.rank
                      ? 'bg-slate-900 border-white shadow-md'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                  style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold font-mono" style={{ color }}>
                      Rank {rc.rank}
                    </span>
                    <span className="font-mono text-[11px] text-slate-200">{pct}%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    {rc.count} {lang === 'es' ? 'pares (j > i)' : 'pairs (j > i)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Inspector Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Pair Inspector Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-50 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-400" />
                {t('matrix.inspector')} ({selectedCell?.i}, {selectedCell?.j})
              </span>
              {selectedPair && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedPair.isUpper
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : selectedPair.isDiagonal
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {selectedPair.isUpper ? (lang === 'es' ? 'Cálculo MPI' : 'MPI Compute') : selectedPair.isDiagonal ? 'Diagonal (0.0)' : (lang === 'es' ? 'Atenuado' : 'Dimmed')}
                </span>
              )}
            </div>

            {selectedPair && selectedPair.spA && selectedPair.spB ? (
              <div className="space-y-3 text-xs">
                {/* Species A */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">
                    {t('matrix.speciesA')} (i={selectedCell?.i})
                  </div>
                  <div className="font-bold text-slate-50 text-sm mt-0.5 flex items-center justify-between">
                    <span>{selectedPair.spA.name}</span>
                    <span className="text-xs font-mono text-purple-400">{selectedPair.spA.maa} Maa</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {selectedPair.spA.taxon} &middot; {selectedPair.spA.proteins.toLocaleString()} {lang === 'es' ? 'proteínas' : 'proteins'}
                  </div>
                </div>

                {/* Species B */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">
                    {t('matrix.speciesB')} (j={selectedCell?.j})
                  </div>
                  <div className="font-bold text-slate-50 text-sm mt-0.5 flex items-center justify-between">
                    <span>{selectedPair.spB.name}</span>
                    <span className="text-xs font-mono text-emerald-400">{selectedPair.spB.maa} Maa</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {selectedPair.spB.taxon} &middot; {selectedPair.spB.proteins.toLocaleString()} {lang === 'es' ? 'proteínas' : 'proteins'}
                  </div>
                </div>

                {/* Assignment & Computational Weight */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('matrix.assignedRank')}</span>
                    <span className="font-bold text-purple-400">
                      Rank {selectedPair.rank} ({partitionMethod === 'cyclic' ? 'i % P' : (lang === 'es' ? 'Bloque' : 'Block')})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'es' ? 'Coste relativo estimado:' : 'Estimated relative cost:'}</span>
                    <span className="text-slate-200">
                      ~{(selectedPair.spA.maa * selectedPair.spB.maa).toFixed(1)} M-ops
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500">
                      {t('matrix.illustrativeDist')}
                    </span>
                    <span
                      className="text-emerald-400/80 font-bold"
                      title={t('matrix.illustrativeDistHint')}
                    >
                      {selectedPair.isDiagonal
                        ? '0.000000'
                        : (0.125 + (selectedCell!.i + selectedCell!.j) * 0.015).toFixed(6)}
                    </span>
                  </div>
                  {/* The value above is a positional placeholder, not a computed
                      distance. Saying so is the difference between a teaching aid
                      and a false claim. */}
                  <p className="text-[10px] text-amber-400/80 leading-snug pt-1 border-t border-slate-800/80">
                    {t('matrix.illustrativeDistHint')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">
                {lang === 'es' ? 'Haz clic en una celda de la matriz para inspeccionar el par biológico.' : 'Click on any matrix cell to inspect the biological species pair.'}
              </div>
            )}
          </div>

          {/* Why Lower Triangle is Dimmed Card */}
          <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-xs space-y-2 text-slate-300">
            <div className="font-semibold text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              {lang === 'es' ? '¿Por qué atenuar la mitad inferior (j ≤ i)?' : 'Why omit the lower triangle (j ≤ i)?'}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === 'es'
                ? 'La matriz de distancias filogenéticas es estrictamente simétrica (D(A, B) = D(B, A)) con diagonal nula (D(A, A) = 0). En HPC, calcular el 100% de la matriz duplicaría innecesariamente el consumo energético y tiempo de CPU. ProtSpam evalúa solo las N(N - 1) / 2 celdas superiores y aplica una reducción simétrica libre de error.'
                : 'The phylogenetic distance matrix is strictly symmetric (D(A, B) = D(B, A)) with zero diagonal (D(A, A) = 0). In HPC, computing 100% of the matrix would double CPU time and power consumption. ProtSpam evaluates only the N(N - 1) / 2 upper cells and performs bitwise error-free symmetric reduction.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
