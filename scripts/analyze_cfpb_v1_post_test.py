#!/usr/bin/env python3
"""Post-test analysis of the frozen CFPB Consumer-Issue V1 held-out run.

Read-only over raw V1 artifacts; writes only to .../analysis/ and prints compact
aggregates. Deterministic: sampling uses seed 42, sort keys are Complaint ID.

Outputs (data/results/cfpb-consumer-issue-v1-20260920T053337511Z/analysis/):
  subissue_agreement.csv        Part 2 table
  margin_confidence_bands.csv   Part 3 bands (margin + confidence)
  confusion_directions.json     Part 1 counts + sampled IDs per direction
  direction_samples.md          Part 1: 5 narratives per major direction (for reading)
  case_review_candidates.md     Part 4: stratified sample with narratives (for annotation)
  case_review_selection.json    Part 4 selection metadata
  multiissue_clusters.csv       Part 5 mechanical concept clusters
  structural_failures.json      Part 6 exact rejected distributions
  aggregate_summary.json        compact everything
"""
from __future__ import annotations

import csv
import json
import random
import re
import statistics
from collections import defaultdict, Counter
from pathlib import Path

SEED = 42
RES = Path(r"data/results/cfpb-consumer-issue-v1-20260920T053337511Z")
TEST = Path(r"data/prepared/cfpb/consumer-issue-prediction-v1/test.csv")
OUT = RES / "analysis"
OUT.mkdir(exist_ok=True)

LABELS = [
    "Attempts to collect debt not owed",
    "Written notification about debt",
    "False statements or representation",
    "Took or threatened to take negative or legal action",
]

# Load judgments (no narratives in raw.jsonl) and join to test.csv.
results = {}
with open(RES / "raw.jsonl", encoding="utf-8") as f:
    for line in f:
        r = json.loads(line)
        results[r["ComplaintId"]] = r

cases = []
with open(TEST, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        r = results[row["Complaint ID"]]
        if r["Status"] != "success":
            continue
        probs = r["Probabilities"]
        ordered = sorted(probs.items(), key=lambda kv: -kv[1])
        margin = ordered[0][1] - ordered[1][1]
        cases.append({
            "id": row["Complaint ID"],
            "issue": row["Issue"],
            "sub": row["Sub-issue"],
            "nar": row["Consumer complaint narrative"],
            "jev": r["Choice"],
            "probs": probs,
            "conf": r["Confidence"],
            "margin": margin,
            "agree": r["Agreement"],
        })
cases.sort(key=lambda c: int(c["id"]))
assert len(cases) == 805

def med(xs):
    return statistics.median(xs) if xs else None

# ---------------- Part 1: confusion structure ----------------
confusion = defaultdict(Counter)
for c in cases:
    confusion[c["issue"]][c["jev"]] += 1
directions = []
for src in LABELS:
    for dst in LABELS:
        if src != dst and confusion[src][dst] > 0:
            directions.append((src, dst, confusion[src][dst]))
directions.sort(key=lambda d: -d[2])

rng = random.Random(SEED)
dir_samples = {}
for src, dst, n in directions:
    pool = [c for c in cases if c["issue"] == src and c["jev"] == dst]
    k = min(5, len(pool))
    dir_samples[f"{src} -> {dst}"] = [c["id"] for c in rng.sample(pool, k)]

with open(OUT / "confusion_directions.json", "w", encoding="utf-8") as f:
    json.dump({"directions": [{"from": s, "to": d, "n": n} for s, d, n in directions],
               "sampled_ids_per_direction": dir_samples}, f, indent=2)

with open(OUT / "direction_samples.md", "w", encoding="utf-8") as f:
    for src, dst, n in directions[:10]:
        f.write(f"\n## {src}  ->  {dst}   (n={n})\n\n")
        for c in cases:
            if c["id"] in dir_samples.get(f"{src} -> {dst}", []):
                f.write(f"### ID {c['id']} | Sub-issue: {c['sub']} | conf={c['conf']} margin={c['margin']:.2f}\n")
                f.write(f"probs: {json.dumps(c['probs'])}\n")
                f.write("narrative (up to 1100 chars):\n")
                f.write(c["nar"][:1100].replace("\n", " ") + ("\n...[truncated]\n" if len(c["nar"]) > 1100 else "\n"))

# ---------------- Part 2: sub-issue analysis ----------------
sub_rows = []
by_sub = defaultdict(list)
for c in cases:
    by_sub[(c["issue"], c["sub"])].append(c)
for (issue, sub), grp in sorted(by_sub.items(), key=lambda kv: (LABELS.index(kv[0][0]), kv[0][1])):
    agrees = [c for c in grp if c["agree"]]
    dis = [c for c in grp if not c["agree"]]
    top_dis = Counter(c["jev"] for c in dis).most_common(1)
    sub_rows.append({
        "issue": issue, "sub_issue": sub, "n": len(grp), "agree": len(agrees),
        "agreement_pct": round(100 * len(agrees) / len(grp), 1),
        "most_common_jev_when_disagreeing": top_dis[0][0] if top_dis else "",
        "disagree_count_to_that": top_dis[0][1] if top_dis else 0,
        "mean_conf": round(statistics.mean(c["conf"] for c in grp), 3),
        "median_conf": round(med([c["conf"] for c in grp]), 3) if grp else None,
        "mean_margin": round(statistics.mean(c["margin"] for c in grp), 3),
        "median_margin": round(med([c["margin"] for c in grp]), 3) if grp else None,
    })
with open(OUT / "subissue_agreement.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(sub_rows[0].keys()))
    w.writeheader()
    w.writerows(sub_rows)

# ---------------- Part 3: margin / confidence bands ----------------
BANDS = [(0.00, 0.10), (0.10, 0.25), (0.25, 0.50), (0.50, 0.75), (0.75, 0.90), (0.90, 1.00)]

def band_rows(field):
    rows = []
    for lo, hi in BANDS:
        grp = [c for c in cases if lo <= c[field] < hi or (hi == 1.00 and c[field] == 1.0)]
        a = sum(1 for c in grp if c["agree"])
        rows.append({"measure": field, "band": f"{lo:.2f}-{hi:.2f}", "n": len(grp),
                     "agreement_pct": round(100 * a / len(grp), 1) if grp else None})
    return rows

band_rows_all = band_rows("margin") + band_rows("conf")
with open(OUT / "margin_confidence_bands.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["measure", "band", "n", "agreement_pct"])
    w.writeheader()
    w.writerows(band_rows_all)

def rank(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r

def spearman(a, b):
    ra, rb = rank(a), rank(b)
    n = len(a)
    ma, mb = statistics.mean(ra), statistics.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else None

agree01 = [1 if c["agree"] else 0 for c in cases]
corr = {
    "spearman_margin_vs_agree": round(spearman([c["margin"] for c in cases], agree01), 3),
    "spearman_confidence_vs_agree": round(spearman([c["conf"] for c in cases], agree01), 3),
}

# ---------------- Part 4: stratified case review sample ----------------
HIGH, LOW = 0.75, 0.25
strata = {
    "A_high_conf_agree": [c for c in cases if c["agree"] and c["margin"] >= HIGH],
    "B_low_conf_agree": [c for c in cases if c["agree"] and c["margin"] < LOW],
    "C_high_conf_disagree": [c for c in cases if not c["agree"] and c["margin"] >= HIGH],
    "D_low_conf_disagree": [c for c in cases if not c["agree"] and c["margin"] < LOW],
}
PER = 12
sampled = {}
rng = random.Random(SEED)
for name, pool in strata.items():
    pool = sorted(pool, key=lambda c: int(c["id"]))
    if "disagree" in name:
        # proportional allocation across confusion directions, largest remainder
        dirs = defaultdict(list)
        for c in pool:
            dirs[(c["issue"], c["jev"])].append(c)
        keys = sorted(dirs, key=lambda k: (-len(dirs[k]), k))
        quota = {k: 0 for k in keys}
        for i in range(min(PER, len(pool))):
            quota[keys[i % len(keys)]] += 1
        picks = []
        for k in keys:
            picks.extend(rng.sample(sorted(dirs[k], key=lambda c: int(c["id"])), quota[k]))
        picks.sort(key=lambda c: int(c["id"]))
        sampled[name] = [c["id"] for c in picks]
    else:
        # proportional across expected issues
        byis = defaultdict(list)
        for c in pool:
            byis[c["issue"]].append(c)
        keys = sorted(byis, key=lambda k: (-len(byis[k]), LABELS.index(k)))
        quota = {k: 0 for k in keys}
        for i in range(min(PER, len(pool))):
            quota[keys[i % len(keys)]] += 1
        picks = []
        for k in keys:
            picks.extend(rng.sample(sorted(byis[k], key=lambda c: int(c["id"])), quota[k]))
        picks.sort(key=lambda c: int(c["id"]))
        sampled[name] = [c["id"] for c in picks]

review_ids = {i for ids in sampled.values() for i in ids}
with open(OUT / "case_review_selection.json", "w", encoding="utf-8") as f:
    json.dump({"seed": SEED, "high_def": f"margin >= {HIGH}", "low_def": f"margin < {LOW}",
               "per_stratum_target": PER, "stratum_sizes": {k: len(v) for k, v in strata.items()},
               "selected": sampled,
               "issue_coverage": Counter(next(c for c in cases if c["id"] == i)["issue"] for i in review_ids)},
              f, indent=2)

with open(OUT / "case_review_candidates.md", "w", encoding="utf-8") as f:
    for name in ["A_high_conf_agree", "B_low_conf_agree", "C_high_conf_disagree", "D_low_conf_disagree"]:
        f.write(f"\n# STRATUM {name} (pool {len(strata[name])}, sampled {len(sampled[name])})\n")
        for c in cases:
            if c["id"] in set(sampled[name]):
                f.write(f"\n## ID {c['id']} [{name}]\n")
                f.write(f"- CFPB Issue: {c['issue']}\n- CFPB Sub-issue: {c['sub']}\n- Jev Choice: {c['jev']}\n")
                f.write(f"- Probabilities: {json.dumps(c['probs'])}\n- Confidence: {c['conf']} | Margin: {c['margin']:.2f}\n")
                nar = c["nar"]
                f.write(f"- Narrative ({len(nar)} chars, shown up to 900): {nar[:900].replace(chr(10), ' ')}"
                        f"{' ...[truncated]' if len(nar) > 900 else ''}\n")
                f.write("ANNOTATION:\n")

# ---------------- Part 5: mechanical multi-issue clusters ----------------
CLUSTERS = {
    "not_owed": r"not my debt|do(?:es)? n[o']?t owe|don'?t owe|never had (?:any )?(?:an )?account|belongs to (?:a|some|another)|identity theft|already paid|was paid in full|discharged|bankrupt",
    "validation_notice": r"valid(?:ation|ate)|verif(?:y|ication|ied)|no documentation|did(?:n'?t| not) receive|never received|proof of|itemized|1692g|right to dispute|dunning",
    "false_statement": r"wrong amount|inflat|overstat|incorrect amount|falsely|false(?:ly)? (?:report|claim|stat|represent)|misrepresent|impersonat|pretend(?:ing)? to be|claiming to be",
    "adverse_action": r"\bsue|lawsuit|legal action|garnish|arrest|jail|prison|seiz|levy|deport|immigration|judgment|judgement|credit report|credit file|credit burea|repossess|charge.?off",
}
cluster_counts = defaultdict(list)
for c in cases:
    t = c["nar"].lower()
    hits = sum(1 for pat in CLUSTERS.values() if re.search(pat, t))
    bucket = "none_detected" if hits == 0 else ("single_cluster" if hits == 1 else "two_or_more")
    cluster_counts[(bucket, c["agree"])].append(c)
mi_rows = []
for bucket in ["none_detected", "single_cluster", "two_or_more"]:
    ag = cluster_counts.get((bucket, True), [])
    dg = cluster_counts.get((bucket, False), [])
    tot = ag + dg
    mi_rows.append({
        "bucket": bucket, "n_total": len(tot),
        "pct_of_all": round(100 * len(tot) / len(cases), 1),
        "n_agree": len(ag), "n_disagree": len(dg),
        "agreement_pct_within_bucket": round(100 * len(ag) / len(tot), 1) if tot else None,
    })
with open(OUT / "multiissue_clusters.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(mi_rows[0].keys()))
    w.writeheader()
    w.writerows(mi_rows)

# ---------------- Part 6: structural failures ----------------
failures = []
with open(RES / "raw.jsonl", encoding="utf-8") as f:
    for line in f:
        r = json.loads(line)
        if r["Status"] != "success":
            body = json.loads(r["RawResponse"])
            a = body["answers"]["consumerSelectedIssue"]
            failures.append({
                "id": r["ComplaintId"], "expected": r["ExpectedCfpbIssue"], "http": r["HttpStatus"],
                "choice": a["choice"], "confidence": a["confidence"], "probabilities": a["probabilities"],
                "sum": round(sum(a["probabilities"].values()), 6),
                "values_have_2_decimals": all(abs(round(v, 2) - v) < 1e-9 for v in a["probabilities"].values()),
            })
with open(OUT / "structural_failures.json", "w", encoding="utf-8") as f:
    json.dump(failures, f, indent=2)

# ---------------- aggregate summary ----------------
summary = {
    "validated_cases": len(cases),
    "confusion": {s: dict(confusion[s]) for s in LABELS},
    "directions_sorted": [{"from": s, "to": d, "n": n} for s, d, n in directions],
    "correlations": corr,
    "bands": band_rows_all,
    "subissue_rows": sub_rows,
    "multiissue": mi_rows,
    "failures": [{"id": x["id"], "sum": x["sum"], "choice": x["choice"], "expected": x["expected"]} for x in failures],
    "strata_sizes": {k: len(v) for k, v in strata.items()},
}
(OUT / "aggregate_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

print("=== DIRECTIONS (top 10) ===")
for s, d, n in directions[:10]:
    print(f"  {s} -> {d}: {n}")
print("\n=== SUB-ISSUE TABLE ===")
for r in sub_rows:
    print(f"  [{r['issue'][:12]}] {r['sub_issue'][:60]}: n={r['n']} agree={r['agreement_pct']}% "
          f"dis->'{r['most_common_jev_when_disagreeing'][:30]}'(x{r['disagree_count_to_that']}) "
          f"conf={r['mean_conf']} margin={r['mean_margin']}")
print("\n=== BANDS ===")
for r in band_rows_all:
    print(f"  {r['measure']:9s} {r['band']}: n={r['n']:4d} agreement={r['agreement_pct']}")
print("\n=== CORRELATIONS ===", corr)
print("\n=== MULTI-ISSUE BUCKETS ===")
for r in mi_rows:
    print(f"  {r['bucket']:15s} n={r['n_total']:4d} ({r['pct_of_all']}%) within-bucket agreement={r['agreement_pct_within_bucket']}%")
print("\n=== STRATA SIZES ===", {k: len(v) for k, v in strata.items()})
print("=== FILES WRITTEN ===")
for p in sorted(OUT.iterdir()):
    print(f"  {p.name} ({p.stat().st_size} bytes)")
