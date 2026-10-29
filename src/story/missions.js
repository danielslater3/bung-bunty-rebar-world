// Playable mission kinds for Acts II–VI. Each one can fail and be retried.
// Walking up to a sign is not enough to clear these steps.
import { state } from '../core/state.js';
import { ESCORT_PATH, SCOOTER_PATH } from './sagaData.js?v=20261029x';

const HANDLED = new Set([
  'escort', 'race', 'rhythm', 'photo', 'shards', 'trial', 'cricket', 'sky',
  'dodge', 'snow', 'deliver', 'sequence', 'eyes', 'hold', 'visits', 'evidence',
]);

export function isMission(kind) { return HANDLED.has(kind); }

export function closePlay() {
  document.getElementById('saga-play')?.remove();
}

function playCard(title, body) {
  closePlay();
  const el = document.createElement('div');
  el.id = 'saga-play';
  el.innerHTML = `<div class="saga-card"><b>${title}</b><p id="saga-play-body">${body}</p><div class="pitch"><div class="sweet" id="saga-sweet"></div><div id="saga-marker"></div></div><div id="saga-play-score"></div><div class="row" id="saga-play-actions"></div></div>`;
  document.body.appendChild(el);
  return el;
}

function setSweet(widthPct, leftPct) {
  const sweet = document.getElementById('saga-sweet');
  if (!sweet) return;
  sweet.style.width = `${widthPct}%`;
  sweet.style.left = `${leftPct}%`;
}

// The marker travels 6% → 92% of the pitch. The gold has to use that same scale.
function markBand(center, half) {
  setSweet(half * 2 * 86, 6 + (center - half) * 86);
}

function score(text) {
  const el = document.getElementById('saga-play-score');
  if (el) el.textContent = text;
}

function body(text) {
  const el = document.getElementById('saga-play-body');
  if (el) el.textContent = text;
}

function unlockPointer(saga) {
  saga.freeze = true;
  saga.game._wasLocked = false;
  saga.game.input.unlock();
  if (saga.game.trolley.riding) saga.game.trolley.dismount();
}

function haveMap(bucket) {
  return state.saga.stepState[bucket] || (state.saga.stepState[bucket] = {});
}

export function bootMission(saga, step) {
  saga.freeze = false;
  saga.mission = null;
  closePlay();
  clearSnow(saga);
  const boot = BOOT[step.kind];
  if (boot) boot(saga, step);
}

function retry(saga, speaker, text) {
  saga.game.audio.sfx('denied');
  saga.game.say(speaker, text);
  saga.freeze = false;
  closePlay();
  saga.mission = null;
  saga._booted = '';
  saga.ensureStep();
}

const BOOT = {
  escort(saga) {
    saga.mission = { kind: 'escort', t: 0, snatch: 0 };
  },
  race(saga) {
    saga.gaborT = 0;
    saga.mission = { kind: 'race', tail: 0, lost: 0 };
  },
  rhythm(saga, step) {
    unlockPointer(saga);
    saga.mission = { kind: 'rhythm', t: 0, hits: 0, misses: 0, armed: true, scored: false };
    playCard(step.banner || 'RAP BATTLE', 'Press F when the marker sits in the gold.');
    markBand(0.7, step.window || 0.08);
    score(`0 / ${step.need} BARS`);
  },
  photo(saga, step) {
    unlockPointer(saga);
    saga.mission = { kind: 'photo', t: 0, tries: 0 };
    playCard(step.banner || 'CAMERA', step.help || 'Press F when the marker sits in the gold.');
    markBand(0.5, step.sweet || 0.1);
  },
  cricket(saga, step) {
    unlockPointer(saga);
    saga.mission = { kind: 'cricket', t: 0, ball: 0, catches: 0 };
    playCard('REBAR CRICKET', 'Catch it. Press F while the marker is in the gold.');
    markBand(0.5, step.sweet || 0.12);
    score(`CATCHES 0/${step.need} · BALL 1/${step.balls}`);
  },
  trial(saga, step) {
    unlockPointer(saga);
    saga.mission = { kind: 'trial', q: 0 };
    const el = playCard('BRISBANE CITY COURT', step.questions[0].prompt);
    document.querySelector('#saga-play .pitch').style.display = 'none';
    layTrial(saga, step, el);
  },
  shards(saga) {
    saga.mission = { kind: 'shards', got: {}, stolen: 0 };
  },
  sky(saga, step) {
    saga.mission = { kind: 'sky', t: 0, fall: 0, caught: 0, misses: 0 };
    saga.game.toast(step.banner || 'LOOK UP', 'red');
  },
  dodge(saga) {
    saga.mission = { kind: 'dodge', t: 0, hurt: 0 };
  },
  snow(saga, step) {
    saga.mission = { kind: 'snow', left: step.seconds || 110 };
    makeSnow(saga);
  },
  deliver(saga) {
    saga.mission = { kind: 'deliver' };
    state.saga.stepState.leg = state.saga.stepState.leg || 0;
    state.saga.stepState.carrying = !!state.saga.stepState.carrying;
    state.saga.stepState.walk = state.saga.stepState.walk || 0;
  },
  eyes(saga) {
    saga.mission = { kind: 'eyes', t: 0, eye: 0, eyeHit: false, hits: 0, misses: 0 };
    saga.game.toast('TEN EYES. CATCH SIX BEFORE FOUR SHUT.', 'red');
  },
  hold(saga, step) {
    saga.mission = { kind: 'hold', t: 0, held: 0, bump: 0 };
    saga.game.say('ching', step.help || 'Stay on the floor. If he bumps you, the song starts again.');
  },
};

function layTrial(saga, step, root) {
  const q = step.questions[saga.mission.q];
  body(q.prompt);
  const row = root.querySelector('#saga-play-actions');
  row.innerHTML = '';
  for (const ev of step.evidence) {
    const btn = document.createElement('button');
    btn.className = 'mbtn';
    btn.textContent = ev.label;
    btn.onclick = () => answerTrial(saga, step, ev.id);
    row.appendChild(btn);
  }
}

function answerTrial(saga, step, id) {
  const m = saga.mission;
  if (!m || m.kind !== 'trial') return;
  const q = step.questions[m.q];
  if (id !== q.answer) {
    saga.game.audio.sfx('denied');
    saga.game.say('judge', q.bad || 'The court does not accept that exhibit.');
    return;
  }
  if (!state.saga.evidence.includes(id)) {
    saga.game.say('judge', 'You described it. You did not bring it.');
    return;
  }
  saga.game.audio.sfx('quest');
  saga.game.say('bung', q.reply);
  m.q += 1;
  if (m.q >= step.questions.length) {
    closePlay();
    saga.freeze = false;
    saga.advance();
    return;
  }
  const root = document.getElementById('saga-play');
  if (root) layTrial(saga, step, root);
}

export function tickMission(saga, dt) {
  const step = saga.currentStep();
  const m = saga.mission;
  if (!step || !m || m.kind !== step.kind) return;
  const fn = TICK[step.kind];
  if (fn) fn(saga, step, m, dt);
}

const TICK = {
  escort(saga, step, m, dt) {
    const player = saga.here();
    const ching = saga.pathOn(ESCORT_PATH, m.t);
    const dist = player.distanceTo(ching);
    if (dist < 12) m.t = Math.min(0.995, m.t + dt * 0.02);
    const gabor = ching.clone();
    const block = dist < 3.2;
    if (!block) {
      gabor.x += Math.cos(saga.game.elapsed * 0.8) * 2.2;
      gabor.z += Math.sin(saga.game.elapsed * 0.6) * 2.2;
      m.snatch += dt;
    } else m.snatch = 0;
    saga._escort = { ching, gabor };
    if (!block && m.snatch > 1.15 && m.t > 0.02) {
      m.t = 0;
      m.snatch = 0;
      saga.game.audio.sfx('denied');
      saga.game.say('gabor', 'I will walk her. You can hold the burgers.');
      saga.game.say('ching', 'Bung. Beside me. Not at the horizon.');
    }
    if (m.t > 0.97 && player.distanceTo(saga.pathOn(ESCORT_PATH, 0.99)) < 8) saga.advance();
  },
  race(saga, step, m, dt) {
    const player = saga.here();
    const pos = saga.pathOn(SCOOTER_PATH, saga.gaborT);
    const dist = player.distanceTo(pos);
    const rate = dist < 18 ? 0.048 : 0.02;
    saga.gaborT = Math.min(0.995, saga.gaborT + dt * rate);
    if (saga.game.trolley.riding && dist < 10) m.tail += dt;
    else m.tail = Math.max(0, m.tail - dt * 0.35);
    if (dist > 46) m.lost += dt;
    else m.lost = 0;
    if (m.lost > 3.4) {
      saga.gaborT = 0;
      m.tail = 0;
      m.lost = 0;
      saga.game.audio.sfx('denied');
      saga.game.say('gabor', 'Too slow. The scooter has places to be jealous.');
      return;
    }
    const at = saga.pathOn(SCOOTER_PATH, saga.gaborT);
    if (saga.game.trolley.riding && player.distanceTo(at) < 6.5 && saga.gaborT > 0.72 && m.tail > (step.tail || 4)) {
      saga.advance();
    }
  },
  rhythm(saga, step, m, dt) {
    m.t += dt;
    const cycle = step.gap || 0.9;
    const window = step.window || 0.08;
    const target = 0.7;
    const u = (m.t % cycle) / cycle;
    const marker = document.getElementById('saga-marker');
    if (marker) marker.style.left = `${6 + u * 86}%`;
    const inWindow = Math.abs(u - target) < window;
    body(inWindow ? 'NOW — press F' : 'Wait for the gold, then press F.');
    if (u < 0.12) { m.armed = true; m.scored = false; }
    const press = saga.game.input.pressed['KeyF'] || saga.game.input.pressed['Space'];
    if (press && m.armed && !m.scored) {
      m.scored = true;
      m.armed = false;
      if (inWindow) {
        m.hits += 1;
        saga.game.audio.sfx('coin');
      } else {
        m.misses += 1;
        saga.game.audio.sfx('denied');
      }
    } else if (m.armed && u > target + window) {
      m.armed = false;
      m.misses += 1;
      saga.game.audio.sfx('tick');
    }
    score(`${m.hits} / ${step.need} BARS · ${m.misses} MISSED`);
    if (m.hits + m.misses < (step.notes || 10)) return;
    closePlay();
    saga.freeze = false;
    if (m.hits >= step.need) saga.advance();
    else retry(saga, 'gabor', 'The forehead wins the bar. Again.');
  },
  photo(saga, step, m, dt) {
    m.t += dt;
    const p = (Math.sin(m.t * 2.6) + 1) / 2;
    const marker = document.getElementById('saga-marker');
    if (marker) marker.style.left = `${6 + p * 86}%`;
    if (!(saga.game.input.pressed['KeyF'] || saga.game.input.pressed['Space'])) return;
    m.tries += 1;
    const sweet = step.sweet || 0.1;
    if (Math.abs(p - 0.5) < sweet) {
      if (step.grant && !state.saga.evidence.includes(step.grant)) state.saga.evidence.push(step.grant);
      closePlay();
      saga.freeze = false;
      saga.game.audio.sfx('quest');
      saga.advance();
      return;
    }
    saga.game.audio.sfx('denied');
    if (m.tries >= (step.tries || 3)) retry(saga, 'ching', 'The flash missed him. Hold still and take it again.');
  },
  cricket(saga, step, m, dt) {
    m.t += dt;
    const p = (Math.sin(m.t * 2.1) + 1) / 2;
    const marker = document.getElementById('saga-marker');
    if (marker) marker.style.left = `${6 + p * 86}%`;
    score(`CATCHES ${m.catches}/${step.need} · BALL ${Math.min(step.balls, m.ball + 1)}/${step.balls}`);
    if (!(saga.game.input.pressed['KeyF'] || saga.game.input.pressed['Space'])) return;
    if (m.ball >= step.balls) return;
    m.ball += 1;
    const hit = Math.abs(p - 0.5) < (step.sweet || 0.12);
    if (hit) {
      m.catches += 1;
      saga.game.audio.sfx('coin');
      saga.game.shake(0.12, 0.2);
    } else saga.game.audio.sfx('denied');
    if (m.ball < step.balls) return;
    closePlay();
    saga.freeze = false;
    if (m.catches >= step.need) saga.advance();
    else retry(saga, 'bung', 'That over does not go on the statue. Another one.');
  },
  shards(saga, step, m, dt) {
    const origin = saga.point(step.at);
    const offsets = [[2.2, 1.1], [-2.4, 1.6], [0.8, -2.3]];
    const got = haveMap('shards');
    if (!saga._drone) saga._drone = origin.clone();
    let nearest = null;
    let nearestD = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      if (got[`s${i}`]) continue;
      const p = saga.pointXY(origin.x + offsets[i][0], origin.z + offsets[i][1]);
      if (saga.here().distanceTo(p) < 1.55) {
        got[`s${i}`] = true;
        saga.game.audio.sfx('quest');
        saga.game.toast(`SHARD ${Object.keys(got).length}/3`, 'blue');
        continue;
      }
      const d = Math.hypot(saga._drone.x - p.x, saga._drone.z - p.z);
      if (d < nearestD) { nearestD = d; nearest = p; }
    }
    if (nearest) {
      const dx = nearest.x - saga._drone.x;
      const dz = nearest.z - saga._drone.z;
      const len = Math.hypot(dx, dz) || 1;
      const stepLen = Math.min(len, dt * 2.15);
      saga._drone.x += (dx / len) * stepLen;
      saga._drone.z += (dz / len) * stepLen;
      saga._drone.y = origin.y;
      if (len < 0.9) {
        state.saga.stepState.shards = {};
        saga._drone = origin.clone();
        saga.game.audio.sfx('denied');
        saga.game.say('gabor', 'The drone files that shard under mine.');
        return;
      }
    }
    if (offsets.every((_, i) => got[`s${i}`])) saga.advance();
  },
  sky(saga, step, m, dt) {
    m.t += dt;
    m.fall = Math.min(1, m.fall + dt * (step.fallRate || 0.16));
    const aim = skyPoint(saga, step, m);
    const h = 28 * (1 - m.fall);
    const here = saga.here();
    const dist = Math.hypot(here.x - aim.x, here.z - aim.z);
    const speedOk = !step.ride || (saga.game.trolley.riding && Math.abs(saga.game.trolley.speed) >= (step.minSpeed || 8));
    if (saga.game.input.pressed['KeyF'] && h < 6.2 && h > 1.15 && dist < (step.catchRadius || 3.8) && speedOk) {
      m.caught += 1;
      m.fall = 0;
      saga.game.audio.sfx('quest');
      saga.game.shake(0.28, 0.35);
      saga.game.toast(`CAUGHT ${m.caught}/${step.count}`, 'blue');
      if (m.caught >= step.count) {
        state.saga.saves = Math.max(state.saga.saves || 0, step.save || 0);
        saga.advance();
      }
      return;
    }
    if (m.fall >= 1) {
      m.misses += 1;
      m.fall = 0;
      saga.game.audio.sfx('denied');
      saga.game.shake(0.2, 0.3);
      saga.game.say('bung', step.miss || 'That one kissed the footpath. I get another.');
      if (m.misses >= 3) {
        m.misses = 0;
        m.caught = 0;
        saga.game.say('doc', 'The sky is patient. Bung, less so. The catches start again.');
      }
    }
  },
  dodge(saga, step, m, dt) {
    m.t += dt;
    m.hurt = Math.max(0, m.hurt - dt);
    const c = saga.point(step.at);
    const hazards = [
      [m.t * 1.3, 5.2],
      [-m.t * 0.85, 8.1],
    ];
    saga._hazards = hazards.map(([ang, rad]) => saga.pointXY(c.x + Math.cos(ang) * rad, c.z + Math.sin(ang) * rad));
    if (m.hurt > 0) return;
    const here = saga.here();
    for (const h of saga._hazards) {
      if (here.distanceTo(h) < 2.15) {
        m.hurt = 1.1;
        saga.go(step.back || 'dodgeStart');
        saga.game.audio.sfx('denied');
        saga.game.say('gabor', 'The tornado machine likes your singlet. Back to the edge.');
        break;
      }
    }
  },
  snow(saga, step, m, dt) {
    m.left -= dt;
    blowSnow(saga, dt);
    if (m.left > 0) return;
    state.saga.stepState.piles = {};
    m.left = step.seconds || 110;
    saga.game.audio.sfx('denied');
    saga.game.say('ching', 'Too long. The snow climbed back up. Clear it again.');
  },
  deliver(saga, step, m, dt) {
    if (!state.saga.stepState.carrying) {
      state.saga.stepState.walk = 0;
      return;
    }
    if (saga.game.trolley.riding) state.saga.stepState.walk = 0;
    else state.saga.stepState.walk = (state.saga.stepState.walk || 0) + dt;
    if (state.saga.stepState.walk > 6) {
      state.saga.stepState.carrying = false;
      state.saga.stepState.walk = 0;
      saga.game.audio.sfx('denied');
      saga.game.say('seb', 'The rebar got ideas. It walked back to my yard. Pick it up again.');
    }
  },
  eyes(saga, step, m, dt) {
    m.t += dt;
    const period = 1.32;
    const idx = Math.floor(m.t / period) % 10;
    const phase = (m.t % period) / period;
    if (idx !== m.eye) {
      if (!m.eyeHit) m.misses += 1;
      m.eye = idx;
      m.eyeHit = false;
      if (m.misses >= 4) {
        retry(saga, 'girder', 'Four eyes closed unfed. The river is not impressed.');
        return;
      }
    }
    const open = phase < 0.5;
    saga._eye = { idx, open };
    if (!(open && saga.game.input.pressed['KeyF'] && !m.eyeHit)) return;
    const eye = eyePos(saga, step, idx);
    if (saga.here().distanceTo(eye) > 3.1) {
      m.misses += 1;
      saga.game.audio.sfx('denied');
      if (m.misses >= 4) retry(saga, 'girder', 'You bowed to the wrong eye.');
      return;
    }
    m.eyeHit = true;
    m.hits += 1;
    saga.game.audio.sfx('quest');
    saga.game.toast(`EYE ${m.hits}/6`, 'blue');
    if (m.hits >= 6) saga.advance();
  },
  hold(saga, step, m, dt) {
    m.t += dt;
    const c = saga.point(step.at);
    const rad = 4.2 + Math.sin(m.t * 1.15) * 3.4;
    const ang = m.t * 0.9;
    const gabor = saga.pointXY(c.x + Math.cos(ang) * rad, c.z + Math.sin(ang) * rad);
    saga._holdGabor = gabor;
    const here = saga.here();
    const inside = here.distanceTo(c) < (step.radius || 5.5);
    const bumped = here.distanceTo(gabor) < 2.25;
    if (bumped) {
      if (m.held > 0.4) saga.game.say('gabor', 'The dance is cancelled. I am the guest of honour.');
      m.held = 0;
      m.bump = 0.8;
    } else if (inside) m.held += dt;
    if (m.held >= (step.seconds || 8)) saga.advance();
  },
};

function skyPoint(saga, step, m) {
  const base = saga.point(step.at);
  const drift = Math.sin(m.t * (step.sway || 1.15)) * (step.swayAmp || 4);
  return saga.pointXY(base.x + drift, base.z + drift * 0.35);
}

function eyePos(saga, step, idx) {
  const c = saga.point(step.at);
  const a = (idx / 10) * Math.PI * 2;
  return saga.pointXY(c.x + Math.cos(a) * 4.2, c.z + Math.sin(a) * 4.2);
}

function makeSnow(saga) {
  clearSnow(saga);
  const THREE = saga.game.THREE || globalThis.THREE;
  // Three is imported by Saga; use a tiny local import via the renderer scene objects already constructed.
  if (!saga._snowGeo) return;
  saga._snowOn = true;
}

function clearSnow(saga) {
  saga._snowOn = false;
}

function blowSnow(saga, dt) {
  saga._snowT = (saga._snowT || 0) + dt;
}

export function poseMission(saga) {
  const step = saga.currentStep();
  const a = saga.actors;
  if (!a || !step) return;
  const show = (mesh, x, y, z, yaw) => {
    if (!mesh) return;
    mesh.visible = true;
    mesh.position.set(x, y, z);
    if (yaw != null) mesh.rotation.y = yaw;
  };
  if (step.kind === 'escort' && saga._escort) {
    const { ching, gabor } = saga._escort;
    show(a.ching, ching.x, ching.y, ching.z);
    show(a.gabor, gabor.x, gabor.y, gabor.z);
    show(a.bike, gabor.x + 0.8, gabor.y, gabor.z + 0.4);
    a.ching.position.y += Math.sin(saga.game.elapsed * 8) * 0.04;
  }
  if (step.kind === 'race') {
    const at = saga.pathOn(SCOOTER_PATH, saga.gaborT);
    show(a.gabor, at.x, at.y, at.z);
    show(a.scooter, at.x + 0.7, at.y, at.z + 0.35);
    a.scooter.rotation.y = Math.sin(saga.game.elapsed * 2) * 0.2;
  }
  if (step.kind === 'shards') {
    const origin = saga.point(step.at);
    const got = state.saga.stepState.shards || {};
    [[2.2, 1.1], [-2.4, 1.6], [0.8, -2.3]].forEach((off, i) => {
      const mesh = a.shards?.[i];
      if (!mesh) return;
      mesh.visible = !got[`s${i}`];
      mesh.position.set(origin.x + off[0], origin.y + 0.4 + Math.sin(saga.game.elapsed * 4 + i) * 0.12, origin.z + off[1]);
      mesh.rotation.y += 0.04;
    });
    if (saga._drone && a.drone) show(a.drone, saga._drone.x, origin.y + 1.6, saga._drone.z);
  }
  if (step.kind === 'sky' && saga.mission) {
    const aim = skyPoint(saga, step, saga.mission);
    const h = 28 * (1 - saga.mission.fall);
    const orb = a[step.orb] || a.meteor;
    show(orb, aim.x, aim.y + h, aim.z);
    orb.rotation.x += 0.08;
    orb.rotation.y += 0.05;
    if (a.marker) {
      a.marker.visible = true;
      a.marker.position.set(aim.x, aim.y + 2.5, aim.z);
    }
  }
  if (step.kind === 'dodge' && saga._hazards) {
    saga._hazards.forEach((p, i) => show(i === 0 ? a.guard : a.hazard, p.x, p.y, p.z));
  }
  if (step.kind === 'hold' && saga._holdGabor) {
    const g = saga._holdGabor;
    show(a.gabor, g.x, g.y, g.z);
  }
  if (step.kind === 'eyes' && saga._eye) {
    const stepAt = saga.point(step.at);
    if (a.girder) show(a.girder, stepAt.x, stepAt.y, stepAt.z);
    a.eyes?.forEach((eye, i) => {
      const p = eyePos(saga, step, i);
      const open = saga._eye.open && saga._eye.idx === i;
      eye.visible = true;
      eye.position.set(p.x, p.y + (open ? 2.4 : 1.5), p.z);
      const s = open ? 0.34 : 0.16;
      eye.scale.setScalar(s);
    });
  }
  if (step.kind === 'deliver' && state.saga.stepState.carrying && a.cargo) {
    const p = saga.here();
    show(a.cargo, p.x, p.y + 1.3, p.z + 0.4);
  }
  if ((step.kind === 'visits' || state.saga.mansion) && a.family) {
    for (const member of a.family) member.mesh.visible = !!state.saga.mansion;
  }
  if (step.cast) {
    for (const name of step.cast) {
      if (name === 'ching' && a.ching && step.kind !== 'escort') {
        const p = saga.game.player.pos;
        show(a.ching, p.x + 1.3, p.y, p.z + 0.4);
      }
      if (name === 'gabor' && a.gabor && !['escort', 'race', 'hold'].includes(step.kind)) {
        const p = saga.point(step.look || step.at || 'mcrebar');
        show(a.gabor, p.x + 2.2, p.y, p.z + 1.2);
      }
      if (name === 'seb' && a.seb) {
        const p = saga.point('yard');
        show(a.seb, p.x, p.y, p.z);
      }
    }
  }
  if (step.kind === 'snow' && a.piles) {
    const got = state.saga.stepState.piles || {};
    step.piles.forEach((id) => {
      const mesh = a.piles[id];
      if (!mesh) return;
      mesh.visible = !got[id];
      mesh.position.y = saga.ground(PLACE_X(saga, id), PLACE_Z(saga, id)) + Math.sin(saga.game.elapsed * 2) * 0.05;
    });
  }
}

function PLACE_X(saga, id) { return saga.point(id).x; }
function PLACE_Z(saga, id) { return saga.point(id).z; }

export function missionMarker(saga, step) {
  if (!step || !HANDLED.has(step.kind)) return undefined;
  if (step.kind === 'escort') return saga.pathOn(ESCORT_PATH, Math.min(0.99, (saga.mission?.t || 0) + 0.04));
  if (step.kind === 'race') return saga.pathOn(SCOOTER_PATH, Math.min(0.99, saga.gaborT + 0.02));
  if (step.kind === 'sky' && saga.mission) return skyPoint(saga, step, saga.mission);
  if (step.kind === 'eyes') return saga._eye ? eyePos(saga, step, saga._eye.idx) : saga.point(step.at);
  if (step.kind === 'shards') {
    const got = state.saga.stepState.shards || {};
    const i = [0, 1, 2].find((n) => !got[`s${n}`]);
    if (i == null) return null;
    const origin = saga.point(step.at);
    const off = [[2.2, 1.1], [-2.4, 1.6], [0.8, -2.3]][i];
    return saga.pointXY(origin.x + off[0], origin.z + off[1]);
  }
  if (step.kind === 'evidence' || step.kind === 'snow' || step.kind === 'sequence') {
    const key = step.kind === 'snow' ? 'piles' : step.kind === 'sequence' ? null : 'evidenceGot';
    if (step.kind === 'sequence') {
      const n = state.saga.stepState.seq || 0;
      const id = step.order?.[n];
      return id ? saga.point(id) : null;
    }
    const got = state.saga.stepState[key] || {};
    const list = step.items || step.piles || [];
    const item = list.find((p) => !got[p.id || p]);
    if (!item) return saga.point(step.at || 'home');
    return saga.point(item.at || item.id || item);
  }
  if (step.kind === 'deliver') {
    if (!state.saga.stepState.carrying) return saga.point('crate');
    const id = step.drops[state.saga.stepState.leg || 0];
    return id ? saga.point(id) : saga.point('yard');
  }
  if (step.kind === 'visits') {
    const got = state.saga.stepState.visits || {};
    const next = step.visits.find((v) => !got[v.id]);
    if (!next) return null;
    const p = saga.point(next.at);
    p.y = saga.floorY(next.floor || 0);
    return p;
  }
  if (step.kind === 'dodge') return saga.point(step.at);
  if (step.at && ['photo', 'cricket', 'hold', 'trial'].includes(step.kind)) return null;
  return null;
}

export function missionLabel(saga, step) {
  if (!step || !saga.mission || saga.mission.kind !== step.kind) return null;
  const m = saga.mission;
  if (step.kind === 'race') return `${step.text} — stay with him (${Math.floor(m.tail)}s)`;
  if (step.kind === 'escort') return `${step.text} — ${Math.round(m.t * 100)}% of the way`;
  if (step.kind === 'sky') return `${step.text} (${m.caught}/${step.count})`;
  if (step.kind === 'eyes') return `${step.text} (${m.hits}/6, misses ${m.misses})`;
  if (step.kind === 'hold') return `${step.text} (${Math.floor(m.held)}/${step.seconds || 8}s)`;
  if (step.kind === 'snow') return `${step.text} (${Math.ceil(m.left)}s left)`;
  if (step.kind === 'rhythm') return `${step.text} (${m.hits}/${step.need})`;
  if (step.kind === 'cricket') return `${step.text} (${m.catches}/${step.need})`;
  if (step.kind === 'deliver') {
    const leg = state.saga.stepState.leg || 0;
    return state.saga.stepState.carrying ? `Ride the rebar to drop ${leg + 1}/${step.drops.length}` : `Pick up rebar ${leg + 1} at Seb's yard`;
  }
  return null;
}

export function onInteract(saga, id) {
  const step = saga.currentStep();
  if (!step) return false;
  if (step.kind === 'evidence') return takeEvidence(saga, step, id);
  if (step.kind === 'snow') return clearPile(saga, step, id);
  if (step.kind === 'sequence') return takeClue(saga, step, id);
  if (step.kind === 'deliver') return deliver(saga, step, id);
  if (step.kind === 'visits') return visit(saga, step, id);
  if (step.kind === 'dodge' && id === 'switch') {
    saga.game.dialogue.conversation([
      ['bung', 'Off. The lawn can be a lawn again.'],
      ['gabor', 'I will remember the wind fondly and the lawsuit less so.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'phone' && step.id === 'phone') {
    state.saga.phone = 'blue';
    saga.game.dialogue.conversation([
      ['ching', 'Samsung S24 Ultra. Rebar Edition. Blue, because the trolley already took gold.'],
      ['bung', 'I will guard it with my life and also with both hands, which is more.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'newphone' && step.id === 'newphone') {
    state.saga.phone = 'replaced';
    saga.game.dialogue.conversation([
      ['ching', 'Same phone. New glass. The court paid for the glass.'],
      ['bung', 'I will not let a forehead near this one without a witness and a receipt.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'cheque' && step.id === 'cheque') {
    state.saga.fortune = 3000000000;
    saga.game.dialogue.conversation([
      ['doc', 'The city writes a number with too many zeroes. Three billion dollars. Fictional, and still heavy.'],
      ['bung', 'I would like it in notes, and also in rebars, and also in a house tall enough for both our families.'],
      ['ching', 'Sign it before Gabor offers to count it.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'suitcase' && step.id === 'suitcase') {
    saga.game.dialogue.conversation([
      ['doc', 'The suitcase is packed for places this chronicle does not open yet. China is a stamp, not a level.'],
      ['bung', 'Brisbane first. The world can wait until the trolley has had a lie down.'],
      ['ching', 'The shelf is full. The city is still here. That is the ending and the engine.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'seb' && step.id === 'seb-meet') {
    saga.game.dialogue.conversation([
      ['seb', 'Three standard rebars. Three addresses. You ride, you do not wander, you do not gift them to a forehead.'],
      ['bung', 'Seb Daly. Big boss. I have brought the singlet and the trolley, which is the whole company.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'seb' && step.id === 'seb-pay') {
    if ((state.saga.stepState.leg || 0) < 3) {
      saga.game.say('seb', 'I still have rebars with your name on them. They are not metaphorical.');
      return true;
    }
    saga.game.dialogue.conversation([
      ['seb', 'Three delivered. The yard remembers a straight job, which is rare enough to frame.'],
      ['bung', 'Pay me in rebars. I spend money accidentally and steel on purpose.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'join' && step.id === 'join') {
    state.saga.companion = true;
    saga.game.dialogue.conversation([
      ['ching', 'The visa is stamped. Queen Street is loud. I am staying.'],
      ['bung', 'Then the trolley has a second opinion, which it badly needed.'],
      ['gabor', 'I rode here on a bicycle to say welcome, and also to say I saw her first.'],
      ['ching', 'You saw the queue at the airport. It is not the same achievement.'],
    ], () => saga.advance());
    return true;
  }
  if (id === 'offer' && step.id === 'offer') {
    if (!state.saga.relics.includes('Obsidian Rebar')) state.saga.relics.push('Obsidian Rebar');
    saga.game.dialogue.conversation([
      ['girder', 'The river accepts the offering. Ten eyes blink in something like respect.'],
      ['bung', 'Sir Girderface. I brought steel and a bad idea. You brought the eyes. We are even.'],
    ], () => saga.advance());
    return true;
  }
  return false;
}

function takeEvidence(saga, step, id) {
  const item = step.items.find((it) => it.id === id);
  if (!item) return false;
  const got = haveMap('evidenceGot');
  if (got[id]) {
    saga.game.say('bung', 'Already in the brief.');
    return true;
  }
  got[id] = true;
  if (!state.saga.evidence.includes(id)) state.saga.evidence.push(id);
  saga.game.audio.sfx('quest');
  saga.game.say(item.who || 'bung', item.line);
  if (step.items.every((it) => got[it.id])) saga.advance();
  return true;
}

function clearPile(saga, step, id) {
  if (!step.piles.includes(id)) return false;
  const got = haveMap('piles');
  if (got[id]) return true;
  got[id] = true;
  saga.game.audio.sfx('quest');
  saga.game.say('bung', 'This pile has been negotiated down to a puddle.');
  if (step.piles.every((p) => got[p])) saga.advance();
  return true;
}

function takeClue(saga, step, id) {
  if (!step.order.includes(id)) return false;
  const n = state.saga.stepState.seq || 0;
  if (id !== step.order[n]) {
    state.saga.stepState.seq = 0;
    saga.game.audio.sfx('denied');
    saga.game.say('bung', 'Wrong scrap first. The trail folds up and starts again.');
    return true;
  }
  state.saga.stepState.seq = n + 1;
  saga.game.audio.sfx('quest');
  saga.game.say('doc', step.lines[n] || 'The clue agrees with you.');
  if (state.saga.stepState.seq >= step.order.length) saga.advance();
  return true;
}

function deliver(saga, step, id) {
  const leg = state.saga.stepState.leg || 0;
  if (id === 'crate') {
    if (leg >= step.drops.length) return true;
    if (state.saga.stepState.carrying) {
      saga.game.say('bung', 'I am already carrying the one that matters.');
      return true;
    }
    state.saga.stepState.carrying = true;
    state.saga.stepState.walk = 0;
    saga.game.audio.sfx('quest');
    saga.game.say('seb', 'On the trolley. If you stroll, the steel strolls back.');
    return true;
  }
  if (id !== step.drops[leg]) return false;
  if (!state.saga.stepState.carrying) {
    saga.game.say('bung', 'I have delivered enthusiasm. Seb wanted the rebar.');
    return true;
  }
  if (!saga.game.trolley.riding) {
    saga.game.say('seb', 'I said ride. Walking is how rebars get hobbies.');
    return true;
  }
  state.saga.stepState.carrying = false;
  state.saga.stepState.leg = leg + 1;
  saga.game.audio.sfx('quest');
  saga.game.toast(`DELIVERED ${leg + 1}/${step.drops.length}`, 'blue');
  if (state.saga.stepState.leg >= step.drops.length) saga.advance();
  return true;
}

function visit(saga, step, id) {
  const item = step.visits.find((v) => v.id === id);
  if (!item) return false;
  const here = saga.game.player.pos;
  const spot = saga.point(item.at);
  spot.y = saga.floorY(item.floor || 0);
  if (Math.abs(here.y - spot.y) > 1.6) {
    saga.game.say('bung', 'Wrong floor. The stairs are not a rumour.');
    return true;
  }
  const got = haveMap('visits');
  if (got[id]) {
    saga.game.say(item.speaker || 'bung', 'We said it. The floor heard us.');
    return true;
  }
  got[id] = true;
  saga.game.audio.sfx('quest');
  saga.game.dialogue.conversation(item.lines, () => {
    if (step.visits.every((v) => (state.saga.stepState.visits || {})[v.id])) saga.advance();
  });
  return true;
}

export function prepSnow(saga, THREE) {
  if (saga._snowPoints) return;
  const count = 700;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 46;
    pos[i * 3 + 1] = Math.random() * 18;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf4f7ff, size: 0.12, transparent: true, opacity: 0.85 }));
  points.frustumCulled = false;
  points.visible = false;
  saga.game.zone.group.add(points);
  saga._snowPoints = points;
  saga._snowPos = pos;
}

export function driftSnow(saga, dt) {
  const points = saga._snowPoints;
  if (!points) return;
  const on = saga.currentStep()?.kind === 'snow';
  points.visible = !!on;
  if (!on) return;
  const pos = saga._snowPos;
  const p = saga.here();
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] -= dt * 3.2;
    if (pos[i + 1] < 0) pos[i + 1] = 16;
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.position.set(p.x, p.y, p.z);
}
