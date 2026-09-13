/**
 * Environment palettes.
 *
 * Every value a scene needs to describe "where we are" lives in one
 * object, so an act transition is a cross-fade between two of these and
 * nothing else. Keeping them out of Backdrop.tsx means adding the
 * remaining acts' environments never touches rendering code.
 *
 * Colours are deliberately narrow-range and low-contrast: per the brief,
 * the background must never compete with the tower.
 */
export interface EnvironmentPalette {
  name: string;
  /** Sky shell, sampled by world-space height. */
  top: string;
  horizon: string;
  bottom: string;
  /** Ground plane. */
  ground: string;
  /** Soft light bloom on the backdrop — stands in for a window or glazing. */
  glow: string;
  /** Bloom centre as a direction from the origin. */
  glowDirection: [number, number, number];
  /** Key light. */
  keyColor: string;
  keyIntensity: number;
  /** Ambient/bounce fill. */
  fillColor: string;
  fillIntensity: number;
}

/** Act 01 — a domestic interior. Cool north daylight through one window. */
export const ENV_INTERIOR: EnvironmentPalette = {
  name: "Interior",
  top: "#eceeea",
  horizon: "#e4e8e3",
  bottom: "#cdd4ce",
  ground: "#dfe3dd",
  glow: "#fffdf6",
  glowDirection: [-0.75, 0.28, -0.6],
  keyColor: "#fff6e6",
  keyIntensity: 2.6,
  fillColor: "#dce6e2",
  fillIntensity: 0.85,
};

/** Act 05 — controlled-environment glasshouse. Higher, flatter, greener. */
export const ENV_GLASSHOUSE: EnvironmentPalette = {
  name: "Glasshouse",
  top: "#e7eeea",
  horizon: "#dde8e0",
  bottom: "#c2d2c7",
  ground: "#cfdad1",
  glow: "#f4fbf2",
  glowDirection: [0.35, 0.62, -0.7],
  keyColor: "#f2f8ef",
  keyIntensity: 3.1,
  fillColor: "#d6e4da",
  fillIntensity: 1.15,
};
