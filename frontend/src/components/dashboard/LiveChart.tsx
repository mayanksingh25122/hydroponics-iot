import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { GlassCard } from "../common/GlassCard";
import type { SensorReading } from "@/types/sensor";

export type SensorNumericKey =
  | "ph"
  | "tds"
  | "ec"
  | "water_temperature"
  | "water_level";

export interface LiveChartProps {
  title: string;
  color: string;
  unit?: string;
  data: SensorReading[];
  dataKey: SensorNumericKey;
  icon?: string;
  height?: number;
}

interface LiveChartPoint {
  t: string;
  value: number;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toChartPoints(
  data: SensorReading[],
  dataKey: SensorNumericKey
): LiveChartPoint[] {
  return data.map((reading) => ({
    t: formatTime(reading.timestamp),
    value: reading[dataKey],
  }));
}

export function LiveChart({
  title,
  color,
  unit,
  data,
  dataKey,
  icon = "📈",
  height = 260,
}: LiveChartProps) {
  const points = toChartPoints(data, dataKey);

  const gradientId = `gradient-${dataKey}`;

  return (
    <GlassCard className="group relative overflow-hidden transition-all duration-500 hover:-translate-y-1">

      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-400/5 opacity-0 transition duration-500 group-hover:opacity-100" />

      {/* Header */}
      <div className="relative mb-5 flex items-center gap-3">

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 shadow-[0_0_20px_rgba(34,197,94,.2)]">
          <span className="text-xl">{icon}</span>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">
            {title}
          </h3>

          <p className="text-xs text-emerald-200/60">
            Live Sensor History
          </p>
        </div>

      </div>

      {points.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 text-emerald-200/40"
          style={{ height }}
        >
          No Data Available
        </div>
      ) : (
        <div style={{ width: "100%", height }}>

          <ResponsiveContainer>

            <AreaChart
              data={points}
              margin={{
                top: 5,
                right: 10,
                left: -20,
                bottom: 5,
              }}
            >

              <defs>

                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="0%"
                    stopColor={color}
                    stopOpacity={0.45}
                  />

                  <stop
                    offset="60%"
                    stopColor={color}
                    stopOpacity={0.15}
                  />

                  <stop
                    offset="100%"
                    stopColor={color}
                    stopOpacity={0}
                  />

                </linearGradient>

              </defs>

              <CartesianGrid
                stroke="rgba(255,255,255,.06)"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="t"
                tick={{
                  fill: "#A7F3D0",
                  fontSize: 11,
                }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                hide
              />

              <Tooltip
                cursor={{
                  stroke: color,
                  strokeOpacity: 0.3,
                }}
                contentStyle={{
                  background: "#08140D",
                  border: "1px solid rgba(34,197,94,.15)",
                  borderRadius: "16px",
                  color: "#fff",
                  backdropFilter: "blur(12px)",
                }}
                labelStyle={{
                  color: "#86EFAC",
                }}
              formatter={(value) => [
  `${value}${unit ?? ""}`,
  title,
]}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={3}
                fill={`url(#${gradientId})`}
                animationDuration={800}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: color,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />

            </AreaChart>

          </ResponsiveContainer>

        </div>
      )}
    </GlassCard>
  );
}
