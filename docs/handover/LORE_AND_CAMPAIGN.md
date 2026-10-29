# Lore and campaign

Two layers exist. **Original lore** is the biography the player asked the game to keep. **Game text** is what `src/lore/universe.js` `ARCHIVE` and `src/story/sagaData.js` actually say. Where they differ, the game text is the adaptation, and it should not be "corrected" back into a deleted joke or a real brand.

The archive spells the partner **Chung** in several cards. Dialogue speaker id and most chapter titles use **Ching**. Both refer to the same character. Do not rename one without renaming the other on purpose.

International cities are zones and archive flavour. The chronicle's own header says later cities stay out of this campaign. Brisbane is the playable setting.

## People and objects

**Bung Bunty.** Archive: born 3 March 1977 in Brisbane, stained singlet, brown boxers, four rebar hairs, a ten-hair goatee. Chapter 1's opening lines say he graduates in 1995 and that the school still talks about the rebar he brought to assembly. Personality in dialogue is loud, hungry, and sincere about the trolley. Model: `buildBung()` in `models.js`. Feet origin, head group at local y 1.78.

**Ching / Chung.** Met Bung while he was travelling in China. She moves to Brisbane in this chronicle (chapter 5 starts at King George Square, not on a China map). She shares the rebar obsession and the second golden trolley in the archive text. She is the reason the mansion has not been condemned. Model: `buildChing()`.

**Gabor Mihala.** Wiry, enormous forehead, small orange beard, purple cape, bag of fake rebars, scooter. Jealous of Bung, interested in Ching, trying to monopolise rebar. The Parliament lawsuit in the archive is $10,000. Model: `buildGabor()`, scooter `buildScooter()`.

**James Rebar.** A standard, not a man who walks around. The golden motorised trolley and the workshop use the name. Default trolley id `'james'` in `trolleySpec`.

**McRebar.** The fictional restaurant at the real 130 Queen Street frontage. Meals hide miniature rebars. Signage stays McREBAR. No chain wordmark and no letter-arch.

**Golden Mini Rebar.** One in a hundred thousand meals. Chapter 2 relic string `'Golden Mini Rebar'`, archive id `golden-mini`.

**Platinum Diamond Rebar.** McRebar Max prize, one in a million. Chapter 3 relic `'Platinum Diamond Rebar'`, archive `platinum-diamond`. In the game it is obtained after a spoon is taken out of the axle and Big Boy Mode is switched on. Big Boy Mode is a speed flag, not a new vehicle mesh.

**Emerald Rebar.** One in a hundred million. Chapter 4 relic `'Emerald Rebar'`, archive `emerald-mini`. Recovered from a fictional South Bank collector lawn.

**X-ray goggles.** Chapter 2. Gabor's line is that they see through cardboard. They are not a rendering effect.

**Scooter and sabotage.** Chapter 3 opens with Gabor putting a spoon in the axle (`trolleyDamage`). Chapter 6 is the jealousy scooter. The sandbox also has `BossEvents.js` `GaborChase`, which is a different boss than the saga polyline.

**Rap battles.** Chapter 7 and the last round of chapter 23. Implementation is a timing bar (`kind: 'rhythm'`), not recorded vocals.

**Samsung S24 Ultra.** Chapter 8 calls it a blue Rebar Edition. The archive id is `samsung`. The photograph and the smash are story beats. Shards are pickups (`kind: 'shards'`).

**$10,000 lawsuit.** Chapter 9. A fictional sitting on the Parliament lawn. The player presents evidence. The building footprint is real. The court is not a scanned interior.

**Parliament House.** OSM way 8040447. The plaque is fiction (`universe.js` district text).

**W Brisbane celebration.** Chapter 10. Played on `PLACE.wlawn` because the hotel is not in the map. The archive card says that on purpose.

**Meteors and rebar cricket.** Chapters 11–14. Davies Park catches, South Bank meteors, Victoria Bridge cartoon bombs, a rebar satellite over King George Square. These are the "three saves". Cricket is a timing window (`kind: 'cricket'`), not a physics ball.

**$3 billion.** Chapter 15, archive `three-billion`. A fictional cheque. `state.saga.fortune` is the story counter.

**Mansion.** Chapter 16 builds it. Archive and chapter 24 agree on floors: Ching's family below, Bung and Ching in the middle, Bung's family on top. `Saga.ensureMansion` creates that shell in West End when `chapter >= 15` or `mansion` is set. It is not the mansion hub zone, which is a separate sandbox map at the origin of its own scene.

**Rebar Expo.** Chapter 18. Kebab and photo booth on `PLACE.expo`.

**Seb Daly.** Archive: Big Boss of Brisbane. Chapter 20 sends Bung to a yard near Davies Park with three rebars.

**Rebar Man.** Chapter 21. Scraps, then a workshop, then poses. Not a separate licensed character.

**Sir Girderface.** Chapter 22. Ten eyes, obsidian, a river offering. Archive: originally a Rebar Simulator legend. The game does not import that other game's assets.

**Great Brisbane Snow Disaster.** Chapter 19. Piles from West End to the CBD (`kind: 'snow'`). It melts when the piles are cleared. It is not a climate model.

**Ultimate showdown.** Chapter 23. A race, an over, and a rap. Failure retries the round inside `missions.js`.

**Future international expansions.** Archive card `tour` mentions China, Japan, airports, hotels. Sydney and Hong Kong zones exist for the sandbox and are named in `DISTRICTS`. They are not chapters. Do not start them while chapters 1–4 are the priority. Chapter 24's suitcase line says the rest of the world is later, and the suitcase stays shut.

## Acts and chapters

`ACTS` and `CHAPTERS` in `sagaData.js`. Every chapter has `playable: true` and a `steps` array. "Playable" here means the step machine can run it. It does not mean the scene has been art-directed.

| Index | Id | Act | Title | Opening kind |
| --- | --- | --- | --- | --- |
| 0 | ch1 | 1 | BUNG BUNTY: THE ORIGINS | scene at the house |
| 1 | ch2 | 1 | THE GOLDEN MINI REBAR INCIDENT | scene at McRebar |
| 2 | ch3 | 1 | MCREBAR MAX: BIG BOY MODE | scene at the garage |
| 3 | ch4 | 1 | THE EMERALD REBAR HEIST | scene at McRebar |
| 4 | ch5 | 2 | CHING'S ARRIVAL | scene at King George Square |
| 5 | ch6 | 2 | THE GABOR JEALOUSY CRISIS | scene at McRebar, then a scooter race |
| 6 | ch7 | 3 | THE LEGENDARY RAP BATTLE | rhythm minigame on the square |
| 7 | ch8 | 3 | THE SAMSUNG S24 ULTRA CATASTROPHE | phone, photo, shards |
| 8 | ch9 | 3 | THE $10,000 BRISBANE CITY COURT LAWSUIT | evidence, then a trial |
| 9 | ch10 | 3 | W BRISBANE: THE VICTORY CELEBRATION | hold position on the lawn |
| 10 | ch11 | 4 | THE REBAR CRICKET PRODIGY | cricket timing at Davies Park |
| 11 | ch12 | 4 | THE GREAT BRISBANE METEOR CRISIS | sky catches at South Bank |
| 12 | ch13 | 4 | THE FALLING-BOMB INCIDENT | sky catches by Victoria Bridge |
| 13 | ch14 | 4 | THE THIRD IMPOSSIBLE SAVE | sky catch that wants the trolley moving |
| 14 | ch15 | 4 | THE THREE-BILLION-DOLLAR BUNG | cheque and fortune |
| 15 | ch16 | 5 | THE THREE-STOREY REBAR MANSION | visits on three floors |
| 16 | ch17 | 5 | GABOR'S BILLIONAIRE JEALOUSY | tornado machine on a lawn |
| 17 | ch18 | 6 | THE BRISBANE REBAR EXPO | expo booths |
| 18 | ch19 | 6 | THE GREAT BRISBANE SNOW DISASTER | snow piles |
| 19 | ch20 | 6 | SEB DALY: THE BIG BOSS OF BRISBANE | yard delivery |
| 20 | ch21 | 6 | REBAR MAN RISES AGAIN | scraps and workshop |
| 21 | ch22 | 6 | THE AWAKENING OF SIR GIRDERFACE | eyes, then an offering |
| 22 | ch23 | 6 | THE ULTIMATE GABOR SHOWDOWN | race, cricket, rap |
| 23 | ch24 | 6 | THE LEGEND OF BUNG BUNTY | floor visits, rings, closed suitcase |

Rewards and exact lines are on each chapter object. `finishChapter` pushes the chapter id into `state.saga.done`, grants coins, pushes `reward.relic` into `relics` if set, and unlocks `reward.archive`.

## What not to rewrite

- Do not delete the 1977 birth or the 1995 graduation lines.
- Do not move Ching's arrival onto a China level.
- Do not put the W hotel on the map by inventing a coordinate. The lawn stand-in is deliberate.
- Do not import Sir Girderface from another project.
- Do not reduce a chapter to a single "walk here and press E" if it already has a minigame. Also do not claim a minigame is a finished cinematic.
