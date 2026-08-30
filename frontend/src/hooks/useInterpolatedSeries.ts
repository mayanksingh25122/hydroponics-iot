import { useEffect, useRef, useState } from "react";

export interface UseInterpolatedSeriesOptions {
  /**
   * How quickly displayed values catch up to target values, in ms.
   * This is a time constant (τ), not a fixed per-frame step, so the
   * ease behaves identically regardless of the display's refresh
   * rate. Defaults to the blueprint's "data" motion token (800ms).
   */
  smoothingMs?: number;
  /**
   * If the gap between two target updates exceeds this, the next
   * update snaps instead of easing — never interpolate across a
   * genuine telemetry gap and invent data that never arrived.
   * Defaults to 15s (comfortably above the app's 5s poll interval).
   */
  gapThresholdMs?: number;
  /**
   * Freezes the animation loop in place — display stops advancing
   * toward target. Pair with dimming the chart in the consumer, per
   * the blueprint's stale-telemetry treatment.
   */
  frozen?: boolean;
  /** Disables easing entirely; display snaps straight to target. */
  reducedMotion?: boolean;
}

export interface UseInterpolatedSeriesResult {
  /** Smoothed values — safe to feed directly into a chart every render. */
  values: number[];
  /** True if the most recent target update snapped (gap or reduced motion) rather than eased. */
  didSnap: boolean;
}

const DEFAULT_SMOOTHING_MS = 800;
const DEFAULT_GAP_THRESHOLD_MS = 15_000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Eases a numeric series toward `target` on requestAnimationFrame,
 * instead of letting a chart re-draw itself from zero on every poll.
 *
 * This is the mechanism, not a chart: it returns plain numbers, so
 * any consumer (Recharts area, a metric-tile counter, a gauge) can
 * feed `values` in and render normally with animation disabled on
 * the chart library's side (e.g. Recharts' `isAnimationActive={false}`).
 *
 * Not wired into any existing chart in this task — LiveChart.tsx is
 * unchanged. A future task adopts this hook and sets
 * isAnimationActive={false} on its Recharts elements.
 *
 * Usage note: `target` is compared by re-running this effect on every
 * new array identity, so memoize it (useMemo / a stable query-derived
 * array) rather than mapping inline in JSX — otherwise every render
 * looks like a fresh telemetry update.
 */
export function useInterpolatedSeries(
  target: number[],
  options: UseInterpolatedSeriesOptions = {}
): UseInterpolatedSeriesResult {
  const {
    smoothingMs = DEFAULT_SMOOTHING_MS,
    gapThresholdMs = DEFAULT_GAP_THRESHOLD_MS,
    frozen = false,
    reducedMotion,
  } = options;

  const [values, setValues] = useState<number[]>(() => [...target]);
  const [didSnap, setDidSnap] = useState(false);

  const displayRef = useRef<number[]>([...target]);
  const targetRef = useRef<number[]>([...target]);
  // Timestamp is read inside the effect below, never during render —
  // `performance.now()` is an impure call and must not run at render time.
  const lastTargetUpdateRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  // A new target array arrived (new poll result). Decide snap vs ease.
  useEffect(() => {
    const now = performance.now();
    const elapsedSinceLastUpdate =
      lastTargetUpdateRef.current === null ? Infinity : now - lastTargetUpdateRef.current;
    lastTargetUpdateRef.current = now;

    const reduce = reducedMotion ?? prefersReducedMotion();
    const lengthChanged = target.length !== targetRef.current.length;
    const gapped = elapsedSinceLastUpdate > gapThresholdMs;
    const shouldSnap = reduce || lengthChanged || gapped;

    targetRef.current = [...target];

    if (shouldSnap) {
      displayRef.current = [...target];
      setValues([...target]);
      setDidSnap(true);
    } else {
      setDidSnap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // The animation loop itself: eases display -> target every frame,
  // using elapsed wall-clock time so the result is frame-rate
  // independent (correct at 60Hz, 120Hz, or a throttled background tab).
  useEffect(() => {
    if (frozen) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    const tau = Math.max(1, smoothingMs);

    function tick(now: number) {
      const last = lastFrameRef.current ?? now;
      const dt = now - last;
      lastFrameRef.current = now;

      const display = displayRef.current;
      const tgt = targetRef.current;
      let changed = false;
      const factor = 1 - Math.exp(-dt / tau);

      const next = display.map((v, i) => {
        const t = tgt[i] ?? v;
        const nv = v + (t - v) * factor;
        if (Math.abs(nv - v) > 0.0005) changed = true;
        return nv;
      });

      displayRef.current = next;
      if (changed) setValues(next);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
    };
  }, [frozen, smoothingMs]);

  return { values, didSnap };
}
