// Lumen Drift — the simulation. Pure state and fixed-step updates; no DOM, no rendering.
// You are the firefly keeper: your light is always draining. Gather drifting light motes to
// feed it, and burn shadow moths away with your lantern beam before they reach you and drink
// your light themselves. Survive five waves and dawn breaks — you win. Let the light reach
// zero and the night takes the garden — game over.

import { FIELD, LIGHT, MOTE, MOTH, PLAYER, WAVES } from './config.js';
import { makeRng, pointInField, range } from './random.js';

export const EVENT_PICKUP = 'pickup';
export const EVENT_BANISH = 'banish';
export const EVENT_HURT = 'hurt';
export const EVENT_WAVE = 'wave';
export const EVENT_DAWN = 'dawn';
export const EVENT_OVER = 'over';

export function createWorld(seed, ambient = false) {
  const rng = makeRng(seed);
  const state = {
    rng,
    ambient, // an ambient world (the title screen) drifts and glows but never plays: no drain, no moths
    time: 0,
    score: 0,
    wave: 1,
    waveTime: 0,
    dawn: false,
    over: false,
    player: {
      x: FIELD.width / 2,
      y: FIELD.height / 2 + 40,
      vx: 0,
      vy: 0,
      light: PLAYER.startLight,
      aim: -Math.PI / 2,
      beamOn: false,
      grace: 0, // seconds of touch immunity left
      focus: null, // the moth currently being burned, and for how long
      focusTime: 0,
    },
    motes: [],
    moths: [],
    particles: [],
    moteTimer: 0.4,
    mothTimer: 1.2,
    mothsSpawned: 0,
    events: [],
  };
  // A few motes are already drifting when the night begins.
  for (let i = 0; i < 4; i += 1) spawnMote(state, true);
  return state;
}

function spawnMote(state, anywhere = false) {
  const p = pointInField(state.rng, 46);
  state.motes.push({
    x: p.x,
    y: anywhere ? p.y : Math.min(p.y, FIELD.height - 60),
    vx: range(state.rng, -1, 1) * MOTE.drift,
    vy: range(state.rng, -1, 1) * MOTE.drift * 0.6,
    age: 0,
    phase: state.rng() * Math.PI * 2,
    active: true,
  });
}

function spawnMoth(state) {
  // Moths come from the dark beyond the edges, never from the middle of the garden.
  const side = Math.floor(state.rng() * 4);
  const pos = [
    { x: -24, y: range(state.rng, 30, FIELD.height - 30) },
    { x: FIELD.width + 24, y: range(state.rng, 30, FIELD.height - 30) },
    { x: range(state.rng, 30, FIELD.width - 30), y: -24 },
    { x: range(state.rng, 30, FIELD.width - 30), y: FIELD.height + 24 },
  ][side];
  const speed = MOTH.baseSpeed + (state.wave - 1) * MOTH.speedPerWave + range(state.rng, -6, 10);
  state.moths.push({
    x: pos.x,
    y: pos.y,
    speed,
    wobble: state.rng() * Math.PI * 2,
    burn: 0, // 0..1, how scorched this moth is
    active: true,
  });
  state.mothsSpawned += 1;
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const v = range(state.rng, speed * 0.3, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: range(state.rng, 0.35, 0.8),
      age: 0,
      color,
      size: range(state.rng, 1.5, 3.4),
    });
  }
}

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Is `moth` inside the lantern beam right now? */
export function mothInBeam(state, moth) {
  const p = state.player;
  if (!p.beamOn) return false;
  const dx = moth.x - p.x;
  const dy = moth.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > PLAYER.beamRange + MOTH.radius) return false;
  return Math.abs(angleDiff(Math.atan2(dy, dx), p.aim)) <= PLAYER.beamHalfAngle;
}

/**
 * Advance the world by one fixed step. `intent` is { moveX, moveY, aimX, aimY, beam }.
 * Events the step produced are collected in state.events for the caller (sound, flashes).
 */
export function stepWorld(state, intent, dt) {
  state.events.length = 0;
  if (state.over || state.dawn) {
    stepParticles(state, dt);
    return state;
  }
  const p = state.player;
  state.time += dt;
  if (state.ambient) {
    for (const mote of state.motes) {
      mote.age += dt * 0.2;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt + Math.sin(state.time * 1.7 + mote.phase) * 6 * dt;
      if (mote.x < 30 || mote.x > FIELD.width - 30) mote.vx *= -1;
      if (mote.y < 30 || mote.y > FIELD.height - 30) mote.vy *= -1;
    }
    stepParticles(state, dt);
    return state;
  }

  // --- the keeper moves (diagonals are normalised so they are not faster) ---
  const len = Math.hypot(intent.moveX, intent.moveY);
  p.vx = len > 0 ? (intent.moveX / len) * PLAYER.speed : 0;
  p.vy = len > 0 ? (intent.moveY / len) * PLAYER.speed : 0;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, p.x));
  p.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, p.y));
  p.aim = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);
  p.beamOn = Boolean(intent.beam);
  if (p.grace > 0) p.grace -= dt;

  // --- light always drains; the beam drinks faster ---
  p.light -= LIGHT.decayPerSecond * dt;
  if (p.beamOn) p.light -= PLAYER.beamDrain * dt;

  // --- waves and dawn ---
  state.waveTime += dt;
  if (state.waveTime >= WAVES.length) {
    state.waveTime = 0;
    if (state.wave >= WAVES.count) {
      state.dawn = true;
      state.score += LIGHT.dawnBonus;
      state.events.push(EVENT_DAWN);
    } else {
      state.wave += 1;
      state.mothsSpawned = 0;
      state.mothTimer = 0.8;
      state.score += LIGHT.waveBonus;
      state.events.push(EVENT_WAVE);
    }
  }

  // --- motes drift in, moths gather ---
  state.moteTimer -= dt;
  if (state.moteTimer <= 0 && state.motes.filter((m) => m.active).length < MOTE.maxAlive) {
    spawnMote(state);
    state.moteTimer = MOTE.spawnEvery;
  }
  if (state.mothsSpawned < WAVES.mothsInWave(state.wave)) {
    state.mothTimer -= dt;
    if (state.mothTimer <= 0) {
      spawnMoth(state);
      state.mothTimer = WAVES.spawnGap(state.wave);
    }
  }

  // --- motes: drift, fade, and feed the keeper who reaches them ---
  for (const mote of state.motes) {
    if (!mote.active) continue;
    mote.age += dt;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt + Math.sin(state.time * 1.7 + mote.phase) * 6 * dt;
    if (mote.age > MOTE.lifeTime) mote.active = false;
    if (Math.hypot(mote.x - p.x, mote.y - p.y) < PLAYER.radius + MOTE.radius + 4) {
      mote.active = false;
      p.light = Math.min(PLAYER.maxLight, p.light + LIGHT.moteRestore);
      state.score += LIGHT.moteScore;
      burst(state, mote.x, mote.y, '#ffe89a', 10, 90);
      state.events.push(EVENT_PICKUP);
    }
  }

  // --- moths: home in, burn under the beam, drink on touch ---
  let focused = null;
  for (const moth of state.moths) {
    if (!moth.active) continue;
    // Steer at the keeper's led position: a moth that only chases his tail never lands.
    const rawDist = Math.hypot(p.x - moth.x, p.y - moth.y);
    const lead = Math.min(0.9, (rawDist / Math.max(1, moth.speed)) * MOTH.leadFactor);
    const dx = p.x + p.vx * lead - moth.x;
    const dy = p.y + p.vy * lead - moth.y;
    const dist = Math.hypot(dx, dy) || 1;
    moth.wobble += dt * 3;
    // Home straight at the keeper, with a flutter sideways so the flight looks alive.
    const flutter = Math.sin(moth.wobble) * 22;
    moth.x += ((dx / dist) * moth.speed + (-dy / dist) * flutter) * dt;
    moth.y += ((dy / dist) * moth.speed + (dx / dist) * flutter) * dt;

    if (mothInBeam(state, moth) && (focused === null || dist < focused.dist)) {
      focused = { moth, dist };
    }
    if (rawDist < MOTH.touchRange && p.grace <= 0) {
      moth.active = false;
      p.light -= PLAYER.touchDamage;
      p.grace = PLAYER.touchCooldown;
      burst(state, moth.x, moth.y, '#9a7bff', 16, 130);
      state.events.push(EVENT_HURT);
    }
  }
  // The beam burns the nearest moth it covers; hold it there to banish.
  if (focused) {
    if (p.focus === focused.moth) p.focusTime += dt;
    else {
      p.focus = focused.moth;
      p.focusTime = 0;
    }
    focused.moth.burn = Math.min(1, p.focusTime / PLAYER.beamFocusTime);
    if (p.focusTime >= PLAYER.beamFocusTime) {
      focused.moth.active = false;
      state.score += LIGHT.banishScore;
      burst(state, focused.moth.x, focused.moth.y, '#ffb35c', 22, 170);
      state.events.push(EVENT_BANISH);
      p.focus = null;
      p.focusTime = 0;
    }
  } else {
    p.focus = null;
    p.focusTime = 0;
    for (const moth of state.moths) moth.burn = Math.max(0, moth.burn - dt * 2);
  }

  state.motes = state.motes.filter((m) => m.active);
  state.moths = state.moths.filter((m) => m.active);
  stepParticles(state, dt);

  // --- the night wins ---
  if (p.light <= 0) {
    p.light = 0;
    state.over = true;
    burst(state, p.x, p.y, '#ffd76a', 30, 200);
    state.events.push(EVENT_OVER);
  }
  return state;
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.age += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
  }
  state.particles = state.particles.filter((pt) => pt.age < pt.life);
}
