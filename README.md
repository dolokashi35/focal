# Focal

A desktop focus coach that watches what you're working on, scores how focused you are in real time, and grows a virtual garden as you stay on task.

Focal runs in the background as an Electron app. Every few seconds it records the active app, window title, and browser URL. It sends that context to an LLM, which sorts the activity into categories like deep work, learning, or distraction. The categories feed a live focus score that you can see in a floating overlay, on a dashboard, and on a shared leaderboard.

## Features

- **Real-time activity tracking.** Records the active app, window title, and URL on macOS (AppleScript) and Windows (PowerShell), along with app-switching rate and session length.
- **AI focus scoring.** A local LLM (Ollama, `gemma3:4b`) puts each activity window into one of five categories: `deep_work`, `learning`, `maintenance`, `distracted`, or `idle`. When no model is available, a rule-based classifier takes over.
- **Hybrid score.** The score blends base signals (time spent, switching, app and title context) with the AI's multiplier, weighted by its confidence. The result is an instantaneous score and a cumulative score on a 0–1000 scale.
- **Productivity garden.** Plants grow faster while your focus score is high. You can buy seeds in the shop, plant them in a grid, and keep a floating plant overlay on screen.
- **Overlays.** A transparent always-on-top window shows your current score and context. It's draggable and has fixes specific to macOS and Windows.
- **Accounts and leaderboard.** Sign-in uses AWS Cognito. Scores and profiles sync to MongoDB Atlas, which powers a global leaderboard.
- **Optional Bedrock analyzer.** A service module that asks Claude on AWS Bedrock for a richer context analysis (`electron/services/contextAnalyzer.ts`).

## Architecture

```
┌──────────────── Electron main process ────────────────┐
│ focus-tracker.ts   active app / title / URL sampling  │
│ focus-ai.ts        LLM classification + scoring       │
│ services/          MongoDB sync, Bedrock analyzer     │
│ main.ts            windows, overlays, IPC handlers    │
└───────────────────────────┬───────────────────────────┘
                            │ IPC (preload.ts)
┌───────────────────────────┴───────────────────────────┐
│ React renderer (src/)                                 │
│ Dashboard · Analytics · Garden · Leaderboard · Auth   │
│ core/gardenGame.ts   garden game engine               │
└───────────────────────────────────────────────────────┘
```

## Tech stack

Electron 30, React 18, TypeScript, Vite, Ollama, AWS Bedrock, AWS Cognito, MongoDB Atlas, electron-builder.

## Getting started

Prerequisites: Node.js 18+, plus [Ollama](https://ollama.com) if you want AI scoring.

```bash
npm install
cp .env.example .env      # then fill in MongoDB and Cognito values
ollama pull gemma3:4b     # optional; without it, rule-based scoring is used
npm run dev
```

On macOS, grant the app Accessibility and Screen Recording permissions so it can read window titles.

### Build a distributable

```bash
npm run build             # outputs to release/<version>/
```

## Project structure

```
electron/          main process: tracking, scoring, windows, services
src/components/    React views (Dashboard, Garden, Leaderboard, ...)
src/core/          garden game engine
src/services/      Cognito auth client
```

## Privacy

Activity data stays on your machine. The only thing sent off it is your aggregate score, to the database you configure. AI classification runs locally through Ollama unless you turn on the Bedrock analyzer.
