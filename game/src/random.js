// A tiny seeded RNG (mulberry32). The world draws every random number from one of these, so a
// seed fully determines a run — that is what makes the screenshot scenes reproducible.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random point inside the field, kept `margin` px from every edge. */
export function pointInField(rng, margin) {
  return {
    x: range(rng, margin, 960 - margin),
    y: range(rng, margin, 540 - margin),
  };
}
