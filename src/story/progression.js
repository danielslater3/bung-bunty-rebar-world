// Save-compatible completion transitions. 'done' is also the reward receipt,
// so replaying a chapter or resuming its clear screen cannot mint coins twice.
export function repairProgress(saga, chapters) {
  saga.chapter = Math.max(0, Math.min(chapters.length - 1, Math.floor(Number(saga.chapter) || 0)));
  const chapter = chapters[saga.chapter];
  saga.step = Math.max(0, Math.min(chapter.steps.length, Math.floor(Number(saga.step) || 0)));
  if (saga.step >= chapter.steps.length && saga.done?.includes(chapter.id)) saga.intermission = true;
  return saga.step >= chapter.steps.length && !saga.done?.includes(chapter.id);
}
export function awardChapter(state, chapter) {
  const saga = state.saga;
  const first = !saga.done.includes(chapter.id);
  if (first) {
    saga.done.push(chapter.id);
    state.coins += chapter.reward?.coins || 0;
  }
  if (chapter.reward?.relic && !saga.relics.includes(chapter.reward.relic))
    saga.relics.push(chapter.reward.relic);
  saga.intermission = true;
  saga.trolleyDamage = false;
  return first;
}
