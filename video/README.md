# ReSecArc videos

The launch video and the full walkthrough, scripted with [Showpilot](https://github.com/vijaykumargowdakk/showpilot).
This folder is a separate project: it has its own dependencies, and the app's build, tests and deployment don't use it.

| Cut | |
|---|---|
| `cuts/main.ts` | The submission video, about 3½ min, narrated: hello and the problem, a 5× speed-run, the attack-path hook, the standards, a tour, GitHub, the call to action. |
| `cuts/deepdive.ts` | The full walkthrough, about 16 min, silent with subtitles: every feature, then the README, the architecture and the code. `cuts/deepdive.voice.ts` holds its spoken script for a narrated copy. |
| `cuts/moves.ts` | Shared moves (devices, panels, linking) using the same roles and labels as the app's browser tests. |

`showpilot.config.ts` sets the app (this repository's production build), the brand and the narrator.
`lexicon.json` holds ReSecArc's pronunciations.

## Making the videos

```sh
cd video
npm install                     # Showpilot and its tools, in video/node_modules only
npx showpilot setup-browser     # once
npx showpilot setup-voice       # once, for narration
(cd .. && npm run build)        # the app build that gets recorded

npx showpilot voice main        # narration first: takes are paced to it
npx showpilot record main
npx showpilot render main       # out/main/main.mp4 (+ .srt, script, chapters)
npx showpilot thumbnail main

npx showpilot record deepdive   # silent: no voice step
npx showpilot render deepdive
npx showpilot voice deepdive && npx showpilot dub deepdive   # optional narrated copy
```

Re-shoot one chapter with `--chapter N`. Recordings and videos go to `video/out/`, which is not committed.
The GitHub chapters record the live repository, so they show whatever `main` has at the time.
