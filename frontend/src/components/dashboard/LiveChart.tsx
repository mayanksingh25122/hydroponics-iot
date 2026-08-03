import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard } from "../common/GlassCard";
import type { SensorReading } from "@/types/sensor";

export type SensorNumericKey = "ph" | "tds" | "ec" | "water_temperature";

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
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function toChartPoints(data: SensorReading[], dataKey: SensorNumericKey): LiveChartPoint[] {
  return data.map((reading) => ({
    t: formatTime(reading.timestamp),
    value: reading[dataKey],
  }));
}

/**
 * Reusable live-updating chart card. Consumes raw SensorReading[] plus
 * a numeric field key so a single component can back all four metric
 * charts (Temperature, pH, EC, TDS) without duplicating chart config.
 */
export function LiveChart({
  title,
  color,
  unit,
  data,
  dataKey,
  icon = "📈",
  height = 220,
}: LiveChartProps) {
  const points = toChartPoints(data, dataKey);
  const gradientId = `canopy-livechart-${dataKey}`;

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-white/56">
        <span className="text-base leading-none">{icon}</span>
        <span>{title}</span>
      </div>

      {points.length === 0 ? (
        <div className="flex items-center justify-center text-white/40" style={{ height }}>
          No historical data
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="55%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                stroke="rgba(255,255,255,0.24)"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "rgba(11, 15, 13, 0.92)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.9)",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                formatter={(value) => [`${value ?? "—"}${unit ?? ""}`, "Value"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}