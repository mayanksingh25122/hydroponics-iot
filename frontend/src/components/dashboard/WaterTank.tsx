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
  full: "from-emerald-400 via-emerald-500 to-green-600",
  ok: "from-emerald-400 via-emerald-500 to-green-600",
  low: "from-yellow-300 via-yellow-400 to-orange-400",
  critical: "from-red-400 via-red-500 to-red-700",
};

const stateGlow: Record<WaterLevelState, string> = {
  full: "shadow-[0_0_45px_rgba(16,185,129,.45)]",
  ok: "shadow-[0_0_35px_rgba(16,185,129,.35)]",
  low: "shadow-[0_0_35px_rgba(250,204,21,.35)]",
  critical: "shadow-[0_0_40px_rgba(239,68,68,.40)]",
};

const stateLabel: Record<WaterLevelState, string> = {
  full: "Tank Full",
  ok: "Water Level Good",
  low: "Refill Soon",
  critical: "Critical Level",
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
        "group flex flex-col gap-5 transition-all duration-300 hover:-translate-y-1",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <span className="text-xl">💧</span>
          <span className="font-semibold">Water Tank</span>
        </div>

        <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          LIVE
        </div>
      </div>

      <div className="mx-auto flex h-64 w-36 items-end justify-center rounded-[32px] border border-white/10 bg-white/5 p-2">

        <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#08140D]">

          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 bg-gradient-to-t transition-all duration-[1800ms]",
              stateColor[state],
              stateGlow[state]
            )}
            style={{
              height: `${shownPercent}%`,
            }}
          >
            <div className="absolute top-0 left-0 h-3 w-full animate-pulse bg-white/25 blur-sm" />
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center">

            <span className="text-5xl font-bold text-white drop-shadow-xl">
              {shownPercent}
            </span>

            <span className="text-lg text-emerald-300">
              %
            </span>

          </div>

        </div>

      </div>

      <div className="space-y-2">

        <div className="flex justify-between text-sm">

          <span className="text-white/60">
            Status
          </span>

          <span
            className={cn(
              "font-semibold",
              state === "critical"
                ? "text-red-400"
                : state === "low"
                ? "text-yellow-400"
                : "text-emerald-400"
            )}
          >
            {stateLabel[state]}
          </span>

        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">

          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r",
              stateColor[state]
            )}
            style={{
              width: `${shownPercent}%`,
              transition: "width 1.8s ease",
            }}
          />

        </div>

      </div>
    </GlassCard>
  );
}