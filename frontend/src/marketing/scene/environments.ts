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

import type { PropMaterial } from "./textures";

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
  /**
   * Surface texture. Defaults to plaster.
   *
   * Carries luminance grain only — the hue always comes from `c` or the
   * tone ramp — so one wood texture serves walnut, oak and pale birch.
   */
  m?: PropMaterial;
}

/**
 * Every environment is padded to this length so prop N in one room
 * always morphs into prop N in the next. Raising it costs one instance
 * in a single InstancedMesh, not a draw call.
 */
export const MAX_PROPS = 46;

/** Hidden slot: below the floor at zero size, so padding never shows. */
const EMPTY: Prop = { p: [0, -2, 0], s: [0, 0, 0] };

/** Repeats a prop along an axis — desk rows, channel runs, pendants. */
function row(
  count: number,
  start: [number, number, number],
  step: [number, number, number],
  size: [number, number, number],
  tone = 0.5,
  rot = 0,
  material?: PropMaterial,
  color?: string
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
    m: material,
    c: color,
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
    { p: [0.35, 0.006, -1.5], s: [4.4, 0.012, 3.0], c: CLAY, m: "fabric" },
    { p: [0.35, 0.01, -1.5], s: [3.7, 0.012, 2.4], c: CLAY_PALE, m: "fabric" },

    // --- Sofa: base, back, two arms, two cushions, a throw ---
    { p: [2.25, 0.28, -2.35], s: [2.15, 0.56, 0.95], r: -0.05, c: SAGE, m: "fabric" },
    { p: [2.25, 0.63, -2.71], s: [2.15, 0.66, 0.24], r: -0.05, c: SAGE, m: "fabric" },
    { p: [3.25, 0.44, -2.35], s: [0.22, 0.34, 0.95], r: -0.05, c: SAGE_PALE, m: "fabric" },
    { p: [1.25, 0.44, -2.35], s: [0.22, 0.34, 0.95], r: -0.05, c: SAGE_PALE, m: "fabric" },
    { p: [2.78, 0.68, -2.57], s: [0.42, 0.4, 0.17], r: -0.22, c: OCHRE, m: "fabric" },
    { p: [1.76, 0.66, -2.57], s: [0.38, 0.36, 0.16], r: 0.18, c: TERRACOTTA, m: "fabric" },
    { p: [1.34, 0.6, -2.1], s: [0.46, 0.5, 0.86], r: -0.05, c: CREAM, m: "fabric" },

    // --- Coffee table with a book stack and a bowl ---
    { p: [1.5, 0.37, -0.95], s: [1.2, 0.06, 0.66], c: WALNUT, m: "wood" },
    { p: [1.05, 0.18, -0.95], s: [0.06, 0.37, 0.52], c: INK, m: "metal" },
    { p: [1.95, 0.18, -0.95], s: [0.06, 0.37, 0.52], c: INK, m: "metal" },
    { p: [1.28, 0.43, -0.9], s: [0.24, 0.06, 0.18], r: 0.3, c: SLATE_BLUE },
    { p: [1.28, 0.48, -0.9], s: [0.21, 0.04, 0.16], r: 0.12, c: CREAM },
    { p: [1.78, 0.44, -1.02], s: [0.21, 0.09, 0.21], c: BRASS, m: "metal" },

    // --- Floor lamp ---
    { p: [-2.55, 0.015, -3.0], s: [0.3, 0.03, 0.3], c: INK, m: "metal" },
    { p: [-2.55, 0.66, -3.0], s: [0.035, 1.3, 0.035], c: INK, m: "metal" },
    { p: [-2.55, 1.39, -3.0], s: [0.38, 0.3, 0.38], c: "#f5e9d2", m: "fabric" },

    // --- Shelf unit, books, a vase and a small brass object ---
    { p: [1.65, 0.33, -5.9], s: [2.9, 0.66, 0.42], c: WALNUT, m: "wood" },
    { p: [0.62, 0.83, -5.86], s: [0.1, 0.28, 0.14], c: TERRACOTTA },
    { p: [0.75, 0.85, -5.86], s: [0.08, 0.32, 0.14], c: SLATE_BLUE },
    { p: [0.86, 0.81, -5.86], s: [0.09, 0.24, 0.14], c: CREAM },
    { p: [1.0, 0.84, -5.86], s: [0.11, 0.3, 0.14], c: OCHRE },
    { p: [2.0, 0.86, -5.86], s: [0.17, 0.34, 0.17], c: SAGE_PALE },
    { p: [2.52, 0.76, -5.86], s: [0.15, 0.15, 0.15], c: BRASS, m: "metal" },

    // --- Framed art ---
    { p: [1.2, 1.82, -6.5], s: [0.7, 0.9, 0.03], c: OCHRE },
    { p: [2.12, 1.74, -6.5], s: [0.46, 0.6, 0.03], c: LEAF },

    // --- Potted plant ---
    { p: [-3.3, 0.17, -4.1], s: [0.38, 0.36, 0.38], c: TERRACOTTA },
    { p: [-3.3, 0.78, -4.1], s: [0.72, 0.92, 0.72], c: LEAF },

    // --- Side table and a mug ---
    { p: [-1.15, 0.24, -2.5], s: [0.44, 0.48, 0.44], c: WALNUT_PALE, m: "wood" },
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
   04 - CAFE. Act 04, Anywhere.

   Counter, stool row, pendant lights, tables, back shelving. Warmest
   artificial light in the sequence and the most social frame: the act
   argues the tower belongs where people gather, which needs people's
   furniture in shot.
   ============================================================ */
const CAFE_OAK = "#a67a4e";
const CAFE_OAK_PALE = "#c19a6a";
const CAFE_TOP = "#8a6647";
const CAFE_INK = "#3a352e";
const CAFE_BRASS = "#bb9155";
const CAFE_TILE = "#cdbda6";
const CAFE_LEAF = "#6f8a62";

export const ENV_CAFE: EnvironmentPalette = {
  name: "Cafe",
  at: 0.375,
  top: "#efeae1",
  horizon: "#e9e2d6",
  bottom: "#cfc7b9",
  ground: "#c4b49c",
  glow: "#fff2da",
  glowDirection: [0.62, 0.2, -0.72],
  presence: 1,
  wallColor: "#ded5c6",
  wallDistance: 7.0,
  ceilingHeight: 3.05,
  ceilingColor: "#e2dacd",
  windowColor: "#fff8e8",
  windowPosition: [2.9, 1.5],
  windowSize: [2.8, 2.3],
  propDark: "#8f8579",
  propLight: "#ddd4c4",
  props: pad([
    // --- Serving counter: carcass, bar top, kick plate, front panels ---
    { p: [-2.6, 0.52, -2.6], s: [3.4, 1.04, 0.72], r: 0.1, c: CAFE_OAK, m: "wood" },
    { p: [-2.6, 1.07, -2.6], s: [3.6, 0.08, 0.88], r: 0.1, c: CAFE_TOP, m: "wood" },
    { p: [-2.6, 0.05, -2.6], s: [3.3, 0.1, 0.66], r: 0.1, c: CAFE_INK, m: "metal" },
    ...row(3, [-3.7, 0.58, -2.28], [1.1, 0, 0], [0.9, 0.7, 0.03], 0.4, 0.1, "wood", CAFE_OAK_PALE),
    // --- Espresso machine and a grinder on the bar ---
    { p: [-3.3, 1.28, -2.72], s: [0.72, 0.36, 0.44], r: 0.1, c: CAFE_BRASS, m: "metal" },
    { p: [-3.3, 1.5, -2.72], s: [0.5, 0.1, 0.34], r: 0.1, c: CAFE_INK, m: "metal" },
    { p: [-2.5, 1.26, -2.78], s: [0.2, 0.32, 0.2], r: 0.1, c: CAFE_INK, m: "metal" },

    // --- Stools ---
    ...row(4, [-3.7, 0.35, -1.8], [0.74, 0, 0], [0.32, 0.07, 0.32], 0.9, 0, "wood", CAFE_OAK_PALE),
    ...row(4, [-3.7, 0.17, -1.8], [0.74, 0, 0], [0.05, 0.35, 0.05], 0.2, 0, "metal", CAFE_INK),

    // --- Pendant lights over the counter ---
    ...row(3, [-3.2, 2.34, -2.6], [0.64, 0, 0], [0.013, 0.7, 0.013], 0.15, 0, "metal", CAFE_INK),
    ...row(3, [-3.2, 1.92, -2.6], [0.64, 0, 0], [0.26, 0.18, 0.26], 1, 0, "metal", CAFE_BRASS),

    // --- Two tables with chairs ---
    { p: [1.9, 0.39, -1.5], s: [0.78, 0.05, 0.78], r: 0.2, c: CAFE_TOP, m: "wood" },
    { p: [1.9, 0.19, -1.5], s: [0.07, 0.39, 0.07], c: CAFE_INK, m: "metal" },
    { p: [2.55, 0.45, -1.5], s: [0.38, 0.44, 0.05], r: 0.2, c: CAFE_OAK_PALE, m: "wood" },
    { p: [2.5, 0.39, -3.6], s: [0.78, 0.05, 0.78], r: -0.15, c: CAFE_TOP, m: "wood" },
    { p: [2.5, 0.19, -3.6], s: [0.07, 0.39, 0.07], c: CAFE_INK, m: "metal" },
    { p: [3.15, 0.45, -3.6], s: [0.38, 0.44, 0.05], r: -0.15, c: CAFE_OAK_PALE, m: "wood" },
    // Cups on the near table.
    { p: [1.78, 0.46, -1.42], s: [0.1, 0.1, 0.1], c: "#efe9dd", m: "plaster" },
    { p: [2.02, 0.45, -1.6], s: [0.09, 0.08, 0.09], c: "#efe9dd", m: "plaster" },

    // --- Back shelving with crockery and a plant ---
    { p: [-2.7, 1.62, -6.85], s: [3.3, 0.06, 0.3], c: CAFE_TOP, m: "wood" },
    { p: [-2.7, 2.04, -6.85], s: [3.3, 0.06, 0.3], c: CAFE_TOP, m: "wood" },
    ...row(5, [-3.9, 1.79, -6.83], [0.62, 0, 0], [0.11, 0.26, 0.11], 0.6, 0, "plaster", "#e5ded0"),
    ...row(4, [-3.7, 2.2, -6.83], [0.72, 0, 0], [0.13, 0.26, 0.13], 0.6, 0, "plaster", "#d9cfbd"),
    { p: [-1.2, 2.28, -6.83], s: [0.34, 0.42, 0.34], c: CAFE_LEAF, m: "fabric" },
    // --- Menu board and floor tiles hint ---
    { p: [-2.7, 2.52, -6.92], s: [1.9, 0.66, 0.04], c: CAFE_INK, m: "plaster" },
    { p: [0.4, 0.005, -2.0], s: [5.0, 0.01, 4.6], c: CAFE_TILE, m: "plaster" },
  ]),
  fogColor: "#e2dacd",
  fogDensity: 0.03,
  keyColor: "#ffe9c6",
  keyIntensity: 2.3,
  keyPosition: [3.6, 3.2, 2.0],
  fillColor: "#ded5c6",
  fillIntensity: 0.78,
};

/* ============================================================
   05 - COMMERCIAL KITCHEN. Act 05, Two Products.

   Stainless, hard surfaces, even light. Deliberately unglamorous -
   the act where the page stops selling lifestyle and starts talking
   to the people who buy at volume.
   ============================================================ */
const K_STEEL = "#b6bfc1";
const K_STEEL_DARK = "#7c878a";
const K_TOP = "#cdd5d6";
const K_TILE = "#dee4e4";
const K_INK = "#333a3b";

export const ENV_KITCHEN: EnvironmentPalette = {
  name: "Commercial kitchen",
  at: 0.49,
  top: "#eef0f1",
  horizon: "#e6e9ea",
  bottom: "#ccd2d3",
  ground: "#c8cfd0",
  glow: "#f6fbfd",
  glowDirection: [-0.3, 0.55, -0.78],
  presence: 1,
  wallColor: "#e3e8e9",
  wallDistance: 7.4,
  ceilingHeight: 3.2,
  ceilingColor: "#e8ecec",
  windowColor: "#fbfeff",
  windowPosition: [-3.4, 2.0],
  windowSize: [1.6, 1.6],
  propDark: "#8e999c",
  propLight: "#dde3e4",
  props: pad([
    // --- Pass counter: carcass, top, plinth, door lines ---
    { p: [-2.95, 0.46, -2.4], s: [3.2, 0.92, 0.78], c: K_STEEL, m: "metal" },
    { p: [-2.95, 0.94, -2.4], s: [3.32, 0.06, 0.9], c: K_TOP, m: "metal" },
    { p: [-2.95, 0.05, -2.4], s: [3.1, 0.1, 0.7], c: K_STEEL_DARK, m: "metal" },
    ...row(3, [-4.0, 0.5, -2.03], [1.05, 0, 0], [0.9, 0.7, 0.03], 0.4, 0, "metal", K_STEEL_DARK),

    // --- Island with extraction hood ---
    { p: [2.75, 0.46, -2.8], s: [2.4, 0.92, 0.95], c: K_STEEL, m: "metal" },
    { p: [2.75, 0.94, -2.8], s: [2.52, 0.06, 1.06], c: K_TOP, m: "metal" },
    { p: [2.75, 0.05, -2.8], s: [2.3, 0.1, 0.86], c: K_STEEL_DARK, m: "metal" },
    { p: [2.75, 2.32, -2.8], s: [2.2, 0.5, 1.1], c: K_STEEL, m: "metal" },
    { p: [2.75, 2.74, -2.8], s: [0.5, 0.42, 0.5], c: K_STEEL_DARK, m: "metal" },
    // Pans hanging from the hood rail.
    ...row(3, [2.2, 1.92, -2.8], [0.55, 0, 0], [0.26, 0.26, 0.05], 0.5, 0, "metal", K_STEEL_DARK),

    // --- Upper cabinets and a splashback ---
    ...row(4, [-3.9, 1.98, -7.05], [0.86, 0, 0], [0.82, 0.66, 0.36], 0.75, 0, "metal", K_STEEL),
    { p: [-2.3, 1.34, -7.15], s: [4.4, 0.62, 0.03], c: K_TILE, m: "plaster" },

    // --- Prep bench along the back, with containers ---
    { p: [0.1, 0.44, -6.5], s: [3.0, 0.88, 0.62], c: K_STEEL, m: "metal" },
    { p: [0.1, 0.9, -6.5], s: [3.1, 0.06, 0.72], c: K_TOP, m: "metal" },
    ...row(4, [-1.1, 1.06, -6.5], [0.8, 0, 0], [0.3, 0.26, 0.3], 0.65, 0, "plaster", "#e8eded"),

    // --- Ceiling light strips ---
    ...row(3, [0, 3.12, -1.6], [0, 0, -1.9], [4.8, 0.07, 0.26], 1, 0, "plaster", "#f6fafa"),

    // --- Trolley and a bin ---
    { p: [0.95, 0.4, -1.1], s: [0.86, 0.04, 0.58], c: K_STEEL, m: "metal" },
    { p: [0.95, 0.2, -1.1], s: [0.06, 0.4, 0.06], c: K_STEEL_DARK, m: "metal" },
    { p: [0.95, 0.5, -1.1], s: [0.7, 0.16, 0.46], c: K_STEEL_DARK, m: "metal" },
    { p: [-1.5, 0.3, -1.2], s: [0.46, 0.6, 0.46], c: K_INK, m: "metal" },
    // Tiled floor patch under the working area.
    { p: [0, 0.005, -3.0], s: [9.0, 0.01, 6.0], c: K_TILE, m: "plaster" },
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
   06 - GLASSHOUSE. Act 06, The Farm.

   The wall retreats, glazing goes full height, and the massing
   flattens into long NFT channel runs. Highest ambient and lowest
   contrast of the set: the act is about scale, and scale reads
   through repetition and depth rather than through detail.
   ============================================================ */
const GH_CHANNEL = "#c6cfc7";
const GH_POST = "#9aa79c";
const GH_CROP = "#7f9a71";
const GH_CROP_YOUNG = "#98ac84";

export const ENV_GLASSHOUSE: EnvironmentPalette = {
  name: "Glasshouse",
  at: 0.62,
  top: "#e7eeea",
  horizon: "#dde8e0",
  bottom: "#c2d2c7",
  ground: "#c6d0c7",
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
    // --- Channel runs either side, with crop in them ---
    ...row(3, [-2.6, 0.72, -5.0], [-1.25, 0, 0], [0.34, 0.1, 9.5], 0.95, 0, "metal", GH_CHANNEL),
    ...row(3, [2.6, 0.72, -5.0], [1.25, 0, 0], [0.34, 0.1, 9.5], 0.95, 0, "metal", GH_CHANNEL),
    ...row(3, [-2.6, 0.86, -3.4], [-1.25, 0, 0], [0.44, 0.24, 4.8], 0.6, 0, "fabric", GH_CROP),
    ...row(3, [2.6, 0.86, -3.4], [1.25, 0, 0], [0.44, 0.24, 4.8], 0.6, 0, "fabric", GH_CROP),
    ...row(3, [-2.6, 0.82, -7.6], [-1.25, 0, 0], [0.4, 0.16, 3.0], 0.6, 0, "fabric", GH_CROP_YOUNG),
    ...row(3, [2.6, 0.82, -7.6], [1.25, 0, 0], [0.4, 0.16, 3.0], 0.6, 0, "fabric", GH_CROP_YOUNG),

    // --- Support legs at both ends of every run ---
    ...row(3, [-2.6, 0.34, -3.0], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_POST),
    ...row(3, [2.6, 0.34, -3.0], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_POST),
    ...row(3, [-2.6, 0.34, -7.5], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_POST),
    ...row(3, [2.6, 0.34, -7.5], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_POST),

    // --- Roof trusses and vertical glazing mullions ---
    ...row(4, [0, 5.35, -1.5], [0, 0, -2.6], [15, 0.13, 0.13], 0.45, 0, "metal", GH_POST),
    ...row(5, [-6.0, 2.8, -10.5], [3.0, 0, 0], [0.1, 5.4, 0.1], 0.4, 0, "metal", GH_POST),

    // --- Irrigation trunk, end bench, and a service walkway ---
    { p: [0, 4.85, -6.0], s: [0.1, 0.1, 13], c: GH_POST, m: "metal" },
    { p: [0, 0.1, -11.5], s: [16, 0.2, 0.5], c: GH_CHANNEL, m: "metal" },
    { p: [0, 0.008, -5.0], s: [1.5, 0.016, 11.0], c: "#bcc6bd", m: "plaster" },
    { p: [-5.4, 0.44, -7.0], s: [1.1, 0.86, 4.0], c: GH_CHANNEL, m: "metal" },
    { p: [5.4, 0.44, -7.0], s: [1.1, 0.86, 4.0], c: GH_CHANNEL, m: "metal" },
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
   07 - CLASSROOM. Act 07, What Compounds.

   Desks in a grid, a board, ceiling strips. An institution reads as a
   place where the same procedure is repeated by different people -
   which is exactly the argument the act is making about the platform.
   ============================================================ */
const CL_DESK = "#c2a97f";
const CL_DESK_EDGE = "#9c8055";
const CL_FRAME = "#7f8a90";
const CL_CHAIR = "#7d94a4";
const CL_BOARD = "#e9eee9";
const CL_FLOOR = "#bcae97";

export const ENV_CLASSROOM: EnvironmentPalette = {
  name: "Classroom",
  at: 0.74,
  top: "#eeeeea",
  horizon: "#e7e7e2",
  bottom: "#d0d2cd",
  ground: "#cabb9f",
  glow: "#fdfbf2",
  glowDirection: [-0.68, 0.34, -0.65],
  presence: 1,
  wallColor: "#e6e7e2",
  wallDistance: 8.4,
  ceilingHeight: 3.1,
  ceilingColor: "#ecedea",
  windowColor: "#fefdf6",
  windowPosition: [-3.4, 1.6],
  windowSize: [3.6, 2.0],
  propDark: "#96907f",
  propLight: "#dcd7c8",
  props: pad([
    // --- Three rows of desks: top, edge band, frame, chair ---
    ...row(3, [-2.5, 0.38, -3.3], [2.5, 0, 0], [1.2, 0.05, 0.58], 0.9, 0, "wood", CL_DESK),
    ...row(3, [-2.5, 0.34, -3.3], [2.5, 0, 0], [1.22, 0.04, 0.6], 0.9, 0, "wood", CL_DESK_EDGE),
    ...row(3, [-2.5, 0.18, -3.3], [2.5, 0, 0], [1.04, 0.36, 0.06], 0.25, 0, "metal", CL_FRAME),
    ...row(3, [-2.5, 0.46, -3.95], [2.5, 0, 0], [0.44, 0.44, 0.05], 0.35, 0, "fabric", CL_CHAIR),

    ...row(3, [-2.5, 0.38, -5.2], [2.5, 0, 0], [1.2, 0.05, 0.58], 0.9, 0, "wood", CL_DESK),
    ...row(3, [-2.5, 0.34, -5.2], [2.5, 0, 0], [1.22, 0.04, 0.6], 0.9, 0, "wood", CL_DESK_EDGE),
    ...row(3, [-2.5, 0.18, -5.2], [2.5, 0, 0], [1.04, 0.36, 0.06], 0.25, 0, "metal", CL_FRAME),
    ...row(3, [-2.5, 0.46, -5.85], [2.5, 0, 0], [0.44, 0.44, 0.05], 0.35, 0, "fabric", CL_CHAIR),

    ...row(3, [-2.5, 0.38, -7.1], [2.5, 0, 0], [1.2, 0.05, 0.58], 0.9, 0, "wood", CL_DESK),
    ...row(3, [-2.5, 0.18, -7.1], [2.5, 0, 0], [1.04, 0.36, 0.06], 0.25, 0, "metal", CL_FRAME),

    // --- Board, its tray, and the teaching bench ---
    { p: [0.4, 1.68, -8.3], s: [4.6, 1.3, 0.05], c: CL_BOARD, m: "plaster" },
    { p: [0.4, 1.0, -8.24], s: [4.6, 0.06, 0.14], c: CL_FRAME, m: "metal" },
    { p: [0.4, 0.44, -7.6], s: [1.9, 0.88, 0.6], c: CL_DESK, m: "wood" },
    { p: [0.4, 0.9, -7.6], s: [2.0, 0.05, 0.68], c: CL_DESK_EDGE, m: "wood" },

    // --- Ceiling strips and a pinboard on the side wall ---
    ...row(3, [0, 3.02, -3.0], [0, 0, -2.2], [5.4, 0.06, 0.24], 1, 0, "plaster", "#f7f8f5"),
    { p: [4.0, 1.7, -6.2], s: [0.05, 1.0, 2.4], c: "#b9a98c", m: "fabric" },
    // --- Floor covering under the desks ---
    { p: [0, 0.005, -5.2], s: [9.5, 0.01, 6.4], c: CL_FLOOR, m: "fabric" },
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

   The act describes a fixed camera rig photographing the same plant
   from the same angle every day, and a controlled bench running
   induced-stress treatments. So the room contains both: a rig on a
   tripod aimed squarely at the tower, and a bench of individually
   coloured reagent bottles. Clean, scientific, the least warm frame
   in the sequence.
   ============================================================ */
const LAB_STEEL = "#b9c3c4";
const LAB_STEEL_DARK = "#7f8d90";
const LAB_TOP = "#e6ebea";
const LAB_INK = "#2f3638";

export const ENV_LAB: EnvironmentPalette = {
  name: "Laboratory",
  at: 0.855,
  top: "#edf1f1",
  horizon: "#e6ecec",
  bottom: "#cbd4d4",
  ground: "#d4dadb",
  glow: "#fafefe",
  glowDirection: [-0.2, 0.6, -0.77],
  presence: 1,
  wallColor: "#e4eae9",
  wallDistance: 7.6,
  ceilingHeight: 3.0,
  ceilingColor: "#eaefee",
  windowColor: "#fdffff",
  windowPosition: [3.3, 1.95],
  windowSize: [1.9, 1.9],
  propDark: "#8d9899",
  propLight: "#e0e6e5",
  props: pad([
    // --- Left bench: carcass, worktop, plinth, drawer lines ---
    { p: [-2.9, 0.44, -3.4], s: [1.05, 0.86, 5.2], c: LAB_STEEL, m: "metal" },
    { p: [-2.9, 0.9, -3.4], s: [1.14, 0.06, 5.32], c: LAB_TOP, m: "plaster" },
    { p: [-2.9, 0.05, -3.4], s: [0.95, 0.1, 5.1], c: LAB_STEEL_DARK, m: "metal" },
    ...row(4, [-2.42, 0.6, -1.5], [0, 0, -1.25], [0.03, 0.42, 1.0], 0.5, 0, "metal", LAB_STEEL_DARK),

    // --- Right bench ---
    { p: [2.9, 0.44, -3.4], s: [1.05, 0.86, 5.2], c: LAB_STEEL, m: "metal" },
    { p: [2.9, 0.9, -3.4], s: [1.14, 0.06, 5.32], c: LAB_TOP, m: "plaster" },
    { p: [2.9, 0.05, -3.4], s: [0.95, 0.1, 5.1], c: LAB_STEEL_DARK, m: "metal" },

    // --- Reagent bottles, individually coloured. These stand in for
    //     the induced-stress treatments the narrative describes, which
    //     is why they are the one place in the room with any chroma. ---
    { p: [-2.95, 1.04, -1.5], s: [0.13, 0.22, 0.13], c: "#8fae7d", m: "plaster" },
    { p: [-2.78, 1.06, -1.9], s: [0.12, 0.26, 0.12], c: "#c2a35c", m: "plaster" },
    { p: [-3.02, 1.03, -2.35], s: [0.14, 0.2, 0.14], c: "#9fb5c4", m: "plaster" },
    { p: [-2.82, 1.07, -2.8], s: [0.12, 0.28, 0.12], c: "#b87f66", m: "plaster" },
    { p: [-2.98, 1.02, -3.3], s: [0.11, 0.18, 0.11], c: "#8c9ec0", m: "plaster" },
    { p: [-2.8, 1.05, -3.75], s: [0.13, 0.24, 0.13], c: "#a9b98e", m: "plaster" },

    // --- Instruments on the right bench ---
    { p: [2.82, 1.06, -1.7], s: [0.34, 0.26, 0.3], c: LAB_STEEL_DARK, m: "metal" },
    { p: [2.82, 1.2, -1.56], s: [0.24, 0.14, 0.02], c: "#5f7f86", m: "plaster" },
    { p: [3.0, 1.02, -2.5], s: [0.16, 0.18, 0.16], c: LAB_TOP, m: "plaster" },
    { p: [2.78, 1.08, -3.2], s: [0.28, 0.3, 0.24], c: LAB_STEEL, m: "metal" },

    // --- The fixed camera rig, aimed at the tower. The whole act is
    //     about this object, so it is in frame rather than implied. ---
    { p: [1.55, 0.62, -0.35], s: [0.05, 1.24, 0.05], c: LAB_INK, m: "metal" },
    { p: [1.55, 0.03, -0.35], s: [0.46, 0.05, 0.46], c: LAB_INK, m: "metal" },
    { p: [1.5, 1.3, -0.35], s: [0.2, 0.14, 0.3], r: -0.42, c: LAB_INK, m: "metal" },
    { p: [1.36, 1.3, -0.28], s: [0.1, 0.1, 0.12], r: -0.42, c: "#4a5153", m: "metal" },
    // Its colour calibration card, in frame with the plant.
    { p: [0.62, 0.52, -0.72], s: [0.3, 0.42, 0.015], r: -0.3, c: "#f0ece2", m: "plaster" },

    // --- Reagent shelving above the left bench ---
    { p: [-3.2, 1.8, -3.4], s: [0.44, 0.04, 5.0], c: LAB_TOP, m: "plaster" },
    ...row(6, [-3.2, 1.95, -1.4], [0, 0, -0.85], [0.13, 0.26, 0.13], 0.7, 0, "plaster", "#dfe5e4"),

    // --- Fume hood on the back wall ---
    { p: [0.2, 1.1, -7.2], s: [2.1, 2.2, 0.85], c: LAB_STEEL, m: "metal" },
    { p: [0.2, 1.5, -6.74], s: [1.76, 1.1, 0.03], c: "#dfeceb", m: "plaster" },
    { p: [0.2, 0.86, -6.72], s: [1.8, 0.06, 0.06], c: LAB_STEEL_DARK, m: "metal" },
    { p: [0.2, 2.42, -7.2], s: [0.34, 0.44, 0.34], c: LAB_STEEL_DARK, m: "metal" },

    // --- Ceiling strips and a stool ---
    ...row(3, [0, 2.92, -2.4], [0, 0, -2.0], [5.6, 0.06, 0.22], 1, 0, "plaster", "#f4f8f7"),
    { p: [-1.55, 0.32, -2.2], s: [0.36, 0.05, 0.36], c: LAB_STEEL, m: "metal" },
    { p: [-1.55, 0.16, -2.2], s: [0.05, 0.32, 0.05], c: LAB_STEEL_DARK, m: "metal" },
  ]),
  fogColor: "#e4eae9",
  fogDensity: 0.024,
  keyColor: "#f7fdfd",
  keyIntensity: 2.85,
  keyPosition: [-1.4, 4.6, 3.0],
  fillColor: "#dee6e5",
  fillIntensity: 1.2,
};

/* ============================================================
   09 — GLASSHOUSE, GOLDEN HOUR. Act 09, Destination.

   The same structure as act 06 at the end of the day, and the last
   thing anyone sees — so it is furnished in its own right rather than
   left as a recolour of the act before it. Crop in the channels,
   stacked harvest crates, a loaded trolley, a low warm sun.
   ============================================================ */
const CROP = "#7d9a6b";
const CROP_DEEP = "#67875c";
const CRATE = "#b98f52";
const CRATE_PALE = "#c79b5e";
const GH_FRAME = "#c3b9a4";
const GH_STEEL = "#9d9384";

export const ENV_GOLDEN: EnvironmentPalette = {
  name: "Glasshouse, golden hour",
  at: 0.96,
  top: "#e6e2d5",
  horizon: "#f0e0c4",
  bottom: "#c6bda7",
  ground: "#cfc4ab",
  glow: "#ffd89a",
  glowDirection: [0.78, 0.1, -0.62],
  presence: 1,
  wallColor: "#e9dcc2",
  wallDistance: 15,
  ceilingHeight: 5.6,
  ceilingColor: "#f1e4c9",
  windowColor: "#ffe4ad",
  windowPosition: [2.6, 2.4],
  windowSize: [13, 5.4],
  propDark: "#ab9f88",
  propLight: "#e7dcc4",
  props: pad([
    // --- Channel runs, now carrying crop ---
    ...row(3, [-2.6, 0.72, -5.0], [-1.25, 0, 0], [0.34, 0.1, 9.5], 0.95, 0, "metal", GH_FRAME),
    ...row(3, [2.6, 0.72, -5.0], [1.25, 0, 0], [0.34, 0.1, 9.5], 0.95, 0, "metal", GH_FRAME),
    ...row(3, [-2.6, 0.88, -3.6], [-1.25, 0, 0], [0.46, 0.28, 5.4], 0.6, 0, "fabric", CROP),
    ...row(3, [2.6, 0.88, -3.6], [1.25, 0, 0], [0.46, 0.28, 5.4], 0.6, 0, "fabric", CROP),
    ...row(3, [-2.6, 0.86, -7.6], [-1.25, 0, 0], [0.44, 0.24, 2.6], 0.6, 0, "fabric", CROP_DEEP),
    ...row(3, [2.6, 0.86, -7.6], [1.25, 0, 0], [0.44, 0.24, 2.6], 0.6, 0, "fabric", CROP_DEEP),

    // --- Support legs ---
    ...row(3, [-2.6, 0.34, -3.0], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_STEEL),
    ...row(3, [2.6, 0.34, -3.0], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_STEEL),
    ...row(3, [-2.6, 0.34, -7.5], [-1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_STEEL),
    ...row(3, [2.6, 0.34, -7.5], [1.25, 0, 0], [0.06, 0.68, 0.06], 0.3, 0, "metal", GH_STEEL),

    // --- Roof structure and the irrigation trunk along the ridge ---
    ...row(4, [0, 5.35, -1.5], [0, 0, -2.6], [15, 0.13, 0.13], 0.45, 0, "metal", GH_STEEL),
    { p: [0, 4.85, -6.0], s: [0.1, 0.1, 13], c: GH_STEEL, m: "metal" },

    // --- Harvest crates, stacked slightly off-square ---
    { p: [-1.5, 0.16, -1.4], s: [0.62, 0.32, 0.44], r: 0.12, c: CRATE, m: "wood" },
    { p: [-1.46, 0.48, -1.36], s: [0.62, 0.32, 0.44], r: -0.06, c: CRATE, m: "wood" },
    { p: [-1.52, 0.78, -1.42], s: [0.6, 0.28, 0.42], r: 0.2, c: CRATE_PALE, m: "wood" },
    { p: [1.72, 0.16, -1.6], s: [0.62, 0.32, 0.44], r: -0.14, c: CRATE, m: "wood" },
    { p: [1.68, 0.48, -1.56], s: [0.62, 0.32, 0.44], r: 0.08, c: CRATE_PALE, m: "wood" },

    // --- Loaded trolley ---
    { p: [3.7, 0.52, -1.1], s: [0.9, 0.04, 0.6], c: GH_STEEL, m: "metal" },
    { p: [3.7, 0.26, -1.1], s: [0.06, 0.52, 0.06], c: GH_STEEL, m: "metal" },
    { p: [3.7, 0.62, -1.1], s: [0.72, 0.16, 0.46], c: CROP, m: "fabric" },

    // --- Far bench and the end of the run ---
    { p: [0, 0.1, -11.5], s: [16, 0.2, 0.5], c: GH_FRAME, m: "metal" },
    { p: [-5.6, 0.44, -6.5], s: [1.1, 0.86, 4.0], c: GH_FRAME, m: "metal" },
    { p: [5.6, 0.44, -6.5], s: [1.1, 0.86, 4.0], c: GH_FRAME, m: "metal" },
  ]),
  fogColor: "#eadfc6",
  fogDensity: 0.046,
  keyColor: "#ffd08c",
  keyIntensity: 3.5,
  keyPosition: [6.6, 1.7, 1.0],
  fillColor: "#ded1b8",
  fillIntensity: 0.88,
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
