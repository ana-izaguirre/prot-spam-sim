import jsPDF from 'jspdf';
import type { Language } from '../context/LanguageThemeContext';

export function generateTFMPdf(lang: Language = 'es') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isEs = lang === 'es';

  // Palette
  const primaryEmerald = [16, 185, 129];
  const darkSlate = [15, 23, 42];
  const midSlate = [51, 65, 85];
  const lightBg = [248, 250, 252];
  const textDark = [30, 41, 59];
  const textMuted = [100, 116, 139];

  // Header Background
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(0, 0, 210, 45, 'F');

  // Emerald Top Accent Line
  doc.setFillColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.rect(0, 0, 210, 4, 'F');

  // Title & Supercomputer Badge
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ProtSpam HPC Suite — Resumen Ejecutivo TFM', 15, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 243, 208); // Emerald light
  doc.text(
    isEs
      ? 'Reconstrucción filogenética de secuencias de proteoma completo en paralelo (MPI)'
      : 'Parallel phylogenetic reconstruction of whole proteome sequences on distributed memory (MPI)',
    15,
    22
  );

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Máster Interuniversitario en Computación de Altas Prestaciones (MUI HPC) — UDC & CESGA',
    15,
    28
  );

  // Metadata Box (Right side of header)
  doc.setDrawColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(140, 10, 56, 28, 2, 2, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Supercomputador:', 143, 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('FinisTerrae III (CESGA)', 143, 21);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Hardware:', 143, 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('2x Intel Xeon Platinum 8352Y (64 c/n)', 143, 32);

  // Academic Details Section
  let y = 53;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 22, 2, 2, 'FD');

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(isEs ? 'Autora:' : 'Author:', 20, y + 7);
  doc.text(isEs ? 'Director:' : 'Advisor:', 20, y + 14);
  doc.text(isEs ? 'Fecha de Defensa:' : 'Defense Date:', 110, y + 7);
  doc.text(isEs ? 'Repositorio Git:' : 'Git Repository:', 110, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.text('Ana Izaguirre Matamoros', 35, y + 7);
  doc.text('github.com/ana-izaguirre/ProtSpaM', 137, y + 14);

  doc.setTextColor(midSlate[0], midSlate[1], midSlate[2]);
  doc.text('Jorge González Domínguez', 37, y + 14);
  doc.text(isEs ? '29 de Julio de 2026' : 'July 29, 2026', 145, y + 7);

  // Section 1: Abstract & Objectives
  y = 82;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(isEs ? '1. Resumen y Objetivos del Trabajo' : '1. Summary & Objectives', 15, y);
  
  doc.setDrawColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 195, y + 2);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);

  const summaryText = isEs
    ? 'El presente Trabajo de Fin de Máster aborda la paralelización en memoria distribuida (MPI) del software bioinformático Prot-SpaM (Spaced Words for Protein Alignment). Prot-SpaM permite estimar distancias filogenéticas entre proteomas completos sin requerir costosos alineamientos múltiples (MSA). En este trabajo se distribuyeron las fases críticas de indexación (Fase 3: spacedwords + std::sort) y comparación de media matriz (Fase 4: calc_matches + BLOSUM62 + Kimura), permitiendo procesar hasta 300 especies biológicas completas en el supercomputador FinisTerrae III.'
    : 'This Master\'s Thesis presents the distributed memory (MPI) parallelization of the bioinformatics tool Prot-SpaM (Spaced Words for Protein Alignment). Prot-SpaM computes phylogenetic distances between whole proteome sequences without costly multiple sequence alignments. This project distributed both the pattern indexing phase (Phase 3: spacedwords + std::sort) and the upper triangular matrix comparison (Phase 4: calc_matches + BLOSUM62 + Kimura), scaling to 300 complete biological proteomes on the FinisTerrae III supercomputer.';

  const splitSummary = doc.splitTextToSize(summaryText, 180);
  doc.text(splitSummary, 15, y);
  y += splitSummary.length * 4 + 4;

  // Section 2: Key HPC Results & Benchmarks (Table)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(isEs ? '2. Resultados Experimentales en FinisTerrae III (300 Especies)' : '2. Experimental Benchmarks on FinisTerrae III (300 Species)', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 7;

  // Benchmark Table Header
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(15, y, 180, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(isEs ? 'Configuración / Procesos' : 'Configuration / Processes', 18, y + 4.2);
  doc.text(isEs ? 'Nodos / Cores' : 'Nodes / Cores', 65, y + 4.2);
  doc.text(isEs ? 'Tiempo Fase 4 (s)' : 'Phase 4 Time (s)', 105, y + 4.2);
  doc.text(isEs ? 'Tiempo Total (s)' : 'Total Time (s)', 140, y + 4.2);
  doc.text(isEs ? 'Speedup Global' : 'Overall Speedup', 170, y + 4.2);

  const benchmarkRows = [
    { p: '1 Proceso (Secuencial Base)', hw: '1 Core (Single)', t4: '111,840 s (~31.1 h)', tot: '112,654 s', sp: '1.0x (Línea Base)' },
    { p: '16 Procesos MPI', hw: '1/4 Nodo (1 Socket)', t4: '27,100 s', tot: '27,310 s', sp: '4.1x' },
    { p: '32 Procesos MPI', hw: '1/2 Nodo (1 Socket)', t4: '14,200 s', tot: '14,350 s', sp: '7.8x' },
    { p: '64 Procesos MPI', hw: '1 Nodo Completo (64c)', t4: '7,610 s', tot: '7,730 s', sp: '14.6x' },
    { p: '128 Procesos MPI (metacache)', hw: '2 Nodos (128c)', t4: '7,702 s (Contención)', tot: '7,820 s', sp: '14.4x' },
    { p: '128 Procesos MPI (isend) ★', hw: '2 Nodos (128c)', t4: '4,204 s (Óptimo)', tot: '4,310 s', sp: '26.8x ★' },
  ];

  y += 6;
  benchmarkRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(241, 245, 249);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(15, y, 180, 5.5, 'F');
    doc.setFont('helvetica', row.p.includes('★') ? 'bold' : 'normal');
    doc.setTextColor(row.p.includes('★') ? primaryEmerald[0] : textDark[0], row.p.includes('★') ? primaryEmerald[1] : textDark[1], row.p.includes('★') ? primaryEmerald[2] : textDark[2]);
    doc.setFontSize(7.5);
    doc.text(row.p, 18, y + 3.8);
    doc.setTextColor(midSlate[0], midSlate[1], midSlate[2]);
    doc.text(row.hw, 65, y + 3.8);
    doc.text(row.t4, 105, y + 3.8);
    doc.text(row.tot, 140, y + 3.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(row.p.includes('★') ? primaryEmerald[0] : textDark[0], row.p.includes('★') ? primaryEmerald[1] : textDark[1], row.p.includes('★') ? primaryEmerald[2] : textDark[2]);
    doc.text(row.sp, 170, y + 3.8);
    y += 5.5;
  });

  // Section 3: Branches & Architectural Highlights
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(isEs ? '3. Arquitectura y Ramas Git del Proyecto' : '3. Architecture & Git Branches', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  y += 6;

  const branchBoxes = [
    {
      name: 'feat/mpi-phase4-metacache-isend (RECOMENDADA)',
      desc: isEs
        ? 'Comunicación punto a punto asíncrona mediante MPI_Isend en ráfaga, gestión de buffers no completados con PendingSend y sincronización agrupada con MPI_Waitall. Evita el bloqueo del protocolo rendezvous.'
        : 'Asynchronous point-to-point communication with burst MPI_Isend, pending buffer tracking with PendingSend, and collective synchronization with MPI_Waitall.',
    },
    {
      name: 'feat/mpi-phase4-metacache',
      desc: isEs
        ? 'Cálculo distribuido de media matriz triangular (j > i) con caché de metadatos de proteomas y envíos bloqueantes secuenciales con MPI_Send. Presenta contención a partir de 64 procesos.'
        : 'Distributed triangular half-matrix calculation (j > i) with proteome metadata caching and sequential blocking MPI_Send calls.',
    },
    {
      name: 'feat/mpi-phase3-a & feat/mpi-phase3-b',
      desc: isEs
        ? 'Paralelización de la indexación (spacedwords + std::sort). La variante B realiza lectura distribuida directa de disco, reduciendo el tráfico de red de entrada.'
        : 'Parallelization of pattern indexing. Variant B performs distributed direct disk reads, minimizing input broadcast network traffic.',
    },
    {
      name: 'feat/seq (Línea Base)',
      desc: isEs
        ? 'Versión secuencial C++11 de referencia con función write_words_checksum() para validación bit a bit de matrices PHYLIP.'
        : 'Clean sequential C++11 reference with write_words_checksum() for bitwise verification of output PHYLIP matrices.',
    },
  ];

  branchBoxes.forEach((b) => {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 11.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(b.name.includes('RECOMENDADA') ? primaryEmerald[0] : darkSlate[0], b.name.includes('RECOMENDADA') ? primaryEmerald[1] : darkSlate[1], b.name.includes('RECOMENDADA') ? primaryEmerald[2] : darkSlate[2]);
    doc.text(b.name, 18, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(midSlate[0], midSlate[1], midSlate[2]);
    const splitBDesc = doc.splitTextToSize(b.desc, 174);
    doc.text(splitBDesc, 18, y + 7.5);
    y += 13;
  });

  // Section 4: Numerical Correctness & Invariance
  y += 2;
  doc.setFillColor(240, 253, 244); // light emerald
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text(
    isEs ? '✔ Verificación de Invarianza Numérica Exacta (IEEE-754)' : '✔ Exact Numerical Invariance Guarantee (IEEE-754)',
    20,
    y + 5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 78, 59);
  doc.text(
    isEs
      ? 'La matriz de distancias filogenómicas PHYLIP calculada con 128 procesos MPI es 100% idéntica bit a bit a la generada por el algoritmo secuencial (Error Delta = 0.000000000000). Reproducibilidad científica garantizada.'
      : 'The PHYLIP phylogenetic distance matrix computed across 128 MPI processes is 100% bitwise identical to the sequential baseline (Delta Error = 0.000000000000). Full scientific reproducibility guaranteed.',
    20,
    y + 10
  );

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    isEs
      ? 'Documento generado automáticamente por ProtSpam HPC Suite — Ana Izaguirre Matamoros (2026)'
      : 'Document generated automatically by ProtSpam HPC Suite — Ana Izaguirre Matamoros (2026)',
    15,
    290
  );
  doc.text('Página 1 / 1', 180, 290);

  // Save the PDF file directly to client
  doc.save('TFM_Ana_Izaguirre_ProtSpam_HPC.pdf');
}
