// The ReSecArc videos, made with Showpilot (https://github.com/vijaykumargowdakk/showpilot). See README.md here.
import { defineConfig } from 'showpilot';

export const LINKS = {
  profile: 'https://github.com/vijaykumargowdakk',
  repo: 'https://github.com/vijaykumargowdakk/ReSecArc',
  live: 'https://resecarc.vijaykumarkk.in',
};

export default defineConfig({
  app: {
    // The production build of this repository (run `npm run build` in the repository root first).
    serve: '../dist',
    ready: '.react-flow__node-device',
    // Light theme, and the first-run tour already seen. The storage keys keep the old prefix on purpose (saved work).
    storage: { 'conduitot:theme': 'light', 'conduitot:prefs': JSON.stringify({ tourSeen: true }) },
  },
  brand: {
    name: 'ReSecArc',
    highlight: 'Sec',
    logo: '../public/favicon.svg',
    links: [
      { label: 'Try it', url: LINKS.live },
      { label: 'Code', url: LINKS.repo },
    ],
  },
  // The narrator the owner chose (audition 2026-10-30): Fenrir 70% with Eric 30%, slightly slow, high energy.
  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
  lexicon: 'lexicon.json',
});
