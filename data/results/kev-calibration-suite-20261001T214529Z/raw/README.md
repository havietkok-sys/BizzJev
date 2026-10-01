# Raw provider responses

Phase 0–2 made zero provider requests, so this directory intentionally contains no response files.

The immutable historical inputs are referenced by path and SHA-256 in `experiment-manifest.json`. Those historical language-evaluation files contain parsed probabilities, returned model and per-request latency, but not the exact serialized request payload or raw provider response. Every live request in Phase 4 and later must save both without API keys.
