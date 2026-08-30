import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  HardDrive,
  Cpu,
  Send,
  Inbox,
  Network,
  Clock,
  MinusCircle,
  PowerOff,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  Info,
} from 'lucide-react';
import {
  STAGE_LABELS,
  VARIANTS,
  WALK_M,
  WALK_N,
  WALK_OWNERS,
  WALK_P,
  WALK_PLAN,
  WALK_SPECIES,
  WALK_TOTAL_PAIRS,
  type Bilingual,
  type RankStatus,
  type Variant,
  type WalkStep,
} from '../data/phaseWalkthrough';

/**
 * "How it works": one execution of each ProtSpaM variant, step by step.
 *
 * The module answers a single question — *what does this branch actually do,
 * and in what order* — for `seq`, the two phase-3 options and the two phase-4
 * variants. It deliberately models no timing at all: every step is a call the
 * branch makes, and the measured seconds live in the scalability module where
 * they were measured.
 */

/* ------------------------------------------------------------------ */
/* Presentation helpers                                               */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<
  RankStatus,
  { chip: string; lane: string; icon: React.FC<{ className?: string }> }
> = {
  io: {
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    lane: 'border-amber-500/40 bg-amber-500/5',
    icon: HardDrive,
  },
  compute: {
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    lane: 'border-emerald-500/40 bg-emerald-500/5',
    icon: Cpu,
  },
  send: {
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    lane: 'border-blue-500/40 bg-blue-500/5',
    icon: Send,
  },
  recv: {
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    lane: 'border-sky-500/40 bg-sky-500/5',
    icon: Inbox,
  },
  collective: {
    chip: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    lane: 'border-purple-500/40 bg-purple-500/5',
    icon: Network,
  },
  wait: {
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    lane: 'border-rose-500/40 bg-rose-500/5',
    icon: Clock,
  },
  idle: {
    chip: 'bg-slate-700/40 text-slate-400 border-slate-700',
    lane: 'border-slate-700 bg-slate-900/40',
    icon: MinusCircle,
  },
  off: {
    chip: 'bg-slate-800/60 text-slate-500 border-slate-800',
    lane: 'border-slate-800 bg-slate-950/60',
    icon: PowerOff,
  },
};

const NOTE_STYLE = {
  why: {
    box: 'border-blue-500/40 bg-blue-500/10',
    title: 'text-blue-300',
    icon: Lightbulb,
  },
  flag: {
    box: 'border-amber-500/40 bg-amber-500/10',
    title: 'text-amber-300',
    icon: AlertTriangle,
  },
  data: {
    box: 'border-emerald-500/40 bg-emerald-500/10',
    title: 'text-emerald-300',
    icon: BarChart3,
  },
} as const;

/** One colour per rank, reused by the lanes, the plan table and the pair grid. */
const RANK_COLOR = [
  { text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' },
  { text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
  { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50' },
];

const SPEEDS = [0.5, 1, 2] as const;

export const PhaseWalkthrough: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();
  const say = useCallback((text: Bilingual) => (lang === 'es' ? text.es : text.en), [lang]);

  const [variantId, setVariantId] = useState<string>(VARIANTS[0].id);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const timerRef = useRef<number | null>(null);

  const variant: Variant = useMemo(
    () => VARIANTS.find((v) => v.id === variantId) ?? VARIANTS[0],
    [variantId],
  );
  const steps = variant.steps;
  const step: WalkStep = steps[Math.min(stepIndex, steps.length - 1)];
  const atEnd = stepIndex >= steps.length - 1;

  // Autoplay stops at the last step rather than looping: the point of the
  // module is the order of the calls, and restarting mid-read hides it.
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 3400 / speed);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, steps.length]);

  const selectVariant = (id: string) => {
    setVariantId(id);
    setStepIndex(0);
    setIsPlaying(false);
  };

  const reset = () => {
    setStepIndex(0);
    setIsPlaying(false);
  };

  const isSeq = variant.ranks === 1;
  const messages = step.messages ?? [];
  const orderedMessages = [...messages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="space-y-4">
      {/* ---------------- Header + honesty banner ---------------- */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-50">{t('walk.title')}</h2>
          <p className="text-xs sm:text-[13px] text-slate-400 mt-1 max-w-4xl leading-relaxed">
            {t('walk.subtitle')}
          </p>
        </div>

        <div className="flex items-start gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
            {t('walk.honesty')}
          </p>
        </div>
      </div>

      {/* ---------------- Variant tabs ---------------- */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold w-full sm:w-auto">
            {t('walk.variant')}
          </span>
          <div
            className="flex flex-wrap gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800"
            role="tablist"
            aria-label={t('walk.variant')}
          >
            {VARIANTS.map((v, i) => {
              const active = v.id === variant.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectVariant(v.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                    active
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <span className="opacity-60 mr-1.5">{i + 1}</span>
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[13px] text-slate-300 leading-relaxed max-w-4xl">
          {say(variant.tagline)}
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
            {t('walk.changes')}
          </span>
          <p className="text-xs text-slate-400 leading-relaxed">{say(variant.changes)}</p>
          <a
            href={variant.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-blue-400 hover:text-emerald-400 transition-colors pt-1"
          >
            <span>{variant.branch}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ---------------- Player ---------------- */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setStepIndex((p) => Math.max(0, p - 1));
            }}
            disabled={stepIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-50 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('walk.prev')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setStepIndex((p) => Math.min(steps.length - 1, p + 1));
            }}
            disabled={atEnd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>{t('walk.next')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={atEnd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-50 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPlaying ? t('walk.pause') : t('walk.play')}</span>
          </button>

          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-50 hover:border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('walk.reset')}</span>
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">
              {t('walk.speed')}
            </span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors ${
                  speed === s
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">
              {t('walk.step')} {stepIndex} {t('walk.of')} {steps.length - 1}
            </span>
            <span className="text-slate-500">
              {variant.branch} · {isSeq ? '1' : WALK_P}{' '}
              {isSeq ? t('walk.process') : t('walk.processes')}
            </span>
          </div>
          <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(stepIndex / Math.max(1, steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Stage timeline */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGE_LABELS.map((s) => {
            const active = s.stage === step.stage;
            return (
              <div
                key={s.stage}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                <span className="font-mono opacity-70">{s.stage}</span>
                <span>{say(s.label)}</span>
                {active && (
                  <span className="font-mono text-[10px] opacity-70 hidden sm:inline">
                    {say(s.cost)}
                  </span>
                )}
              </div>
            );
          })}
          <div
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono ml-auto ${
              step.timer === 'none'
                ? 'bg-slate-950 border-slate-800 text-slate-500'
                : 'bg-blue-500/15 border-blue-500/50 text-blue-300 font-bold'
            }`}
          >
            {step.timer === 'none'
              ? t('walk.timerNone')
              : step.timer === 'phase3'
                ? t('walk.timerPhase3')
                : t('walk.timerPhase4')}
          </div>
        </div>
      </div>

      {/* ---------------- The step itself ---------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Left: ranks + traffic */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            {isSeq ? t('walk.process') : t('walk.ranks')}
          </span>

          <div className={`grid gap-2 ${isSeq ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {step.ranks.map((rank, index) => {
              const style = STATUS_STYLE[rank.status];
              const Icon = style.icon;
              const color = RANK_COLOR[index % RANK_COLOR.length];
              const pairs = step.pairsDone?.[index];
              return (
                <div
                  key={index}
                  className={`rounded-xl border p-3 space-y-2 transition-colors ${style.lane}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-mono font-bold ${color.text}`}>
                      {isSeq ? t('walk.singleProcess') : `rank ${index}`}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-medium ${style.chip}`}
                  >
                    {say(rank.label)}
                  </div>
                  {pairs !== undefined && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {t('walk.pairsDone')}: {pairs}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Traffic on this step */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              {t('walk.messages')}
            </span>
            {orderedMessages.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-950 border border-slate-800 rounded-xl p-3">
                {t('walk.noMessages')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {orderedMessages.map((message, index) => {
                  const serial = message.kind === 'serial' && message.order !== undefined;
                  const tone =
                    message.kind === 'collective'
                      ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                      : message.kind === 'burst'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-300';
                  return (
                    <li
                      key={index}
                      className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono ${tone}`}
                    >
                      {serial && (
                        <span className="w-4 h-4 rounded-full bg-slate-950/60 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {message.order}
                        </span>
                      )}
                      <span className="font-bold">rank {message.from}</span>
                      <span aria-hidden="true">──▶</span>
                      <span className="font-bold">rank {message.to}</span>
                      <span className="opacity-80">{say(message.payload)}</span>
                    </li>
                  );
                })}
                <li className="text-[10px] text-slate-500 pt-1 leading-relaxed">
                  {messages.some((m) => m.kind === 'burst')
                    ? t('walk.legendBurst')
                    : messages.some((m) => m.order !== undefined)
                      ? t('walk.legendSerial')
                      : ''}
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Right: narration */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-50 leading-snug">
            {say(step.title)}
          </h3>

          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-0.5">
              {t('walk.call')}
            </span>
            <code className="text-[11px] sm:text-xs font-mono text-emerald-300 break-words">
              {step.call}
            </code>
          </div>

          <p className="text-[13px] text-slate-300 leading-relaxed">{say(step.detail)}</p>

          {step.code && (
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto text-[10.5px] sm:text-[11px] font-mono text-slate-300 leading-relaxed">
              <code>{step.code}</code>
            </pre>
          )}

          {step.notes?.map((note, index) => {
            const style = NOTE_STYLE[note.kind];
            const Icon = style.icon;
            return (
              <div
                key={index}
                className={`flex items-start gap-2.5 rounded-xl border p-3 ${style.box}`}
              >
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.title}`} />
                <div className="space-y-1 min-w-0">
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider font-bold block ${style.title}`}
                  >
                    {note.kind === 'why'
                      ? t('walk.noteWhy')
                      : note.kind === 'flag'
                        ? t('walk.noteFlag')
                        : t('walk.noteData')}
                  </span>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{say(note.text)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- Variant summary ---------------- */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
          {t('walk.summary')} · {variant.branch}
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {variant.summary.map((row, index) => (
            <div
              key={index}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5"
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                {say(row.label)}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">{say(row.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- The scenario, spelled out ---------------- */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            {t('walk.scenario')}
          </span>
          <p className="text-xs text-slate-400 leading-relaxed mt-1.5 max-w-4xl">
            {t('walk.scenarioNote')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Species */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              {t('walk.speciesTable')} · N = {WALK_N} · P = {WALK_P} · m = {WALK_M}
            </span>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-[11px] font-mono">
                <thead className="bg-slate-950 text-slate-500">
                  <tr>
                    <th className="text-left px-2.5 py-2 font-bold">i</th>
                    <th className="text-left px-2.5 py-2 font-bold">{t('walk.colSpecies')}</th>
                    <th className="text-right px-2.5 py-2 font-bold">Maa</th>
                    <th className="text-right px-2.5 py-2 font-bold">{t('walk.colOwner')}</th>
                  </tr>
                </thead>
                <tbody>
                  {WALK_SPECIES.map((s) => {
                    const owner = WALK_OWNERS[s.index];
                    const color = RANK_COLOR[owner % RANK_COLOR.length];
                    return (
                      <tr key={s.index} className="border-t border-slate-800/80">
                        <td className="px-2.5 py-1.5 text-slate-500">{s.index}</td>
                        <td className="px-2.5 py-1.5 text-slate-300">
                          <span className="font-bold">{s.code}</span>
                          <span className="text-slate-500 ml-1.5 hidden sm:inline">{s.name}</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-slate-300">
                          {s.maa.toFixed(2)}
                        </td>
                        <td className={`px-2.5 py-1.5 text-right font-bold ${color.text}`}>
                          rank {owner}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pair grid */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              {t('walk.pairsGrid')} · {WALK_TOTAL_PAIRS} {t('walk.pairs')}
            </span>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto">
              <table className="text-[10px] font-mono border-collapse mx-auto">
                <tbody>
                  {WALK_SPECIES.map((rowSpecies) => (
                    <tr key={rowSpecies.index}>
                      <td className="pr-2 text-slate-500 text-right">{rowSpecies.index}</td>
                      {WALK_SPECIES.map((colSpecies) => {
                        const i = rowSpecies.index;
                        const j = colSpecies.index;
                        if (i === j) {
                          return (
                            <td key={j} className="p-0">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-600">
                                0
                              </div>
                            </td>
                          );
                        }
                        if (i > j) {
                          return (
                            <td key={j} className="p-0">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 border border-slate-800/60 bg-slate-950 flex items-center justify-center text-slate-700">
                                ·
                              </div>
                            </td>
                          );
                        }
                        const owner = WALK_OWNERS[i];
                        const color = RANK_COLOR[owner % RANK_COLOR.length];
                        return (
                          <td key={j} className="p-0">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 border flex items-center justify-center font-bold ${color.bg} ${color.border} ${color.text}`}
                              title={`(${i}, ${j}) → rank ${owner}`}
                            >
                              {owner}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td />
                    {WALK_SPECIES.map((s) => (
                      <td key={s.index} className="pt-1 text-center text-slate-500">
                        {s.index}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{t('walk.gridLegend')}</p>
          </div>
        </div>

        {/* Per-rank plan */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            {t('walk.planTable')}
          </span>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-[11px] font-mono min-w-[560px]">
              <thead className="bg-slate-950 text-slate-500">
                <tr>
                  <th className="text-left px-2.5 py-2 font-bold">rank</th>
                  <th className="text-left px-2.5 py-2 font-bold">{t('walk.colOwns')}</th>
                  <th className="text-right px-2.5 py-2 font-bold">{t('walk.colPairs')}</th>
                  <th className="text-right px-2.5 py-2 font-bold">{t('walk.colOwnMaa')}</th>
                  <th className="text-right px-2.5 py-2 font-bold">{t('walk.colPairMaa')}</th>
                  <th className="text-left px-2.5 py-2 font-bold">{t('walk.colNeeds')}</th>
                </tr>
              </thead>
              <tbody>
                {WALK_PLAN.map((plan) => {
                  const color = RANK_COLOR[plan.rank % RANK_COLOR.length];
                  return (
                    <tr key={plan.rank} className="border-t border-slate-800/80">
                      <td className={`px-2.5 py-1.5 font-bold ${color.text}`}>{plan.rank}</td>
                      <td className="px-2.5 py-1.5 text-slate-300">
                        {plan.species.map((i) => WALK_SPECIES[i].code).join(', ')}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-slate-300">
                        {plan.pairs.length}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-slate-300">
                        {plan.ownMaa.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right text-slate-100 font-bold">
                        {plan.pairMaa.toFixed(1)}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-400">
                        {plan.needs.length === 0 ? '—' : plan.needs.join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-4xl">
            {t('walk.planNote')}
          </p>
        </div>
      </div>
    </div>
  );
};
