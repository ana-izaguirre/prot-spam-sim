# Prot-SpaM HPC Suite & Simulador Interactivo

Simulador interactivo y explorador de arquitecturas paralelas de **Prot-SpaM** para la reconstrucción filogenética libre de alineamiento a escala de proteoma completo sobre sistemas de memoria distribuida (MPI).

Basado en el **Trabajo de Fin de Máster (TFM)**:
> **"Reconstrucción filogenética de secuencias de proteoma completo en paralelo sobre sistemas de memoria distribuida"**  
> **Autora:** Ana Izaguirre Matamoros  
> **Director:** Jorge González Domínguez  
> **Titulación:** Máster Interuniversitario en Computación de Altas Prestaciones  
> **Institución:** Facultade de Informática da Coruña, Universidade da Coruña (UDC) / Centro de Supercomputación de Galicia (CESGA)  
> **Supercomputador:** FinisTerrae III (Intel Xeon Platinum 8352Y, 64 cores/nodo, OpenMPI 5.0.9, SLURM)

---

## 🔗 Enlaces del Proyecto y Repositorio Oficial

- **Repositorio GitHub (Fork con ramas del TFM):** [https://github.com/ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)
- **Ramas de desarrollo incremental:**
  - `feat/seq`: Implementación secuencial limpia de referencia e instrumentación de checksum.
  - `feat/mpi-phase3-a`: Paralelización de Fase 3 con Opción A (Lectura centralizada en Rank 0 y distribución punto a punto).
  - `feat/mpi-phase3-b`: Paralelización de Fase 3 con Opción B (Lectura distribuida independiente en cada proceso).
  - `feat/mpi-phase4-metacache`: Paralelización de Fase 4 con comunicación punto a punto bloqueante (`MPI_Send`/`MPI_Recv`) y caché de metadatos.
  - `feat/mpi-phase4-metacache-isend`: Comunicación no bloqueante en ráfagas (`MPI_Isend` + cola `PendingSend` + sincronización `MPI_Waitall`).
  - `feat/mpi-phase4-metacache-isend-calcopt`: Optimización de precálculo por patrón trasladada a la ruta secuencial ($np=1$).

---

## 🏛️ Arquitectura Computacional de Prot-SpaM

Prot-SpaM estima distancias filogenéticas sin alineamiento múltiple comparando secuencias completas de proteínas a través de **palabras espaciadas** (*spaced words*) definidas por patrones binarios (ej. $w=6$ posiciones de coincidencia, $\ell=46$, $dc=40$ posiciones don't-care, $m=5$ patrones, umbral $T=0$ y matriz BLOSUM62).

El algoritmo consta de 5 fases:

```
┌─────────────────┐     ┌─────────────────────┐     ┌────────────────────────────────┐
│ 1. Patrones     │ ──> │ 2. Lectura FASTA    │ ──> │ 3. Palabras Espaciadas         │
│ (Θ(m·ℓ))        │     │ (Θ(Σ n_i))          │     │ (Θ(m·Σ n_i log n_i))           │
│ Carga fija      │     │ Proteomas completos │     │ Extracción + std::sort         │
└─────────────────┘     └─────────────────────┘     └────────────────────────────────┘
                                                                    │
                                                                    ▼
┌─────────────────┐                                 ┌────────────────────────────────┐
│ 5. Salida DMat  │ <────────────────────────────── │ 4. Coincidencias y Distancia   │
│ (Θ(N²))         │        MPI_Reduce final         │ (Θ(m·N²·ñ))                    │
│ Matriz PHYLIP   │                                 │ BLOSUM62 + Kimura (j > i)      │
└─────────────────┘                                 └────────────────────────────────┘
```

### 1. Fase 3: Generación y Ordenación de Palabras Espaciadas
- **Unidad de cómputo:** Por especie.
- **Cuello de botella secuencial:** La llamada a `std::sort` representa ~37.3% del tiempo total de la herramienta secuencial.
- **Paralelización:** Cada proceso genera y ordena localmente las palabras de sus especies asignadas sin sincronización intermedia.
- **Estrategias evaluadas:**
  - **Opción A (Centralizada):** Proceso 0 lee de disco y envía bloques con `MPI_Send`. Escala mejor en grandes conjuntos (30 y 300 especies).
  - **Opción B (Distribuida):** Todos los procesos leen en paralelo de disco compartido (I/O intensivo).

### 2. Fase 4: Cálculo Distribuido de Coincidencias
- **Unidad de cómputo:** Pares de especies ($j > i$, media matriz triangular superior con $N(N-1)/2$ pares).
- **Caché de metadatos (`metacache`):** Cabeceras, secuencias y metadatos se transmiten una única vez antes del bucle de patrones.
- **Streaming patrón a patrón:** Se evita saturación de memoria RAM descartando los buffers de palabras tras procesar cada patrón.
- **Mecanismo Bloqueante (`metacache`):** Usa `MPI_Send` secuencial sobre cada destino. A partir de 64-128 procesos sufre de contención y serialización por el protocolo *rendezvous*.
- **Mecanismo No Bloqueante (`isend`):** Dispara `MPI_Isend` concurrentes almacenados en la estructura `PendingSend` y espera con un único `MPI_Waitall`, logrando hasta un **45% de reducción de tiempo** frente a `metacache` en 128 cores en el CESGA FinisTerrae III.

### 3. Balanceo de Carga y Límites Teóricos
1. **Desbalance por Estructura Triangular:** Asignar bloques contiguos de tamaño $b = N/P$ concentra más pares en el Rank 0 ($b(N-1)$ pares) y casi ninguno en el Rank $P-1$, imponiendo un límite estructural de eficiencia de ~50%.
2. **Disparidad de Tamaños de Proteoma:** En datasets heterogéneos, especies como *Homo sapiens* (69.58 Maa) concentran hasta 207× más carga que especies microbianas (0.34 Maa), reduciendo la cota $E_{max} = \bar{n} / n_{max}$ al 12.6%.

### 4. Invarianza Numérica (Exactitud IEEE-754)
Al calcular cada par $(i,j)$ de manera indivisible en un único proceso y consolidar con `MPI_Reduce(MPI_SUM)` sobre posiciones disjuntas inicializadas en 0.0 exacto, la matriz PHYLIP paralela es **100% idéntica bit a bit** a la secuencial ($\Delta = 0.000000000000$).

---

## 💻 ¿Cómo fue construido este Simulador Web?

El simulador interactivo está desarrollado como una SPA reactiva moderna optimizada para demostración científica y visualización de conceptos de HPC:

- **Core & Runtime:** Vite + React 19 + TypeScript (ESNext / C++11 aligned).
- **Estilos & Diseño:** Tailwind CSS 4 configurado con **Bento Grid** minimalista (fondo `slate-950`, tarjetas `slate-900/50`, bordes `slate-800`, paleta semántica esmeralda/azul/ámbar/rosa).
- **Gráficos Interactivos:** Chart.js + `react-chartjs-2` con curvas de *Strong Scaling* (Aceleración $S_p$, Eficiencia $E_p$, tiempo de ejecución $T(P)$) y anotaciones de puntos críticos (128P / 256P).
- **Iconografía:** `lucide-react`.
- **Módulos Interactivos:**
  1. *Simulador de Distribución de Carga (Workload)*: Carga por rank, efecto de *Homo sapiens*, métricas de balanceo.
  2. *Visualizador de Comunicación MPI*: Animación de paquetes en tránsito, estado de colas `PendingSend`, comparación `metacache` vs `isend`.
  3. *Explorador de Matriz Triangular*: Inspección par a par de especies con cálculo de complejidad BLOSUM62 y asignación de proceso $i \pmod P$.
  4. *Simulador Algorítmico Paso a Paso*: Secuencias $S_1$/$S_2$, extracción de ventanas, matriz BLOSUM62, acumulación y cálculo de distancia de Kimura.
  5. *Curvas de Escalabilidad HPC*: Datos experimentales reales tomados en el supercomputador FinisTerrae III (1 a 256 procesos).
  6. *Verificador de Corrección Numérica*: Comparador IEEE-754 en coma flotante de 64 bits con inspección hexadecimal y bitwise XOR.

---

## 🚀 Compilación y Ejecución del Código C++ (FinisTerrae III CESGA)

```bash
# 1. Clonar el repositorio
git clone --branch feat/mpi-phase4-metacache-isend https://github.com/ana-izaguirre/ProtSpaM.git
cd ProtSpaM

# 2. Cargar módulos en el clúster
module load cesga/2025 gcc openmpi/5.0.9

# 3. Compilar con optimizaciones
make

# 4. Ejecución paralela MPI (ejemplo 128 procesos en 4 nodos)
mpirun --map-by ppr:32:node -np 128 ./bin/Debug/protspam \
  -l filelist_300 -p patterns_clean.txt -o DMat_output.phylip
```

---

## 📄 Descargas y Recursos Académicos

- **Memoria del TFM:** Disponible para consulta y descarga mediante el botón "Descargar Memoria TFM (PDF)" en la barra superior y modal de documentación del simulador.
- **Código Fuente C++:** [GitHub ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)
