# Kev-9B Calibration & Evaluation Suite

This directory contains Phase 0–2 only. It reproduces historical Jev and Kev-9B baselines from saved artifacts, creates a paired 75/25 development/final split, and calibrates Kev thresholds offline on development data. It performs zero provider calls.

## Reproduce

```powershell
node scripts\run-kev-calibration-offline.mjs data\results\kev-calibration-suite-20261001T214529Z
```

The script validates the 100 paired EN/SV case IDs and labels, verifies the expected baseline metrics, then regenerates all Phase 0–2 artifacts. Seed: `20261001`.

## Leakage boundary

Threshold candidates are selected from the 75 development case IDs only. EN and SV for each ID always share the same split. The 25 final IDs are listed for auditability but no calibrated-threshold result is computed for them before configuration freeze.

## Candidate policy

Three thresholds are reported per gate and language: F1-optimal (F1), precision-oriented (F0.5), and recall-oriented (F2). The recommended experiment candidate follows the existing policy profile: `strong_boundary` uses precision-oriented, `catch_most` uses recall-oriented, and other profiles use F1. This recommendation is provisional until business costs are confirmed.

## Small holdout gates

Gates with fewer than five positive final cases are explicitly marked in `split-manifest.json`. Their eventual holdout counts remain valid but are too unstable for strong per-gate claims. `grouped-repeated-cv.csv` therefore adds 20×5 repeated cross-validation over development cases while keeping EN/SV pairs grouped.

## Phase 2 finding

No gate currently qualifies for wording experiments: every gate retains strong semantic ordering, with mean EN/SV AUROC above 0.93. Threshold and probability-scale calibration should be completed before spending live calls on wording variants.

## Historical limitation

Existing run artifacts do not include exact request payloads or raw provider responses. See `raw/README.md`. No source artifact was modified.
