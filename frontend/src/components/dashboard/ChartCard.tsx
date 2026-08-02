import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { GlassCard } from "../common/GlassCard";

export interface ChartPoint {
  t: string;
  value: number;
}

export interface ChartCardProps {
  title: string;
  icon?: string;
  data: ChartPoint[];
  unit?: string;
  height?: number;
}

export function ChartCard({ title, icon = "📈", data, unit, height = 220 }: ChartCardProps) {
  const gradientId = `canopy-gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-white/56">
        <span className="text-base leading-none">{icon}</span>
        <span>{title}</span>
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                <stop offset="55%" stopColor="#34D399" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(value) => [`${value ?? "—"}${unit ?? ""}`, ""]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#34D399"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
