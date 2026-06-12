// DebugManager — opt-in diagnostics for the whole game.
// Enable by loading the game with ?debug in the URL (http://localhost:8787/?debug).
// When enabled:
//   - portals render their actual trigger discs (wireframe)
//   - portal/rebar/chain/boost events log accepted/rejected reasons
//   - missing-audio and quest events log to console
// Debug must NEVER affect gameplay logic — read-only observation only.
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function dlog(category, ...args) {
  if (DEBUG) console.log(`%c[${category}]`, 'color:#2ee6ff;font-weight:bold', ...args);
}
