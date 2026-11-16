// Lumen Drift — boot and the live loop. Owns the screens (title, play, pause, over), feeds
// real input to the world at a fixed step, plays the sounds the world asks for, and renders.
// With ?shot=start|play|end&seed=N it instead builds that deterministic scene and holds it
// still — that is how the screenshots in screenshots/ were taken.

import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { STEP } from './config.js';
import { drawScene, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { buildShotScene } from './shots.js';
import {
  createWorld,
  EVENT_BANISH,
  EVENT_DAWN,
  EVENT_HURT,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_WAVE,
  stepWorld,
} from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const BEST_KEY = 'lumen-drift-best';

const ui = {
  best: Number(localStorage.getItem(BEST_KEY) ?? 0) || 0,
  muted: false,
};

function saveBest(score) {
  if (score > ui.best) {
    ui.best = score;
    localStorage.setItem(BEST_KEY, String(score));
  }
}

// --- screenshot mode: build one scene, draw it, and keep redrawing the identical frame ---
if (params.has('shot')) {
  const seed = Number(params.get('seed') ?? 1) || 1;
  const { state, screen } = buildShotScene(params.get('shot'), seed);
  const draw = () => drawScene(ctx, state, screen, ui);
  draw();
  // Repaint a few times so fonts and gradients settle before a capture tool reads the page.
  let n = 0;
  const timer = setInterval(() => {
    draw();
    n += 1;
    if (n > 8) clearInterval(timer);
  }, 90);
} else {
  playLive();
}

function playLive() {
  const audio = createAudio();
  const input = createInput(canvas);
  input.attach();

  let screen = SCREEN_TITLE;
  let state = createWorld(Date.now() % 100000, true);
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    state = createWorld((Date.now() % 100000) + 7);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
  }

  function handleEvents() {
    for (const event of state.events) {
      if (event === EVENT_PICKUP) audio.pickup();
      else if (event === EVENT_BANISH) audio.banish();
      else if (event === EVENT_HURT) audio.hurt();
      else if (event === EVENT_WAVE) audio.wave();
      else if (event === EVENT_DAWN) {
        audio.dawn();
        saveBest(state.score);
        screen = SCREEN_OVER;
        frame.releasedOnce = false;
      } else if (event === EVENT_OVER) {
        audio.over();
        saveBest(state.score);
        screen = SCREEN_OVER;
        frame.releasedOnce = false; // the click that ends the game must not also restart it
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25; // a stalled tab must not fast-forward the night

    // One-shot keys first: start, restart, pause, mute.
    for (const key of input.pressed) {
      if (key === 'm') ui.muted = audio.toggleMute();
      if (screen === SCREEN_TITLE && (key === 'enter' || key === ' ')) startGame();
      else if (screen === SCREEN_OVER && (key === 'r' || key === 'enter')) startGame();
      else if (screen === SCREEN_PLAY && (key === 'p' || key === 'escape')) screen = SCREEN_PAUSE;
      else if (screen === SCREEN_PAUSE && (key === 'p' || key === 'escape')) screen = SCREEN_PLAY;
    }
    input.pressed.clear();
    if (canvas.matches(':active') || input.beam) audio.unlock();
    if (screen === SCREEN_TITLE && input.beam) startGame();
    // A click restarts from the end screen, but not the click that ended the game: the
    // button must have been released once since the end screen appeared.
    if (screen === SCREEN_OVER && input.beam && frame.releasedOnce) startGame();
    if (!input.beam) frame.releasedOnce = true;

    if (screen === SCREEN_PAUSE) {
      drawScene(ctx, state, SCREEN_PAUSE, ui);
      return;
    }
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === SCREEN_TITLE) {
        stepWorld(state, { moveX: 0, moveY: 0, aimX: 480, aimY: 160, beam: false }, STEP);
      } else if (screen === SCREEN_PLAY) {
        stepWorld(
          state,
          { moveX: input.moveX, moveY: input.moveY, aimX: input.aimX, aimY: input.aimY, beam: input.beam },
          STEP,
        );
        handleEvents();
        if (state.over || state.dawn) break;
      } else if (screen === SCREEN_OVER) {
        stepWorld(state, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 1, beam: false }, STEP);
      }
    }
    drawScene(ctx, state, screen, ui);
  }
  requestAnimationFrame(frame);
}
