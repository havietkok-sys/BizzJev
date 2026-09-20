# Running the Semantic Operations Lab Demo

This guide assumes you have never seen the project before.

> **You must supply your own TypeSafe API key to run live Jev analysis.** Get one from [TypeSafe's API keys page](https://console.typesafe.ai/keys). No API key or API credits are bundled with BizzJev.

## What You Need

| Dependency | Version | Check |
|---|---|---|
| .NET SDK | 10.0.201 or later (same feature band) | `dotnet --version` |
| TypeSafe/Jev API key | your own valid key | [Create/manage API keys](https://console.typesafe.ai/keys) |
| Internet connection | access to TypeSafe's hosted API | Live analysis sends text to `https://api.typesafe.ai/v1/systemone` |
| Web browser | any modern browser | — |

Node.js / npm are **not** required to run the demo — the React frontend is pre-built and served by the backend. You only need Node.js if you want to modify the frontend source (`web/lab/`).

Works on Windows 10/11. The launcher is a `.bat` file; on other platforms, see the manual method below.

---

## First-Time Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/havietkok-sys/BizzJev.git
   cd BizzJev
   ```

2. **Run the launcher:**

   ```text
   START_DEMO.bat
   ```

3. **If prompted for an API key** (first run only):
   - Sign in to the [TypeSafe Console](https://console.typesafe.ai/keys) and create an API key
   - Paste it into the launcher's masked prompt
   - The key is stored in .NET User Secrets on your machine only — never in Git, never in the browser, never shown in the UI

4. **The demo opens automatically in your browser** at http://localhost:5099

---

## API Key

### Get a key and configure it

1. Open [TypeSafe Console → API keys](https://console.typesafe.ai/keys) and sign in or create an account.
2. Create an API key for your use of Jev. Check the console for your account's access and usage limits, and see [models and pricing](https://docs.typesafe.ai/models) for current published prices.
3. In the BizzJev folder, run `SET_API_KEY.bat` and paste the key into the masked prompt. This configures `TYPESAFE_API_KEY` in .NET User Secrets.
4. Run `START_DEMO.bat` and submit one of the demo messages to make a live analysis request.

The key authenticates requests to TypeSafe; you do not download or run the Jev model locally. Although BizzJev's web application runs on your computer, analysis sends the submitted text and gate definitions to TypeSafe. You can read the saved results and documentation without making API calls.

For background on Jev, Noul/Choice/Score, and how this project uses them, see [TypeSafe and Jev in the README](../README.md#what-are-typesafe-and-jev). TypeSafe's [quick start](https://docs.typesafe.ai/introduction/quickstart), [Playground](https://console.typesafe.ai/playground), and [API reference](https://docs.typesafe.ai/api) are useful next steps.

### Where the key is stored

The TypeSafe/Jev API key:

- **Is configured locally** in .NET User Secrets (`dotnet user-secrets`), scoped to the `src/BizzJev.Lab` project
- **Is stored outside Git** — User Secrets are stored under your user profile, outside the repository; the backend sends the key to TypeSafe for authentication over HTTPS
- **Is backend-only** — the frontend never receives the key; it only calls the backend API
- **Never appears in Technical View** — the request payload shown there is the JSON body, which contains no authorization headers (those live in server-side HTTP headers)

To configure or replace the key at any time:

```text
SET_API_KEY.bat
```

---

## Starting the Demo

### Easy method (recommended)

```text
START_DEMO.bat
```

This single script:
1. Checks that .NET SDK is installed
2. Checks that an API key is configured (offers first-run setup if not)
3. Stops any previous instance on port 5099
4. Starts the backend (which also serves the pre-built frontend)
5. Waits for readiness
6. Opens http://localhost:5099 in your browser

### Manual developer method

From the repository root:

```bash
dotnet run --project src/BizzJev.Lab -- --urls http://localhost:5099
```

Then open http://localhost:5099 in a browser.

To rebuild the frontend after editing React source code:

```bash
cd web/lab
npm install
npm run build
cp -r dist/* ../../src/BizzJev.Lab/wwwroot/
```

---

## Stopping the Demo

- If you used `START_DEMO.bat`: close the launcher window (or press Ctrl+C in it). The backend is a child process and stops with it.
- If you started the backend manually: press Ctrl+C in that terminal, or close it.

Logs are written to `data\lab\backend.log` and `data\lab\backend.err.log` if you need to diagnose a startup failure.

---

## Ports and URLs

| Component | URL |
|---|---|
| Full demo (UI + API) | http://localhost:5099 |
| Health check | http://localhost:5099/api/health |

The backend serves both the REST API (`/api/*`) and the pre-built React frontend from the same port — no separate frontend server is needed for normal demo use.

---

## Troubleshooting

### Missing .NET SDK

```
ERROR: .NET SDK not found.
```

Install .NET SDK 10.0 from https://dotnet.microsoft.com/download/dotnet/10.0 and run `START_DEMO.bat` again.

### API key missing

```
API key not configured.
```

Run `SET_API_KEY.bat`, paste your key, then run `START_DEMO.bat` again. If you don't have a key, create one in the [TypeSafe Console](https://console.typesafe.ai/keys).

### Port already in use

```
ERROR: Backend exited unexpectedly.
```

Check that nothing else is using port 5099. The launcher tries to stop a previous instance automatically, but if a manual process is holding the port, close it (Task Manager → look for `BizzJev.Lab` or `dotnet` processes). Alternatively, start on a different port:

```bash
dotnet run --project src/BizzJev.Lab -- --urls http://localhost:5100
```

Then open http://localhost:5100 instead.

### Backend fails to start

Check `data\lab\backend.log` and `data\lab\backend.err.log` for the full error output. Common causes:
- .NET SDK version mismatch (the project targets net10.0)
- Missing build output (run `dotnet build src/BizzJev.Lab` first if you skipped the launcher)
- Corrupted NuGet cache (try `dotnet nuget locals all --clear`)

### Jev / API request fails

The Analyze screen shows per-gate failure status. Common causes:
- API key expired or revoked — create a replacement in the [TypeSafe Console](https://console.typesafe.ai/keys), then run `SET_API_KEY.bat` again
- Network connectivity issue
- Rate limiting — wait a moment and retry

### Browser does not open automatically

Open http://localhost:5099 manually.

---

## Demo Walkthrough

After startup, try this flow:

### 1. Overview

Read the introduction page. It explains the fictional company (Nordbo Telecom), what Jev does, and why multiple signals can exist simultaneously.

### 2. Analyze

Go to the **Analyze** tab. Paste or type a customer message, then click **Analyze**.

Suggested example:

> Support was very friendly, but the broadband is still broken and I have started looking at Telia's offers.

Observe that several gates fire simultaneously: positive support experience, technical problem, unresolved issue, competitor consideration, and churn risk — all from one message.

### 3. Threshold Policy

On the analysis result, drag the **Review** and **Accept** threshold circles on any gate's policy scale. Watch the policy result change (NO / REVIEW / YES) instantly — **without calling Jev again**. The Jev signal stays fixed; only the business interpretation changes.

### 4. Business View / Technical View

Switch to **Technical View** on the analysis result. Inspect:
- the exact customer input sent
- the full Jev request payload (JSON)
- every gate definition used in this run
- the raw Jev response
- the parsed signals
- the deterministic policy calculation per gate
- the resulting business actions

Switch back to Business View for the operational summary.

### 5. Gate Studio

Go to the **Gate Studio** tab. Click any gate (e.g. Churn Risk) to open its full definition:
- business goal, semantic target, interior, boundaries
- false-positive / false-negative consequences
- the actual Jev instruction and TRUE/FALSE criteria
- policy thresholds on the shared zone scale

Edit any field to create an **unsaved draft**. Use **Test Draft** to run the draft against a message without activating it. Use **Run Against Saved Cases** to compare the draft against the current active version on all evaluation cases (fixed / broken / unchanged).

**Save as new version** creates a new immutable local version (e.g. `v2-local`) — the original `v1` is never overwritten. Use **Set as active** to make a version live for new Analyze runs.

### 6. Evaluation Library

Go to the **Evaluation Library** tab. Click **Run full evaluation** to score all gates against the 100-case synthetic dataset. Inspect per-gate metrics (TP, FP, FN, TN, Precision, Recall, F1), metrics by case type, the weakest routing gate, and the Operational Capture view (how many expected-YES cases were automatic YES vs human REVIEW vs missed).

---

## Suggested Demo Inputs

### Churn, not cancellation

```
If the connection fails one more time, I'm switching provider.
```

Expected conceptual result:
- churn risk: high (conditional intention to leave)
- cancellation intent: low (no actual request to cancel)

### Actual cancellation

```
Please terminate my broadband subscription at the end of this month.
```

Expected:
- cancellation intent: high (a present, dated instruction)
- contract problem: high (subscription lifecycle)
- churn risk: high (the relationship is ending)

### Multi-signal case

```
Support was very friendly, but the broadband is still broken and I have already started looking at Telia's offers.
```

Possible simultaneous signals:
- positive support experience
- technical problem
- unresolved issue
- competitor consideration
- churn risk

### Negated cancellation

```
I do not want to cancel. I just want the connection fixed.
```

Cancellation intent should remain low (the word "cancel" appears but is negated).

### Boundary case

```
I'm not happy with the speed but the price is competitive. What does it cost to upgrade?
```

This is useful for exploring the semantic boundaries between:
- technical dissatisfaction (slow speed)
- billing (price mention)
- contract/subscription (upgrade question)
- churn (mild frustration, but no leaving intent)

---

## Gate Studio Persistence

- The **frozen baseline gate definitions** live in `src/BizzJev.Lab/config/gates.v1.json` (repository-owned, always committed)
- **Local gate versions** you create in Gate Studio are stored under `data/lab/gates/` (runtime-only, never committed automatically)
- Local versions **survive application restart** — they are written to disk immediately on save
- **Historical analysis runs** record the exact gate version they used, so opening an old run in Technical View always shows the gate definition that was active at that time, even if you have since changed it
- To restore all gates to the frozen baseline, use **Reset local gate versions** in Gate Studio (requires double confirmation; does not delete evaluation history)

---

## Prototype Scope

This is a local technical/business demo and experimentation environment. It is not production-ready. See the root README for the full list of deliberately out-of-scope concerns.
