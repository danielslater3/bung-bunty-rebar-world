import { writeFileSync } from 'node:fs';
const value = process.argv[2];
const url = new URL(value);
if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev'))
  throw Error('Expected the deployed HTTPS workers.dev URL.');
writeFileSync(
  new URL('../src/multiplayer/config.js', import.meta.url),
  `// Public room service URL; no credentials belong here.\nexport const ROOM_SERVER = ${JSON.stringify(url.origin)};\n`,
);
