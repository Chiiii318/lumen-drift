// Lumen Drift — all drawing. Canvas 2D only: layered night sky, a glowing keeper, drifting
// motes, fluttering shadow moths and a soft lantern beam. The renderer reads world state and
// never changes it, so the same state always draws the same frame (the shot scenes rely on it).

import { COLORS, FIELD, MOTH, PLAYER, WAVES } from './config.js';
import { makeRng } from './random.js';
import { mothInBeam } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

// Stars and fireflies of the backdrop are fixed once, from their own seed: the night sky is
// the same in every frame and every screenshot.
const backdropRng = makeRng(20261116);
const STARS = Array.from({ length: 130 }, () => ({
  x: backdropRng() * FIELD.width,
  y: backdropRng() * FIELD.height * 0.62,
  r: 0.6 + backdropRng() * 1.5,
  tw: backdropRng() * Math.PI * 2,
}));
const GRASS = Array.from({ length: 90 }, () => ({
  x: backdropRng() * FIELD.width,
  h: 10 + backdropRng() * 22,
  lean: (backdropRng() - 0.5) * 8,
}));

function drawBackdrop(ctx, state) {
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sky.addColorStop(0, COLORS.nightTop);
  sky.addColorStop(0.65, COLORS.nightBottom);
  sky.addColorStop(1, COLORS.ground);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Stars, gently twinkling.
  for (const s of STARS) {
    ctx.globalAlpha = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(state.time * 0.9 + s.tw));
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The moon and its halo.
  const moonX = FIELD.width - 150;
  const moonY = 84;
  const halo = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 92);
  halo.addColorStop(0, 'rgba(255, 240, 200, 0.5)');
  halo.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(moonX - 92, moonY - 92, 184, 184);
  ctx.fillStyle = '#fdf3d0';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(214, 196, 150, 0.5)';
  ctx.beginPath();
  ctx.arc(moonX - 10, moonY - 6, 6, 0, Math.PI * 2);
  ctx.arc(moonX + 9, moonY + 11, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Dawn creeps in on the last wave: the horizon warms as the win approaches.
  const dawnGlow = state.wave >= WAVES.count ? 0.35 : state.wave >= WAVES.count - 1 ? 0.15 : 0;
  if (dawnGlow > 0 || state.dawn) {
    const g = ctx.createLinearGradient(0, FIELD.height * 0.55, 0, FIELD.height);
    g.addColorStop(0, 'rgba(255, 157, 77, 0)');
    g.addColorStop(1, `rgba(255, 157, 77, ${state.dawn ? 0.55 : dawnGlow})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, FIELD.height * 0.55, FIELD.width, FIELD.height * 0.45);
  }

  // Hills and ground.
  ctx.fillStyle = COLORS.hillFar;
  ctx.beginPath();
  ctx.moveTo(0, 452);
  for (let x = 0; x <= FIELD.width; x += 60) ctx.lineTo(x, 452 - Math.sin(x * 0.011 + 2) * 22 - 12);
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.fill();
  ctx.fillStyle = COLORS.hillNear;
  ctx.beginPath();
  ctx.moveTo(0, 492);
  for (let x = 0; x <= FIELD.width; x += 60) ctx.lineTo(x, 492 - Math.sin(x * 0.017) * 12 - 4);
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.fill();

  // Grass silhouettes along the bottom.
  ctx.strokeStyle = 'rgba(10, 6, 24, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const g of GRASS) {
    ctx.moveTo(g.x, FIELD.height);
    ctx.quadraticCurveTo(g.x + g.lean * 0.4, FIELD.height - g.h * 0.6, g.x + g.lean, FIELD.height - g.h);
  }
  ctx.stroke();
}

function drawMote(ctx, state, mote) {
  const pulse = 0.75 + 0.25 * Math.sin(state.time * 3 + mote.phase);
  const fade = mote.age > 13 ? Math.max(0, 1 - (mote.age - 13) / 3) : 1;
  const r = 15 * pulse;
  const g = ctx.createRadialGradient(mote.x, mote.y, 1, mote.x, mote.y, r);
  g.addColorStop(0, `rgba(255, 232, 154, ${0.85 * fade})`);
  g.addColorStop(1, 'rgba(255, 232, 154, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(mote.x - r, mote.y - r, r * 2, r * 2);
  ctx.fillStyle = `rgba(255, 244, 196, ${fade})`;
  ctx.beginPath();
  ctx.arc(mote.x, mote.y, 3.4 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoth(ctx, state, moth) {
  const flap = Math.sin(state.time * 14 + moth.wobble * 2) * 0.55;
  const angle = Math.atan2(state.player.y - moth.y, state.player.x - moth.x);
  ctx.save();
  ctx.translate(moth.x, moth.y);
  ctx.rotate(angle + Math.PI / 2);
  // Wings, darker as the moth scorches under the beam.
  const wing = moth.burn > 0 ? '#8a5a3c' : COLORS.mothWing;
  ctx.fillStyle = wing;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.7 + flap * 0.5));
    ctx.beginPath();
    ctx.ellipse(side * 10, -2, 11, 6, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = moth.burn > 0 ? '#5c4030' : COLORS.mothBody;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes — two small violet points that make the moth read as a creature, not a blob.
  ctx.fillStyle = '#c9b8ff';
  ctx.beginPath();
  ctx.arc(-2.6, -6, 1.5, 0, Math.PI * 2);
  ctx.arc(2.6, -6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (moth.burn > 0.05) {
    ctx.strokeStyle = `rgba(255, 179, 92, ${0.35 + moth.burn * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(moth.x, moth.y, MOTH.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * moth.burn);
    ctx.stroke();
  }
}

function drawKeeper(ctx, state) {
  const p = state.player;
  const lightFrac = p.light / PLAYER.maxLight;

  // The beam: a soft cone from the keeper toward the aim, lit only while held.
  if (p.beamOn && !state.over) {
    const flicker = 0.92 + 0.08 * Math.sin(state.time * 31);
    const a0 = p.aim - PLAYER.beamHalfAngle;
    const a1 = p.aim + PLAYER.beamHalfAngle;
    const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, PLAYER.beamRange);
    grad.addColorStop(0, `rgba(255, 214, 106, ${0.34 * flicker})`);
    grad.addColorStop(1, 'rgba(255, 214, 106, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, PLAYER.beamRange, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  // The keeper's glow grows and shrinks with its light — your health is readable at a glance.
  const glowR = 30 + lightFrac * 55 + Math.sin(state.time * 2.2) * 3;
  const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, glowR);
  glow.addColorStop(0, `rgba(255, 215, 106, ${0.5 + lightFrac * 0.3})`);
  glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);

  // Body: a warm orb with a brighter heart; it flashes while untouchable after a hit.
  const flash = p.grace > 0 && Math.floor(state.time * 12) % 2 === 0;
  ctx.fillStyle = flash ? '#fff6d8' : COLORS.gold;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y - 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // The lantern it carries, swung toward the aim.
  const lx = p.x + Math.cos(p.aim) * 17;
  const ly = p.y + Math.sin(p.aim) * 17;
  ctx.strokeStyle = '#caa14f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.fillStyle = p.beamOn ? '#ffe89a' : '#e8b84b';
  ctx.beginPath();
  ctx.arc(lx, ly, 4.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const a = 1 - pt.age / pt.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * a + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function drawHud(ctx, state) {
  const p = state.player;
  // Light bar, top left, with a flame tick at the keeper's starting light.
  ctx.fillStyle = 'rgba(8, 5, 20, 0.55)';
  ctx.beginPath();
  ctx.roundRect(18, 16, 252, 34, 9);
  ctx.fill();
  const frac = Math.max(0, p.light / PLAYER.maxLight);
  const bar = ctx.createLinearGradient(38, 0, 258, 0);
  bar.addColorStop(0, COLORS.ember);
  bar.addColorStop(1, COLORS.gold);
  ctx.fillStyle = frac < 0.25 ? COLORS.danger : bar;
  if (frac > 0) {
    ctx.beginPath();
    ctx.roundRect(42, 27, 192 * frac, 12, 6);
    ctx.fill();
  }
  text(ctx, '✦', 30, 34, 15, COLORS.gold, 'center');
  text(ctx, `${Math.ceil(p.light)}`, 262, 34, 13, COLORS.text, 'right');

  // Score and wave, top right.
  text(ctx, `${state.score}`, FIELD.width - 20, 26, 24, COLORS.text, 'right', 700);
  text(ctx, `WAVE ${state.wave} / ${WAVES.count}`, FIELD.width - 20, 50, 12, COLORS.textDim, 'right');
  // Night progress: a thin line that fills toward dawn.
  const nightFrac = ((state.wave - 1) + state.waveTime / WAVES.length) / WAVES.count;
  ctx.fillStyle = 'rgba(245, 239, 220, 0.16)';
  ctx.fillRect(FIELD.width - 170, 60, 150, 3);
  ctx.fillStyle = COLORS.goldSoft;
  ctx.fillRect(FIELD.width - 170, 60, 150 * Math.min(1, nightFrac), 3);
}

function panel(ctx, w, h) {
  ctx.fillStyle = 'rgba(10, 6, 26, 0.62)';
  ctx.beginPath();
  ctx.roundRect(FIELD.width / 2 - w / 2, FIELD.height / 2 - h / 2, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 215, 106, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTitle(ctx, state, ui) {
  drawWorld(ctx, state);
  panel(ctx, 560, 330);
  text(ctx, 'LUMEN DRIFT', FIELD.width / 2, 168, 52, COLORS.goldSoft, 'center', 800);
  text(ctx, '萤 火 守 夜 人', FIELD.width / 2, 208, 17, COLORS.text, 'center');
  text(ctx, 'The night drinks light. Gather the drifting motes to feed yours,', FIELD.width / 2, 252, 15, COLORS.textDim, 'center', 400);
  text(ctx, 'burn the shadow moths from the dark — and last until dawn.', FIELD.width / 2, 274, 15, COLORS.textDim, 'center', 400);
  text(ctx, 'WASD / Arrows — drift      Mouse — aim lantern      Hold click — beam', FIELD.width / 2, 312, 14, COLORS.text, 'center');
  text(ctx, 'Touch: drag to drift, a second finger holds the beam', FIELD.width / 2, 334, 13, COLORS.text, 'center', 400);
  text(ctx, 'Survive 5 waves to see the dawn.  P — pause    M — sound', FIELD.width / 2, 356, 13, COLORS.textDim, 'center', 400);
  const pulse = 0.75 + 0.25 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, '—  CLICK OR PRESS ENTER TO BEGIN  —', FIELD.width / 2, 388, 16, COLORS.gold, 'center', 700);
  ctx.globalAlpha = 1;
  if (ui.best > 0) text(ctx, `Best score  ${ui.best}`, FIELD.width / 2, 420, 13, COLORS.textDim, 'center', 400);
}

function drawOver(ctx, state, ui) {
  drawWorld(ctx, state);
  panel(ctx, 520, 300);
  if (state.dawn) {
    text(ctx, 'DAWN BREAKS', FIELD.width / 2, 190, 44, COLORS.goldSoft, 'center', 800);
    text(ctx, '天 亮 了 — 你 守 住 了 这 座 花 园', FIELD.width / 2, 228, 15, COLORS.text, 'center');
  } else {
    text(ctx, 'THE LIGHT GOES OUT', FIELD.width / 2, 190, 38, COLORS.text, 'center', 800);
    text(ctx, '灯 灭 了 — 夜 色 带 走 了 花 园', FIELD.width / 2, 228, 15, COLORS.textDim, 'center');
  }
  text(ctx, `Score  ${state.score}`, FIELD.width / 2, 276, 26, COLORS.gold, 'center', 700);
  text(ctx, `Reached wave ${state.wave} of ${WAVES.count}`, FIELD.width / 2, 308, 14, COLORS.textDim, 'center', 400);
  if (ui.best > 0) text(ctx, `Best  ${ui.best}`, FIELD.width / 2, 332, 13, COLORS.textDim, 'center', 400);
  const pulse = 0.75 + 0.25 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = pulse;
  text(ctx, '—  CLICK OR PRESS R TO PLAY AGAIN  —', FIELD.width / 2, 372, 15, COLORS.gold, 'center', 700);
  ctx.globalAlpha = 1;
}

function drawPause(ctx, state) {
  drawWorld(ctx, state);
  ctx.fillStyle = 'rgba(6, 4, 16, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'PAUSED', FIELD.width / 2, FIELD.height / 2 - 14, 34, COLORS.text, 'center', 800);
  text(ctx, 'Press P to return to the night', FIELD.width / 2, FIELD.height / 2 + 26, 14, COLORS.textDim, 'center', 400);
}

function drawWorld(ctx, state) {
  drawBackdrop(ctx, state);
  for (const mote of state.motes) drawMote(ctx, state, mote);
  for (const moth of state.moths) drawMoth(ctx, state, moth);
  drawKeeper(ctx, state);
  drawParticles(ctx, state);
  // A soft vignette keeps the eye in the garden.
  const v = ctx.createRadialGradient(480, 270, 240, 480, 270, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(2,1,8,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** Draw one frame. `screen` is one of the SCREEN_* constants; `ui` carries { best, muted }. */
export function drawScene(ctx, state, screen, ui) {
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, state, ui);
    return;
  }
  if (screen === SCREEN_OVER) {
    drawOver(ctx, state, ui);
    return;
  }
  drawWorld(ctx, state);
  drawHud(ctx, state);
  if (screen === SCREEN_PAUSE) drawPause(ctx, state);
  if (ui.muted) text(ctx, 'MUTED (M)', FIELD.width - 20, FIELD.height - 18, 11, COLORS.textDim, 'right', 400);
}
