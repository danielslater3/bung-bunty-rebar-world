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
    state.rebars = (state.rebars || 0) + (chapter.reward?.coins || 0);
  }
  if (chapter.reward?.relic && !saga.relics.includes(chapter.reward.relic))
    saga.relics.push(chapter.reward.relic);
  saga.intermission = true;
  saga.trolleyDamage = false;
  return first;
}

// Unlocks come from the main campaign, never from a temporary replay.
export function chapterFrontier(saga, chapters) {
  if (!saga?.active) return -1;
  if (saga.legend) return chapters.length - 1;
  let reached = Math.max(0, Math.min(chapters.length - 1, Math.floor(Number(saga.chapter) || 0)));
  for (let i = 0; i < chapters.length; i++)
    if (saga.done?.includes(chapters[i].id))
      reached = Math.max(reached, Math.min(i + 1, chapters.length - 1));
  return reached;
}
export function chapterReplay(saved, index, chapters, createSaga) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > chapterFrontier(saved?.saga, chapters) ||
    !chapters[index]?.playable
  )
    throw new Error('That chapter is locked.');
  const copy = JSON.parse(JSON.stringify(saved));
  // Establish only the story prerequisites that existed before this chapter.
  const saga = createSaga();
  saga.chapter = index;
  saga.done = chapters.slice(0, index).map((ch) => ch.id);
  saga.relics = chapters.slice(0, index).flatMap((ch) => (ch.reward?.relic ? [ch.reward.relic] : []));
  saga.bigBoy = index >= 3;
  saga.companion = index >= 5;
  saga.mansion = index >= 16;
  saga.phone = index >= 10 ? 'replaced' : index >= 8 ? 'broken' : index >= 7 ? 'blue' : 'intact';
  saga.evidence = index >= 9 ? ['photo','shards','receipt','witness','goggles'] : index >= 8 ? ['photo', 'shards'] : [];
  saga.garageOpen = index > 0;
  saga.introSeen = index > 0;
  copy.saga = saga;
  copy._replay = { chapter: index };
  copy.currentZone = 'brisbane';
  copy.places = {};
  copy.picked = {};
  copy.flags = { ...copy.flags, trolleyUnlocked: index > 0 };
  return copy;
}
