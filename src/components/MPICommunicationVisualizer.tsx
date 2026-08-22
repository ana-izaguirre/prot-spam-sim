import React, { useState, useEffect, useRef } from 'react';
import { useAppLanguageTheme } from '../context/LanguageThemeContext';
import { Play, Pause, RotateCcw, FastForward, CheckCircle2, Clock, Zap, ArrowRight, ShieldAlert } from 'lucide-react';

type Mode = 'metacache' | 'isend';

export const MPICommunicationVisualizer: React.FC = () => {
  const { lang, t } = useAppLanguageTheme();
  const [mode, setMode] = useState<Mode>('isend');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animStep, setAnimStep] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const maxSteps = 12;

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 1200 / speed;
      timerRef.current = window.setInterval(() => {
        setAnimStep((prev) => (prev >= maxSteps ? 0 : prev + 1));
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed]);

  const resetAnimation = () => {
    setAnimStep(0);
    setIsPlaying(false);
  };

  // State definitions based on animStep
  const isSendActive = (rank: number) => {
    if (mode === 'metacache') {
      return animStep === rank * 2 - 1;
    } else {
      return animStep >= 1 && animStep <= 3;
    }
  };

  const isComputing = (rank: number) => {
    if (mode === 'metacache') {
      return animStep >= rank * 2 && animStep < rank * 2 + 2;
    } else {
      return animStep >= 3 && animStep <= 9;
    }
  };

  const isIdleWaiting = (rank: number) => {
    if (mode === 'metacache') {
      return !isSendActive(rank) && !isComputing(rank) && animStep < 10;
    } else {
      return animStep === 0;
    }
  };

  const isSynchronized = animStep >= 10;

  // PendingSend buffer items for isend
  const pendingRequests = [
    { id: 1, target: 'Rank 1', state: animStep >= 1 ? (animStep >= 10 ? t('mpi.stateCompleted') : t('mpi.stateActive')) : t('mpi.stateQueued'), bytes: '1.4 MB' },
    { id: 2, target: 'Rank 2', state: animStep >= 2 ? (animStep >= 10 ? t('mpi.stateCompleted') : t('mpi.stateActive')) : t('mpi.stateQueued'), bytes: '1.4 MB' },
    { id: 3, target: 'Rank 3', state: animStep >= 2 ? (animStep >= 10 ? t('mpi.stateCompleted') : t('mpi.stateActive')) : t('mpi.stateQueued'), bytes: '1.4 MB' },
    { id: 4, target: 'Rank 4', state: animStep >= 3 ? (animStep >= 10 ? t('mpi.stateCompleted') : t('mpi.stateActive')) : t('mpi.stateQueued'), bytes: '1.4 MB' },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header & Mode Tabs */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('mpi.mechanism')}
          </span>
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setMode('metacache');
                setAnimStep(0);
              }}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors text-center ${
                mode === 'metacache'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('mpi.blocking')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('isend');
                setAnimStep(0);
              }}
              className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-lg transition-colors text-center ${
                mode === 'isend'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('mpi.nonblocking')}
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 bg-emerald-500 text-slate-950 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-400 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? t('core.pause') : t('core.play')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAnimStep((s) => Math.min(s + 1, maxSteps))}
            className="bg-slate-950 border border-slate-800 text-slate-200 p-2 rounded-lg text-xs hover:border-slate-600 transition-colors"
            title={t('mpi.stepForward')}
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetAnimation}
            className="bg-slate-950 border border-slate-800 text-slate-400 p-2 rounded-lg text-xs hover:text-slate-200 transition-colors"
            title={t('mpi.reset')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-mono mr-1">{t('mpi.speed')}</span>
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                  speed === s ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Visual Schema Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visual Pipeline Grid (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 min-h-[400px]">
          {/* Header Status Bar */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono uppercase tracking-wider ${
                  mode === 'metacache' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {lang === 'es' ? 'Paso' : 'Step'} {animStep}/{maxSteps}: {mode === 'metacache' ? (lang === 'es' ? 'SERIALIZACIÓN BLOQUEANTE' : 'BLOCKING SERIALIZATION') : (lang === 'es' ? 'RÁFAGA ASÍNCRONA + OVERLAP' : 'ASYNC BURST + OVERLAP')}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              {mode === 'metacache' ? (lang === 'es' ? 'Contención por Rendezvous MPI' : 'MPI Rendezvous Contention') : (lang === 'es' ? 'Solapamiento Cómputo/Comunicación' : 'Compute/Communication Overlap')}
            </div>
          </div>

          {/* Graphical Node Scheme: Master (Rank 0) -> Network -> Worker Ranks */}
          <div className="grid grid-cols-12 gap-3 items-center relative py-2">
            {/* Rank 0 (Master / Root) */}
            <div className="col-span-3 bg-slate-950 border-2 border-blue-500/70 rounded-xl p-3.5 flex flex-col items-center text-center shadow-lg relative">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs mb-1.5">
                R0
              </div>
              <div className="text-xs font-bold text-white">Rank 0 (Master)</div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                {mode === 'metacache'
                  ? animStep % 2 === 1
                    ? (lang === 'es' ? '🛑 Bloqueado en MPI_Send' : '🛑 Blocked in MPI_Send')
                    : (lang === 'es' ? 'Preparando bloque' : 'Preparing block')
                  : animStep < 4
                  ? (lang === 'es' ? '⚡ Disparando MPI_Isend' : '⚡ Bursting MPI_Isend')
                  : (lang === 'es' ? '🚀 Cómputo BLOSUM62' : '🚀 BLOSUM62 Compute')}
              </div>

              {/* Status Indicator */}
              <div className="mt-2.5 text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-slate-900 border border-slate-800 text-blue-400">
                {mode === 'metacache' ? (lang === 'es' ? `Envío a Rank ${Math.min(Math.ceil((animStep + 1) / 2), 4)}` : `Send to Rank ${Math.min(Math.ceil((animStep + 1) / 2), 4)}`) : 'Non-blocking I/O'}
              </div>
            </div>

            {/* In-Flight Network Channels (Col span 4) */}
            <div className="col-span-4 flex flex-col justify-around h-full py-1 space-y-3 relative">
              {[1, 2, 3, 4].map((rankId) => {
                const active = isSendActive(rankId);
                return (
                  <div key={rankId} className="relative flex items-center h-6">
                    <div className="w-full h-0.5 bg-slate-800 relative">
                      {active && (
                        <div
                          className={`absolute top-[-5px] w-3 h-3 rounded-full shadow-md transition-all ${
                            mode === 'metacache'
                              ? 'bg-rose-500 animate-ping'
                              : 'bg-emerald-400 packet-move-anim'
                          }`}
                        />
                      )}
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 ${active ? (mode === 'metacache' ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-700'}`} />
                  </div>
                );
              })}
            </div>

            {/* Worker Nodes (Rank 1 to 4) */}
            <div className="col-span-5 space-y-2">
              {[1, 2, 3, 4].map((rankId) => {
                const activeSend = isSendActive(rankId);
                const computing = isComputing(rankId);
                const idle = isIdleWaiting(rankId);

                return (
                  <div
                    key={rankId}
                    className={`border rounded-xl p-2.5 flex justify-between items-center transition-all ${
                      computing
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-200'
                        : activeSend
                        ? mode === 'metacache'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : idle
                        ? 'bg-slate-950 border-slate-800 opacity-60 text-slate-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400">R{rankId}</span>
                      <span className="text-xs font-medium">Rank {rankId}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {computing ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500 text-slate-950 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {lang === 'es' ? 'Cómputo BLOSUM' : 'BLOSUM Compute'}
                        </span>
                      ) : activeSend ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          mode === 'metacache' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-slate-950'
                        }`}>
                          {mode === 'metacache' ? (lang === 'es' ? '🛑 Recibiendo (Bloqueado)' : '🛑 Receiving (Blocked)') : (lang === 'es' ? '📥 Recibiendo Isend' : '📥 Receiving Isend')}
                        </span>
                      ) : isSynchronized ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {lang === 'es' ? 'Listo (MPI_Waitall)' : 'Ready (MPI_Waitall)'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {lang === 'es' ? 'Espera ociosa' : 'Idle Wait'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Execution Timeline Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1.5">
              <span>{t('mpi.trafficTimeline')}</span>
              <span>{animStep >= 10 ? (lang === 'es' ? '✔ Sincronización Final (MPI_Waitall)' : '✔ Collective Sync (MPI_Waitall)') : (lang === 'es' ? 'En progreso...' : 'In progress...')}</span>
            </div>
            <div className="grid grid-cols-12 gap-1 h-3 rounded-full overflow-hidden bg-slate-900 p-0.5">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-full rounded-sm transition-colors ${
                    idx < animStep
                      ? mode === 'metacache'
                        ? idx % 2 === 0
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                        : 'bg-emerald-500'
                      : idx === animStep
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1.5">
              <span>{lang === 'es' ? 't=0s (Inicio Fase 4)' : 't=0s (Phase 4 Start)'}</span>
              <span>{lang === 'es' ? 't=50% (Tráfico en Red)' : 't=50% (Network Traffic)'}</span>
              <span>{lang === 'es' ? 't=100% (Reduce Final)' : 't=100% (Final Reduce)'}</span>
            </div>
          </div>
        </div>

        {/* Right Info Panel: PendingSend Buffer & HPC Analysis */}
        <div className="space-y-4">
          {/* PendingSend Buffer State */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-400" />
                {t('mpi.queueTitle')}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {mode === 'isend' ? (lang === 'es' ? 'Buffer Activo' : 'Active Buffer') : (lang === 'es' ? 'No disponible' : 'N/A')}
              </span>
            </div>

            {mode === 'isend' ? (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-bold">Req #{req.id}</span>
                      <span className="text-slate-300">&rarr; {req.target}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{req.bytes}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          req.state === t('mpi.stateCompleted')
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : req.state === t('mpi.stateActive')
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {req.state}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-400 mt-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  📌 <strong className="text-slate-200">MPI_Waitall:</strong> {lang === 'es' ? 'Consolida todas las solicitudes pendientes en un único punto de sincronización, liberando el bus de datos y evitando bloqueos intermedios.' : 'Aggregates all pending requests into a single synchronization barrier, unblocking the data bus and avoiding step stalls.'}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-rose-500" />
                <p className="text-rose-400 font-bold">
                  {lang === 'es' ? 'metacache usa MPI_Send síncrono' : 'metacache uses synchronous MPI_Send'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {lang === 'es' ? 'No existe buffer PendingSend. Cada proceso emisor debe esperar obligatoriamente a que el receptor complete la lectura antes de continuar.' : 'No PendingSend buffer exists. Each sender must wait for the receiver handshake before proceeding.'}
                </p>
              </div>
            )}
          </div>

          {/* Comparison Summary Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-xs space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-white">
              {lang === 'es' ? 'Diagnóstico de Rendimiento' : 'HPC Performance Diagnostic'}
            </h4>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-500 text-[10px]">{lang === 'es' ? 'TIEMPO OCIOSO' : 'IDLE WAIT TIME'}</div>
                <div className={`font-bold mt-0.5 ${mode === 'metacache' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {mode === 'metacache' ? '~58.4% (High)' : '~8.2% (Minimal)'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-500 text-[10px]">{lang === 'es' ? 'SOLAPAMIENTO' : 'OVERLAP RATIO'}</div>
                <div className={`font-bold mt-0.5 ${mode === 'metacache' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {mode === 'metacache' ? '0% (None)' : '85% (Optimal)'}
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
              {mode === 'metacache'
                ? (lang === 'es' ? 'Con >64 procesos, el tiempo de bloqueo en MPI_Send supera al tiempo de cómputo, provocando la caída de aceleración observada en benchmarks HPC.' : 'With >64 processes, blocking time in MPI_Send dwarfs computation, triggering the speedup drop observed in HPC benchmarks.')
                : (lang === 'es' ? 'isend permite que los cores sigan procesando extensiones BLOSUM mientras los buffers TCP/InfiniBand transmiten los datos en segundo plano.' : 'isend lets CPU cores compute BLOSUM matches concurrently while network controllers stream data in the background.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
