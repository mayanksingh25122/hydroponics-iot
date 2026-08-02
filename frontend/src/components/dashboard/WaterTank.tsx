import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { GlassCard } from "../common/GlassCard";

export type WaterLevelState = "full" | "ok" | "low" | "critical";

export interface WaterTankProps {
  percent: number;
  state: WaterLevelState;
  className?: string;
}

const stateColor: Record<WaterLevelState, string> = {
  full: "from-canopy-primary to-canopy-accent",
  ok: "from-canopy-primary to-canopy-accent",
  low: "from-canopy-warn to-canopy-secondary",
  critical: "from-canopy-error to-red-400",
};

const stateLabel: Record<WaterLevelState, string> = {
  full: "Full",
  ok: "Good",
  low: "Low — Refill Soon",
  critical: "Critical — Refill Now",
};

const ANIMATION_DURATION = 1800;
const UPDATE_THRESHOLD = 5;
const FORCE_UPDATE_TIME = 60000;

function easeInOut(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function WaterTank({
  percent,
  state,
  className,
}: WaterTankProps) {
  const target = Math.max(0, Math.min(100, percent));

  const [displayPercent, setDisplayPercent] = useState(target);

  const currentRef = useRef(target);
  const lastAnimatedRef = useRef(target);
  const lastAnimationTimeRef = useRef(Date.now());

  useEffect(() => {
    const diff = Math.abs(target - lastAnimatedRef.current);
    const elapsed =
      Date.now() - lastAnimationTimeRef.current;

    if (diff < UPDATE_THRESHOLD && elapsed < FORCE_UPDATE_TIME)
      return;

    const start = currentRef.current;
    const change = target - start;

    let frame: number;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min(
        (time - startTime) / ANIMATION_DURATION,
        1
      );

      const eased = easeInOut(progress);

      const value = start + change * eased;

      currentRef.current = value;
      setDisplayPercent(value);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    lastAnimatedRef.current = target;
    lastAnimationTimeRef.current = Date.now();

    return () => cancelAnimationFrame(frame);
  }, [target]);

  const shownPercent = Math.round(displayPercent);

  return (
    <GlassCard
      className={cn(
        "flex flex-col gap-4",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-white/60">
        <span className="text-base">💧</span>
        <span>Water Tank</span>
      </div>

      <div className="relative h-44 overflow-hidden rounded-canopy-sm border border-white/10 bg-white/[0.03]">

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t",
            stateColor[state]
          )}
          style={{
            height: `${shownPercent}%`,
            transition: "height 1.8s ease-in-out",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-white drop-shadow-lg">
            {shownPercent}%
          </span>
        </div>
      </div>

      <div
        className={cn(
          "text-center text-sm font-medium",
          state === "critical"
            ? "text-canopy-error"
            : state === "low"
            ? "text-canopy-warn"
            : "text-white/70"
        )}
      >
        {stateLabel[state]}
      </div>
    </GlassCard>
  );
}