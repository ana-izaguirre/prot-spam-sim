import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { LanguageThemeProvider, useAppLanguageTheme } from './context/LanguageThemeContext';

// The landing module is imported eagerly: it is what the visitor sees first and
// what Astro prerenders into the HTML. Every other module is a separate chunk,
// fetched the first time it is opened, so a reader who never leaves the base
// algorithm never downloads Chart.js or the branch dossier.
import { ProtSpamStepSimulator } from './components/ProtSpamStepSimulator';

import {
  Layers,
  Zap,
  Grid,
  TrendingUp,
  ShieldCheck,
  Binary,
  BookOpen,
  X,
  Sparkles,
  Github,
  Download,
  ExternalLink,
  GitBranch,
  GraduationCap,
  Sun,
  Moon,
  Globe,
  FileText,
  CheckCircle2,
  Menu,
  ChevronDown,
} from 'lucide-react';

const TFMBranchExplorer = lazy(() =>
  import('./components/TFMBranchExplorer').then((m) => ({ default: m.TFMBranchExplorer })),
);
const WorkloadSimulator = lazy(() =>
  import('./components/WorkloadSimulator').then((m) => ({ default: m.WorkloadSimulator })),
);
const MPICommunicationVisualizer = lazy(() =>
  import('./components/MPICommunicationVisualizer').then((m) => ({
    default: m.MPICommunicationVisualizer,
  })),
);
const TriangularMatrixExplorer = lazy(() =>
  import('./components/TriangularMatrixExplorer').then((m) => ({
    default: m.TriangularMatrixExplorer,
  })),
);
const ScalabilityCharts = lazy(() =>
  import('./components/ScalabilityCharts').then((m) => ({ default: m.ScalabilityCharts })),
);
const NumericCorrectness = lazy(() =>
  import('./components/NumericCorrectness').then((m) => ({ default: m.NumericCorrectness })),
);

type SectionId = 'core_sim' | 'tfm_branches' | 'workload' | 'mpi_comm' | 'matrix' | 'scalability' | 'correctness';

/**
 * Placeholder shown while a module chunk is in flight. It mirrors the shared
 * module frame (header card plus body card) so the layout does not jump when the
 * real module arrives.
 */
function ModuleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-live="polite">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="h-4 w-64 max-w-full rounded bg-slate-800" />
        <div className="h-3 w-96 max-w-full rounded bg-slate-800/70" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 h-72" />
      <span className="sr-only">Loading module…</span>
    </div>
  );
}

function AppContent() {
  // Default to 'core_sim' so the user directly experiences the base Prot-SpaM simulator!
  const [activeSection, setActiveSection] = useState<SectionId>('core_sim');
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [moreNavOpen, setMoreNavOpen] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const { lang, setLang, theme, toggleTheme, t } = useAppLanguageTheme();
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close 'More' dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setMoreNavOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigationItems: Array<{ id: SectionId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'core_sim', label: t('app.coreSim'), icon: Binary },
    { id: 'tfm_branches', label: t('app.tfmBranches'), icon: GitBranch },
    { id: 'workload', label: t('app.workload'), icon: Layers },
    { id: 'mpi_comm', label: t('app.mpiComm'), icon: Zap },
    { id: 'matrix', label: t('app.matrix'), icon: Grid },
    { id: 'scalability', label: t('app.scalability'), icon: TrendingUp },
    { id: 'correctness', label: t('app.correctness'), icon: ShieldCheck },
  ];

  const branches = [
    { name: 'feat/mpi-phase4-metacache-isend', desc: lang === 'es' ? 'Versión MPI no bloqueante recomendada (isend + PendingSend)' : 'Recommended non-blocking MPI version (isend + PendingSend)', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend' },
    { name: 'feat/mpi-phase4-metacache', desc: lang === 'es' ? 'Fase 4 bloqueante con caché de metadatos (MPI_Send)' : 'Blocking Phase 4 with metadata cache (MPI_Send)', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache' },
    { name: 'feat/mpi-phase3-a', desc: lang === 'es' ? 'Fase 3 paralela con lectura centralizada en Rank 0' : 'Parallel Phase 3 with centralized reading at Rank 0', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-a' },
    { name: 'feat/mpi-phase3-b', desc: lang === 'es' ? 'Fase 3 paralela con lectura distribuida de disco' : 'Parallel Phase 3 with distributed disk reading', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-b' },
    { name: 'feat/seq', desc: lang === 'es' ? 'Línea base secuencial limpia con checksum de palabras' : 'Clean sequential baseline with word checksum', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/seq' },
    { name: 'feat/mpi-phase4-metacache-isend-calcopt', desc: lang === 'es' ? 'Optimización de precálculo en ruta secuencial np=1' : 'Pattern precomputation on sequential path np=1', url: 'https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend-calcopt' },
  ];

  // jsPDF and its html2canvas dependency are ~390 kB that only matter when the
  // visitor actually asks for the factsheet, so the module is fetched on demand.
  const handleDownloadTFMInfo = async () => {
    try {
      const { generateTFMPdf } = await import('./utils/generatePdf');
      generateTFMPdf(lang);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Bar: Responsive with clean zone spacing */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-5 py-2">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-sm">
              &Pi;
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm text-slate-50 tracking-tight whitespace-nowrap">
                {t('app.title')}
              </span>
              <span className="text-[9px] text-slate-400 font-mono hidden sm:inline leading-none">
                {t('app.subtitle')}
              </span>
            </div>
          </div>

          {/* Zone 2: Desktop Navigation Links (Responsive with 'More' dropdown on intermediate screens) */}
          <nav className="hidden lg:flex items-center gap-1 py-0.5 justify-center">
            {/* Primary 4 Modules */}
            {navigationItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-slate-50 hover:bg-slate-900 border border-transparent hover:border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Next Modules (Visible directly on 2xl, or inside 'More' dropdown on lg/xl) */}
            <div className="hidden 2xl:flex items-center gap-1">
              {navigationItems.slice(4).map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                        : 'text-slate-400 hover:text-slate-50 hover:bg-slate-900 border border-transparent hover:border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 'More' dropdown for lg & xl viewports */}
            <div className="relative 2xl:hidden" ref={moreDropdownRef}>
              <button
                type="button"
                onClick={() => setMoreNavOpen(!moreNavOpen)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  navigationItems.slice(4).some((it) => it.id === activeSection)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-50 hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
              >
                <span>{t('app.more')}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {moreNavOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                  {navigationItems.slice(4).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          setMoreNavOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-slate-50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-emerald-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Actions & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language Selector */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-mono font-bold">
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-1.5 sm:px-2 py-1 rounded-md transition-colors text-[11px] ${
                  lang === 'es' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-50'
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-1.5 sm:px-2 py-1 rounded-md transition-colors text-[11px] ${
                  lang === 'en' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-50'
                }`}
              >
                EN
              </button>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-50 transition-colors"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
            </button>

            {/* GitHub Repo */}
            <a
              href="https://github.com/ana-izaguirre/ProtSpaM"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="GitHub repository"
            >
              <Github className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('app.github')}</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            {/* TFM Modal */}
            <button
              type="button"
              onClick={() => setShowDocsModal(true)}
              className="hidden sm:flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{t('app.docs')}</span>
            </button>

            {/* Hamburger Button for Mobile / Tablet */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-1.5 rounded-lg border transition-colors ${
                mobileMenuOpen
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-50'
              }`}
              title="Toggle Menu"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 pt-2 border-t border-slate-800 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-1 font-bold">
              {lang === 'es' ? 'Secciones y Módulos' : 'Sections & Modules'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900/60 text-slate-300 hover:text-slate-50 hover:bg-slate-900 border border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-emerald-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-slate-950"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions inside mobile drawer */}
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setShowDocsModal(true);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 py-2 px-3 rounded-xl font-bold"
              >
                <GraduationCap className="w-4 h-4" />
                <span>{t('app.docs')}</span>
              </button>
              <a
                href="https://github.com/ana-izaguirre/ProtSpaM"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 py-2 px-3 rounded-xl font-medium"
              >
                <Github className="w-4 h-4 text-slate-400" />
                <span>{t('app.github')}</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 md:p-6 space-y-4">
        {/* TFM Reference Header Banner */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-200 font-medium flex flex-wrap items-center gap-2">
                <span>{t('app.bannerTitle')}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                  UDC / CESGA
                </span>
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                {t('app.author')}: <strong className="text-slate-200 font-medium">Ana Izaguirre Matamoros</strong> &middot; {t('app.director')}: <strong className="text-slate-200 font-medium">Jorge González Domínguez</strong> &middot; {t('app.system')} FinisTerrae III
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
            <button
              type="button"
              onClick={handleDownloadTFMInfo}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{downloadSuccess ? t('app.downloaded') : t('app.downloadFicha')}</span>
            </button>
            <a
              href="https://github.com/ana-izaguirre/ProtSpaM"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{t('app.branchRepo')}</span>
            </a>
          </div>
        </div>

        {/* Dynamic Section Renderer — every module but the landing one is a
            separately fetched chunk, so the frame below stands in while it loads. */}
        <Suspense fallback={<ModuleSkeleton />}>
          {activeSection === 'core_sim' && <ProtSpamStepSimulator />}
          {activeSection === 'tfm_branches' && <TFMBranchExplorer />}
          {activeSection === 'workload' && <WorkloadSimulator />}
          {activeSection === 'mpi_comm' && <MPICommunicationVisualizer />}
          {activeSection === 'matrix' && <TriangularMatrixExplorer />}
          {activeSection === 'scalability' && <ScalabilityCharts />}
          {activeSection === 'correctness' && <NumericCorrectness />}
        </Suspense>
      </main>

      {/* Documentation / Theoretical Architecture & TFM Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-50 tracking-wide">
                    {lang === 'es' ? 'Memoria del TFM & Arquitectura HPC' : 'TFM Master\'s Thesis & HPC Architecture'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Máster Interuniversitario en Computación de Altas Prestaciones (UDC / CESGA)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Academic Sheet */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold font-mono">
                    {lang === 'es' ? 'Trabajo de Fin de Máster' : 'Master\'s Thesis'}
                  </div>
                  <h3 className="text-sm font-bold text-slate-50 mt-1 leading-snug">
                    {t('app.bannerTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTFMInfo}
                  className="flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadSuccess ? t('app.downloaded') : t('app.downloadFicha')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">{t('app.author')}</span>
                  <span className="text-slate-200 font-semibold">Ana Izaguirre Matamoros</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">{t('app.director')}</span>
                  <span className="text-slate-200 font-semibold">Jorge González Domínguez</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">{t('app.system')}</span>
                  <span className="text-slate-200 font-semibold">FinisTerrae III (CESGA)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">{t('app.date')}</span>
                  <span className="text-slate-200 font-semibold">29/07/2026</span>
                </div>
              </div>
            </div>

            {/* GitHub Branches Directory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-emerald-400" />
                  {lang === 'es' ? 'Ramas de Desarrollo en GitHub' : 'GitHub Development Branches'}
                </span>
                <a
                  href="https://github.com/ana-izaguirre/ProtSpaM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <span>github.com/ana-izaguirre/ProtSpaM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {branches.map((b) => (
                  <a
                    key={b.name}
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all text-xs space-y-1 block group"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-blue-400 group-hover:text-emerald-400 font-semibold truncate max-w-[240px]">
                        {b.name}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-300 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {b.desc}
                    </p>
                  </a>
                ))}
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="text-xs space-y-3.5 leading-relaxed text-slate-300 pt-2 border-t border-slate-800">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-blue-400 uppercase text-[11px] mb-1.5">
                  {lang === 'es' ? '1. Algoritmo 1: Partición Cíclica de la Media Matriz' : '1. Algorithm 1: Cyclic Partitioning of Half Matrix'}
                </h4>
                <p className="text-slate-400">
                  {lang === 'es'
                    ? 'La matriz de distancias es simétrica y solo se calcula la mitad superior j > i con N(N - 1) / 2 pares. El Algoritmo 1 asigna la fila i al rank i mod P, compensando las filas pesadas (ej. fila 0 con N-1 comparaciones) con filas ligeras (fila N-2 con 1 comparación).'
                    : 'The distance matrix is symmetric; only the upper triangle j > i is computed with N(N - 1) / 2 pairs. Algorithm 1 assigns row i to rank i mod P, balancing heavy rows (e.g. row 0 with N-1 comparisons) with light rows (row N-2 with 1 comparison).'}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-emerald-400 uppercase text-[11px] mb-1.5">
                  {lang === 'es' ? '2. Comunicación Asíncrona: isend vs metacache' : '2. Asynchronous Communication: isend vs metacache'}
                </h4>
                <p className="text-slate-400">
                  {lang === 'es'
                    ? 'metacache emplea MPI_Send bloqueante que sufre contención a partir de 64 procesos. isend dispara ráfagas no bloqueantes con MPI_Isend en colas PendingSend y sincroniza una sola vez con MPI_Waitall, logrando un 45% más de rendimiento en 128 procesos.'
                    : 'metacache relies on blocking MPI_Send which encounters network contention beyond 64 processes. isend fires non-blocking MPI_Isend bursts using PendingSend queues and synchronizes via MPI_Waitall, yielding up to 45% higher throughput at 128 processes.'}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-orange-400 uppercase text-[11px] mb-1.5">
                  {lang === 'es' ? '3. Invarianza Numérica y Cero Error en Coma Flotante' : '3. Numerical Invariance & Zero Floating-Point Error'}
                </h4>
                <p className="text-slate-400">
                  {lang === 'es'
                    ? 'Al procesar cada par (i, j) íntegramente en un único proceso MPI y combinar con MPI_Reduce con matrices inicializadas en cero exacto, se preserva la asociatividad bit a bit de IEEE-754 (100% coincidencia, Δ = 0.000000000000).'
                    : 'By calculating each pair (i, j) completely on a single MPI process and reducing matrices initialized to exact zeroes via MPI_Reduce, bitwise IEEE-754 associativity is preserved (100% match, Δ = 0.000000000000).'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <a
                href="https://github.com/ana-izaguirre/ProtSpaM"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                <span>github.com/ana-izaguirre/ProtSpaM</span>
              </a>
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs hover:bg-emerald-400 transition-colors"
              >
                {lang === 'es' ? 'Cerrar Guía' : 'Close Guide'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageThemeProvider>
      <AppContent />
    </LanguageThemeProvider>
  );
}
