/**
 * Environment palettes — the world that changes around the tower.
 *
 * Every value a scene needs to describe "where we are" lives in one
 * object, so an act transition is a lerp between two of these and
 * nothing else. No geometry is swapped, mounted or unmounted at a
 * boundary: the same room shell is reshaped and recoloured. That is
 * what lets the environment change completely while the tower stays
 * visually continuous through it — the brief's one non-negotiable rule.
 *
 * Everything here is deliberately low-contrast and desaturated. The
 * background must never compete with the tower, so the whole set lives
 * in a narrow value range and the only real brightness in any scene is
 * the window.
 */

export interface EnvironmentPalette {
  name: string;

  /** Scroll position this environment is fully resolved at. */
  at: number;

  /* ---- Sky shell, sampled by world-space height ---- */
  top: string;
  horizon: string;
  bottom: string;

  /* ---- Ground ---- */
  ground: string;

  /* ---- Soft bloom on the backdrop: a window, or glazing ---- */
  glow: string;
  glowDirection: [number, number, number];

  /* ---- Room shell ----
     `presence` fades the entire built environment out. At 0 the tower
     floats in a graded void, which is how the cutaway act reads as an
     engineering drawing rather than a room with a ghost in it. */
  presence: number;
  wallColor: string;
  /** Distance of the back wall from the tower, in metres. */
  wallDistance: number;

  /* ---- The window. The only genuinely bright thing in any scene. ---- */
  windowColor: string;
  /** Centre of the window on the back wall: [x, y]. */
  windowPosition: [number, number];
  /** Width and height in metres. */
  windowSize: [number, number];

  /* ---- Three massing blocks standing in for furniture or structure.
     Same three objects in every environment, reshaped — never swapped. */
  massColor: string;
  /** Per mass: [x, y, z, width, height, depth]. */
  masses: [number, number, number, number, number, number][];

  /* ---- Atmospheric perspective ---- */
  fogColor: string;
  fogDensity: number;

  /* ---- Lighting ---- */
  keyColor: string;
  keyIntensity: number;
  /** Key light position. Moves with the window it is meant to come from. */
  keyPosition: [number, number, number];
  fillColor: string;
  fillIntensity: number;
}

/**
 * Acts 01–02 — a domestic interior. Cool daylight from one tall window,
 * a low mass reading as seating, a tall thin one as a floor lamp.
 */
export const ENV_INTERIOR: EnvironmentPalette = {
  name: "Interior",
  at: 0.0,
  top: "#eceeea",
  horizon: "#e4e8e3",
  bottom: "#cdd4ce",
  ground: "#dfe3dd",
  glow: "#fffdf6",
  glowDirection: [-0.75, 0.28, -0.6],
  presence: 1,
  wallColor: "#e8ebe6",
  wallDistance: 6.2,
  windowColor: "#fffef8",
  windowPosition: [-2.35, 1.5],
  windowSize: [1.5, 2.4],
  massColor: "#d8ddd7",
  masses: [
    [-1.95, 0.28, -2.3, 1.9, 0.56, 0.85],
    [1.85, 0.62, -3.1, 0.12, 1.25, 0.12],
    [0.9, 0.42, -4.6, 2.4, 0.84, 0.35],
  ],
  fogColor: "#e6eae5",
  fogDensity: 0.024,
  keyColor: "#fff6e6",
  keyIntensity: 2.6,
  keyPosition: [-3.2, 4.2, 2.6],
  fillColor: "#dce6e2",
  fillIntensity: 0.85,
};

/**
 * Act 03 — the cutaway. No room at all: `presence` drops to zero and
 * the tower stands in a graded studio void. The absence is the point.
 */
export const ENV_STUDIO: EnvironmentPalette = {
  name: "Studio",
  at: 0.245,
  top: "#eef0ed",
  horizon: "#e7eae6",
  bottom: "#d5dbd6",
  ground: "#e2e6e1",
  glow: "#ffffff",
  glowDirection: [-0.4, 0.5, -0.75],
  presence: 0,
  wallColor: "#e9ece8",
  wallDistance: 9,
  windowColor: "#ffffff",
  windowPosition: [0, 2.1],
  windowSize: [3.2, 2.6],
  massColor: "#dfe3de",
  masses: [
    [-2.4, 0.2, -3.2, 1.2, 0.4, 0.6],
    [2.4, 0.5, -3.4, 0.1, 1.0, 0.1],
    [0, 0.3, -5.2, 2.0, 0.6, 0.3],
  ],
  fogColor: "#eaede9",
  fogDensity: 0.01,
  keyColor: "#fbfdf9",
  keyIntensity: 2.9,
  keyPosition: [-2.6, 3.8, 3.4],
  fillColor: "#e2e8e4",
  fillIntensity: 1.05,
};

/**
 * Acts 04–05 — where people gather. Warmer, lower light, a long counter
 * mass and a bank of seating. The room the tower has to look good in.
 */
export const ENV_SOCIAL: EnvironmentPalette = {
  name: "Social",
  at: 0.44,
  top: "#efece6",
  horizon: "#e9e4db",
  bottom: "#d3cdc2",
  ground: "#ddd8ce",
  glow: "#fff4e0",
  glowDirection: [0.6, 0.22, -0.72],
  presence: 1,
  wallColor: "#e6e0d5",
  wallDistance: 5.4,
  windowColor: "#fff8ea",
  windowPosition: [2.5, 1.35],
  windowSize: [2.2, 2.0],
  massColor: "#d2cbbf",
  masses: [
    [-2.25, 0.46, -2.0, 3.0, 0.92, 0.7],
    [1.7, 0.36, -2.4, 0.7, 0.72, 0.7],
    [-0.4, 0.9, -4.9, 4.2, 1.8, 0.25],
  ],
  fogColor: "#e7e1d7",
  fogDensity: 0.03,
  keyColor: "#ffeccf",
  keyIntensity: 2.35,
  keyPosition: [3.0, 3.4, 2.2],
  fillColor: "#e0dace",
  fillIntensity: 0.8,
};

/**
 * Acts 06–07 — controlled-environment glasshouse. The wall retreats,
 * the window becomes full-height glazing, and the massing flattens into
 * long low channel runs. Highest ambient, lowest contrast of the set.
 */
export const ENV_GLASSHOUSE: EnvironmentPalette = {
  name: "Glasshouse",
  at: 0.7,
  top: "#e7eeea",
  horizon: "#dde8e0",
  bottom: "#c2d2c7",
  ground: "#cfdad1",
  glow: "#f4fbf2",
  glowDirection: [0.35, 0.62, -0.7],
  presence: 1,
  wallColor: "#dfe9e1",
  wallDistance: 11.5,
  windowColor: "#fbfffa",
  windowPosition: [0, 2.6],
  windowSize: [9.5, 4.6],
  massColor: "#ccd8ce",
  masses: [
    [-3.4, 0.22, -4.2, 2.4, 0.44, 7.5],
    [3.4, 0.22, -4.2, 2.4, 0.44, 7.5],
    [0, 0.2, -8.4, 11.0, 0.4, 1.6],
  ],
  fogColor: "#dde7e0",
  fogDensity: 0.042,
  keyColor: "#f2f8ef",
  keyIntensity: 3.1,
  keyPosition: [1.6, 5.8, 2.0],
  fillColor: "#d6e4da",
  fillIntensity: 1.15,
};

/**
 * Acts 08–09 — the same glasshouse at golden hour. Warmest frame on the
 * page, deliberately resolving the cool interior it opened on.
 */
export const ENV_GOLDEN: EnvironmentPalette = {
  name: "Golden hour",
  at: 0.95,
  top: "#e8e6dd",
  horizon: "#eee2cd",
  bottom: "#c9c3b2",
  ground: "#d6cfbe",
  glow: "#ffdfa8",
  glowDirection: [0.72, 0.14, -0.68],
  presence: 1,
  wallColor: "#e4dccb",
  wallDistance: 13,
  windowColor: "#ffe9bd",
  windowPosition: [2.2, 1.9],
  windowSize: [10.5, 4.2],
  massColor: "#cfc6b3",
  masses: [
    [-3.4, 0.22, -4.2, 2.4, 0.44, 7.5],
    [3.4, 0.22, -4.2, 2.4, 0.44, 7.5],
    [0, 0.2, -9.0, 12.0, 0.4, 1.6],
  ],
  fogColor: "#e6dcc8",
  fogDensity: 0.05,
  keyColor: "#ffd79a",
  keyIntensity: 3.4,
  keyPosition: [5.4, 2.2, 1.4],
  fillColor: "#ded4c2",
  fillIntensity: 0.95,
};

/** Ordered by scroll position. The scene samples neighbours and blends. */
export const ENVIRONMENTS: EnvironmentPalette[] = [
  ENV_INTERIOR,
  ENV_STUDIO,
  ENV_SOCIAL,
  ENV_GLASSHOUSE,
  ENV_GOLDEN,
];

/**
 * Which two environments to blend at a given scroll position, and how
 * far between them.
 *
 * Blending is smoothstepped rather than linear so an environment holds
 * near its own keyframe and moves fastest in the middle — otherwise the
 * world is perpetually in transition and never feels like anywhere.
 */
export function sampleEnvironment(progress: number): {
  from: EnvironmentPalette;
  to: EnvironmentPalette;
  mix: number;
} {
  let upper = 1;
  while (upper < ENVIRONMENTS.length - 1 && ENVIRONMENTS[upper].at < progress) upper++;

  const from = ENVIRONMENTS[upper - 1];
  const to = ENVIRONMENTS[upper];
  const span = to.at - from.at;
  const raw = span > 0 ? (progress - from.at) / span : 0;
  const t = Math.min(1, Math.max(0, raw));

  return { from, to, mix: t * t * (3 - 2 * t) };
}
