# ProtSpam HPC Suite — Simulador Interactivo

[English](./README.md) · **Español**

[![CI](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/ana-izaguirre/prot-spam-sim/actions/workflows/ci.yml)
[![Smoke tests](https://img.shields.io/badge/smoke%20tests-Playwright-2EAD33?logo=playwright&logoColor=white)](./tests/smoke.spec.ts)
[![Live site](https://img.shields.io/badge/live-GitHub%20Pages-121011?logo=github)](https://ana-izaguirre.github.io/prot-spam-sim/)

Un simulador interactivo que hace visible una paralelización MPI: cómo una carga triangular
no se equilibra sola, por qué los envíos bloqueantes colapsan en 128 procesos y qué hace
realmente un algoritmo de palabras espaciadas, paso a paso.

El algoritmo, la memoria del TFM y la implementación en C++ viven en su propio repositorio:
**[ana-izaguirre/ProtSpaM](https://github.com/ana-izaguirre/ProtSpaM)**. Este repositorio es
solo el simulador.

---

## Cómo se construyó

Lo interesante de este proyecto es su cadena de construcción: cuatro herramientas, cada una
haciendo aquello en lo que realmente es buena, con una especificación escrita como formato
de entrega entre ellas.

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ 1. Google Stitch │──▶│ 2. Google AI     │──▶│ 3. GitHub Spec   │──▶│ 4. Claude Code   │
│                  │   │    Studio        │   │    Kit           │   │                  │
│ Diseño visual    │   │ Prototipo React  │   │ El prototipo     │   │ Migración a      │
│ de la interfaz   │   │ funcional, Vite  │   │ puesto por       │   │ Astro, arreglo   │
│                  │   │ + Tailwind       │   │ escrito          │   │ de defectos,     │
│                  │   │                  │   │                  │   │ CI/CD            │
└──────────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
     el aspecto            algo que              qué hace y por qué      algo publicable
                           funciona
```

**1 — Google Stitch: el diseño.** El lenguaje visual vino primero: la retícula Bento, la
paleta oscura con sus acentos semánticos, la densidad de los paneles de control. Diseñar
antes de programar es lo que mantiene siete módulos técnicos densos pareciendo un solo
producto.

**2 — Google AI Studio: el prototipo funcional.** El diseño de Stitch se convirtió en una
aplicación React 19 + Vite: siete módulos interactivos, dos idiomas, visualizaciones con
Chart.js, exportación a PDF en el navegador. Esto es lo que demostró que la idea
funcionaba y, como casi todo prototipo, estaba optimizado para existir, no para mantenerse.

**3 — GitHub Spec Kit: poner por escrito lo que hay.** Antes de tocar nada, el prototipo se
sometió a ingeniería inversa hasta una especificación
[Spec Kit](https://github.com/github/spec-kit): una constitución de principios, historias
de usuario y requisitos funcionales, un modelo de datos, contratos de componentes y del
motor de simulación, y el plan de migración. Ese paso es lo que convirtió un código
heredado en algo que se podía cambiar con seguridad, y sacó a la luz seis defectos reales
que nadie había visto, incluido un parámetro de la simulación que no hacía nada y una tabla
de puntuación que decía ser BLOSUM62 sin serlo.

**4 — Claude Code: la ingeniería.** Trabajando desde la especificación: migración de Vite a
Astro (**payload inicial 958,9 kB → 270,6 kB de JavaScript**), los seis defectos arreglados de
uno en uno en su propio pull request, una suite de humo con Playwright, y una tubería CI/CD
que comprueba tipos, construye, prueba en un navegador real y solo entonces despliega.

> Esos 270,6 kB son lo que consiguió la migración en su momento, contando solo JavaScript.
> Medido hoy sobre la petición completa de la portada —todos los ficheros del propio origen
> que el navegador descarga para renderizar `/`, HTML y CSS incluidos, Google Fonts excluido—
> la cifra es de **450,4 kB en bruto / 125,6 kB comprimidos**. Se reproduce con
> `npm run build && npm run preview` y leyendo el panel de red en `/`.

La especificación no es documentación escrita a posteriori: es el artefacto que cada etapa
entregó a la siguiente, y sigue siendo el contrato al que se somete el código. Está en
[`specs/`](./specs/001-protspam-hpc-simulator/) y
[`.specify/`](./.specify/memory/constitution.md).

---

## Qué muestra el simulador

| Módulo                | Qué hace visible                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Cómo funciona**     | Una ejecución completa de cada versión —`seq`, fase 3a, fase 3b, `metacache`, `isend`— llamada a llamada |
| **Algoritmo base**    | Extracción de palabras espaciadas, indexación y extensión acotada por X-drop, narradas paso a paso       |
| **Ramas TFM**         | Las seis ramas de desarrollo en C++, su fase y su aceleración medida                                     |
| **Reparto de carga**  | Carga por rank con el reparto por bloques implementado frente al cíclico propuesto                       |
| **Tráfico MPI**       | `MPI_Send` bloqueante serializándose frente a `MPI_Isend` no bloqueante solapando                        |
| **Matriz triangular** | Qué rank posee cada par y por qué media matriz no se calcula nunca                                       |
| **Escalabilidad**     | Los tres experimentos medidos del TFM (cuadros 6.2, 6.3 y 6.4), cada uno con su propia base              |
| **Invarianza**        | Valores PHYLIP secuenciales frente a paralelos, comparados a nivel de bits IEEE-754                      |

Todo es cliente y determinista: sin backend, sin llamadas a API en ejecución, sin
aleatoriedad. Los números de escalabilidad están transcritos punto a punto de los cuadros
numerados del TFM y nunca se recalculan en el navegador; donde el TFM no midió una
configuración, el módulo no dibuja un punto interpolado: no dibuja nada.

**Cómo funciona** es el módulo de entrada y el primero que conviene abrir: recorre una
ejecución entera de cada rama, llamada a llamada, mostrando qué hace cada proceso, qué
mensajes viajan y por qué el diseño es así. No modela ningún tiempo — el reparto, los
propietarios, la asignación de pares y la matriz de necesidad remota se calculan con las
mismas fórmulas que el C++, y los segundos se quedan en el módulo de escalabilidad.

> **Es una herramienta didáctica, no la herramienta C++.** Las simplificaciones
> deliberadas —una tabla de sustitución 4×4 en lugar de BLOSUM62, una línea temporal MPI
> guionizada, distancias sintéticas por patrón— están recogidas en
> [`research.md` §A.3](./specs/001-protspam-hpc-simulator/research.md). La propia interfaz
> también lo dice.

---

## Arquitectura

**Astro 5, salida estática, una isla de React.** El documento, las fuentes, las etiquetas
SEO y el script de arranque de tema/idioma se renderizan en tiempo de construcción. La
suite se hidrata como una única isla, porque el módulo activo, el idioma y el tema son
estado cliente compartido; la mejora de payload viene de `React.lazy` por módulo — Chart.js
solo se descarga con los dos módulos que lo usan, y jsPDF solo al descargar la ficha.

```
src/
├── pages/index.astro · 404.astro     las rutas
├── layouts/BaseLayout.astro          head, fuentes, SEO, arranque de tema/idioma
├── islands/AppShell.tsx              punto de entrada de hidratación
├── App.tsx                           shell, navegación, conmutación lazy de módulos
├── components/                       los ocho módulos
├── context/                          diccionario i18n + tema (seguro en prerenderizado)
├── data/speciesData.ts               conjuntos, particionador, series medidas
└── utils/generatePdf.ts              PDF en el navegador (importado dinámicamente)
```

---

## Puesta en marcha

Requiere **Node.js 20 o superior**.

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # sitio estático en dist/
npm test              # suite de humo con Playwright sobre el build
npm run lint          # astro check
npm run status:site   # ¿está producción en pie?
```

**Despliegue.** Cada push a `main` y cada pull request ejecuta type-check → build → suite de
humo en navegador; los push a `main` publican además en **GitHub Pages**. Un despliegue que
no responda 200 con HTML prerenderizado hace fallar el run. No hacen falta secretos —Pages
se autentica con el token OIDC del propio workflow—, pero _Settings → Pages → Source_ debe
estar en **GitHub Actions**. Define la variable `SITE_URL` como
`https://ana-izaguirre.github.io/prot-spam-sim/` para emitir las etiquetas `canonical` y
`og:url`.

Pages sirve un sitio de proyecto desde `/<repo>/`, así que la build de producción fija
`BASE_PATH`; las builds de pull request se quedan en la raíz. Pages aloja un sitio por
repositorio, de modo que no hay previews por pull request ni cabeceras propias de caché o
seguridad.

**Contribuir.** Un cambio por pull request, verde por sí solo, con la rama prefijada por su
tipo de cambio — las reglas están en la
[constitución](./.specify/memory/constitution.md), y
[`quickstart.md`](./specs/001-protspam-hpc-simulator/quickstart.md) tiene los escenarios de
verificación.

---

## Licencia

[MIT](./LICENSE) © Ana Izaguirre Matamoros. El algoritmo Prot-SpaM y su implementación en
C++ se rigen por los términos de su propio repositorio.
