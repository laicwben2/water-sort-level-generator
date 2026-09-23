# Developer Playtest Web

Standalone Next.js App Router frontend for blind Water Sort developer playtests.

Current scope:

- anonymous browser-local session ID;
- deterministic per-session randomized puzzle order;
- blind benchmark loading;
- no source difficulty, solver metrics, or optimal-move metadata;
- no backend submission yet.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The benchmark snapshot is copied into `public/benchmark.json` so the app can later be deployed independently from the generator runtime.
