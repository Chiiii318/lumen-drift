// The deterministic scenes behind ?shot=start|play|end&seed=N — the same mechanism the
// screenshots in screenshots/ were captured with, so anyone can re-render them exactly.
// Each scene steps the real rules forward from a fresh world with a simple autopilot:
// the play scene's keeper gathers motes and burns the moth it can reach; the end scene's
// keeper is careless, chases motes through the dark, and is caught — as a hurried player is.

import { FIELD, PLAYER } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createWorld, mothInBeam, stepWorld } from './world.js';

const STEP = 1 / 60;

function nearest(state, list) {
  let best = null;
  let bestDist = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best ? { item: best, dist: bestDist } : null;
}

function moveToward(state, x, y, intent) {
  const dx = x - state.player.x;
  const dy = y - state.player.y;
  intent.moveX = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
  intent.moveY = Math.abs(dy) < 6 ? 0 : Math.sign(dy);
}

/** The careful keeper of the play scene: feed the light, flee close moths, burn far ones. */
function carefulPilot(state) {
  const p = state.player;
  const intent = { moveX: 0, moveY: 0, aimX: p.x, aimY: p.y - 100, beam: false };
  const moth = nearest(state, state.moths);
  const mote = nearest(state, state.motes);
  if (moth && moth.dist < 95) {
    // Too close to burn safely — back away from it, toward the middle of the garden.
    moveToward(state, FIELD.width / 2 + (p.x - moth.item.x), FIELD.height / 2 + (p.y - moth.item.y), intent);
    intent.aimX = moth.item.x;
    intent.aimY = moth.item.y;
    intent.beam = moth.dist < PLAYER.beamRange;
  } else if (mote) {
    moveToward(state, mote.item.x, mote.item.y, intent);
    if (moth) {
      intent.aimX = moth.item.x;
      intent.aimY = moth.item.y;
      intent.beam = mothInBeam(state, moth.item) || moth.dist < PLAYER.beamRange * 0.9;
    } else {
      intent.aimX = mote.item.x;
      intent.aimY = mote.item.y;
    }
  } else if (moth) {
    intent.aimX = moth.item.x;
    intent.aimY = moth.item.y;
    intent.beam = moth.dist < PLAYER.beamRange;
  }
  return intent;
}

/** The careless keeper of the end scene: eyes only on the motes, never on the dark. */
function carelessPilot(state) {
  const p = state.player;
  const intent = { moveX: 0, moveY: 0, aimX: p.x, aimY: p.y - 100, beam: false };
  const mote = nearest(state, state.motes);
  if (mote) {
    moveToward(state, mote.item.x, mote.item.y, intent);
    intent.aimX = mote.item.x;
    intent.aimY = mote.item.y;
  }
  return intent;
}

function run(state, pilot, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps && !state.over && !state.dawn; i += 1) {
    stepWorld(state, pilot(state), STEP);
  }
}

/**
 * The play scene does not stop on a clock: it plays until the frame is worth showing —
 * the beam lit, at least two moths in the garden and at least three motes adrift — some
 * time after the tenth second. The same seed always stops on the same step.
 */
function runUntilPhotogenic(state, pilot, maxSeconds) {
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps && !state.over && !state.dawn; i += 1) {
    stepWorld(state, pilot(state), STEP);
    if (
      state.time > 10 &&
      state.player.beamOn &&
      state.moths.length >= 2 &&
      state.motes.length >= 3
    ) {
      // Hold the moment a breath longer so the burn ring reads on the moth.
      stepWorld(state, pilot(state), STEP);
      stepWorld(state, pilot(state), STEP);
      return;
    }
  }
}

/** Build the named scene. Returns { state, screen } ready for drawScene. */
export function buildShotScene(name, seed) {
  if (name === 'play') {
    const state = createWorld(seed);
    runUntilPhotogenic(state, carefulPilot, 45);
    return { state, screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    const state = createWorld(seed);
    // The careless keeper falls quickly once the waves thicken; cap the search so a lucky
    // seed still produces an ending (the night drains his light even if no moth lands).
    run(state, carelessPilot, 400);
    run(state, carelessPilot, 0.8); // a breath of settling particles after the fall
    return { state, screen: SCREEN_OVER };
  }
  // 'start' (and anything unknown): the calm garden behind the title.
  const state = createWorld(seed, true);
  run(state, () => ({ moveX: 0, moveY: 0, aimX: 480, aimY: 160, beam: false }), 3);
  return { state, screen: SCREEN_TITLE };
}
