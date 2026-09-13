import { useCallback, useEffect, useRef, useState } from "react";
import { TowerScene } from "@/marketing/scene/TowerScene";
import type { SceneTelemetry } from "@/marketing/scene/TowerScene";
import { observeScrollProgress } from "@/marketing/scene/useScrollStory";

/**
 * Feasibility prototype — NOT the homepage.
 *
 * Scope is deliberately the minimum needed to answer one question:
 * does scroll-driven rotation of the VERDA tower actually feel
 * world-class? Everything here is throwaway except the scene modules it
 * mounts, which are the real architecture.
 *
 * Lives at /lab/tower, outside every auth guard, and is additive — no
 * existing route, component or behaviour is touched by its presence.
 */

/** Minimal beats, present only to judge copy legibility over the render. */
const BEATS = [
  { at: 0, title: "A farm, anywhere.", body: "Controlled growing. Automated operation." },
  { at: 0.22, title: "Twenty-four growing sites.", body: "Arranged on a helix so every plant gets light." },
  { at: 0.46, title: "The room changes.", body: "The tower does not." },
  { at: 0.72, title: "The same system, at scale.", body: "One tower, or a glasshouse of them." },
  { at: 0.92, title: "Back where it started.", body: "Two full turns. Same face. Different plant." },
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export default function TowerLab() {
  const reducedMotion = useReducedMotion();
  const [worst, setWorst] = useState({ fps: 999, lag: 0 });
  const [perfFactor, setPerfFactor] = useState(1);

  // Telemetry is written straight to DOM nodes rather than React state:
  // at 4 Hz a setState would be survivable, but the habit of routing
  // frame-loop data through React is exactly what makes these scenes
  // stutter later, so the prototype models the right pattern.
  const fpsRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const rotationRef = useRef<HTMLSpanElement>(null);
  const lagRef = useRef<HTMLSpanElement>(null);
  const dprRef = useRef<HTMLSpanElement>(null);

  useEffect(() => observeScrollProgress(), []);

  const handleTelemetry = useCallback((telemetry: SceneTelemetry) => {
    if (fpsRef.current) fpsRef.current.textContent = telemetry.fps.toFixed(0);
    if (progressRef.current) progressRef.current.textContent = `${(telemetry.progress * 100).toFixed(1)}%`;
    if (rotationRef.current) rotationRef.current.textContent = `${telemetry.rotationDeg.toFixed(0)}°`;
    if (lagRef.current) lagRef.current.textContent = `${telemetry.lagDeg.toFixed(1)}°`;
    if (dprRef.current) dprRef.current.textContent = telemetry.dpr.toFixed(2);

    setWorst((previous) => {
      const fps = Math.min(previous.fps, telemetry.fps);
      const lag = Math.max(previous.lag, Math.abs(telemetry.lagDeg));
      return fps === previous.fps && lag === previous.lag ? previous : { fps, lag };
    });
  }, []);

  return (
    <div className="relative bg-verda-canvas">
      <TowerScene
        onTelemetry={handleTelemetry}
        onPerformanceChange={setPerfFactor}
        reducedMotion={reducedMotion}
      />

      {/* ---- Telemetry HUD. This is the prototype's actual deliverable. ---- */}
      <div className="pointer-events-none fixed left-4 top-4 z-20 rounded-verda-md border border-verda-line bg-verda-surface/85 px-3.5 py-3 font-verda-mono text-verda-label text-verda-ink-2 backdrop-blur-sm">
        <div className="mb-2 tracking-[0.14em] text-verda-ink-3">TOWER FEASIBILITY RIG</div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 tabular-nums">
          <dt>fps</dt>
          <dd className="text-right text-verda-ink"><span ref={fpsRef}>—</span></dd>
          <dt>scroll</dt>
          <dd className="text-right text-verda-ink"><span ref={progressRef}>—</span></dd>
          <dt>rotation</dt>
          <dd className="text-right text-verda-ink"><span ref={rotationRef}>—</span></dd>
          <dt>lag</dt>
          <dd className="text-right text-verda-ink"><span ref={lagRef}>—</span></dd>
          <dt>dpr</dt>
          <dd className="text-right text-verda-ink"><span ref={dprRef}>—</span></dd>
        </dl>
        <div className="mt-2 border-t border-verda-line-subtle pt-2">
          <div>min fps <span className="text-verda-ink">{worst.fps === 999 ? "—" : worst.fps.toFixed(0)}</span></div>
          <div>max lag <span className="text-verda-ink">{worst.lag.toFixed(1)}°</span></div>
          <div>perf factor <span className="text-verda-ink">{perfFactor.toFixed(2)}</span></div>
          <div>reduced motion <span className="text-verda-ink">{reducedMotion ? "ON" : "off"}</span></div>
        </div>
      </div>

      {/* ---- Scroll container. Copy sits in normal document flow; the
             canvas is fixed behind it. ---- */}
      <div className="relative z-10">
        {BEATS.map((beat) => (
          <section
            key={beat.at}
            className="flex h-[140vh] items-center"
            style={{ scrollMarginTop: 0 }}
          >
            <div className="w-full max-w-[1440px] mx-auto px-4 tablet:px-6 desktop:px-8">
              <div className="max-w-[24ch] rounded-verda-md bg-verda-canvas/55 p-4 backdrop-blur-[2px]">
                <h2 className="text-verda-h1 font-semibold tracking-tight text-verda-forest-900">
                  {beat.title}
                </h2>
                <p className="mt-2 text-verda-body text-verda-ink-2">{beat.body}</p>
              </div>
            </div>
          </section>
        ))}
        <div className="h-[40vh]" />
      </div>
    </div>
  );
}
