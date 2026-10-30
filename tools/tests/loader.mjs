// Resolve the browser import map/root paths for Node's native test runner.
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('vendor/three.module.js', root).href, shortCircuit: true };
  if (specifier.startsWith('/src/')) specifier = new URL(specifier.slice(1), root).href;
  // Query suffixes are HTTP cache keys, not different module state.
  if (/^(file:|\.\.?\/)/.test(specifier)) specifier = specifier.split('?')[0];
  return next(specifier, context);
}
