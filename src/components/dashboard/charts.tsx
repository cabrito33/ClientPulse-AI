"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SprintMetric } from "@/data/types";

const axis = {
  stroke: "#928b82",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e3ddd3",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(18,23,27,0.25)",
  color: "#12171b",
} as const;

export function CompletedBySprintChart({
  data,
  height = 220,
}: {
  data: SprintMetric[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }} barCategoryGap="28%">
          <CartesianGrid stroke="#e3ddd3" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="sprint" {...axis} tick={{ fill: "#928b82", fontSize: 11 }} />
          <YAxis {...axis} tick={{ fill: "#928b82", fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(18,23,27,0.04)" }}
            contentStyle={tooltipStyle}
            labelFormatter={(l) => `Sprint ${String(l).replace("S", "")}`}
            formatter={(value) => [`${value} tarefas`, "Concluídas"]}
          />
          <Bar dataKey="completed" name="Concluídas" fill="#0e5a52" radius={[5, 5, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlannedVsCompletedChart({ data }: { data: SprintMetric[] }) {
  return (
    <div style={{ height: 210 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="doneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0e5a52" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#0e5a52" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e3ddd3" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="sprint" {...axis} tick={{ fill: "#928b82", fontSize: 11 }} />
          <YAxis {...axis} tick={{ fill: "#928b82", fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="completed"
            name="Concluídas"
            stroke="#0e5a52"
            strokeWidth={2}
            fill="url(#doneGrad)"
          />
          <Line
            type="monotone"
            dataKey="planned"
            name="Planeadas"
            stroke="#cfc7ba"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
