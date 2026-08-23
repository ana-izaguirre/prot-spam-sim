# Contract: Simulation Engine

Two independent engines: the **step generator** (base algorithm narration) and the
**partitioner** (MPI workload distribution). Both are deterministic and side-effect free.

---

## 1. Step generator — `generateSimulationSteps()`

**Location**: `src/components/ProtSpamStepSimulator.tsx`
**Signature**: `() => void` — closes over the input state, writes `steps` and resets
`currentStep` to 0.
**Determinism**: identical inputs always produce an identical array. No randomness, no
clock reads (`spec.md` SC-008).

### 1.1 Input normalisation

```
patterns := patternInput.split(',')
                        .map(strip characters other than '1' and '*')
                        .filter(non-empty)
            or ['1*11*1'] when empty

S1 := upper-case(s1Input), strip [^A-Z], or 'ACTG' when empty
S2 := upper-case(s2Input), strip [^A-Z], or 'ATTG' when empty
T  := thresholdInput || 8
X  := dropoffInput   || 3        // X-drop bound on the extension
```

This sanitisation is also the XSS boundary: narration strings are injected as HTML, and
only `[1*]` and `[A-Z]` survive normalisation.

### 1.2 Algorithm

```
for each pattern p in patterns:
    L := |p|

    ── Phase 3a: spacedwords() ────────────────────────────────
    emit step "starting pattern p"
    for i in 0 … |S1| − L:
        key := concat(S1[i + k] for k where p[k] == '1')
        index[key] += [i]              // multimap: one key, many positions
        rawList    += {key, pos: i}
        emit step "extracted key at S1[i]"

    ── Phase 3b: std::sort() ──────────────────────────────────
    sorted := rawList sorted by key, lexicographic ascending
    emit step "indexed |sorted| words"

    ── Phase 4: calc_matches() ────────────────────────────────
    for j in 0 … |S2| − L:
        key := concat(S2[j + k] for k where p[k] == '1')
        hits := index[key] or []

        if hits is empty:
            push {key, j} to missStack
            emit step "miss"
        else:
            for each i in hits:
                push {key, i, j} to matchStack
                emit step "hit"
                evaluate extension(i, j, L)     // see 1.3

    ── Extension narration ────────────────────────────────────
    for each evaluated match:
        for k in 0 … alignmentLength − 1:
            emit step "score S1[k] × S2[k] → accumulated"

    record {pattern: p, approvedMatches, dist: 1 / (approvedMatches + 1)}

emit terminal step with globalResults and avgDist = mean(dist)
```

**Step ordering note**: all hit/miss steps for a pattern are emitted _before_ any of that
pattern's extension steps, even though the extensions are computed inline during matching.
The narration therefore reads as "find every hit, then score every hit" — a deliberate
pedagogical grouping, not the interleaving a real implementation would perform.

### 1.3 Extension (gap-free, bidirectional)

```
seedScore := Σ blosum(S1[i + k], S2[j + k]) for k in 0 … L−1

// each direction independently, X-drop bounded:
//   grow while in bounds; keep the length at which the running score peaked;
//   stop once running < best − X
extLeft,  leftScore  := extendWithDropoff(step ↦ (i − 1 − step, j − 1 − step))
extRight, rightScore := extendWithDropoff(step ↦ (i + L + step, j + L + step))

align1 := S1[i − extLeft … i + L + extRight)
align2 := S2[j − extLeft … j + L + extRight)

hspScore := leftScore + seedScore + rightScore
status   := hspScore ≥ T ? 'approved' : 'rejected'
```

Because each direction is trimmed to the length at which its score peaked, the sum of the
trimmed alignment's columns equals `hspScore` exactly — the last value of the narration's
accumulated column is the score the decision uses, so the table cannot disagree with the
verdict.

Each direction's score is clamped at 0 from below (it starts at 0 and only rises), so a
direction that only ever loses points contributes 0 and no characters, rather than a
negative score.

### 1.4 Distance

```
per pattern:  dist_p := 1 / (approvedMatches_p + 1)
overall:      avgDist := mean over patterns of dist_p
```

The Kimura correction `d = −ln(1 − p − 0.2·p²)` is **displayed as the formula** on the
terminal step but is not evaluated; `avgDist` is the synthetic value shown
(`research.md` A.3).

### 1.5 Invariants

- `steps.length ≥ 2` for any input (at least a pattern-start step and the terminal step).
- Exactly one step has `showMatrix === true`, and it is the last.
- Every step's `memoryState` and `stackState` are deep copies; no two steps share mutable
  structure. Consequence: stepping backwards restores state exactly; cost is
  `O(steps × state size)`.
- `s1Pos`/`s2Pos` are `−1` when that sequence has no cursor in the step.

---

## 2. Partitioner — `calculateWorkload()`

**Location**: `src/data/speciesData.ts`
**Signature**

```ts
calculateWorkload(
  speciesList: Species[],
  numProcesses: number,
  algorithmType: 'algoritmo1_cyclic' | 'naive_block' = 'algoritmo1_cyclic'
): ProcessWorkload[]
```

Pure; returns exactly `numProcesses` entries, indexed by rank.

### 2.1 Row cost

Row `i` of an `n × n` symmetric matrix contributes its upper-triangle share:

```
comparisons(i) = n − 1 − i
```

Row 0 costs `n − 1` pairs; row `n − 2` costs 1; row `n − 1` costs 0. The cost is strictly
decreasing in `i` — this monotonic decay is the origin of the structural imbalance.

### 2.2 Strategies

```
algoritmo1_cyclic:  owner(i) = i mod P
naive_block:        b = ceil(n / P) ;  owner(i) = min(floor(i / b), P − 1)
```

Cyclic interleaves expensive low rows with cheap high rows, so each rank receives a
near-uniform pair count. Block gives rank 0 the entire expensive prefix.

**Worked example**, `n = 300`, `P = 4`:

|              | Rank 0 | Rank 1 | Rank 2 | Rank 3 |
| ------------ | -----: | -----: | -----: | -----: |
| Cyclic pairs | 11 325 | 11 250 | 11 175 | 11 100 |
| Block pairs  | 19 650 | 14 025 |  8 400 |  2 775 |

Cyclic spreads within 2 %; block gives rank 0 43.8 % of the work where an even split would
be 25 %, and leaves rank 3 with 6.2 %. Both strategies sum to `300 × 299 / 2 = 44 850`.

### 2.3 Accumulation

For every species index `i`, the owning rank accumulates: `speciesAssigned += [i]`,
`speciesCount += 1`, `totalMaa += maa(i)`, `comparisonsCount += (n − 1 − i)`, and
`hasHomoSapiens |= isHuman(i) || name(i) contains "Homo sapiens"` (the name check is a
redundant safety net for datasets that omit the flag).

### 2.4 Invariants

- `Σ comparisonsCount = n(n − 1) / 2` for every `(n, P, strategy)` (`spec.md` SC-006).
- `Σ speciesCount = n`; the `speciesAssigned` sets are disjoint and cover `0 … n − 1`.
- `Σ totalMaa` equals the dataset total, independent of strategy.
- Ranks with no assigned species are returned as valid zero-filled entries, never omitted.
- The load metric is `maa`, a proxy for the true `O(m · N² · n̄)` pair cost — good enough
  to show the shape of the imbalance, not a runtime model.

### 2.5 What the two datasets isolate

- `SPECIES_64_HOMOGENEOUS`: sizes within a 1.3× range, so any visible imbalance is purely
  geometric.
- `SPECIES_300_UNBALANCED`: a 120× size range, with the largest proteomes at the lowest
  indices — geometric and biological imbalance land on the same ranks, reproducing the
  thesis' `E_max = mean(n) / max(n)` ceiling of 12.6 %.
