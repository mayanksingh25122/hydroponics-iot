/**
 * Types for the vendored React Bits SplashCursor (JS-CSS variant).
 *
 * The upstream component ships as plain .jsx with no types. Rather than
 * turning on `allowJs` for the whole project — which would also stop
 * `tsc -b` from type-checking anything that file touches — it gets a
 * declaration file here, so call sites are checked normally and the
 * vendored source stays byte-identical to the registry.
 *
 * Source: https://reactbits.dev/r/SplashCursor-JS-CSS.json
 * Do not edit SplashCursor.jsx; re-run the registry install to update.
 */
export interface SplashCursorProps {
  SIM_RESOLUTION?: number;
  DYE_RESOLUTION?: number;
  CAPTURE_RESOLUTION?: number;
  DENSITY_DISSIPATION?: number;
  VELOCITY_DISSIPATION?: number;
  PRESSURE?: number;
  PRESSURE_ITERATIONS?: number;
  CURL?: number;
  SPLAT_RADIUS?: number;
  SPLAT_FORCE?: number;
  SHADING?: boolean;
  COLOR_UPDATE_SPEED?: number;
  BACK_COLOR?: { r: number; g: number; b: number };
  TRANSPARENT?: boolean;
  /**
   * Defaults to TRUE upstream, and when it is on `generateColor()`
   * returns a random hue and COLOR is ignored entirely. Pass false if
   * you want the COLOR prop to have any effect.
   */
  RAINBOW_MODE?: boolean;
  /** Hex string, e.g. "#55f7bc". Only used when RAINBOW_MODE is false. */
  COLOR?: string;
}

declare function SplashCursor(props: SplashCursorProps): import("react").ReactElement;

export default SplashCursor;
