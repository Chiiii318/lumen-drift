// Lumen Drift — tuning constants. Everything the world and renderer share lives here so the
// shot scenes, the autopilot and the live game all play by exactly the same rules.

export const FIELD = { width: 960, height: 540 };

/** Fixed simulation step (seconds). The world never steps by a frame's real duration. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 245, // px per second
  startLight: 78,
  maxLight: 100,
  beamRange: 265, // px the lantern beam reaches
  beamHalfAngle: 0.42, // radians either side of the aim direction
  beamDrain: 5.2, // light per second while the beam is lit
  beamFocusTime: 0.55, // seconds of beam on one moth to banish it
  touchDamage: 13, // light lost when a moth reaches the keeper
  touchCooldown: 0.9, // seconds of grace after a touch
};

export const LIGHT = {
  decayPerSecond: 0.85, // the night always drinks a little light
  moteRestore: 5.5,
  moteScore: 10,
  banishScore: 25,
  waveBonus: 50,
  dawnBonus: 300,
};

export const MOTE = {
  radius: 6,
  spawnEvery: 1.15, // seconds between mote spawns
  maxAlive: 9,
  drift: 14, // px per second of gentle drift
  lifeTime: 16, // seconds before a mote fades away
};

export const MOTH = {
  radius: 12,
  baseSpeed: 64,
  speedPerWave: 9,
  leadFactor: 0.55, // moths steer at where the keeper is heading, not where he is
  touchRange: 24, // centre distance that counts as reaching the keeper
};

export const WAVES = {
  length: 25, // seconds per wave; dawn breaks when the last wave ends
  count: 5, // survive all five and dawn breaks (a win)
  mothsInWave: (wave) => 4 + wave * 2, // wave is 1-based
  spawnGap: (wave) => Math.max(0.7, 2.2 - wave * 0.25),
};

export const COLORS = {
  nightTop: '#0b1026',
  nightBottom: '#1b1440',
  hillFar: '#241a4d',
  hillNear: '#170f33',
  ground: '#120b28',
  gold: '#ffd76a',
  goldSoft: '#ffedb0',
  ember: '#ff9d4d',
  mote: '#ffe89a',
  mothBody: '#4a3a75',
  mothWing: '#6b58a6',
  violet: '#9a7bff',
  text: '#f5efdc',
  textDim: '#b9b3d9',
  danger: '#ff6a7a',
};
