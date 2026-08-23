import React, { useState, useEffect } from 'react';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  HelpCircle,
  Binary,
  GitBranch,
  Sparkles,
  ArrowRight,
  Calculator,
  CheckCircle2,
} from 'lucide-react';

interface StepData {
  phase: string;
  badgeClass: string;
  activeFn: 'spacedwords' | 'sort' | 'setwords' | 'none';
  s1Pos: number;
  s2Pos: number;
  key: string;
  patternStr: string;
  desc: string;
  isMatch?: boolean;
  matchedKey?: string | null;
  s1Extend?: number[];
  s2Extend?: number[];
  memoryState: any[];
  stackState: any[];
  matchesState: any[];
  alignmentData?: {
    s1: string[];
    s2: string[];
    scores: number[];
    accum: number[];
    activeIndex: number;
  };
  activePair?: { a: string; b: string; score: number };
  showMatrix?: boolean;
  globalResults?: any[];
  avgDist?: number;
}

/**
 * Didactic stand-in for BLOSUM62.
 *
 * Prot-SpaM scores extensions with the real 20x20 amino-acid BLOSUM62 matrix.
 * A 20x20 lookup cannot be followed by eye one cell at a time, which is the
 * whole point of this module, so the simulator uses a 4-symbol table with the
 * same shape: positive on the diagonal, penalties off it. The UI says so.
 */
const DEMO_SUBSTITUTION_MATRIX: Record<string, Record<string, number>> = {
  A: { A: 4, C: 0, T: 0, G: 0 },
  C: { A: 0, C: 9, T: -1, G: -3 },
  T: { A: 0, C: -1, T: 5, G: -2 },
  G: { A: 0, C: -3, T: -2, G: 6 },
};

function getBlosumScore(a: string, b: string): number {
  if (DEMO_SUBSTITUTION_MATRIX[a] && DEMO_SUBSTITUTION_MATRIX[a][b] !== undefined) {
    return DEMO_SUBSTITUTION_MATRIX[a][b];
  }
  return a === b ? 4 : -1;
}

/** Score of the seed window itself (the positions the pattern spans). */
function scoreWindow(
  S1: string[],
  S2: string[],
  s1Pos: number,
  s2Pos: number,
  length: number
): number {
  let total = 0;
  for (let k = 0; k < length; k++) {
    total += getBlosumScore(S1[s1Pos + k], S2[s2Pos + k]);
  }
  return total;
}

/**
 * Grows one direction away from the seed until the running score falls more
 * than `dropoff` below the best score seen, then trims back to that best
 * position. Returns the characters that direction contributes and the score
 * they carry.
 *
 * This is the X-drop rule the real tool uses to stop an extension from running
 * off into noise. `positionsAt(step)` maps a distance from the seed to the pair
 * of indices to compare; `inBounds` guards the ends of the sequences.
 */
function extendWithDropoff(
  positionsAt: (step: number) => [number, number],
  inBounds: (a: number, b: number) => boolean,
  S1: string[],
  S2: string[],
  dropoff: number
): { length: number; score: number } {
  let running = 0;
  let best = 0;
  let bestLength = 0;

  for (let step = 0; ; step++) {
    const [a, b] = positionsAt(step);
    if (!inBounds(a, b)) break;

    running += getBlosumScore(S1[a], S2[b]);

    if (running > best) {
      best = running;
      bestLength = step + 1;
    } else if (running < best - dropoff) {
      break;
    }
  }

  return { length: bestLength, score: best };
}

export const ProtSpamStepSimulator: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();

  const [patternInput, setPatternInput] = useState<string>('1*11*1, 11**1, 1**11');
  const [s1Input, setS1Input] = useState<string>('ACTGACACTG');
  const [s2Input, setS2Input] = useState<string>('ATTGCAATTG');
  const [thresholdInput, setThresholdInput] = useState<number>(8);
  const [dropoffInput, setDropoffInput] = useState<number>(3);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1000);
  const [blosumExplainer, setBlosumExplainer] = useState<{ a: string; b: string; score: number } | null>(null);

  const generateSimulationSteps = () => {
    const rawPats = patternInput.split(',');
    let patternList = rawPats.map((p) => p.trim().replace(/[^1*]/g, '')).filter((p) => p.length > 0);
    if (patternList.length === 0) patternList = ['1*11*1'];

    const s1Raw = s1Input.toUpperCase().replace(/[^A-Z]/g, '') || 'ACTG';
    const s2Raw = s2Input.toUpperCase().replace(/[^A-Z]/g, '') || 'ATTG';

    const S1 = s1Raw.split('');
    const S2 = s2Raw.split('');
    const paramT = thresholdInput || 8;
    const paramD = dropoffInput || 3;

    const newSteps: StepData[] = [];
    const globalResults: any[] = [];
    const accumulatedMemory: any[] = [];
    const accumulatedPatternStack: any[] = [];

    patternList.forEach((patternStr) => {
      const patternLen = patternStr.length;

      const currentPatternBlock: any = {
        pattern: patternStr,
        rawWordsList: [],
        sortedWordsList: [],
        status: 'extracting',
        latestKey: null,
        latestPos: -1,
      };

      const currentStackBlock: any = {
        pattern: patternStr,
        matches: [],
        noMatches: [],
      };

      const tempMemoryState = JSON.parse(JSON.stringify(accumulatedMemory));
      tempMemoryState.push(currentPatternBlock);

      const tempStackState = JSON.parse(JSON.stringify(accumulatedPatternStack));
      tempStackState.push(currentStackBlock);

      // Fase 3.1: spacedwords()
      newSteps.push({
        phase: lang === 'es' ? 'Fase 3: spacedwords()' : 'Phase 3: spacedwords()',
        badgeClass: 'bg-[#a855f7] text-slate-50',
        activeFn: 'spacedwords',
        s1Pos: -1,
        s2Pos: -1,
        key: '-',
        patternStr: patternStr,
        desc: lang === 'es' 
          ? `<strong>spacedwords():</strong> Iniciando patrón binario <code>${patternStr}</code> en la secuencia S1.`
          : `<strong>spacedwords():</strong> Starting binary pattern <code>${patternStr}</code> on sequence S1.`,
        memoryState: JSON.parse(JSON.stringify(tempMemoryState)),
        stackState: JSON.parse(JSON.stringify(tempStackState)),
        matchesState: [],
        showMatrix: false,
      });

      const tempHash: Record<string, number[]> = {};
      const rawList: Array<{ key: string; pos: number }> = [];
      const maxS1 = S1.length - patternLen;

      if (maxS1 >= 0) {
        for (let i = 0; i <= maxS1; i++) {
          let key = '';
          for (let p = 0; p < patternLen; p++) {
            if (patternStr[p] === '1') key += S1[i + p];
          }
          if (!tempHash[key]) tempHash[key] = [];
          tempHash[key].push(i);
          rawList.push({ key, pos: i });

          const activeBlock = tempMemoryState[tempMemoryState.length - 1];
          activeBlock.rawWordsList = JSON.parse(JSON.stringify(rawList));
          activeBlock.latestKey = key;
          activeBlock.latestPos = i;

          newSteps.push({
            phase: lang === 'es' ? 'Fase 3: spacedwords()' : 'Phase 3: spacedwords()',
            badgeClass: 'bg-[#a855f7] text-slate-50',
            activeFn: 'spacedwords',
            s1Pos: i,
            s2Pos: -1,
            key,
            patternStr,
            desc: lang === 'es'
              ? `Extrayendo palabra espaciada: <strong>"${key}"</strong> en S1[${i}] según máscara <code>${patternStr}</code>.`
              : `Extracting spaced word: <strong>"${key}"</strong> at S1[${i}] with mask <code>${patternStr}</code>.`,
            memoryState: JSON.parse(JSON.stringify(tempMemoryState)),
            stackState: JSON.parse(JSON.stringify(tempStackState)),
            matchesState: [],
            showMatrix: false,
          });
        }
      }

      // Fase 3.2: std::sort()
      const sortedList = [...rawList].sort((a, b) => a.key.localeCompare(b.key));
      const activeBlock2 = tempMemoryState[tempMemoryState.length - 1];
      activeBlock2.sortedWordsList = sortedList;
      activeBlock2.status = 'sorted';

      newSteps.push({
        phase: lang === 'es' ? 'Fase 3: std::sort()' : 'Phase 3: std::sort()',
        badgeClass: 'bg-[#3b82f6] text-slate-50',
        activeFn: 'sort',
        s1Pos: -1,
        s2Pos: -1,
        key: '-',
        patternStr,
        desc: lang === 'es'
          ? `<strong>std::sort():</strong> Indexando ${sortedList.length} palabras espaciadas lexicográficamente en memoria para búsqueda O(log N).`
          : `<strong>std::sort():</strong> Lexicographically sorting ${sortedList.length} spaced words in memory for fast O(log N) lookup.`,
        memoryState: JSON.parse(JSON.stringify(tempMemoryState)),
        stackState: JSON.parse(JSON.stringify(tempStackState)),
        matchesState: [],
        showMatrix: false,
      });

      activeBlock2.status = 'ready';
      accumulatedMemory.push(JSON.parse(JSON.stringify(activeBlock2)));

      // Fase 4: calc_matches()
      const maxS2 = S2.length - patternLen;
      const matchesEvaluated: any[] = [];
      const patternScoresList: any[] = [];

      if (maxS2 >= 0) {
        for (let j = 0; j <= maxS2; j++) {
          let s2Key = '';
          for (let p = 0; p < patternLen; p++) {
            if (patternStr[p] === '1') s2Key += S2[j + p];
          }

          const s1Positions = tempHash[s2Key] || [];
          const isMatch = s1Positions.length > 0;

          if (isMatch) {
            s1Positions.forEach((s1Pos) => {
              const activeStack = tempStackState[tempStackState.length - 1];
              activeStack.matches.push({
                key: s2Key,
                s1Pos,
                s2Pos: j,
                pattern: patternStr,
              });

              newSteps.push({
                phase: lang === 'es' ? 'Fase 4: calc_matches() (Hit)' : 'Phase 4: calc_matches() (Hit)',
                badgeClass: 'bg-[#10b981] text-[#002113]',
                activeFn: 'setwords',
                s1Pos,
                s2Pos: j,
                key: s2Key,
                patternStr,
                desc: lang === 'es'
                  ? `<strong>¡Coincidencia exacta de patrón!</strong> Clave <code>${s2Key}</code> coincide en S1[${s1Pos}] y S2[${j}].`
                  : `<strong>Exact pattern match!</strong> Key <code>${s2Key}</code> matches at S1[${s1Pos}] and S2[${j}].`,
                matchedKey: s2Key,
                memoryState: JSON.parse(JSON.stringify(accumulatedMemory)),
                stackState: JSON.parse(JSON.stringify(tempStackState)),
                matchesState: JSON.parse(JSON.stringify(matchesEvaluated)),
                showMatrix: false,
              });

              // Extensión bidireccional sin gaps, acotada por X-drop.
              //
              // Se parte del seed (la ventana del patrón) y se crece en cada
              // dirección de forma independiente, llevando la puntuación corrida
              // y la mejor alcanzada. En cuanto la corrida cae más de X por
              // debajo de la mejor, esa dirección se corta y se recorta hasta la
              // posición de la mejor puntuación: prolongar más solo añade ruido.
              const seedScore = scoreWindow(S1, S2, s1Pos, j, patternLen);

              const leftExtension = extendWithDropoff(
                // step 0 is the character immediately left of the seed; the seed
                // itself is already accounted for in seedScore.
                (step) => [s1Pos - 1 - step, j - 1 - step],
                (a, b) => a >= 0 && b >= 0,
                S1,
                S2,
                paramD
              );

              const rightExtension = extendWithDropoff(
                (step) => [s1Pos + patternLen + step, j + patternLen + step],
                (a, b) => a < S1.length && b < S2.length,
                S1,
                S2,
                paramD
              );

              const extLeft = leftExtension.length;
              const extRight = rightExtension.length;

              // Score of the trimmed HSP: the seed plus whatever each direction
              // kept. It equals the last accumulated value in the table below.
              const hspScore = leftExtension.score + seedScore + rightExtension.score;

              const fullS1Align: string[] = [];
              const fullS2Align: string[] = [];
              const s1ExtIndices: number[] = [];
              const s2ExtIndices: number[] = [];

              for (let k = s1Pos - extLeft; k < s1Pos + patternLen + extRight; k++) {
                fullS1Align.push(S1[k]);
                s1ExtIndices.push(k);
              }
              for (let k = j - extLeft; k < j + patternLen + extRight; k++) {
                fullS2Align.push(S2[k]);
                s2ExtIndices.push(k);
              }

              let runningScore = 0;
              const scoresArr: number[] = [];
              const accumArr: number[] = [];

              for (let k = 0; k < fullS1Align.length; k++) {
                const sc = getBlosumScore(fullS1Align[k], fullS2Align[k]);
                runningScore += sc;
                scoresArr.push(sc);
                accumArr.push(runningScore);
              }

              const maxScore = hspScore;
              const status = maxScore >= paramT ? 'approved' : 'rejected';
              matchesEvaluated.push({
                key: s2Key,
                s1Pos,
                s2Pos: j,
                pattern: patternStr,
                maxScore,
                threshold: paramT,
                status,
                fullAlign: {
                  s1: fullS1Align,
                  s2: fullS2Align,
                  scores: scoresArr,
                  accum: accumArr,
                },
                s1ExtIndices,
                s2ExtIndices,
              });

              patternScoresList.push({ key: s2Key, score: maxScore, status });
            });
          } else {
            const activeStack = tempStackState[tempStackState.length - 1];
            activeStack.noMatches.push({ key: s2Key, s2Pos: j });

            newSteps.push({
              phase: lang === 'es' ? 'Fase 4: calc_matches() (Miss)' : 'Phase 4: calc_matches() (Miss)',
              badgeClass: 'bg-rose-500 text-slate-50',
              activeFn: 'setwords',
              s1Pos: -1,
              s2Pos: j,
              key: s2Key,
              patternStr,
              desc: lang === 'es'
                ? `Sin coincidencia para <code>${s2Key}</code> en S2[${j}]. Se avanza la ventana.`
                : `No match for <code>${s2Key}</code> in S2[${j}]. Advancing sliding window.`,
              matchedKey: null,
              memoryState: JSON.parse(JSON.stringify(accumulatedMemory)),
              stackState: JSON.parse(JSON.stringify(tempStackState)),
              matchesState: JSON.parse(JSON.stringify(matchesEvaluated)),
              showMatrix: false,
            });
          }
        }
      }

      accumulatedPatternStack.push(JSON.parse(JSON.stringify(tempStackState[tempStackState.length - 1])));

      // Extension Evaluation Steps
      matchesEvaluated.forEach((match) => {
        const fullAlignData = match.fullAlign;
        for (let stepIdx = 0; stepIdx < fullAlignData.s1.length; stepIdx++) {
          const char1Active = fullAlignData.s1[stepIdx];
          const char2Active = fullAlignData.s2[stepIdx];
          const subScore = fullAlignData.scores[stepIdx];
          const subAccum = fullAlignData.accum[stepIdx];

          newSteps.push({
            phase: lang === 'es' ? 'Fase 4: Extensión sin gaps' : 'Phase 4: Gap-free extension',
            badgeClass: 'bg-[#a855f7] text-slate-50',
            activeFn: 'none',
            s1Pos: match.s1Pos,
            s2Pos: match.s2Pos,
            key: match.key,
            patternStr: match.pattern,
            s1Extend: match.s1ExtIndices,
            s2Extend: match.s2ExtIndices,
            desc: lang === 'es'
              ? `Extensión sin gaps [${stepIdx + 1}/${fullAlignData.s1.length}]: S1(<strong>${char1Active}</strong>) &times; S2(<strong>${char2Active}</strong>) &rarr; puntuación: <strong>${
                  subScore >= 0 ? '+' + subScore : subScore
                }</strong> | Acumulado: <strong style="color:#38bdf8;">${subAccum}</strong>`
              : `Gap-free extension [${stepIdx + 1}/${fullAlignData.s1.length}]: S1(<strong>${char1Active}</strong>) &times; S2(<strong>${char2Active}</strong>) &rarr; score: <strong>${
                  subScore >= 0 ? '+' + subScore : subScore
                }</strong> | Accumulated: <strong style="color:#38bdf8;">${subAccum}</strong>`,
            memoryState: JSON.parse(JSON.stringify(accumulatedMemory)),
            stackState: JSON.parse(JSON.stringify(accumulatedPatternStack)),
            matchesState: JSON.parse(JSON.stringify(matchesEvaluated)),
            alignmentData: {
              s1: fullAlignData.s1,
              s2: fullAlignData.s2,
              scores: fullAlignData.scores,
              accum: fullAlignData.accum,
              activeIndex: stepIdx,
            },
            showMatrix: false,
            activePair: { a: char1Active, b: char2Active, score: subScore },
          });
        }
      });

      const approvedCount = matchesEvaluated.filter((m: any) => m.status === 'approved').length;
      globalResults.push({
        pattern: patternStr,
        approvedMatches: approvedCount,
        dist: 1 / (approvedCount + 1),
        scoresList: patternScoresList,
      });
    });

    const avgDist =
      globalResults.reduce((acc, r) => acc + r.dist, 0) / (globalResults.length || 1);

    newSteps.push({
      phase: lang === 'es' ? 'Fase 4: Matriz PHYLIP Completa' : 'Phase 4: Complete PHYLIP Matrix',
      badgeClass: 'bg-[#10b981] text-[#002113]',
      activeFn: 'none',
      s1Pos: -1,
      s2Pos: -1,
      key: 'FIN',
      patternStr: 'GLOBAL',
      desc: lang === 'es'
        ? '<strong>Simulación finalizada.</strong> Se han consolidado todos los patrones, extensiones y la matriz de distancia evolutiva PHYLIP.'
        : '<strong>Simulation finished.</strong> All spaced patterns, gap-free extensions, and the final PHYLIP evolutionary distance matrix are consolidated.',
      memoryState: JSON.parse(JSON.stringify(accumulatedMemory)),
      stackState: JSON.parse(JSON.stringify(accumulatedPatternStack)),
      matchesState: [],
      showMatrix: true,
      globalResults,
      avgDist,
    });

    setSteps(newSteps);
    setCurrentStep(0);
  };

  useEffect(() => {
    generateSimulationSteps();
  }, [lang]);

  // Autoplay effect
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, steps.length, playSpeed]);

  const currentStepData = steps[currentStep] || steps[0];

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep((c) => c + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((c) => c - 1);
  };

  const s1Chars = s1Input.toUpperCase().split('');
  const s2Chars = s2Input.toUpperCase().split('');

  return (
    <div className="space-y-4">
      {/* Pedagogical Header Explanation Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-50 tracking-wide">
                {t('core.title')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('core.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
              {lang === 'es' ? 'Simulador Original Prot-SpaM' : 'Original Prot-SpaM Simulator'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('core.howItWorks')}</span>
          </div>
          <p className="text-slate-400">
            {t('core.howItWorksDesc')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-pink-400 font-bold block">1. spacedwords()</span>
              <span className="text-slate-400 text-[10px]">Extracción con máscara</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-purple-400 font-bold block">2. std::sort()</span>
              <span className="text-slate-400 text-[10px]">Indexación binaria O(log N)</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-blue-400 font-bold block">3. calc_matches()</span>
              <span className="text-slate-400 text-[10px]">Extensión sin gaps</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-bold block">4. Distancia Kimura</span>
              <span className="text-slate-400 text-[10px]">Matriz simétrica PHYLIP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Playback & Navigation Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider ${
              currentStepData?.badgeClass || 'bg-blue-500 text-slate-950'
            }`}
          >
            {currentStepData?.phase || 'Fase 3'}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {t('core.step')} <strong className="text-slate-50">{currentStep}</strong> {t('core.of')} {steps.length - 1}
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
          {/* Autoplay toggle */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 bg-emerald-500 text-slate-950 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-400 transition-colors shadow-sm"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? t('core.pause') : t('core.play')}</span>
          </button>

          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:opacity-30 hover:border-slate-600 transition-colors"
            title={t('core.prevStep')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentStep >= steps.length - 1}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-50 font-bold text-xs disabled:opacity-30 hover:border-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <span>{t('core.nextStep')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(0);
            }}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={t('core.reset')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed controls */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-mono mr-1">{t('core.speed')}:</span>
            {[1500, 1000, 400].map((spd, idx) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaySpeed(spd)}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                  playSpeed === spd
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {idx === 0 ? '0.5x' : idx === 1 ? '1x' : '2x'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parameter Configuration Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('core.patterns')}
          </label>
          <input
            type="text"
            value={patternInput}
            onChange={(e) => setPatternInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-mono text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('core.seq1')}
          </label>
          <input
            type="text"
            value={s1Input}
            onChange={(e) => setS1Input(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-mono text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('core.seq2')}
          </label>
          <input
            type="text"
            value={s2Input}
            onChange={(e) => setS2Input(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-mono text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('core.threshold')}
          </label>
          <input
            type="number"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(parseInt(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-mono text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            title={t('core.dropoffHint')}
          >
            {t('core.dropoff')}
          </label>
          <input
            type="number"
            min={0}
            value={dropoffInput}
            onChange={(e) => setDropoffInput(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-200 font-mono text-xs outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-slate-500 leading-snug">{t('core.dropoffHint')}</p>
        </div>
        <div>
          <button
            type="button"
            onClick={generateSimulationSteps}
            className="w-full bg-emerald-500 text-slate-950 font-bold py-2 px-3 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            {t('core.updateParams')}
          </button>
        </div>
      </div>

      {/* Main 3-Column Simulation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Sequence Exploration */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-50">
              {lang === 'es' ? 'Exploración de Secuencias' : 'Sequence Exploration'}
            </span>
            <span className="text-[10px] font-mono text-blue-400 font-bold">
              {currentStepData?.activeFn !== 'none' ? `${currentStepData?.activeFn}()` : 'Fase 4'}
            </span>
          </div>

          {/* S1 Row */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">S1 (Base Proteome)</div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {s1Chars.map((char, idx) => {
                const isWindow =
                  currentStepData?.s1Pos !== undefined &&
                  currentStepData.s1Pos !== -1 &&
                  idx >= currentStepData.s1Pos &&
                  idx < currentStepData.s1Pos + (currentStepData.patternStr?.length || 0);

                const isExtended = currentStepData?.s1Extend?.includes(idx);

                return (
                  <div
                    key={idx}
                    className={`w-6 h-7 shrink-0 rounded flex flex-col items-center justify-center font-mono text-xs font-bold border transition-colors ${
                      isExtended
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : isWindow
                        ? currentStepData.matchedKey
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'bg-blue-600 border-blue-500 text-slate-50'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[8px] text-slate-500 leading-none">{idx}</span>
                    <span className="leading-none mt-0.5">{char}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* S2 Row */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">S2 (Query Proteome)</div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {s2Chars.map((char, idx) => {
                const isWindow =
                  currentStepData?.s2Pos !== undefined &&
                  currentStepData.s2Pos !== -1 &&
                  idx >= currentStepData.s2Pos &&
                  idx < currentStepData.s2Pos + (currentStepData.patternStr?.length || 0);

                const isExtended = currentStepData?.s2Extend?.includes(idx);

                return (
                  <div
                    key={idx}
                    className={`w-6 h-7 shrink-0 rounded flex flex-col items-center justify-center font-mono text-xs font-bold border transition-colors ${
                      isExtended
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : isWindow
                        ? currentStepData.matchedKey
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'bg-blue-600 border-blue-500 text-slate-50'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[8px] text-slate-500 leading-none">{idx}</span>
                    <span className="leading-none mt-0.5">{char}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Metadata Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between text-xs font-mono">
            <div>
              {lang === 'es' ? 'Clave: ' : 'Key: '}
              <strong className="text-blue-400">{currentStepData?.key}</strong>
            </div>
            <div>
              {lang === 'es' ? 'Patrón: ' : 'Pattern: '}
              <strong className="text-pink-400">{currentStepData?.patternStr}</strong>
            </div>
          </div>

          {/* Step Description Box */}
          <div className="bg-slate-950 border-l-4 border-l-emerald-500 p-3 rounded-xl text-xs leading-relaxed text-slate-300">
            <div dangerouslySetInnerHTML={{ __html: currentStepData?.desc || '' }} />
          </div>
        </div>

        {/* Column 2: Memory & Stack */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-50 border-b border-slate-800 pb-3">
            {lang === 'es' ? 'Estructura de Memoria S1' : 'Memory Structure S1'}
          </div>

          {/* Phase 3 Flow Badges */}
          <div className="grid grid-cols-3 gap-1.5 text-[9px] font-bold uppercase text-center font-mono">
            <div
              className={`p-1.5 rounded-lg border ${
                currentStepData?.activeFn === 'spacedwords'
                  ? 'border-pink-500/60 bg-pink-500/20 text-pink-400'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              1. spacedwords()
            </div>
            <div
              className={`p-1.5 rounded-lg border ${
                currentStepData?.activeFn === 'sort'
                  ? 'border-purple-500/60 bg-purple-500/20 text-purple-400'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              2. std::sort()
            </div>
            <div
              className={`p-1.5 rounded-lg border ${
                currentStepData?.activeFn === 'setwords'
                  ? 'border-orange-500/60 bg-orange-500/20 text-orange-400'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              3. set_words()
            </div>
          </div>

          {/* Memory Accumulation List */}
          <div className="max-h-[140px] overflow-y-auto space-y-2">
            {currentStepData?.memoryState?.map((block: any, idx: number) => {
              const isActive = block.pattern === currentStepData.patternStr;
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl bg-slate-950 border text-[11px] ${
                    isActive ? 'border-pink-500/40 bg-pink-500/5' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between font-mono text-[10px] text-blue-400 mb-1.5">
                    <span>{lang === 'es' ? 'Patrón: ' : 'Pattern: '}{block.pattern}</span>
                    <span>{block.status === 'ready' ? (lang === 'es' ? '✔ Listo' : '✔ Ready') : (lang === 'es' ? '⏳ Procesando' : '⏳ Indexing')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(block.status === 'extracting' ? block.rawWordsList : block.sortedWordsList)?.map(
                      (w: any, wIdx: number) => (
                        <span
                          key={wIdx}
                          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                        >
                          "{w.key}" &rarr; {w.pos}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matches & Discards Stack */}
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-50 pt-3 border-t border-slate-800">
            {lang === 'es' ? 'Pila Acumulada (Matches)' : 'Accumulated Match Stack'}
          </div>
          <div className="max-h-[120px] overflow-y-auto space-y-2">
            {currentStepData?.stackState?.map((st: any, idx: number) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                <div className="flex justify-between font-mono text-[10px] text-pink-400 mb-1.5">
                  <span>{lang === 'es' ? 'Patrón: ' : 'Pattern: '}{st.pattern}</span>
                  <span>Matches: {st.matches.length} | {lang === 'es' ? 'Descarte: ' : 'Miss: '}{st.noMatches.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">✔ Matches: </span>
                    <span className="text-slate-300">{st.matches.map((m: any) => m.key).join(', ') || '-'}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-rose-400 font-bold">✖ Misses: </span>
                    <span className="text-slate-400">{st.noMatches.map((nm: any) => nm.key).join(', ') || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Extension & Matrices */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-50 border-b border-slate-800 pb-3">
            {lang === 'es' ? 'Extensión & Distancia' : 'Extension & Distance'}
          </div>

          {/* Alignment Table */}
          {currentStepData?.alignmentData ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 overflow-x-auto">
              <table className="w-full border-collapse text-center font-mono text-xs">
                <tbody>
                  <tr>
                    <td className="text-[10px] text-slate-500 p-1 text-right">S1</td>
                    {currentStepData.alignmentData.s1.map((c: string, k: number) => (
                      <td
                        key={k}
                        className={`p-1 rounded font-bold ${
                          k === currentStepData.alignmentData?.activeIndex
                            ? 'border-2 border-emerald-400 bg-emerald-600 text-slate-950'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[10px] text-slate-500 p-1 text-right">S2</td>
                    {currentStepData.alignmentData.s2.map((c: string, k: number) => (
                      <td
                        key={k}
                        className={`p-1 rounded font-bold ${
                          k === currentStepData.alignmentData?.activeIndex
                            ? 'border-2 border-emerald-400 bg-slate-800 text-slate-50'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[10px] text-slate-500 p-1 text-right">BLOSUM</td>
                    {currentStepData.alignmentData.scores.map((s: number, k: number) => (
                      <td
                        key={k}
                        onClick={() =>
                          setBlosumExplainer({
                            a: currentStepData.alignmentData!.s1[k],
                            b: currentStepData.alignmentData!.s2[k],
                            score: s,
                          })
                        }
                        className={`p-1 rounded font-bold cursor-pointer hover:opacity-80 ${
                          s >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {s >= 0 ? `+${s}` : s}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[10px] text-slate-500 p-1 text-right">Accum</td>
                    {currentStepData.alignmentData.accum.map((a: number, k: number) => (
                      <td key={k} className="p-1 rounded bg-slate-900 border border-slate-800 text-blue-400 font-bold">
                        {a}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500 italic">
              {lang === 'es' ? 'El alineamiento aparecerá tras indexar las coincidencias.' : 'The alignment will appear once matches are indexed.'}
            </div>
          )}

          {/* The scoring table is a teaching stand-in, not BLOSUM62. Say it where
              the reader is looking at the scores, not only in the docs. */}
          <p className="text-[10px] text-amber-400/80 leading-snug bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
            {t('core.demoMatrixHint')}
          </p>

          {/* Interactive Cell Explainer */}
          {blosumExplainer && (
            <div className="bg-purple-500/10 border border-purple-500/40 p-3 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-purple-400 flex items-center justify-between">
                <span>{t('core.demoMatrixTitle')}</span>
                <span className="font-mono text-sm font-bold">
                  {blosumExplainer.score >= 0 ? `+${blosumExplainer.score}` : blosumExplainer.score}
                </span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">
                S1(<code>{blosumExplainer.a}</code>) &times; S2(<code>{blosumExplainer.b}</code>)
              </p>
              <p className="text-slate-400 text-[10px]">
                {blosumExplainer.a === blosumExplainer.b
                  ? (lang === 'es' ? 'Coincidencia exacta de símbolo (+4).' : 'Exact symbol match (+4).')
                  : blosumExplainer.score >= 0
                  ? (lang === 'es' ? 'Sustitución conservadora favorable.' : 'Conservative favorable substitution.')
                  : (lang === 'es' ? 'Sustitución desfavorable penalizada.' : 'Unfavorable penalized substitution.')}
              </p>
            </div>
          )}

          {/* Final Distance Matrix Summary */}
          {currentStepData?.showMatrix && currentStepData.globalResults && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <table className="w-full border-collapse font-mono text-xs text-center">
                  <thead>
                    <tr className="text-[10px] text-slate-500 bg-slate-900">
                      <th className="p-1.5">-</th>
                      <th className="p-1.5">S1</th>
                      <th className="p-1.5">S2</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="p-1.5 text-[10px] text-slate-500">S1</th>
                      <td className="p-1.5 bg-slate-950 text-slate-600">0.0000</td>
                      <td className="p-1.5 bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                        {currentStepData.avgDist?.toFixed(4)}
                      </td>
                    </tr>
                    <tr>
                      <th className="p-1.5 text-[10px] text-slate-500">S2</th>
                      <td className="p-1.5 bg-purple-500/20 text-purple-400 font-bold border border-purple-500/40">
                        {currentStepData.avgDist?.toFixed(4)}
                      </td>
                      <td className="p-1.5 bg-slate-950 text-slate-600">0.0000</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Distance formula */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1">
                <div className="text-blue-400 font-bold">{t('core.distanceFormula')}</div>
                <div className="text-slate-400 text-[10px]">
                  d = -ln(1 - p - 0.2·p²) &emsp; [Kimura]
                </div>
                <div className="text-emerald-400 font-bold">
                  D<sub>S1,S2</sub> = {currentStepData.avgDist?.toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
