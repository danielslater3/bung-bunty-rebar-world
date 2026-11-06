// Compatibility for saves and room profiles written before the partner rename.
// Keep the retired spelling out of game text, identifiers and generated UI.
const retiredId = 'ch\u0069ng';
const retiredToken = new RegExp('(^|[^a-z])' + retiredId + '(?=$|[^a-z])', 'g');
export function canonicalCharacterId(value) {
  return typeof value === 'string'
    ? value.replace(retiredToken, '$1chung')
    : value;
}
export function migrateCharacterState(value) {
  if (Array.isArray(value)) return value.map(migrateCharacterState);
  if (!value || typeof value !== 'object') return canonicalCharacterId(value);
  // If a mixed-version save has both keys, the canonical entry wins.
  const entries = Object.entries(value).sort(
    ([a], [b]) =>
      Number(a === canonicalCharacterId(a)) -
      Number(b === canonicalCharacterId(b)),
  );
  return Object.fromEntries(
    entries.map(([key, item]) => [
      canonicalCharacterId(key),
      migrateCharacterState(item),
    ]),
  );
}
