#!/usr/bin/env python3
"""Consumer-selected Issue prediction experiment v1: eligible set + design/test splits.

Data-preparation only. No Jev calls, no judgment design, no evaluation.

Pipeline (deterministic, seed=42):
  1. From data/raw/cfpb/CCDB_Export_20_July_2026.csv keep rows with:
       Product == "Debt collection"
       non-empty Consumer complaint narrative (whitespace-trim check)
       Issue in the four frozen labels
       non-empty Sub-issue (defensive; expected to remove nothing)
  2. Exclude narratives whose exact text occurs under more than one Issue
     (conflicting consumer selections) - removed from BOTH future splits.
  3. Exact dedup: one row per narrative text (smallest Complaint ID wins).
  4. Split DESIGN/TEST stratified by (Issue, Sub-issue), 60/40 target:
       n==1            -> DESIGN (every Sub-issue visible in DESIGN)
       n>=2            -> design_k = clamp(round(0.6*n), 1, n-1)
     Within each Sub-issue, candidates sorted by Complaint ID and sampled
     with random.Random(42). Output CSVs sorted by Complaint ID.
  5. Leakage checks + template-risk report (report only, no removal).
  6. Writes eligible.csv, design.csv, test.csv, split-manifest.json, and
     docs/CFPB_CONSUMER_ISSUE_DESIGN_SET.md (DESIGN examples only).
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SEED = 42
DESIGN_FRACTION = 0.60
FROZEN_LABELS = [
    "Attempts to collect debt not owed",
    "Written notification about debt",
    "False statements or representation",
    "Took or threatened to take negative or legal action",
]
COLS = ["Complaint ID", "Product", "Sub-product", "Issue", "Sub-issue", "Consumer complaint narrative"]

REPO = Path(__file__).resolve().parents[1]
RAW = REPO / "data" / "raw" / "cfpb" / "CCDB_Export_20_July_2026.csv"
OUT_DIR = REPO / "data" / "prepared" / "cfpb" / "consumer-issue-prediction-v1"
OLD_BENCH = REPO / "data" / "prepared" / "cfpb" / "cfpb-debt-100.csv"
DOC = REPO / "docs" / "CFPB_CONSUMER_ISSUE_DESIGN_SET.md"


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def id_key(cid: str):
    cid = cid.strip()
    return (0, int(cid)) if cid.isdigit() else (1, cid)


def write_csv(path: Path, rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ---------- STEP 1: eligible pool ----------
    dc_rows = 0
    funnel = {}
    pool = []
    with open(RAW, newline="", encoding="utf-8-sig") as f:
        r = csv.reader(f)
        header = next(r)
        idx = {n: header.index(n) for n in COLS}
        for row in r:
            if row[idx["Product"]] != "Debt collection":
                continue
            dc_rows += 1
            if not row[idx["Consumer complaint narrative"]].strip():
                continue
            if row[idx["Issue"]] not in FROZEN_LABELS:
                continue
            if not row[idx["Sub-issue"]].strip():
                continue
            pool.append({c: row[idx[c]] for c in COLS})
    funnel["dc_rows"] = dc_rows
    funnel["after narrative+issue+subissue filters"] = len(pool)

    # conflict exclusion: same exact narrative under >1 Issue
    nar_issues = defaultdict(set)
    for r_ in pool:
        nar_issues[r_["Consumer complaint narrative"]].add(r_["Issue"])
    conflicting = {n for n, s in nar_issues.items() if len(s) > 1}
    conflict_rows = sum(1 for r_ in pool if r_["Consumer complaint narrative"] in conflicting)
    kept = [r_ for r_ in pool if r_["Consumer complaint narrative"] not in conflicting]
    funnel["conflicting-label narratives excluded"] = len(conflicting)
    funnel["rows dropped as conflicting"] = conflict_rows
    funnel["rows after conflict exclusion"] = len(kept)

    # exact dedup (smallest Complaint ID per narrative)
    by_nar = {}
    for r_ in sorted(kept, key=lambda r_: id_key(r_["Complaint ID"])):
        by_nar.setdefault(r_["Consumer complaint narrative"], r_)
    eligible = sorted(by_nar.values(), key=lambda r_: id_key(r_["Complaint ID"]))
    funnel["exact-duplicate rows removed"] = len(kept) - len(eligible)
    funnel["eligible unique cases"] = len(eligible)

    # eligible counts per Issue / Sub-issue (needed before choosing split sizes)
    el_issue = defaultdict(int)
    el_sub = defaultdict(int)
    for r_ in eligible:
        el_issue[r_["Issue"]] += 1
        el_sub[(r_["Issue"], r_["Sub-issue"])] += 1

    # ---------- STEP 2: stratified split by (Issue, Sub-issue) ----------
    groups = defaultdict(list)
    for r_ in eligible:
        groups[(r_["Issue"], r_["Sub-issue"])].append(r_)
    for g in groups.values():
        g.sort(key=lambda r_: id_key(r_["Complaint ID"]))

    rng = random.Random(SEED)
    design, test = [], []
    alloc = {}
    for key in sorted(groups, key=lambda k: (FROZEN_LABELS.index(k[0]), k[1])):
        rows = groups[key]
        n = len(rows)
        if n == 1:
            k_design = 1
        else:
            k_design = max(1, min(n - 1, round(DESIGN_FRACTION * n)))
        chosen = set(r_["Complaint ID"] for r_ in rng.sample(rows, k_design))
        d = [r_ for r_ in rows if r_["Complaint ID"] in chosen]
        t = [r_ for r_ in rows if r_["Complaint ID"] not in chosen]
        design.extend(d)
        test.extend(t)
        alloc[f"{key[0]} | {key[1]}"] = {"eligible": n, "design": len(d), "test": len(t)}
    design.sort(key=lambda r_: id_key(r_["Complaint ID"]))
    test.sort(key=lambda r_: id_key(r_["Complaint ID"]))

    write_csv(OUT_DIR / "eligible.csv", eligible)
    write_csv(OUT_DIR / "design.csv", design)
    write_csv(OUT_DIR / "test.csv", test)

    # ---------- STEP 3: leakage checks ----------
    d_nar = {r_["Consumer complaint narrative"] for r_ in design}
    t_nar = {r_["Consumer complaint narrative"] for r_ in test}
    d_ids = {r_["Complaint ID"] for r_ in design}
    t_ids = {r_["Complaint ID"] for r_ in test}
    checks = {
        "exact narrative overlap design-test": len(d_nar & t_nar),
        "duplicate complaint IDs design-test": len(d_ids & t_ids),
        "conflicting-label narratives remaining in either split": sum(
            1 for r_ in design + test if len(nar_issues[r_["Consumer complaint narrative"]]) > 1
        ),
        "narratives unique within design": len(d_nar) == len(design),
        "narratives unique within test": len(t_nar) == len(test),
    }

    # distributions
    def dist(rows):
        iss, sub = defaultdict(int), defaultdict(int)
        for r_ in rows:
            iss[r_["Issue"]] += 1
            sub[(r_["Issue"], r_["Sub-issue"])] += 1
        return iss, sub

    d_iss, d_sub = dist(design)
    t_iss, t_sub = dist(test)
    sub_issues_missing_in_design = sorted(set(el_sub) - set(d_sub))
    sub_issues_missing_in_test = sorted(set(el_sub) - set(t_sub))

    # template/near-duplicate risk (REPORT ONLY, nothing removed)
    def norm(t):
        return re.sub(r"\s+", " ", t.lower()).strip()

    pre = defaultdict(lambda: {"design": 0, "test": 0})
    for r_ in design:
        pre[norm(r_["Consumer complaint narrative"])[:200]]["design"] += 1
    for r_ in test:
        pre[norm(r_["Consumer complaint narrative"])[:200]]["test"] += 1
    spanning = [
        (p, c) for p, c in pre.items() if c["design"] > 0 and c["test"] > 0 and c["design"] + c["test"] >= 3
    ]
    spanning.sort(key=lambda kv: -(kv[1]["design"] + kv[1]["test"]))
    template_risk = {
        "definition": "narratives sharing an identical first 200 normalized chars across BOTH splits (mechanical proxy only)",
        "groups_spanning_splits_ge3_total": len(spanning),
        "top_groups": [
            {"opener": p[:90], "design": c["design"], "test": c["test"]} for p, c in spanning[:12]
        ],
    }

    # transparency: overlap with the previous 100-case benchmark (report only)
    old_ids = set()
    overlap = {}
    if OLD_BENCH.exists():
        with open(OLD_BENCH, newline="", encoding="utf-8") as f:
            old_ids = {r_["Complaint ID"] for r_ in csv.DictReader(f)}
        overlap = {
            "old_benchmark_ids": len(old_ids),
            "now_in_design": len(old_ids & d_ids),
            "now_in_test": len(old_ids & t_ids),
        }

    # ---------- manifest ----------
    manifest = {
        "experiment": "consumer-issue-prediction-v1",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Predict which CFPB Issue the consumer selected, from inference-time information only. "
                   "Metric name: 'Agreement with consumer-selected CFPB Issue'.",
        "source": {
            "file": str(RAW.relative_to(REPO)),
            "sha256": sha256_of(RAW),
        },
        "frozen_labels": FROZEN_LABELS,
        "seed": SEED,
        "filter_funnel": funnel,
        "eligibility_rules": [
            "Product == Debt collection",
            "non-empty Consumer complaint narrative (after whitespace trim)",
            "Issue in the four frozen labels",
            "non-empty Sub-issue (defensive; removed 0 rows in this source)",
            "narratives whose exact text appears under more than one Issue are excluded entirely",
            "exact-duplicate narratives deduplicated to the smallest Complaint ID",
            "narrative text never modified",
        ],
        "split_rule": {
            "stratification": "by (Issue, Sub-issue)",
            "design_fraction_target": DESIGN_FRACTION,
            "rule": "n==1 -> DESIGN; n>=2 -> design_k = clamp(round(0.6*n), 1, n-1)",
            "sampling": "random.Random(42).sample over Complaint-ID-sorted group members",
            "output_order": "both CSVs sorted by Complaint ID (numeric)",
        },
        "counts": {
            "eligible_total": len(eligible),
            "eligible_per_issue": {i: el_issue[i] for i in FROZEN_LABELS},
            "eligible_per_subissue": {f"{k[0]} | {k[1]}": v for k, v in sorted(el_sub.items())},
            "design_total": len(design),
            "test_total": len(test),
            "design_per_issue": {i: d_iss.get(i, 0) for i in FROZEN_LABELS},
            "test_per_issue": {i: t_iss.get(i, 0) for i in FROZEN_LABELS},
            "allocation_per_subissue": alloc,
        },
        "leakage_checks": {k: (v if isinstance(v, int) else v) for k, v in checks.items()},
        "sub_issues_missing_in_design": [f"{a} | {b}" for a, b in sub_issues_missing_in_design],
        "sub_issues_missing_in_test": [f"{a} | {b}" for a, b in sub_issues_missing_in_test],
        "template_risk_report_only": template_risk,
        "overlap_with_previous_100_benchmark": overlap,
        "files": {
            name: {"path": str((OUT_DIR / name).relative_to(REPO)), "sha256": sha256_of(OUT_DIR / name), "rows": n}
            for name, n in [("eligible.csv", len(eligible)), ("design.csv", len(design)), ("test.csv", len(test))]
        },
        "test_set_policy": "TEST narratives must not be inspected case-by-case while designing the judgment. "
                           "Aggregate counts only. One evaluation run after the judgment is frozen.",
    }
    (OUT_DIR / "split-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    # ---------- STEP 4: human-readable design view (DESIGN only) ----------
    lines = [
        "# CFPB Consumer-Selected Issue — DESIGN SET VIEW",
        "",
        f"Generated by `scripts/prepare_consumer_issue_splits.py` (seed {SEED}). "
        f"Source: `data/raw/cfpb/CCDB_Export_20_July_2026.csv`.",
        "",
        "Purpose: let a human directly see how consumers who selected each CFPB Issue/Sub-issue",
        "actually wrote their narratives. Narratives are verbatim; nothing is summarized or reinterpreted.",
        "",
        "**Experiment boundary:** the DESIGN split MAY be inspected. The TEST split must not be inspected",
        "case-by-case; only aggregate counts are known here. The future Jev judgment must be designed from",
        "CFPB documentation + this DESIGN split + TypeSafe docs only. TEST is run once, after freezing.",
        "",
        f"Eligible unique cases: **{len(eligible)}** | DESIGN: **{len(design)}** | TEST: **{len(test)}** "
        f"(held out, not shown in this document).",
        "",
        "## Eligibility & split rules (deterministic)",
        "",
        "1. Debt collection rows with non-empty narrative, one of the four frozen Issues, non-empty Sub-issue.",
        "2. Narratives whose exact text occurs under more than one Issue are excluded entirely "
        f"({funnel['conflicting-label narratives excluded']} narratives, {funnel['rows dropped as conflicting']} rows).",
        f"3. Exact duplicates removed (one row per narrative, smallest Complaint ID): "
        f"{funnel['exact-duplicate rows removed']} rows.",
        "4. Stratified by (Issue, Sub-issue): singleton groups go to DESIGN; otherwise "
        "`design_k = clamp(round(0.6*n), 1, n-1)` sampled with `random.Random(42)`.",
        "",
        "## DESIGN counts per Issue and Sub-issue",
        "",
        "| Issue | Sub-issue | eligible | design | test |",
        "|---|---|---:|---:|---:|",
    ]
    for key in sorted(groups, key=lambda k: (FROZEN_LABELS.index(k[0]), k[1])):
        a = alloc[f"{key[0]} | {key[1]}"]
        lines.append(f"| {key[0]} | {key[1]} | {a['eligible']} | {a['design']} | {a['test']} |")
    lines += [
        "",
        f"Sub-issues present in eligible but absent from DESIGN: "
        f"{len(sub_issues_missing_in_design)} (by construction every Sub-issue has >=1 DESIGN row; this lists any exception).",
        "",
        "---",
        "",
        "## DESIGN examples per Sub-issue (3 per Sub-issue, lowest Complaint IDs, verbatim)",
        "",
    ]
    for issue in FROZEN_LABELS:
        subs = sorted(
            [k for k in groups if k[0] == issue],
            key=lambda k: -alloc[f"{k[0]} | {k[1]}"]["design"],
        )
        lines += [f"### {issue}", ""]
        for sissue, _ in [(k[1], k) for k in subs]:
            rows = sorted(groups[(issue, sissue)], key=lambda r_: id_key(r_["Complaint ID"]))
            design_rows = [r_ for r_ in rows if r_["Complaint ID"] in d_ids]
            lines += [f"**Sub-issue: {sissue}** ({len(design_rows)} design cases)", ""]
            for r_ in design_rows[:3]:
                lines.append(f"- `Complaint ID {r_['Complaint ID']}` | Sub-product: {r_['Sub-product']}")
                for ln in r_["Consumer complaint narrative"].splitlines() or [r_["Consumer complaint narrative"]]:
                    lines.append(f"  > {ln}")
                lines.append("")
    lines += [
        "---",
        "",
        "## Frozen-file hashes (verify before/after evaluation)",
        "",
        f"- `data/prepared/cfpb/consumer-issue-prediction-v1/eligible.csv` — `{manifest['files']['eligible.csv']['sha256']}`",
        f"- `data/prepared/cfpb/consumer-issue-prediction-v1/design.csv` — `{manifest['files']['design.csv']['sha256']}`",
        f"- `data/prepared/cfpb/consumer-issue-prediction-v1/test.csv` — `{manifest['files']['test.csv']['sha256']}`",
        f"- `data/prepared/cfpb/consumer-issue-prediction-v1/split-manifest.json` — "
        f"`{sha256_of(OUT_DIR / 'split-manifest.json')}` *(this hash is self-referential only if manifest not edited; "
        f"treat the three CSV hashes as canonical)*",
        "",
        "## Known template/near-duplicate risk (report only — nothing removed)",
        "",
        f"{template_risk['groups_spanning_splits_ge3_total']} narrative-opener groups (identical first 200 normalized "
        "characters) appear in BOTH splits with >=3 total members. If the future judgment is tuned on DESIGN,",
        "these families could make TEST performance partially predictable from memorized openers. Largest groups:",
        "",
        "| opener (first 90 chars) | design | test |",
        "|---|---:|---:|",
    ]
    for g in template_risk["top_groups"]:
        lines.append(f"| {g['opener']} | {g['design']} | {g['test']} |")
    ov = manifest["overlap_with_previous_100_benchmark"]
    if ov:
        lines += [
            "",
            "## Transparency: overlap with the previous 100-case benchmark (report only)",
            "",
            f"The earlier `cfpb-debt-100.csv` benchmark drew from the same eligible pool. Of its {ov['old_benchmark_ids']} "
            f"cases, {ov['now_in_design']} now fall in DESIGN and {ov['now_in_test']} in TEST. No cases were removed "
            "for this reason; flagged so the experimenter can decide whether prior exposure matters.",
        ]
    DOC.write_text("\n".join(lines), encoding="utf-8")

    # ---------- console report ----------
    print("=== FUNNEL ===")
    for k, v in funnel.items():
        print(f"  {k}: {v}")
    print("\n=== ELIGIBLE PER ISSUE ===")
    for i in FROZEN_LABELS:
        print(f"  {i}: {el_issue[i]}")
    print("\n=== SPLIT TOTALS ===")
    print(f"  design={len(design)} test={len(test)}")
    for i in FROZEN_LABELS:
        print(f"  {i}: design={d_iss.get(i,0)} test={t_iss.get(i,0)}")
    print("\n=== LEAKAGE CHECKS (required: 0 / 0 / 0) ===")
    for k, v in checks.items():
        print(f"  {k}: {v}")
    print(f"  sub-issues missing in DESIGN: {len(sub_issues_missing_in_design)}")
    print(f"  sub-issues missing in TEST: {len(sub_issues_missing_in_test)} -> "
          f"{[f'{a}|{b}' for a,b in sub_issues_missing_in_test]}")
    print(f"\n=== TEMPLATE RISK (report only) ===")
    print(f"  opener groups spanning both splits (>=3 total): {template_risk['groups_spanning_splits_ge3_total']}")
    for g in template_risk["top_groups"][:8]:
        print(f"    [{g['design']}d/{g['test']}t] {g['opener']}")
    print(f"\n=== OLD-BENCHMARK OVERLAP ===  {overlap}")
    print("\n=== FILES ===")
    for name, info in manifest["files"].items():
        print(f"  {info['path']}  rows={info['rows']}  sha256={info['sha256']}")
    print(f"  {DOC.relative_to(REPO)}")
    print(f"  data/prepared/cfpb/consumer-issue-prediction-v1/split-manifest.json")


if __name__ == "__main__":
    main()
