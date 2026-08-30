import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'es' | 'en';
export type Theme = 'dark' | 'light';

interface LanguageThemeContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  es: {
    // Top Bar & Brand
    'app.title': 'ProtSpam HPC Suite',
    'app.subtitle': 'Simulador Filogenético Distribuido',
    'app.howItWorks': 'Cómo Funciona',
    'app.coreSim': 'Algoritmo Base',
    'app.tfmBranches': 'Ramas TFM',
    'app.workload': 'Reparto Carga',
    'app.mpiComm': 'Tráfico MPI',
    'app.matrix': 'Matriz',
    'app.scalability': 'Escalabilidad',
    'app.correctness': 'Invarianza',
    'app.docs': 'Memoria TFM',
    'app.more': 'Más',
    'app.github': 'GitHub',
    'app.downloadFicha': 'Descargar Ficha TFM (PDF)',
    'app.downloaded': '¡PDF Descargado!',
    'app.branchRepo': 'Ramas GitHub',
    'app.author': 'Autora',
    'app.director': 'Director',
    'app.system': 'Supercomputador',
    'app.date': 'Fecha',
    'app.bannerTitle':
      'TFM: Reconstrucción filogenética de secuencias de proteoma completo sobre memoria distribuida',
    'app.sectionsTitle': 'Secciones y Módulos',

    // Phase Walkthrough — cómo funciona cada variante, paso a paso
    'walk.title': 'Cómo funciona cada versión, paso a paso',
    'walk.subtitle':
      'Una ejecución completa de cada rama —seq, fase 3a, fase 3b, metacache e isend— parada por parada: qué llamada se ejecuta, qué hace cada proceso en ese momento, qué mensajes viajan y por qué el diseño es así.',
    'walk.honesty':
      'Esto es el mecanismo, no el rendimiento. Cada paso es una llamada real de la rama, en el orden en que el programa la ejecuta; no hay tiempos simulados en ningún punto. Los tiempos son medidas del TFM en FinisTerrae III y están en el módulo de Escalabilidad. El escenario es un caso miniatura para que una ejecución entera quepa en pantalla; el reparto, los propietarios, los pares y la matriz de necesidad se calculan aquí con las mismas fórmulas que el C++.',
    'walk.variant': 'Versión',
    'walk.changes': 'Qué cambia respecto a la anterior',
    'walk.prev': 'Anterior',
    'walk.next': 'Siguiente',
    'walk.play': 'Reproducir',
    'walk.pause': 'Pausar',
    'walk.reset': 'Reiniciar',
    'walk.speed': 'Vel',
    'walk.step': 'Paso',
    'walk.of': 'de',
    'walk.process': 'proceso',
    'walk.processes': 'procesos',
    'walk.singleProcess': 'proceso único',
    'walk.ranks': 'Qué hace cada proceso',
    'walk.messages': 'Mensajes en este paso',
    'walk.noMessages': 'Ningún mensaje: en este paso no hay comunicación.',
    'walk.legendSerial':
      'Numerados porque ocurren en serie: cada MPI_Send bloqueante debe retornar antes de que empiece el siguiente.',
    'walk.legendBurst':
      'Sin numerar porque progresan a la vez: los MPI_Isend de una tanda se publican sin esperar entre ellos y se espera una sola vez, al final.',
    'walk.call': 'Llamada',
    'walk.pairsDone': 'pares resueltos',
    'walk.timerNone': 'sin cronómetro',
    'walk.timerPhase3': 'cronómetro: Fase 3',
    'walk.timerPhase4': 'cronómetro: Fase 4',
    'walk.noteWhy': 'Por qué',
    'walk.noteFlag': 'Límite reconocido',
    'walk.noteData': 'Dato del TFM',
    'walk.summary': 'Resumen de la versión',
    'walk.scenario': 'El escenario, con todos sus números',
    'walk.scenarioNote':
      'Seis especies, tres procesos y dos patrones. Las especies están ordenadas a propósito para que las dos fuentes de desbalance NO coincidan: rank 0 recibe más pares y rank 1 recibe más aminoácidos. Es la instrumentación de 55 especies del TFM —donde el proceso 8, con 75 pares, calcula más del doble que el proceso 0, que tiene 107— reducida a un tamaño que cabe en pantalla.',
    'walk.speciesTable': 'Especies y propietario',
    'walk.colSpecies': 'Especie',
    'walk.colOwner': 'Propietario',
    'walk.pairsGrid': 'Quién calcula cada par',
    'walk.pairs': 'pares',
    'walk.gridLegend':
      'Solo el triángulo superior (j > i): la comparación es simétrica. El número de cada celda es el rank que la calcula, y es siempre el propietario de i.',
    'walk.planTable': 'Reparto resultante por proceso',
    'walk.colOwns': 'Especies',
    'walk.colPairs': 'Pares',
    'walk.colOwnMaa': 'Maa propios',
    'walk.colPairMaa': 'Carga de pares',
    'walk.colNeeds': 'Necesita recibir',
    'walk.planNote':
      '«Carga de pares» suma, para cada par asignado, los aminoácidos de las dos especies: calc_matches recorre las dos listas ordenadas de palabras, así que su coste crece con |palabras(i)| + |palabras(j)|. Es un indicador de carga relativa estructural, no un tiempo. Y muestra el resultado central del TFM: rank 1 tiene 5 pares frente a los 9 de rank 0, y aun así más trabajo.',

    // Modal TFM
    'modal.title': 'Ficha Técnica del Trabajo de Fin de Máster (TFM)',
    'modal.thesisTitle': 'Título del Trabajo:',
    'modal.degree': 'Máster Interuniversitario en Computación de Altas Prestaciones (MUI HPC)',
    'modal.univ': 'Universidade da Coruña (UDC) — Facultade de Informática',
    'modal.cesga': 'Centro de Supercomputación de Galicia (CESGA) — FinisTerrae III',
    'modal.summaryTitle': 'Resumen Ejecutivo & Aportaciones:',
    'modal.summaryP1':
      'Este trabajo aborda la paralelización en memoria distribuida con MPI del algoritmo Prot-SpaM (Spaced Words for Protein Alignment), eliminando la necesidad de alineamientos múltiples tradicionales.',
    'modal.summaryP2':
      'Se paralelizan tanto la indexación de palabras espaciadas (Fase 3) como el cálculo de la media matriz triangular (Fase 4). Con 300 especies, la mejor configuración completada (isend, 128 procesos sobre 4 nodos del FinisTerrae III) resuelve en 4204 s lo que la referencia secuencial tarda 112 500 s: más de 31 horas frente a poco más de una. Ese factor de 26,8x es un factor temporal entre dos binarios distintos, no una aceleración paralela; la aceleración paralela medida sobre la propia versión MPI es 6,88x con 64 procesos en el conjunto de 64 especies.',
    'modal.downloadPdfBtn': 'Descargar Ficha en PDF',
    'modal.close': 'Cerrar',

    // Core Simulator
    'core.title': 'Simulador del Algoritmo Prot-SpaM Original',
    'core.subtitle':
      'Exploración interactiva del flujo base: extracción de palabras espaciadas, ordenación std::sort, extensión BLOSUM62 y cálculo de distancias de Kimura.',
    'core.howItWorks': '¿Cómo funciona Prot-SpaM?',
    'core.howItWorksDesc':
      'Prot-SpaM compara secuencias de proteínas completas sin necesidad de alineamiento múltiple tradicional. Genera palabras espaciadas fijadas por patrones binarios, las indexa en tiempo casi lineal, calcula extensiones con matrices BLOSUM62 y estima distancias evolutivas mediante la fórmula de Kimura.',
    'core.patterns': "Patrones Binarios (1: Coincidencia, *: Don't Care)",
    'core.seq1': 'Secuencia 1 (S1)',
    'core.seq2': 'Secuencia 2 (S2)',
    'core.threshold': 'Umbral Puntuación (T)',
    'core.dropoff': 'Caída Dropoff (X)',
    'core.dropoffHint':
      'La extensión se corta cuando la puntuación cae más de X por debajo de la mejor alcanzada, y se recorta hasta ese máximo.',
    'core.updateParams': 'Recalcular Simulación',
    'core.playback': 'Controles de Ejecución',
    'core.prevStep': 'Paso Anterior',
    'core.nextStep': 'Paso Siguiente',
    'core.play': 'Reproducir',
    'core.pause': 'Pausar',
    'core.reset': 'Reiniciar',
    'core.speed': 'Velocidad',
    'core.step': 'Paso',
    'core.of': 'de',
    'core.currentPhase': 'Fase Actual',
    'core.memoryState': 'Estado de Memoria & Indexación',
    'core.alignment': 'Extensión BLOSUM62 & Puntuación',
    'core.distanceFormula': 'Fórmula de Distancia de Kimura',
    'core.finalMatrix': 'Matriz de Distancias PHYLIP Resultante',
    'core.kimuraEq': 'd = -ln(1 - p - 0.2·p²)',
    'core.demoMatrixTitle': 'Matriz de sustitución didáctica (4×4)',
    'core.demoMatrixHint':
      'Prot-SpaM usa BLOSUM62, una matriz 20×20 de aminoácidos. Este simulador emplea una tabla reducida de 4 símbolos para que la extensión quepa en pantalla y se pueda seguir a mano.',

    // Branches & TFM Explorer
    'tfm.title': 'Evolución del TFM: Fases de Paralelización y Ramas Git',
    'tfm.subtitle':
      'Cómo se transformó la herramienta secuencial en una solución MPI escalable en el supercomputador FinisTerrae III.',
    'tfm.branchSelect': 'Seleccionar Rama de Desarrollo:',
    'tfm.viewOnGithub': 'Ver Rama en GitHub',
    'tfm.summaryBadge': 'Resumen de Rendimiento & Aceleración',
    'tfm.keyDecisions': 'Decisiones de Diseño & Retos Algorítmicos',
    'tfm.cppCode': 'Fragmento de Código C++ Representativo',
    'tfm.whyImportant': 'Impacto en el Clúster',

    // Workload Simulator
    'workload.title': 'Simulador de Reparto de Carga & Balanceo',
    'workload.mpiProcesses': 'Procesos MPI (P)',
    'workload.dataset': 'Conjunto de Entrada',
    'workload.metric': 'Visualizar Métrica',
    'workload.partition': 'Estrategia de Partición',
    'workload.cyclic': 'Cíclico (trabajo futuro)',
    'workload.block': 'Bloques contiguos (implementado)',
    'workload.homoBottle': 'Cuello de Botella: Homo sapiens',
    'workload.demoMode': 'Modo Demo Automático',
    'workload.demoRunning': 'Demo en Curso (Escalado P)',
    'workload.demoSpeed': 'Velocidad',
    'workload.demoExplanation':
      'Visualiza cómo evoluciona la carga y el balanceo al incrementar los procesos de 2 a 64.',
    'workload.controlCockpit': 'Cabina de Control y Topología MPI',
    'workload.chartTitle': 'Distribución de Carga por Proceso MPI (Fases 3 y 4)',
    'workload.kpiImbalance': 'Factor Desbalance (λ)',
    'workload.kpiBottleneck': 'Cuello de Botella Crítico',
    'workload.kpiMaxMin': 'Carga Máx vs Mín',
    'workload.kpiPairs': 'Total Comparaciones (j > i)',
    'workload.presets': 'Topologías HPC Rápidas',
    'workload.executionLog': 'Registro de Ejecución MPI en Tiempo Real',
    'workload.clearLog': 'Limpiar Registro',
    'workload.autoScroll': 'Auto-desplazamiento',
    'workload.copyLog': 'Copiar Registro',
    'workload.logCopied': '¡Copiado!',
    'workload.logCopyFailed': 'No se pudo copiar',
    'workload.logFilterAll': 'Todos',
    'workload.logStatusIdle': 'EN ESPERA',
    'workload.logStatusRunning': 'PROCESANDO',
    'workload.logStatusDone': 'DISTRIBUCIÓN COMPLETADA',

    // MPI Communication
    'mpi.title': 'Visualizador de Tráfico y Comunicación MPI',
    'mpi.subtitle':
      'Comparación directa de contención de red y concurrencia entre MPI_Send bloqueante y MPI_Isend asíncrono.',
    'mpi.mechanism': 'Mecanismo MPI:',
    'mpi.blocking': 'METACACHE (MPI_Send Bloqueante)',
    'mpi.nonblocking': 'MPI_ISEND (No Bloqueante)',
    'mpi.speedupAdvantage': 'isend es hasta un 45% más rápido en 128 procesos en FinisTerrae III.',
    'mpi.stepForward': 'Paso Siguiente',
    'mpi.reset': 'Reiniciar',
    'mpi.speed': 'Vel:',
    'mpi.trafficTimeline': 'Línea Temporal de Comunicación',
    'mpi.senderNode': 'Nodo Emisor (Rank 0 - Propietario)',
    'mpi.receiverNodes': 'Nodos Receptores Concurrentes',
    'mpi.queueTitle': 'Cola PendingSend (Buffers en Tránsito)',
    'mpi.stateCompleted': 'Completado',
    'mpi.stateActive': 'MPI_Request Activo',
    'mpi.stateQueued': 'En Cola',

    // Triangular Matrix
    'matrix.title': 'Explorador Interactivo de Matriz Triangular',
    'matrix.subtitle':
      'Visualización del cálculo de media matriz superior (j > i) y reparto geométrico entre rangos MPI.',
    'matrix.dimension': 'Dimensión Matriz (N)',
    'matrix.strategy': 'Algoritmo de Asignación',
    'matrix.cyclicDesc': 'Cíclico i % P (trabajo futuro)',
    'matrix.blockDesc': 'Bloques contiguos (implementado)',
    'matrix.inspector': 'Inspector de Celda Seleccionada',
    'matrix.diagonal': 'Diagonal Principal (Distancia = 0.0000)',
    'matrix.lowerTriangle': 'Mitad Inferior (Omitida por Simetría)',
    'matrix.upperTriangle': 'Media Matriz Superior (Cálculo Activo)',
    'matrix.assignedRank': 'Rango MPI Propietario:',
    'matrix.speciesA': 'Especie i:',
    'matrix.speciesB': 'Especie j:',
    'matrix.estimatedDist': 'Distancia Estimada:',
    'matrix.illustrativeDist': 'Distancia (valor ilustrativo):',
    'matrix.illustrativeDistHint':
      'Valor de ejemplo derivado de la posición de la celda, no calculado a partir de las secuencias. Los valores reales están en el módulo de Invarianza.',

    // Scalability
    'scall.title': 'Evaluación de Rendimiento & Curvas de Escalabilidad',
    'scall.subtitle':
      'Resultados experimentales en el supercomputador FinisTerrae III (CESGA, Intel Xeon Platinum 8352Y, 64 cores/nodo).',
    'scall.phase3Tab': 'Aceleración Fase 3',
    'scall.phase4Tab': 'Aceleración Fase 4 (metacache vs isend)',
    'scall.totalTimeTab': 'Tiempo Total de Ejecución',
    'scall.dataset300': '300 Especies (Heterogéneo)',
    'scall.dataset64': '64 Especies (Homogéneo)',
    'scall.idealSpeedup': 'Aceleración Ideal (Sp = P)',
    'scall.realSpeedup': 'Aceleración Real',
    'scall.timeUnit': 'Segundos (Escala Logarítmica)',

    // Correctness
    'num.title': 'Verificación de Invarianza Numérica (IEEE-754)',
    'num.subtitle':
      'Garantía matemática de reproducibilidad: la matriz de distancias paralela es 100% idéntica bit a bit a la referencia secuencial.',
    'num.exactMatch': '100% Coincidencia Exacta / 0.0% Error',
    'num.maxDelta': 'Error Máximo (Δ)',
    'num.verifiedPairs': 'Pares Verificados',
    'num.matrixFragment': 'Fragmento de la Matriz de Distancia PHYLIP',
    'num.filterPlaceholder': 'Filtrar especie...',
    'num.speciesPair': 'Par de Especies (i × j)',
    'num.sequential': 'Secuencial',
    'num.mpiParallel': 'MPI (P ranks)',
    'num.delta': 'Δ Delta',
    'num.rankOwner': 'Rank',
    'num.bitwiseProof': 'Prueba de Identidad Bit a Bit (Hex IEEE-754):',
    'num.sameBits': '✔ Mismos 64 bits de precisión doble en memoria.',
  },
  en: {
    // Top Bar & Brand
    'app.title': 'ProtSpam HPC Suite',
    'app.subtitle': 'Distributed Phylogenetic Simulator',
    'app.howItWorks': 'How It Works',
    'app.coreSim': 'Base Algorithm',
    'app.tfmBranches': 'TFM Branches',
    'app.workload': 'Workload',
    'app.mpiComm': 'MPI Comm',
    'app.matrix': 'Matrix',
    'app.scalability': 'Scalability',
    'app.correctness': 'Correctness',
    'app.docs': 'TFM Thesis',
    'app.more': 'More',
    'app.github': 'GitHub',
    'app.downloadFicha': 'Download TFM Sheet (PDF)',
    'app.downloaded': 'PDF Downloaded!',
    'app.branchRepo': 'GitHub Branches',
    'app.author': 'Author',
    'app.director': 'Advisor',
    'app.system': 'Supercomputer',
    'app.date': 'Date',
    'app.bannerTitle':
      "Master's Thesis: Parallel phylogenetic reconstruction of whole proteome sequences on distributed memory systems",
    'app.sectionsTitle': 'Sections & Modules',

    // Phase Walkthrough — how each variant works, step by step
    'walk.title': 'How each version works, step by step',
    'walk.subtitle':
      'One complete execution of every branch — seq, phase 3a, phase 3b, metacache and isend — stop by stop: which call runs, what each process is doing at that moment, which messages travel, and why the design is what it is.',
    'walk.honesty':
      'This is the mechanism, not the performance. Every step is a real call from the branch, in the order the program makes it; no timing is simulated anywhere. The seconds are thesis measurements on FinisTerrae III and live in the Scalability module. The scenario is a miniature so a whole execution fits on one screen; the partition, the owners, the pairs and the need matrix are computed here with the same formulas as the C++.',
    'walk.variant': 'Version',
    'walk.changes': 'What changes from the previous one',
    'walk.prev': 'Previous',
    'walk.next': 'Next',
    'walk.play': 'Play',
    'walk.pause': 'Pause',
    'walk.reset': 'Reset',
    'walk.speed': 'Speed',
    'walk.step': 'Step',
    'walk.of': 'of',
    'walk.process': 'process',
    'walk.processes': 'processes',
    'walk.singleProcess': 'single process',
    'walk.ranks': 'What each process is doing',
    'walk.messages': 'Messages on this step',
    'walk.noMessages': 'No messages: there is no communication on this step.',
    'walk.legendSerial':
      'Numbered because they happen in series: each blocking MPI_Send must return before the next one starts.',
    'walk.legendBurst':
      'Unnumbered because they progress together: the MPI_Isends of a batch are posted without waiting in between, and there is a single wait at the end.',
    'walk.call': 'Call',
    'walk.pairsDone': 'pairs resolved',
    'walk.timerNone': 'no timer',
    'walk.timerPhase3': 'timer: Phase 3',
    'walk.timerPhase4': 'timer: Phase 4',
    'walk.noteWhy': 'Why',
    'walk.noteFlag': 'Acknowledged limit',
    'walk.noteData': 'Thesis figure',
    'walk.summary': 'Version summary',
    'walk.scenario': 'The scenario, with all its numbers',
    'walk.scenarioNote':
      'Six species, three processes and two patterns. The species are ordered on purpose so the two sources of imbalance do NOT coincide: rank 0 receives more pairs while rank 1 receives more amino acids. It is the thesis’ 55-species instrumentation — where process 8, with 75 pairs, computes for more than twice as long as process 0, which has 107 — shrunk to a size that fits on screen.',
    'walk.speciesTable': 'Species and owner',
    'walk.colSpecies': 'Species',
    'walk.colOwner': 'Owner',
    'walk.pairsGrid': 'Who computes each pair',
    'walk.pairs': 'pairs',
    'walk.gridLegend':
      'Only the upper triangle (j > i): the comparison is symmetric. The number in each cell is the rank that computes it, and it is always the owner of i.',
    'walk.planTable': 'Resulting per-process partition',
    'walk.colOwns': 'Species',
    'walk.colPairs': 'Pairs',
    'walk.colOwnMaa': 'Own Maa',
    'walk.colPairMaa': 'Pair load',
    'walk.colNeeds': 'Must receive',
    'walk.planNote':
      '"Pair load" adds up, for every assigned pair, the amino acids of both species: calc_matches walks both sorted word lists, so its cost grows with |words(i)| + |words(j)|. It is an indicator of relative structural load, not a time. And it shows the thesis’ central result: rank 1 has 5 pairs against rank 0’s 9, and still more work.',

    // Modal TFM
    'modal.title': "Master's Thesis (TFM) Executive Factsheet",
    'modal.thesisTitle': 'Thesis Title:',
    'modal.degree': 'Interuniversity Master in High Performance Computing (MUI HPC)',
    'modal.univ': 'Universidade da Coruña (UDC) — Faculty of Computer Science',
    'modal.cesga': 'Supercomputing Center of Galicia (CESGA) — FinisTerrae III',
    'modal.summaryTitle': 'Executive Summary & Scientific Contributions:',
    'modal.summaryP1':
      'This thesis addresses the distributed-memory parallelization using MPI of the Prot-SpaM (Spaced Words for Protein Alignment) algorithm, eliminating the need for expensive traditional multiple sequence alignments.',
    'modal.summaryP2':
      'Both spaced-word indexing (Phase 3) and the upper-triangular half-matrix computation (Phase 4) are parallelised. On 300 species, the best completed configuration (isend, 128 processes across 4 FinisTerrae III nodes) resolves in 4204 s what the sequential reference takes 112 500 s: over 31 hours against a little more than one. That 26.8x is a temporal factor between two different binaries, not a parallel speedup; the parallel speedup measured against the MPI version itself is 6.88x with 64 processes on the 64-species set.',
    'modal.downloadPdfBtn': 'Download PDF Factsheet',
    'modal.close': 'Close',

    // Core Simulator
    'core.title': 'Original Prot-SpaM Core Algorithm Simulator',
    'core.subtitle':
      'Interactive exploration of the foundation: spaced words extraction, std::sort indexation, BLOSUM62 extension, and Kimura distance estimation.',
    'core.howItWorks': 'How does Prot-SpaM work?',
    'core.howItWorksDesc':
      "Prot-SpaM compares complete protein sequences without traditional multiple sequence alignment. It generates spaced words defined by binary patterns, indexes them in quasi-linear time, scores extensions using BLOSUM62 matrices, and computes evolutionary distances using Kimura's model.",
    'core.patterns': "Binary Patterns (1: Match, *: Don't Care)",
    'core.seq1': 'Sequence 1 (S1)',
    'core.seq2': 'Sequence 2 (S2)',
    'core.threshold': 'Score Threshold (T)',
    'core.dropoff': 'Dropoff Decay (X)',
    'core.dropoffHint':
      'The extension stops once the score falls more than X below the best reached, and is trimmed back to that maximum.',
    'core.updateParams': 'Recompute Simulation',
    'core.playback': 'Execution Controls',
    'core.prevStep': 'Previous Step',
    'core.nextStep': 'Next Step',
    'core.play': 'Play',
    'core.pause': 'Pause',
    'core.reset': 'Reset',
    'core.speed': 'Speed',
    'core.step': 'Step',
    'core.of': 'of',
    'core.currentPhase': 'Current Phase',
    'core.memoryState': 'Memory & Index State',
    'core.alignment': 'BLOSUM62 Extension & Scoring',
    'core.distanceFormula': 'Kimura Distance Formula',
    'core.finalMatrix': 'Resulting PHYLIP Distance Matrix',
    'core.kimuraEq': 'd = -ln(1 - p - 0.2·p²)',
    'core.demoMatrixTitle': 'Didactic substitution matrix (4×4)',
    'core.demoMatrixHint':
      'Prot-SpaM uses BLOSUM62, a 20×20 amino-acid matrix. This simulator uses a reduced 4-symbol table so the extension fits on screen and can be followed by hand.',

    // Branches & TFM Explorer
    'tfm.title': 'TFM Evolution: Parallelization Phases & Git Branches',
    'tfm.subtitle':
      'How the sequential tool was transformed into a scalable MPI solution on the FinisTerrae III supercomputer.',
    'tfm.branchSelect': 'Select Development Branch:',
    'tfm.viewOnGithub': 'View Branch on GitHub',
    'tfm.summaryBadge': 'Performance & Speedup Summary',
    'tfm.keyDecisions': 'Design Decisions & Algorithmic Challenges',
    'tfm.cppCode': 'Representative C++ Code Snippet',
    'tfm.whyImportant': 'Cluster HPC Impact',

    // Workload Simulator
    'workload.title': 'Workload Distribution & Load Balancing Simulator',
    'workload.mpiProcesses': 'MPI Processes (P)',
    'workload.dataset': 'Input Dataset',
    'workload.metric': 'View Metric',
    'workload.partition': 'Partitioning Strategy',
    'workload.cyclic': 'Cyclic (future work)',
    'workload.block': 'Contiguous blocks (implemented)',
    'workload.homoBottle': 'Bottleneck: Homo sapiens',
    'workload.demoMode': 'Automated Demo Mode',
    'workload.demoRunning': 'Demo Running (Scaling P)',
    'workload.demoSpeed': 'Speed',
    'workload.demoExplanation':
      'Visualize how workload balance and bottlenecks evolve as processes scale from 2 to 64.',
    'workload.controlCockpit': 'MPI Control & Topology Cockpit',
    'workload.chartTitle': 'MPI Process Workload Distribution (Phases 3 & 4)',
    'workload.kpiImbalance': 'Imbalance Factor (λ)',
    'workload.kpiBottleneck': 'Critical Bottleneck Rank',
    'workload.kpiMaxMin': 'Max vs Min Workload',
    'workload.kpiPairs': 'Total Comparisons (j > i)',
    'workload.presets': 'Quick HPC Topologies',
    'workload.executionLog': 'Real-Time MPI Execution Log',
    'workload.clearLog': 'Clear Log',
    'workload.autoScroll': 'Auto-scroll',
    'workload.copyLog': 'Copy Log',
    'workload.logCopied': 'Copied!',
    'workload.logCopyFailed': 'Copy failed',
    'workload.logFilterAll': 'All',
    'workload.logStatusIdle': 'IDLE',
    'workload.logStatusRunning': 'PROCESSING',
    'workload.logStatusDone': 'DISTRIBUTION COMPLETE',

    // MPI Communication
    'mpi.title': 'MPI Traffic & Communication Visualizer',
    'mpi.subtitle':
      'Direct visual comparison of network contention and concurrency between blocking MPI_Send and non-blocking MPI_Isend.',
    'mpi.mechanism': 'MPI Mechanism:',
    'mpi.blocking': 'METACACHE (Blocking MPI_Send)',
    'mpi.nonblocking': 'MPI_ISEND (Non-Blocking)',
    'mpi.speedupAdvantage': 'isend is up to 45% faster at 128 processes on FinisTerrae III.',
    'mpi.stepForward': 'Next Step',
    'mpi.reset': 'Reset',
    'mpi.speed': 'Speed:',
    'mpi.trafficTimeline': 'Communication Timeline',
    'mpi.senderNode': 'Sender Node (Rank 0 - Owner)',
    'mpi.receiverNodes': 'Concurrent Receiver Nodes',
    'mpi.queueTitle': 'PendingSend Queue (In-Flight Buffers)',
    'mpi.stateCompleted': 'Completed',
    'mpi.stateActive': 'Active MPI_Request',
    'mpi.stateQueued': 'Queued',

    // Triangular Matrix
    'matrix.title': 'Interactive Triangular Matrix Explorer',
    'matrix.subtitle':
      'Visualization of upper half-matrix calculation (j > i) and geometric assignment across MPI ranks.',
    'matrix.dimension': 'Matrix Dimension (N)',
    'matrix.strategy': 'Assignment Algorithm',
    'matrix.cyclicDesc': 'Cyclic i % P (future work)',
    'matrix.blockDesc': 'Contiguous blocks (implemented)',
    'matrix.inspector': 'Selected Cell Inspector',
    'matrix.diagonal': 'Main Diagonal (Distance = 0.0000)',
    'matrix.lowerTriangle': 'Lower Half (Omitted by Symmetry)',
    'matrix.upperTriangle': 'Upper Half-Matrix (Active Compute)',
    'matrix.assignedRank': 'Owner MPI Rank:',
    'matrix.speciesA': 'Species i:',
    'matrix.speciesB': 'Species j:',
    'matrix.estimatedDist': 'Estimated Distance:',
    'matrix.illustrativeDist': 'Distance (illustrative value):',
    'matrix.illustrativeDistHint':
      'Example value derived from the cell position, not computed from the sequences. The real values are in the Correctness module.',

    // Scalability
    'scall.title': 'Performance Evaluation & Scalability Curves',
    'scall.subtitle':
      'Real experimental benchmarks on the FinisTerrae III supercomputer (CESGA, Intel Xeon Platinum 8352Y, 64 cores/node).',
    'scall.phase3Tab': 'Phase 3 Speedup',
    'scall.phase4Tab': 'Phase 4 Speedup (metacache vs isend)',
    'scall.totalTimeTab': 'Total Execution Time',
    'scall.dataset300': '300 Species (Heterogeneous)',
    'scall.dataset64': '64 Species (Homogeneous)',
    'scall.idealSpeedup': 'Ideal Linear Speedup (Sp = P)',
    'scall.realSpeedup': 'Real Speedup',
    'scall.timeUnit': 'Seconds (Logarithmic Scale)',

    // Correctness
    'num.title': 'Numerical Invariance Verification (IEEE-754)',
    'num.subtitle':
      'Mathematical guarantee of reproducibility: the parallel distance matrix is 100% bitwise identical to the sequential reference.',
    'num.exactMatch': '100% Exact Match / 0.0% Error',
    'num.maxDelta': 'Maximum Error (Δ)',
    'num.verifiedPairs': 'Verified Pairs',
    'num.matrixFragment': 'PHYLIP Distance Matrix Excerpt',
    'num.filterPlaceholder': 'Filter species...',
    'num.speciesPair': 'Species Pair (i × j)',
    'num.sequential': 'Sequential',
    'num.mpiParallel': 'MPI (P ranks)',
    'num.delta': 'Δ Delta',
    'num.rankOwner': 'Rank',
    'num.bitwiseProof': 'Bitwise Hex Identity Proof (IEEE-754):',
    'num.sameBits': '✔ Identical 64-bit double precision in memory.',
  },
};

const LanguageThemeContext = createContext<LanguageThemeContextType | undefined>(undefined);

export const LANG_STORAGE_KEY = 'protspam_lang';
export const THEME_STORAGE_KEY = 'protspam_theme';

export const DEFAULT_LANG: Language = 'es';
export const DEFAULT_THEME: Theme = 'dark';

/**
 * localStorage throws in private-browsing modes and when site data is blocked,
 * so every access degrades to the documented default instead of breaking the page.
 */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preference simply does not persist */
  }
}

export const LanguageThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Astro prerenders this island in Node, where localStorage does not exist, and
  // the first client render has to produce exactly the markup the server emitted.
  // So state starts at the documented defaults and reconciles with storage after
  // mount. The inline boot script in BaseLayout.astro has already applied the
  // stored theme and language to <html> before first paint, so no flash is visible.
  const [lang, setLang] = useState<Language>(DEFAULT_LANG);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const storedLang = readStored(LANG_STORAGE_KEY);
    if (storedLang === 'en' || storedLang === 'es') setLang(storedLang);

    const storedTheme = readStored(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);

    setHydrated(true);
  }, []);

  // Persist and apply only once reconciliation has run; writing before the read
  // would clobber the visitor's stored preference with the default.
  useEffect(() => {
    if (!hydrated) return;
    writeStored(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(THEME_STORAGE_KEY, theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark');
    }
  }, [theme, hydrated]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageThemeContext.Provider value={{ lang, setLang, theme, setTheme, toggleTheme, t }}>
      {children}
    </LanguageThemeContext.Provider>
  );
};

export const useAppLanguageTheme = () => {
  const context = useContext(LanguageThemeContext);
  if (!context) {
    throw new Error('useAppLanguageTheme must be used within LanguageThemeProvider');
  }
  return context;
};
