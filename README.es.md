# Prot-SpaM HPC Suite y Simulador Interactivo

[English](./README.md) · **Español**

[![CI](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml)
[![Netlify Status](https://api.netlify.com/api/v1/badges/1f070c7e-b6d8-4bf8-addb-f03bcb9cd28b/deploy-status)](https://app.netlify.com/projects/prot-spam/deploys)

Simulador interactivo y explorador de arquitecturas paralelas de **Prot-SpaM**, una
herramienta de reconstrucción filogenética libre de alineamiento para secuencias de
proteoma completo, paralelizada con MPI sobre sistemas de memoria distribuida.

Construido como sitio estático con [Astro](https://astro.build) e islas de React. Sin
backend, sin base de datos y sin llamadas a API en tiempo de ejecución: todo se ejecuta en
el navegador.

---

## Contexto académico

Basado en el **Trabajo de Fin de Máster (TFM)**:

> **«Reconstrucción filogenética de secuencias de proteoma completo en paralelo sobre
> sistemas de memoria distribuida»**

| | |
|---|---|
| **Autora** | Ana Izaguirre Matamoros |
| **Director** | Jorge González Domínguez |
| **Titulación** | Máster Interuniversitario en Computación de Altas Prestaciones (MUI HPC) |
| **Institución** | Facultade de Informática, Universidade da Coruña (UDC) / CESGA |
| **Supercomputador** | FinisTerrae III — Intel Xeon Platinum 8352Y, 64 cores/nodo, OpenMPI 5.0.9, SLURM |

**Repositorio del código C++**: [github.com/ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)

### Ramas de desarrollo

| Rama | Función |
|---|---|
| [`feat/seq`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/seq) | Línea base secuencial limpia con checksum de palabras |
| [`feat/mpi-phase3-a`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-a) | Fase 3 con lectura FASTA centralizada en el rank 0 |
| [`feat/mpi-phase3-b`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase3-b) | Fase 3 con lectura distribuida independiente |
| [`feat/mpi-phase4-metacache`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache) | Fase 4 con `MPI_Send`/`MPI_Recv` bloqueante y caché de metadatos |
| [`feat/mpi-phase4-metacache-isend`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend) | **Recomendada** — ráfagas no bloqueantes `MPI_Isend` con cola `PendingSend` y `MPI_Waitall` |
| [`feat/mpi-phase4-metacache-isend-calcopt`](https://github.com/ana-izaguirre/ProtSpaM/tree/feat/mpi-phase4-metacache-isend-calcopt) | Precálculo por patrón en la ruta secuencial (descartada: +19,5 % de tiempo secuencial) |

---

## El algoritmo que se simula

Prot-SpaM estima distancias filogenéticas sin alineamiento múltiple, comparando secuencias
completas de proteínas mediante **palabras espaciadas** definidas por patrones binarios
(w = 6 posiciones de coincidencia, ℓ = 46, 40 posiciones *don't care*, m = 5 patrones,
umbral T = 0, BLOSUM62).

```
┌─────────────────┐     ┌─────────────────────┐     ┌────────────────────────────────┐
│ 1. Patrones     │ ──> │ 2. Lectura FASTA    │ ──> │ 3. Palabras espaciadas         │
│ Θ(m·ℓ)          │     │ Θ(Σ nᵢ)             │     │ Θ(m·Σ nᵢ log nᵢ)               │
│ Carga fija      │     │ Proteomas completos │     │ Extracción + std::sort         │
└─────────────────┘     └─────────────────────┘     └────────────────────────────────┘
                                                                    │
┌─────────────────┐                                 ┌───────────────▼────────────────┐
│ 5. Salida DMat  │ <────────────────────────────── │ 4. Coincidencias y distancia   │
│ Θ(N²)           │        MPI_Reduce final         │ Θ(m·N²·ñ)                      │
│ Matriz PHYLIP   │                                 │ BLOSUM62 + Kimura (j > i)      │
└─────────────────┘                                 └────────────────────────────────┘
```

**Fase 3 — generación y ordenación de palabras espaciadas.** Unidad de cómputo: la especie.
La llamada a `std::sort` representa por sí sola ~37,3 % del tiempo secuencial. Cada proceso
genera y ordena localmente las palabras de sus especies sin sincronización intermedia.

**Fase 4 — cálculo distribuido de coincidencias.** Unidad de cómputo: el par de especies
(j > i), es decir N(N−1)/2 pares de la media matriz superior. Cabeceras, secuencias y
metadatos se transmiten una sola vez antes del bucle de patrones (`metacache`), y los
búferes de palabras se descartan tras cada patrón para acotar la memoria. La variante
bloqueante se serializa por el protocolo *rendezvous* a partir de 64–128 procesos; la
variante no bloqueante dispara `MPI_Isend` concurrentes registrados en una cola
`PendingSend` y sincroniza una única vez con `MPI_Waitall`, **hasta un 45 % más rápida en
128 cores**.

**Balanceo de carga.** Repartir bloques contiguos de tamaño N/P concentra el trabajo en el
rank 0: un límite estructural de eficiencia cercano al 50 %. La disparidad de tamaños lo
agrava: *Homo sapiens* (69,58 Maa) concentra hasta 207× la carga de un proteoma microbiano
(0,34 Maa), reduciendo la cota E_max = n̄ / n_max al 12,6 %.

**Invarianza numérica.** Calcular cada par (i, j) de forma indivisible en un único proceso y
consolidar con `MPI_Reduce(MPI_SUM)` sobre posiciones disjuntas inicializadas a 0.0 exacto
hace que la matriz PHYLIP paralela sea idéntica bit a bit a la secuencial (Δ = 0.0).

---

## Los siete módulos interactivos

| Módulo | Qué muestra |
|---|---|
| **Algoritmo base** | Narración paso a paso del algoritmo: extracción de palabras espaciadas, indexación con `std::sort`, decisiones de acierto/fallo, extensión BLOSUM62 sin huecos y matriz de distancias final |
| **Ramas TFM** | Las seis ramas Git con su fase, estado, aceleración destacada, decisiones de diseño y fragmentos de C++ representativos |
| **Reparto de carga** | Carga por rank para dos conjuntos, seis recuentos de procesos, dos estrategias de partición y tres métricas, con KPIs de desbalance y un registro de ejecución MPI en vivo |
| **Tráfico MPI** | `MPI_Send` bloqueante frente a `MPI_Isend` no bloqueante sobre una línea temporal por pasos, con la cola `PendingSend` y el estado de cada rank |
| **Matriz triangular** | Rejilla N×N coloreada por rank propietario, con inspección celda a celda de las dos especies, el propietario y el coste relativo |
| **Escalabilidad** | Curvas medidas en FinisTerrae III de 1 a 256 procesos: aceleración de Fase 3, Fase 4 `metacache` vs `isend` y tiempo total |
| **Invarianza** | Valores PHYLIP secuenciales frente a paralelos con su codificación IEEE-754 en crudo, demostrando la identidad bit a bit |

Ambos idiomas (español/inglés) y ambos temas (oscuro/claro) se aplican a todos los módulos y
persisten entre recargas.

---

## Arquitectura

### Por qué Astro

La suite era originalmente una SPA de Vite: siete módulos, Chart.js y jsPDF en un único
paquete de 959 kB que debía ejecutarse antes de que apareciera nada en pantalla. La
migración a Astro cambia el modelo de entrega, no las funcionalidades.

| | Antes (SPA con Vite) | Después (islas de Astro) |
|---|---|---|
| Primer pintado | tras ejecutar el paquete JS | HTML prerenderizado |
| JS inicial | 958,9 kB (~300 kB gzip) | **270,6 kB (~82 kB gzip)** |
| Código de módulos | un paquete con los siete | un *chunk* por módulo, bajo demanda |
| Chart.js (167 kB) | siempre | solo con los dos módulos de gráficas |
| jsPDF (398 kB) | siempre | solo al descargar la ficha |
| Arranque de tema/idioma | tras la hidratación (parpadeo visible) | script en línea, antes del pintado |
| Head / SEO | `index.html` escrito a mano | layout de Astro tipado y componible |

### Cómo encaja todo

```
Astro (build, estático)                   React (navegador, una isla)
┌──────────────────────────────┐          ┌────────────────────────────────┐
│ BaseLayout.astro             │          │ AppShell → App                 │
│  · <head>, fuentes, SEO      │          │  · LanguageThemeProvider       │
│  · script tema/idioma        │─ client: │  · cabecera, nav, modal        │
│ index.astro                  │  load ──>│  · conmutación con Suspense    │
│  · la única ruta             │          │      ├── algoritmo base (eager)│
│ 404.astro                    │          │      └── 6 módulos (lazy)      │
└──────────────────────────────┘          └────────────────────────────────┘
```

**Una isla, no siete.** El módulo activo, el idioma y el tema son estado cliente compartido
y mutable, así que repartir los módulos en islas hermanas exigiría un almacén externo: una
reescritura en lugar de una migración, y sin ganancia real, porque solo hay un módulo
montado a la vez. La mejora de payload viene de `React.lazy`.

**Estado seguro para el prerenderizado.** Astro ejecuta la isla en Node durante el *build*,
así que el proveedor arranca con los valores por defecto documentados (`es`, `dark`) y se
reconcilia con `localStorage` en un efecto de montaje. Un script en línea en `<head>` aplica
la clase de tema y el atributo `lang` guardados antes del primer pintado, de modo que la
reconciliación es invisible. Ambas implementaciones comparten las mismas claves y valores
por defecto exportados para que no puedan divergir.

**Acceso defensivo al almacenamiento.** La navegación privada y el bloqueo de datos de sitio
hacen que `localStorage` lance excepciones; toda lectura y escritura está protegida y
degrada al valor por defecto documentado.

### Estructura del proyecto

```
astro.config.mjs              # salida estática, integración React, plugin Vite de Tailwind 4
src/
├── pages/
│   ├── index.astro           # la única ruta
│   └── 404.astro             # página estática de no encontrado
├── layouts/
│   └── BaseLayout.astro      # <head>, fuentes, SEO, script de tema/idioma
├── islands/
│   └── AppShell.tsx          # punto de entrada de hidratación
├── App.tsx                   # shell: cabecera, nav, banner, modal y conmutador de módulos
├── components/               # los siete módulos (React, sin cambios en la migración)
├── context/
│   └── LanguageThemeContext.tsx   # diccionario i18n + tema, seguro para prerenderizado
├── data/
│   └── speciesData.ts        # conjuntos, particionador y series de escalabilidad medidas
├── utils/
│   └── generatePdf.ts        # ficha PDF con jsPDF en el navegador (importada dinámicamente)
└── index.css                 # entrada de Tailwind, overrides de tema claro, estilos de tarjeta
public/                       # favicon.svg, robots.txt
specs/                        # especificación con GitHub Spec Kit (ver abajo)
```

### Datos estáticos

Todo se compila dentro del paquete: no hay descarga de datos en tiempo de ejecución.

| Conjunto | Contenido |
|---|---|
| `SPECIES_64_HOMOGENEOUS` | 64 especies sintéticas, ≈12,4–16,0 Maa. Los tamaños abarcan 1,3×, así que todo desbalance mostrado es puramente geométrico |
| `SPECIES_300_UNBALANCED` | 300 especies: 15 taxones reales (*Homo sapiens* 69,58 Maa … *M. genitalium* 0,58 Maa) más 285 de relleno log-normal. Los proteomas mayores ocupan los índices más bajos, así que el desbalance geométrico y el biológico recaen sobre los mismos ranks |
| `SCALABILITY_DATA` | Resultados medidos en FinisTerrae III de 1 a 256 procesos, balanceado y desbalanceado, Fase 3 / Fase 4 / total, `metacache` e `isend` |
| `PHYLIP_SAMPLE_DATA` | 16 celdas verificadas con valor secuencial, valor paralelo, delta (siempre exactamente 0) y rank propietario |

Las tablas de escalabilidad son el único lugar donde los números son medidas experimentales
del TFM. Están transcritas: nunca se interpolan ni se recalculan en el navegador.

---

## Puesta en marcha

Requiere **Node.js 20 o superior**.

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:3000
npm run build     # sitio estático en dist/
npm run preview   # sirve el sitio construido
npm run lint      # astro check — diagnósticos de TypeScript y Astro
```

### Despliegue

La salida del *build* es completamente estática, así que sirve cualquier alojamiento sin
configuración:

```bash
npm run build && npx serve dist    # o Netlify, Vercel, GitHub Pages, S3, nginx
```

La única petición externa de la página es la hoja de estilos de Google Fonts; sin ella la
suite recurre a las fuentes del sistema y sigue plenamente funcional.

#### Despliegue continuo

`.github/workflows/ci.yml` se ejecuta en cada *pull request* y en cada *push* a `main`:

1. **Comprobación** — `npm ci`, `astro check`, `astro build` y una verificación que falla si
   faltan `index.html`, `404.html`, `robots.txt` o `favicon.svg`, o si el HTML
   prerenderizado sale vacío (lo que significaría que la isla ha vuelto silenciosamente a
   ser *client-only*).
2. **Despliegue** — el directorio construido se sube a Netlify: **producción** en `main` y
   una **preview** con alias (`pr-<número>`) en los *pull requests*. La URL del despliegue
   se escribe en el resumen del *job*. Los PR desde *forks* se construyen pero no despliegan,
   porque los secretos no están disponibles para ellos.

Secretos y variables necesarios en el repositorio:

| Nombre | Tipo | Para qué |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | secreto | Token de acceso personal de Netlify (*User settings → Applications → New access token*) |
| `NETLIFY_SITE_ID` | secreto | API ID del sitio (*Site configuration → General → Site information*) |
| `SITE_URL` | variable | Origen de producción, p. ej. `https://tu-sitio.netlify.app`. Define `site` en Astro, que emite las etiquetas `canonical` y `og:url`. Opcional: se omiten si no está definida |

`netlify.toml` lleva las cabeceras de caché y seguridad: los recursos con *hash* en
`/_astro/*` son inmutables durante un año, el HTML siempre se revalida, más `nosniff`,
`Referrer-Policy` y `X-Frame-Options`.

---

## Especificación

El proyecto está documentado con [GitHub Spec Kit](https://github.com/github/spec-kit).

| Documento | Contenido |
|---|---|
| [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) | Los cinco principios rectores |
| [`specs/001-protspam-hpc-simulator/spec.md`](./specs/001-protspam-hpc-simulator/spec.md) | Historias de usuario, 38 requisitos funcionales y criterios de éxito |
| [`…/plan.md`](./specs/001-protspam-hpc-simulator/plan.md) | El plan de migración de Vite a Astro |
| [`…/tasks.md`](./specs/001-protspam-hpc-simulator/tasks.md) | Las siete tareas de migración y los defectos diferidos |
| [`…/research.md`](./specs/001-protspam-hpc-simulator/research.md) | Análisis del prototipo y decisiones de migración |
| [`…/data-model.md`](./specs/001-protspam-hpc-simulator/data-model.md) | Todas las entidades y conjuntos de datos estáticos |
| [`…/contracts/`](./specs/001-protspam-hpc-simulator/contracts/) | Contratos de componentes, motor de simulación e i18n |
| [`…/quickstart.md`](./specs/001-protspam-hpc-simulator/quickstart.md) | Comandos, escenarios de verificación manual y despliegue |

### Simplificaciones conocidas

El simulador es una **herramienta didáctica**, no una reimplementación de la herramienta
C++. Las simplificaciones deliberadas —una tabla de sustitución 4×4 en lugar de BLOSUM62,
una extensión sin corte X-drop, una distancia sintética por patrón, una línea temporal MPI
guionizada— están recogidas en
[`research.md`](./specs/001-protspam-hpc-simulator/research.md) §A.3, y los defectos
abiertos en [`tasks.md`](./specs/001-protspam-hpc-simulator/tasks.md) (D001–D006).

---

## Recursos

- **Código C++**: [github.com/ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)
- **Ficha del TFM**: se genera como PDF en el navegador desde la cabecera o el modal de documentación
