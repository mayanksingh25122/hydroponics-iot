/**
 * Nine environments — one per act — and the prop system that morphs
 * between them.
 *
 * Every environment is the SAME set of objects at different
 * proportions: one instanced prop field, a wall, a ceiling, a window,
 * a floor and a sky. Nothing is ever mounted or unmounted at an act
 * boundary, so a living room can become a glasshouse while the tower
 * stays visually continuous through it — the brief's one
 * non-negotiable rule.
 *
 * The whole built world is therefore ONE draw call for props plus four
 * for the shell, at any point in the story.
 *
 * Everything is deliberately low-contrast and desaturated. A room the
 * eye wants to read is a room competing with the tower, so the props
 * carry silhouette and depth but almost no detail contrast — they are
 * furniture seen from across a bright room, not a product shot.
 */

/** A single piece of furniture or structure. Unit cube, scaled. */
export interface Prop {
  /** Centre position in metres. */
  p: [number, number, number];
  /** Width, height, depth in metres. Zero on any axis hides it. */
  s: [number, number, number];
  /** Yaw in radians. */
  r?: number;
  /** 0 = the environment's dark tone, 1 = its light tone. */
  t?: number;
}

/**
 * Every environment is padded to this length so prop N in one room
 * always morphs into prop N in the next. Raising it costs one instance
 * in a single InstancedMesh, not a draw call.
 */
export const MAX_PROPS = 30;

/** Hidden slot: below the floor at zero size, so padding never shows. */
const EMPTY: Prop = { p: [0, -2, 0], s: [0, 0, 0] };

/** Repeats a prop along an axis — desk rows, channel runs, pendants. */
function row(
  count: number,
  start: [number, number, number],
  step: [number, number, number],
  size: [number, number, number],
  tone = 0.5,
  rot = 0
): Prop[] {
  return Array.from({ length: count }, (_, i) => ({
    p: [start[0] + step[0] * i, start[1] + step[1] * i, start[2] + step[2] * i] as [
      number,
      number,
      number,
    ],
    s: size,
    r: rot,
    t: tone,
  }));
}

/** Pads to MAX_PROPS so every environment has the same slot count. */
function pad(props: Prop[]): Prop[] {
  if (props.length > MAX_PROPS) {
    throw new Error(`Environment has ${props.length} props, max is ${MAX_PROPS}`);
  }
  return [...props, ...Array<Prop>(MAX_PROPS - props.length).fill(EMPTY)];
}

export interface EnvironmentPalette {
  name: string;
  /** Scroll position this environment is fully resolved at. */
  at: number;

  /* ---- Sky shell, sampled by world-space height ---- */
  top: string;
  horizon: string;
  bottom: string;

  ground: string;

  /* ---- Soft daylight bloom on the backdrop ---- */
  glow: string;
  glowDirection: [number, number, number];

  /**
   * Fades the entire built environment out. At 0 the tower floats in a
   * graded void, which is how the cutaway act reads as an engineering
   * drawing rather than a room with a ghost in it.
   */
  presence: number;

  wallColor: string;
  wallDistance: number;
  /** 0 hides the ceiling — used outdoors and in the void. */
  ceilingHeight: number;
  ceilingColor: string;

  windowColor: string;
  windowPosition: [number, number];
  windowSize: [number, number];

  /** Prop tones. Props interpolate between these two by their `t`. */
  propDark: string;
  propLight: string;
  props: Prop[];

  fogColor: string;
  fogDensity: number;

  keyColor: string;
  keyIntensity: number;
  keyPosition: [number, number, number];
  fillColor: string;
  fillIntensity: number;
}

/* ============================================================
   01 — LIVING ROOM. Act 01, Arrival.
   Pale oak, plaster, one tall window. Sofa, coffee table, floor
   lamp, low shelf, framed art. A room someone actually lives in.
   ============================================================ */
export const ENV_LIVING_ROOM: EnvironmentPalette = {
  name: "Living room",
  at: 0.0,
  top: "#eceeea",
  horizon: "#e4e8e3",
  bottom: "#d3d8d1",
  ground: "#ddd8cc",
  glow: "#fffdf6",
  glowDirection: [-0.75, 0.28, -0.6],
  presence: 1,
  wallColor: "#e9ebe6",
  wallDistance: 6.4,
  ceilingHeight: 2.85,
  ceilingColor: "#eef0ec",
  windowColor: "#fffef8",
  windowPosition: [-2.5, 1.45],
  windowSize: [1.6, 2.5],
  propDark: "#b9b3a6",
  propLight: "#e2ded4",
  props: pad([
    // Rug, sofa, cushions
    { p: [-0.2, 0.006, -1.6], s: [3.6, 0.012, 2.6], t: 0.75 },
    { p: [-2.1, 0.34, -2.2], s: [2.05, 0.68, 0.88], r: 0.06, t: 0.35 },
    { p: [-2.1, 0.72, -2.48], s: [1.95, 0.42, 0.22], r: 0.06, t: 0.42 },
    // Coffee table
    { p: [-1.5, 0.19, -1.0], s: [1.1, 0.05, 0.6], t: 0.9 },
    { p: [-1.95, 0.09, -1.0], s: [0.06, 0.19, 0.5], t: 0.2 },
    { p: [-1.05, 0.09, -1.0], s: [0.06, 0.19, 0.5], t: 0.2 },
    // Floor lamp
    { p: [1.95, 0.62, -2.9], s: [0.035, 1.25, 0.035], t: 0.15 },
    { p: [1.95, 1.32, -2.9], s: [0.34, 0.26, 0.34], t: 1 },
    // Low shelf unit against the back wall
    { p: [1.5, 0.31, -5.6], s: [2.6, 0.62, 0.38], t: 0.3 },
    ...row(3, [0.85, 0.78, -5.55], [0.62, 0, 0], [0.12, 0.24, 0.1], 0.55),
    // Framed art
    { p: [1.1, 1.75, -6.3], s: [0.62, 0.82, 0.03], t: 0.85 },
    { p: [1.95, 1.68, -6.3], s: [0.42, 0.56, 0.03], t: 0.7 },
    // Side table
    { p: [0.6, 0.26, -2.6], s: [0.44, 0.52, 0.44], t: 0.45 },
  ]),
  fogColor: "#e6eae5",
  fogDensity: 0.022,
  keyColor: "#fff6e6",
  keyIntensity: 2.6,
  keyPosition: [-3.4, 3.6, 2.4],
  fillColor: "#dce6e2",
  fillIntensity: 0.85,
};

/* ============================================================
   02 — THE SAME ROOM, LATE. Act 02, The Gap.
   Identical furniture, drained of light. The act is about systems
   failing while nobody is watching, so the room goes quiet rather
   than changing. Recognising it as the same room is the point.
   ============================================================ */
export const ENV_ROOM_DUSK: EnvironmentPalette = {
  ...ENV_LIVING_ROOM,
  name: "Living room, late",
  at: 0.14,
  top: "#d9dcda",
  horizon: "#d2d6d3",
  bottom: "#bcc2be",
  ground: "#c8c4ba",
  glow: "#e8e4d6",
  glowDirection: [-0.8, 0.16, -0.56],
  wallColor: "#d5d8d4",
  ceilingColor: "#d9dcd8",
  windowColor: "#e9e6da",
  propDark: "#9a958b",
  propLight: "#c5c2ba",
  fogColor: "#d2d6d2",
  fogDensity: 0.038,
  keyColor: "#e8e0cd",
  keyIntensity: 1.35,
  keyPosition: [-3.6, 2.8, 1.9],
  fillColor: "#c6cecb",
  fillIntensity: 0.6,
};

/* ============================================================
   03 — STUDIO VOID. Act 03, The Machine.
   No room at all. The absence is what makes the cutaway read as an
   engineering drawing instead of a ghost in a living room.
   ============================================================ */
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
  ceilingHeight: 0,
  ceilingColor: "#eef0ed",
  windowColor: "#ffffff",
  windowPosition: [0, 2.1],
  windowSize: [3.2, 2.6],
  propDark: "#d2d6d1",
  propLight: "#e8ebe7",
  props: pad([]),
  fogColor: "#eaede9",
  fogDensity: 0.008,
  keyColor: "#fbfdf9",
  keyIntensity: 2.9,
  keyPosition: [-2.6, 3.8, 3.4],
  fillColor: "#e2e8e4",
  fillIntensity: 1.05,
};

/* ============================================================
   04 — CAFÉ. Act 04, Anywhere.
   Counter, stool row, pendant lights, a bank of small tables.
   Warmest artificial light in the sequence.
   ============================================================ */
export const ENV_CAFE: EnvironmentPalette = {
  name: "Café",
  at: 0.375,
  top: "#efeae1",
  horizon: "#e9e2d6",
  bottom: "#cfc7b9",
  ground: "#cdbfab",
  glow: "#fff2da",
  glowDirection: [0.62, 0.2, -0.72],
  presence: 1,
  wallColor: "#ded5c6",
  wallDistance: 6.8,
  ceilingHeight: 3.05,
  ceilingColor: "#e2dacd",
  windowColor: "#fff8e8",
  windowPosition: [2.7, 1.5],
  windowSize: [2.6, 2.3],
  propDark: "#8f8579",
  propLight: "#ddd4c4",
  props: pad([
    // Serving counter with a raised bar top
    { p: [-2.5, 0.52, -2.6], s: [3.4, 1.04, 0.72], r: 0.1, t: 0.25 },
    { p: [-2.5, 1.07, -2.6], s: [3.6, 0.07, 0.86], r: 0.1, t: 0.85 },
    // Stools
    ...row(4, [-3.6, 0.33, -1.85], [0.72, 0, 0], [0.3, 0.07, 0.3], 0.9),
    ...row(4, [-3.6, 0.16, -1.85], [0.72, 0, 0], [0.05, 0.33, 0.05], 0.2),
    // Pendant lights over the counter
    ...row(3, [-3.1, 2.32, -2.6], [0.62, 0, 0], [0.013, 0.72, 0.013], 0.15),
    ...row(3, [-3.1, 1.9, -2.6], [0.62, 0, 0], [0.24, 0.16, 0.24], 1),
    // Two small tables
    { p: [1.85, 0.38, -1.5], s: [0.72, 0.05, 0.72], r: 0.2, t: 0.8 },
    { p: [1.85, 0.19, -1.5], s: [0.07, 0.38, 0.07], t: 0.2 },
    { p: [2.35, 0.38, -3.5], s: [0.72, 0.05, 0.72], r: -0.15, t: 0.8 },
    { p: [2.35, 0.19, -3.5], s: [0.07, 0.38, 0.07], t: 0.2 },
    // Back shelving
    { p: [-2.6, 1.62, -6.6], s: [3.2, 0.05, 0.28], t: 0.35 },
    { p: [-2.6, 2.02, -6.6], s: [3.2, 0.05, 0.28], t: 0.35 },
    ...row(5, [-3.8, 1.78, -6.58], [0.6, 0, 0], [0.1, 0.26, 0.1], 0.6),
  ]),
  fogColor: "#e2dacd",
  fogDensity: 0.032,
  keyColor: "#ffe9c6",
  keyIntensity: 2.3,
  keyPosition: [3.4, 3.2, 2.0],
  fillColor: "#ded5c6",
  fillIntensity: 0.78,
};

/* ============================================================
   05 — COMMERCIAL KITCHEN. Act 05, Two Products.
   Stainless, hard surfaces, even light. Deliberately unglamorous —
   the act where the page stops selling lifestyle.
   ============================================================ */
export const ENV_KITCHEN: EnvironmentPalette = {
  name: "Commercial kitchen",
  at: 0.49,
  top: "#eef0f1",
  horizon: "#e6e9ea",
  bottom: "#ccd2d3",
  ground: "#d5d9da",
  glow: "#f6fbfd",
  glowDirection: [-0.3, 0.55, -0.78],
  presence: 1,
  wallColor: "#e3e8e9",
  wallDistance: 7.2,
  ceilingHeight: 3.2,
  ceilingColor: "#e8ecec",
  windowColor: "#fbfeff",
  windowPosition: [-3.0, 2.0],
  windowSize: [1.5, 1.5],
  propDark: "#8e999c",
  propLight: "#dde3e4",
  props: pad([
    // Pass-through counter and island
    { p: [-2.9, 0.46, -2.4], s: [3.2, 0.92, 0.78], t: 0.85 },
    { p: [-2.9, 0.94, -2.4], s: [3.3, 0.05, 0.88], t: 1 },
    { p: [2.7, 0.46, -2.8], s: [2.4, 0.92, 0.9], t: 0.85 },
    { p: [2.7, 0.94, -2.8], s: [2.5, 0.05, 1.0], t: 1 },
    // Upper cabinets
    ...row(4, [-3.9, 1.98, -6.85], [0.84, 0, 0], [0.8, 0.66, 0.36], 0.75),
    // Extraction hood over the island
    { p: [2.7, 2.3, -2.8], s: [2.2, 0.5, 1.1], t: 0.5 },
    { p: [2.7, 2.72, -2.8], s: [0.5, 0.44, 0.5], t: 0.4 },
    // Prep benches along the back
    { p: [0.0, 0.44, -6.3], s: [3.0, 0.88, 0.6], t: 0.8 },
    ...row(4, [-1.2, 1.02, -6.3], [0.8, 0, 0], [0.28, 0.3, 0.28], 0.65),
    // Ceiling light strips
    ...row(3, [0, 3.12, -1.6], [0, 0, -1.9], [4.6, 0.07, 0.26], 1),
    // Trolley
    { p: [0.9, 0.4, -1.1], s: [0.86, 0.8, 0.56], t: 0.7 },
  ]),
  fogColor: "#e3e8e9",
  fogDensity: 0.03,
  keyColor: "#f4fbfd",
  keyIntensity: 2.75,
  keyPosition: [-2.2, 4.4, 2.6],
  fillColor: "#dde4e6",
  fillIntensity: 1.1,
};

/* ============================================================
   06 — GLASSHOUSE. Act 06, The Farm.
   Wall retreats, glazing goes full height, massing flattens into
   long NFT channel runs. Highest ambient, lowest contrast.
   ============================================================ */
export const ENV_GLASSHOUSE: EnvironmentPalette = {
  name: "Glasshouse",
  at: 0.62,
  top: "#e7eeea",
  horizon: "#dde8e0",
  bottom: "#c2d2c7",
  ground: "#cdd6ce",
  glow: "#f4fbf2",
  glowDirection: [0.35, 0.62, -0.7],
  presence: 1,
  wallColor: "#e0eae2",
  wallDistance: 15,
  ceilingHeight: 5.6,
  ceilingColor: "#e9f1ea",
  windowColor: "#fbfffa",
  windowPosition: [0, 3.0],
  windowSize: [13, 5.4],
  propDark: "#a8b6ab",
  propLight: "#dbe5dc",
  props: pad([
    // NFT channel runs flanking the tower
    ...row(3, [-2.6, 0.72, -5.0], [-1.25, 0, 0], [0.34, 0.1, 9.5], 0.95),
    ...row(3, [2.6, 0.72, -5.0], [1.25, 0, 0], [0.34, 0.1, 9.5], 0.95),
    // Their support legs
    ...row(3, [-2.6, 0.34, -3.0], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3),
    ...row(3, [2.6, 0.34, -3.0], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3),
    ...row(3, [-2.6, 0.34, -7.5], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3),
    ...row(3, [2.6, 0.34, -7.5], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3),
    // Roof trusses
    ...row(5, [0, 5.35, -1.5], [0, 0, -2.6], [15, 0.13, 0.13], 0.45),
    // Irrigation trunk line along the ridge
    { p: [0, 4.85, -6.0], s: [0.1, 0.1, 13], t: 0.25 },
    { p: [0, 0.1, -11.5], s: [16, 0.2, 0.5], t: 0.55 },
  ]),
  fogColor: "#dde7e0",
  fogDensity: 0.04,
  keyColor: "#f2f8ef",
  keyIntensity: 3.1,
  keyPosition: [1.6, 6.4, 2.0],
  fillColor: "#d6e4da",
  fillIntensity: 1.15,
};

/* ============================================================
   07 — CLASSROOM. Act 07, What Compounds.
   Desks in a grid, a board, ceiling strips. An institution reads as
   a place where the same procedure is repeated — which is the act.
   ============================================================ */
export const ENV_CLASSROOM: EnvironmentPalette = {
  name: "Classroom",
  at: 0.74,
  top: "#eeeeea",
  horizon: "#e7e7e2",
  bottom: "#d0d2cd",
  ground: "#d8d3c6",
  glow: "#fdfbf2",
  glowDirection: [-0.68, 0.34, -0.65],
  presence: 1,
  wallColor: "#e6e7e2",
  wallDistance: 8.0,
  ceilingHeight: 3.1,
  ceilingColor: "#ecedea",
  windowColor: "#fefdf6",
  windowPosition: [-3.2, 1.6],
  windowSize: [3.4, 2.0],
  propDark: "#96907f",
  propLight: "#dcd7c8",
  props: pad([
    // Desks: three rows of three, offset so the grid reads in depth
    ...row(3, [-2.4, 0.37, -3.2], [2.4, 0, 0], [1.15, 0.05, 0.55], 0.9),
    ...row(3, [-2.4, 0.185, -3.2], [2.4, 0, 0], [1.0, 0.37, 0.06], 0.25),
    ...row(3, [-2.4, 0.37, -5.0], [2.4, 0, 0], [1.15, 0.05, 0.55], 0.9),
    ...row(3, [-2.4, 0.185, -5.0], [2.4, 0, 0], [1.0, 0.37, 0.06], 0.25),
    ...row(3, [-2.4, 0.37, -6.8], [2.4, 0, 0], [1.15, 0.05, 0.55], 0.9),
    ...row(3, [-2.4, 0.185, -6.8], [2.4, 0, 0], [1.0, 0.37, 0.06], 0.25),
    // Chair backs
    ...row(3, [-2.4, 0.45, -3.85], [2.4, 0, 0], [0.42, 0.42, 0.05], 0.35),
    ...row(3, [-2.4, 0.45, -5.65], [2.4, 0, 0], [0.42, 0.42, 0.05], 0.35),
    // Board and teaching bench
    { p: [0.4, 1.65, -7.9], s: [4.4, 1.25, 0.05], t: 1 },
    { p: [0.4, 0.44, -7.2], s: [1.9, 0.88, 0.6], t: 0.4 },
    // Ceiling strips
    ...row(3, [0, 3.02, -3.0], [0, 0, -2.2], [5.2, 0.06, 0.24], 1),
  ]),
  fogColor: "#e5e6e1",
  fogDensity: 0.028,
  keyColor: "#fffaea",
  keyIntensity: 2.55,
  keyPosition: [-3.8, 3.9, 2.2],
  fillColor: "#dfe0da",
  fillIntensity: 0.95,
};

/* ============================================================
   08 — LABORATORY. Act 08, What We're Building.
   Benches, reagent shelving, a fume hood, flat even light. Clean,
   scientific, deliberately the least warm frame in the sequence.
   ============================================================ */
export const ENV_LAB: EnvironmentPalette = {
  name: "Laboratory",
  at: 0.855,
  top: "#eef1f0",
  horizon: "#e8ecec",
  bottom: "#cfd6d5",
  ground: "#d9dddc",
  glow: "#fafefe",
  glowDirection: [-0.2, 0.6, -0.77],
  presence: 1,
  wallColor: "#e6ebea",
  wallDistance: 7.4,
  ceilingHeight: 3.0,
  ceilingColor: "#eaeeed",
  windowColor: "#fdffff",
  windowPosition: [3.1, 1.9],
  windowSize: [1.8, 1.8],
  propDark: "#8d9899",
  propLight: "#e0e6e5",
  props: pad([
    // Two long benches flanking the tower
    { p: [-2.8, 0.44, -3.4], s: [1.05, 0.88, 5.2], t: 0.9 },
    { p: [-2.8, 0.9, -3.4], s: [1.12, 0.05, 5.3], t: 1 },
    { p: [2.8, 0.44, -3.4], s: [1.05, 0.88, 5.2], t: 0.9 },
    { p: [2.8, 0.9, -3.4], s: [1.12, 0.05, 5.3], t: 1 },
    // Glassware and instruments on the benches
    ...row(5, [-2.8, 1.05, -1.6], [0, 0, -1.05], [0.14, 0.24, 0.14], 0.55),
    ...row(5, [2.8, 1.05, -1.6], [0, 0, -1.05], [0.12, 0.2, 0.12], 0.55),
    // Reagent shelving above the left bench
    { p: [-3.15, 1.78, -3.4], s: [0.42, 0.04, 5.0], t: 0.35 },
    ...row(6, [-3.15, 1.93, -1.4], [0, 0, -0.85], [0.13, 0.26, 0.13], 0.7),
    // Fume hood on the back wall
    { p: [0.2, 1.1, -7.0], s: [2.0, 2.2, 0.85], t: 0.45 },
    { p: [0.2, 1.45, -6.55], s: [1.7, 1.15, 0.04], t: 1 },
    // Ceiling strips
    ...row(3, [0, 2.92, -2.4], [0, 0, -2.0], [5.6, 0.06, 0.22], 1),
    // Stool
    { p: [-1.6, 0.3, -2.2], s: [0.34, 0.06, 0.34], t: 0.8 },
  ]),
  fogColor: "#e6ebea",
  fogDensity: 0.026,
  keyColor: "#f7fdfd",
  keyIntensity: 2.85,
  keyPosition: [-1.4, 4.6, 3.0],
  fillColor: "#dee6e5",
  fillIntensity: 1.2,
};

/* ============================================================
   09 — GLASSHOUSE, GOLDEN HOUR. Act 09, Destination.
   The same structure as act 06 at the end of the day. Warmest frame
   on the page, resolving the cool room it opened on.
   ============================================================ */
export const ENV_GOLDEN: EnvironmentPalette = {
  ...ENV_GLASSHOUSE,
  name: "Glasshouse, golden hour",
  at: 0.96,
  top: "#e6e3d8",
  horizon: "#efe1c8",
  bottom: "#c7c0ac",
  ground: "#d3cab6",
  glow: "#ffdca0",
  glowDirection: [0.78, 0.1, -0.62],
  wallColor: "#e7dcc6",
  ceilingColor: "#eee2ca",
  windowColor: "#ffe6b4",
  windowPosition: [2.6, 2.2],
  propDark: "#b0a894",
  propLight: "#e6dcc6",
  fogColor: "#e8dcc4",
  fogDensity: 0.05,
  keyColor: "#ffd394",
  keyIntensity: 3.4,
  keyPosition: [6.2, 1.9, 1.2],
  fillColor: "#ddd2bd",
  fillIntensity: 0.9,
};

/** Ordered by scroll position. The scene samples neighbours and blends. */
export const ENVIRONMENTS: EnvironmentPalette[] = [
  ENV_LIVING_ROOM,
  ENV_ROOM_DUSK,
  ENV_STUDIO,
  ENV_CAFE,
  ENV_KITCHEN,
  ENV_GLASSHOUSE,
  ENV_CLASSROOM,
  ENV_LAB,
  ENV_GOLDEN,
];

/**
 * Which two environments to blend at a given scroll position, and how
 * far between them.
 *
 * Blending is smoothstepped rather than linear so a room holds near its
 * own keyframe and moves fastest in the middle — otherwise the world is
 * perpetually in transition and never feels like anywhere.
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
