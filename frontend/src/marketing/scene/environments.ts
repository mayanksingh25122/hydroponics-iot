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
  /**
   * Explicit colour, overriding the tone ramp.
   *
   * The ramp exists so a whole room can be recoloured from two values,
   * which is right for structure — counters, benches, channel runs. It
   * is wrong for the things that make a room feel lived in, because a
   * rug, a sofa and a stack of books are not three values of one
   * material. Those get a colour of their own.
   */
  c?: string;
}

/**
 * Every environment is padded to this length so prop N in one room
 * always morphs into prop N in the next. Raising it costs one instance
 * in a single InstancedMesh, not a draw call.
 */
export const MAX_PROPS = 36;

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

/**
 * Desaturates and dims every explicitly-coloured prop in a room.
 *
 * Used to derive the late-evening living room from the daylit one: the
 * furniture is not replaced, the colour is simply pulled out of it.
 * Recognising it as the same room is the whole point of that act.
 */
function drain(props: Prop[], amount = 0.74, darken = 0.14): Prop[] {
  return props.map((prop) => {
    if (!prop.c) return prop;
    const n = parseInt(prop.c.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    // Perceptual luminance, so a saturated red and a saturated blue
    // drain to greys that still read as different values.
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const to = (v: number) =>
      Math.max(0, Math.min(255, Math.round((v + (grey - v) * amount) * (1 - darken))));
    const hex = ((to(r) << 16) | (to(g) << 8) | to(b)).toString(16).padStart(6, "0");
    return { ...prop, c: `#${hex}` };
  });
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

   The most furnished frame on the page, and the only one allowed real
   colour. It is the first thing a visitor sees, and the act has to
   argue that this object belongs in a room someone actually lives in
   — which a grey room cannot do.

   Colour is warm and muted rather than bright: clay, sage, ochre,
   walnut, brass. Saturated enough to feel like a home, restrained
   enough that the white tower still holds the frame.
   ============================================================ */

/** Muted domestic palette. Warm, low-chroma, no primaries. */
const CLAY = "#bb9075";
const CLAY_PALE = "#d2b39a";
const SAGE = "#7f8f78";
const SAGE_PALE = "#95a58d";
const OCHRE = "#c69a58";
const TERRACOTTA = "#b5705a";
const WALNUT = "#7d6049";
const WALNUT_PALE = "#9a7a5f";
const CREAM = "#e8dfcd";
const INK = "#33322e";
const BRASS = "#b08d55";
const SLATE_BLUE = "#4c6076";
const LEAF = "#5d7a58";

export const ENV_LIVING_ROOM: EnvironmentPalette = {
  name: "Living room",
  at: 0.0,
  top: "#efeee8",
  horizon: "#e9e6dd",
  bottom: "#d6cfc0",
  ground: "#c9b79c",
  glow: "#fffbee",
  glowDirection: [-0.75, 0.28, -0.6],
  presence: 1,
  wallColor: "#ebe7de",
  wallDistance: 6.6,
  ceilingHeight: 2.9,
  ceilingColor: "#f0ece3",
  windowColor: "#fffdf2",
  windowPosition: [-2.6, 1.5],
  windowSize: [1.7, 2.5],
  propDark: "#a99880",
  propLight: "#ded4c2",
  props: pad([
    // --- Rug: a band of clay with a paler field inside it ---
    { p: [0.35, 0.006, -1.5], s: [4.4, 0.012, 3.0], c: CLAY },
    { p: [0.35, 0.01, -1.5], s: [3.7, 0.012, 2.4], c: CLAY_PALE },

    // --- Sofa: base, back, two arms, two cushions, a throw ---
    { p: [2.25, 0.28, -2.35], s: [2.15, 0.56, 0.95], r: -0.05, c: SAGE },
    { p: [2.25, 0.63, -2.71], s: [2.15, 0.66, 0.24], r: -0.05, c: SAGE },
    { p: [3.25, 0.44, -2.35], s: [0.22, 0.34, 0.95], r: -0.05, c: SAGE_PALE },
    { p: [1.25, 0.44, -2.35], s: [0.22, 0.34, 0.95], r: -0.05, c: SAGE_PALE },
    { p: [2.78, 0.68, -2.57], s: [0.42, 0.4, 0.17], r: -0.22, c: OCHRE },
    { p: [1.76, 0.66, -2.57], s: [0.38, 0.36, 0.16], r: 0.18, c: TERRACOTTA },
    { p: [1.34, 0.6, -2.1], s: [0.46, 0.5, 0.86], r: -0.05, c: CREAM },

    // --- Coffee table with a book stack and a bowl ---
    { p: [1.5, 0.37, -0.95], s: [1.2, 0.06, 0.66], c: WALNUT },
    { p: [1.05, 0.18, -0.95], s: [0.06, 0.37, 0.52], c: INK },
    { p: [1.95, 0.18, -0.95], s: [0.06, 0.37, 0.52], c: INK },
    { p: [1.28, 0.43, -0.9], s: [0.24, 0.06, 0.18], r: 0.3, c: SLATE_BLUE },
    { p: [1.28, 0.48, -0.9], s: [0.21, 0.04, 0.16], r: 0.12, c: CREAM },
    { p: [1.78, 0.44, -1.02], s: [0.21, 0.09, 0.21], c: BRASS },

    // --- Floor lamp ---
    { p: [-2.55, 0.015, -3.0], s: [0.3, 0.03, 0.3], c: INK },
    { p: [-2.55, 0.66, -3.0], s: [0.035, 1.3, 0.035], c: INK },
    { p: [-2.55, 1.39, -3.0], s: [0.38, 0.3, 0.38], c: "#f5e9d2" },

    // --- Shelf unit, books, a vase and a small brass object ---
    { p: [1.65, 0.33, -5.9], s: [2.9, 0.66, 0.42], c: WALNUT },
    { p: [0.62, 0.83, -5.86], s: [0.1, 0.28, 0.14], c: TERRACOTTA },
    { p: [0.75, 0.85, -5.86], s: [0.08, 0.32, 0.14], c: SLATE_BLUE },
    { p: [0.86, 0.81, -5.86], s: [0.09, 0.24, 0.14], c: CREAM },
    { p: [1.0, 0.84, -5.86], s: [0.11, 0.3, 0.14], c: OCHRE },
    { p: [2.0, 0.86, -5.86], s: [0.17, 0.34, 0.17], c: SAGE_PALE },
    { p: [2.52, 0.76, -5.86], s: [0.15, 0.15, 0.15], c: BRASS },

    // --- Framed art ---
    { p: [1.2, 1.82, -6.5], s: [0.7, 0.9, 0.03], c: OCHRE },
    { p: [2.12, 1.74, -6.5], s: [0.46, 0.6, 0.03], c: LEAF },

    // --- Potted plant ---
    { p: [-3.3, 0.17, -4.1], s: [0.38, 0.36, 0.38], c: TERRACOTTA },
    { p: [-3.3, 0.78, -4.1], s: [0.72, 0.92, 0.72], c: LEAF },

    // --- Side table and a mug ---
    { p: [-1.15, 0.24, -2.5], s: [0.44, 0.48, 0.44], c: WALNUT_PALE },
    { p: [-1.15, 0.53, -2.5], s: [0.11, 0.11, 0.11], c: "#efeae0" },
  ]),
  fogColor: "#e9e4d9",
  fogDensity: 0.02,
  keyColor: "#fff2dc",
  keyIntensity: 2.75,
  keyPosition: [-3.4, 3.6, 2.4],
  fillColor: "#e2ded2",
  fillIntensity: 0.9,
};

/* ============================================================
   02 — THE SAME ROOM, LATE. Act 02, The Gap.

   Identical furniture in identical positions, with the colour drained
   out of it. The act is about systems failing while nobody is
   watching, so the room does not change — it just stops being warm.
   ============================================================ */
export const ENV_ROOM_DUSK: EnvironmentPalette = {
  ...ENV_LIVING_ROOM,
  name: "Living room, late",
  at: 0.14,
  top: "#d9dbd9",
  horizon: "#d3d5d2",
  bottom: "#bcbdb8",
  ground: "#b5aa9a",
  glow: "#e4e0d2",
  glowDirection: [-0.8, 0.16, -0.56],
  wallColor: "#d6d5cf",
  ceilingColor: "#dad9d3",
  windowColor: "#e6e2d4",
  propDark: "#918b80",
  propLight: "#bdb8ae",
  props: drain(ENV_LIVING_ROOM.props),
  fogColor: "#d3d4cf",
  fogDensity: 0.036,
  keyColor: "#e6ddc9",
  keyIntensity: 1.3,
  keyPosition: [-3.6, 2.8, 1.9],
  fillColor: "#c8ccc7",
  fillIntensity: 0.58,
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
