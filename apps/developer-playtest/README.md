# Developer Playtest Web

Standalone Next.js App Router frontend for blind Water Sort developer playtests.

Current scope:

- anonymous browser-local session ID;
- deterministic per-session randomized puzzle order;
- blind benchmark loading;
- classic-v1 pour interaction;
- per-puzzle timer;
- cumulative legal-move count across restarts;
- restart action history;
- automatic solved detection;
- explicit give-up confirmation and structured reasons;
- 1–5 perceived-difficulty rating plus optional confidence/frustration;
- saved completed/gave-up results in browser localStorage using the v2 result shape;
- no source difficulty, solver metrics, or optimal-move metadata;
- no backend submission yet.

Only finished/gave-up puzzles with submitted feedback are persisted. Reloading during an active puzzle discards that in-progress attempt.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The benchmark snapshot is copied into `public/benchmark.json` so the app can later be deployed independently from the generator runtime.
