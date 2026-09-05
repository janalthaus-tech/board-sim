# Board Sim — The Board Simulator

Tablet-friendly training simulator for automotive repair shop workflow on **The Board**.

Inspired by Shop Fix Academy Board workflow. This is a training MVP — not an official Shop Fix Academy product.

## Quick start (Web)

Same React app in the browser:

```bash
bun install && bun run dev
```

(`npm install && npm run dev` also works.) Open the URL Vite prints (usually http://localhost:5173).

## Mobile (Capacitor)

Board Sim is the **same React app**; Capacitor is only the native iOS/Android shell (WebView). Platform folders `android/` and `ios/` are committed so you can open them directly.

**appId:** `com.boardsim.app` · **appName:** `Board Sim` · **webDir:** `dist`

### Build + sync (any machine with Bun/Node)

```bash
bun install
bun run cap:sync          # production web build + Capacitor sync
# or: bun run build && bunx --bun cap sync
```

> Capacitor CLI 8 wants **Node >= 22**. This repo's scripts use `bunx --bun cap ...` so Bun can run the CLI even when system Node is older. On a Mac/Windows box with Node 22+, `npx cap ...` is fine too.

### Open in Android Studio (Windows / macOS / Linux)

1. Install [Android Studio](https://developer.android.com/studio) + Android SDK.
2. From the project root:

```bash
bun run cap:sync
bun run cap:android
# or: open the `android/` folder in Android Studio (File -> Open)
```

3. Pick an emulator or USB device, then Run.

**Note:** This Linux scaffold box does not ship an Android SDK. Device/emulator builds happen on your machine with Android Studio.

### Open in Xcode (macOS only)

1. Install Xcode from the Mac App Store + accept licenses / first-run setup.
2. From the project root (on a Mac):

```bash
bun run cap:sync
bun run cap:ios
# or: open ios/App/App.xcodeproj
```

3. Select a simulator or device, then Run.

**Building and signing iOS requires macOS + Xcode.** The `ios/` folder was scaffolded on Linux so the native project exists in the repo; you still need a Mac to compile, sign, and run on Simulator/device. No App Store / Play Store publishing is set up here — no signing secrets required for local training builds.

### Scripts

| Script | What it does |
|--------|----------------|
| `bun run dev` | Vite dev server (web) |
| `bun run build` / `build:web` | Typecheck + production web build -> `dist/` |
| `bun run preview` | Preview production build |
| `bun run cap:sync` | `build` then Capacitor sync into `android/` + `ios/` |
| `bun run cap:android` | Open Android project (Android Studio when available) |
| `bun run cap:ios` | Open iOS project (Xcode on macOS) |
| `bun run lint` | Oxlint |

Vite uses `base: './'` so asset URLs work inside the Capacitor WebView.

## What you get

1. Home / scenario picker — eleven playable scenarios
2. Kanban board — Dispatch, Inspection, Approval, Parts, WIP, QC, Final
3. Cards with W/R/S/H magnets, keys-on-board, waiter timers, and sold hours
4. Board HUD — column counts, bottleneck highlight, Parts+WIP hours by tech
4b. Goals strip — flag hrs vs 8 flag hrs/tech + flat-rate pay estimate + GP$ sold pipeline
4c. Roller-coaster tutorial — multi-step overlay (Home, first run, Board “?”)
5. Engine — QC fail to Approval; qc_rework to WIP; timed arrivals and blockers
6. Debrief — waiters left, hours stuck, QC restarts, GP$/flag hours + pay, score/grade

## Mechanics (training)

- **Magnets:** W = waiter, R = rental, S = shuttle, H = heart car
- **Waiter timer:** countdown (sim minutes) on W cards
- **Factory of hours:** sold hours feed Parts+WIP HUD totals
- **QC fail path:** move to Approval, blocked+waiting, bump qcFailCount; qc_rework returns to WIP
- **Cue:** Empty your section — find the bottleneck

## Scenarios

- Morning Rush — waiters + rental/shuttle mix
- Parts Delay Chaos
- Advisor Bottleneck
- Tech Capacity Crunch
- Comeback Day
- Promise Time Panic — W/R/S magnets
- New Tech Tuesday
- Weather Surge — waiters + rentals
- **Waiter Timer Drill** — prioritize W+timer without starving the board
- **Speed Zone Drill** — many waiters, 1-hour pressure, keys on board
- **Production Meeting Day** — mid-run meeting pulse, promised stars, Approval stack, heart comeback

## Domain model

Reusable client-side model in `src/model/`:

- types.ts — VehicleJob markers, soldHours, keysOnBoard, answer clocks, promisedToday
- board.ts — move/add/flag helpers; answer + keys side effects
- scenarios.ts — seeds and events
- engine.ts — tick, 1-hour clock, next-most-important, production meeting, debrief

## Project layout

- `src/model/` — domain
- `src/components/` — Home, BoardView, Debrief, cards, columns
- `src/App.tsx` — screen and sim loop
- `src/index.css` — dark war-room UI
- `capacitor.config.ts` — Capacitor appId / webDir / splash+status bar
- `android/` · `ios/` — native Capacitor shells (commit these; sync refreshes web assets)

## Training concepts (inspired by Shop Fix Board / roller-coaster training)

Inspired-by only — paraphrased labels, not proprietary script text.
Flat-rate mechanics paraphrase Shop Fix “Converting to Flat Rate” concepts (flag hours vs clock, $/flag hour) — no proprietary worksheet text or exact worked example numbers.
- **Speed zone (unsold)** — Dispatch + Inspection: answer not yet delivered / work not sold. Highest priority.
- **Selling** — Approval: waiting on the customer; still speed-sensitive.
- **Sold / production** — Parts, WIP, QC, Final: money already made; lower priority than earliest unanswered.
- **1-hour answer** — From drop, deliver an answer within ~60 sim minutes (move to Approval or tap Answer delivered). Late answers toast and hurt debrief score.
- **Next most important** — Coach: earliest waiter, earliest unanswered drop, oldest Approval wait, heart cars, bottleneck pile.
- **Heart cars (H)** — Relationship-sensitive / comeback work; QC fail adds a manager/lead rework note.
- **Keys on board** — Keys still on the magnet until pulled into a bay / Inspection / WIP.
- **Production meeting** — Timed pulse that stars promisedToday goes; may nudge WTF on long-blocked no-tech jobs.
- **GP$ sold (pipeline)** — Sum of `gpSold` or `soldHours × gpPerHourHint` once answer delivered or job is in Parts/WIP/QC/Final. Scenario targets scale by difficulty.
- **Flag hours (flat rate)** — Techs are paid $/flag hour (billed/sold labor), not clock hours. Flag hours = `soldHours` on jobs in Parts/WIP/QC/Final (and Approval after sold). Soft score still uses the 8 flag hrs/tech baseline.
- **Flat-rate pay estimate** — flagHours × `flatRatePerFlagHr` (training default $50/flag hr — sim rate, not a shop claim).
- **Efficiency** — flagHours / `availableClockHrs` (default 8) shown as a tiny % on the HUD/debrief.
- **GSPH hint** — when flag hours > 0, HUD can show GP$ / flag hours (optional `gsphHint` teaching target).
- **Tutorial** — Six short roller-coaster steps; shown once per browser (`board-sim-tutorial-seen`), reopen from Home or Board “?”. Last step covers flat-rate flag hours.

## New scenarios

- **Speed Zone Drill** — many waiters, 1-hour pressure, keys on board
- **Production Meeting Day** — mid-run meeting pulse, promised stars, Approval stack, heart comeback
