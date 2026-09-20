#!/usr/bin/env python3
"""Prepare the BizzJev CFPB Debt-collection 100-case benchmark (data prep only).

Deterministic pipeline over the July 2026 CFPB export:
    load -> mechanical filter -> exact-dedup -> conflict exclusion
         -> seeded sample (25 x 4 frozen labels) -> seeded shuffle -> write CSV

Rules implemented (frozen methodology):
- Product == "Debt collection", non-empty narrative, Issue in the 4 frozen labels.
- Exact-duplicate narratives: keep exactly one row per narrative text
  (the row with the smallest Complaint ID; ties impossible - IDs are unique).
- Conflicting labels: if the same exact narrative occurs under more than one
  Issue within the candidate pool, ALL occurrences of that narrative are excluded.
- Narrative text is copied verbatim from the source; nothing is edited.
- Seed = 42 for sampling (labels processed in frozen order, candidates sorted
  by Complaint ID) and a fresh Random(42) for the final shuffle.
- No LLM/AI involvement of any kind; no relabeling; no semantic filtering.

Reproducibility note: sampling/shuffle use CPython's random.Random (Mersenne
Twister). Same source file + same CPython stdlib => byte-identical output.
"""
from __future__ import annotations

import csv
import hashlib
import random
from collections import defaultdict
from pathlib import Path

SEED = 42
PER_LABEL = 25
FROZEN_LABELS = [
    "Attempts to collect debt not owed",
    "Written notification about debt",
    "False statements or representation",
    "Took or threatened to take negative or legal action",
]
OUT_COLS = ["Complaint ID", "Product", "Issue", "Sub-issue", "Consumer complaint narrative"]

REPO = Path(__file__).resolve().parents[1]
RAW = REPO / "data" / "raw" / "cfpb" / "CCDB_Export_20_July_2026.csv"
OUT = REPO / "data" / "prepared" / "cfpb" / "cfpb-debt-100.csv"


def id_sort_key(cid: str):
    cid = cid.strip()
    return (0, int(cid)) if cid.isdigit() else (1, cid)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_pool(raw: Path):
    """One pass over the raw CSV. Returns (pool_rows, dc_narrative_issues)."""
    pool = []
    dc_narrative_issues = defaultdict(set)  # narrative -> all Issue labels in Debt collection
    with open(raw, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx = {n: header.index(n) for n in OUT_COLS}
        for row in reader:
            if row[idx["Product"]] != "Debt collection":
                continue
            narrative = row[idx["Consumer complaint narrative"]]
            if not narrative.strip():
                continue
            dc_narrative_issues[narrative].add(row[idx["Issue"]])
            if row[idx["Issue"]] not in FROZEN_LABELS:
                continue
            pool.append({c: row[idx[c]] for c in OUT_COLS})
    return pool, dc_narrative_issues


def main() -> None:
    pool, dc_narrative_issues = load_pool(RAW)

    # --- conflict detection within the candidate pool (4 frozen labels) ---
    pool_narrative_issues = defaultdict(set)
    for r in pool:
        pool_narrative_issues[r["Consumer complaint narrative"]].add(r["Issue"])
    conflicting = {n for n, issues in pool_narrative_issues.items() if len(issues) > 1}
    conflict_rows_excluded = sum(1 for r in pool if r["Consumer complaint narrative"] in conflicting)

    kept = [r for r in pool if r["Consumer complaint narrative"] not in conflicting]

    # --- exact dedup: one row per narrative, smallest Complaint ID wins ---
    by_narrative = {}
    for r in sorted(kept, key=lambda r: id_sort_key(r["Complaint ID"])):
        by_narrative.setdefault(r["Consumer complaint narrative"], r)
    deduped = list(by_narrative.values())
    dup_rows_removed = len(kept) - len(deduped)

    # --- per-label candidates (sorted for determinism) ---
    candidates = {label: [] for label in FROZEN_LABELS}
    for r in deduped:
        candidates[r["Issue"]].append(r)
    for label in FROZEN_LABELS:
        candidates[label].sort(key=lambda r: id_sort_key(r["Complaint ID"]))

    stats = []
    for label in FROZEN_LABELS:
        raw_rows = sum(1 for r in pool if r["Issue"] == label)
        conf_rows = sum(1 for r in pool if r["Issue"] == label and r["Consumer complaint narrative"] in conflicting)
        dups = sum(
            1
            for n, issues in pool_narrative_issues.items()
            if issues == {label} and sum(1 for r in pool if r["Issue"] == label and r["Consumer complaint narrative"] == n) > 1
        )
        final = len(candidates[label])
        stats.append((label, raw_rows, conf_rows, raw_rows - conf_rows - final, final))
        if final < PER_LABEL:
            raise SystemExit(f"FATAL: only {final} candidates for {label!r} (< {PER_LABEL}); aborting, nothing written.")

    # --- seeded sample: one RNG, labels in frozen order, populations pre-sorted ---
    rng = random.Random(SEED)
    selected = [r for label in FROZEN_LABELS for r in rng.sample(candidates[label], PER_LABEL)]

    # --- seeded final shuffle so rows are not grouped by label ---
    random.Random(SEED).shuffle(selected)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLS, lineterminator="\n")
        w.writeheader()
        w.writerows(selected)

    # --- validation ---
    with open(OUT, newline="", encoding="utf-8") as f:
        out_rows = list(csv.DictReader(f))
    issues_in_out = [r["Issue"] for r in out_rows]
    nars = [r["Consumer complaint narrative"] for r in out_rows]
    checks = {
        "total rows == 100": len(out_rows) == 100,
        "25 rows per Issue": all(issues_in_out.count(l) == PER_LABEL for l in FROZEN_LABELS),
        "all Product == Debt collection": all(r["Product"] == "Debt collection" for r in out_rows),
        "all narratives non-empty": all(n.strip() for n in nars),
        "narratives unique by exact text": len(set(nars)) == len(nars),
        "no Issue outside frozen labels": set(issues_in_out) <= set(FROZEN_LABELS),
        "no selected narrative had conflicting pool labels": all(
            len(pool_narrative_issues.get(n, set())) == 1 for n in nars
        ),
    }

    # informational only (never an exclusion rule): pool narratives whose text
    # also appears under a non-pool Debt collection Issue in the raw source
    cross_pool = {
        n
        for n in pool_narrative_issues
        if n not in conflicting and len(dc_narrative_issues.get(n, set())) > 1
    }

    print(f"source: {RAW}")
    print(f"output: {OUT}")
    print("\nper-label pipeline stats (raw pool rows / conflict rows excl / dup rows removed / candidates before sampling):")
    for label, raw_rows, conf_rows, dups, final in stats:
        print(f"  {label}: {raw_rows} / {conf_rows} / {dups} / {final}")
    print(f"\npool rows entering pipeline: {len(pool)}")
    print(f"conflicting-label narratives excluded: {len(conflicting)} ({conflict_rows_excluded} rows)")
    print(f"exact-duplicate rows removed (after conflict exclusion): {dup_rows_removed}")
    print(f"candidates after dedup+conflict exclusion: {len(deduped)}")
    print(f"informational - pool narratives also appearing under a non-pool DC issue (NOT excluded): {len(cross_pool)}")
    print(f"random seed: {SEED}")
    print("\nvalidation:")
    for name, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'} - {name}")
    if not all(checks.values()):
        raise SystemExit("VALIDATION FAILED")
    print(f"\nsha256({OUT.name}): {sha256_of(OUT)}")


if __name__ == "__main__":
    main()
