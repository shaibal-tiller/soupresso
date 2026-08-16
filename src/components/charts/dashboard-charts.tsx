"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatTaka } from "@/lib/format";

const gridColor = "var(--chart-grid)";
const axisColor = "var(--chart-axis)";
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
  color: "var(--foreground)",
};

const tickStyle = { fill: axisColor, fontSize: 11 };

export function DailySalesTrendChart({ data }: { data: { date: string; cashAmount: number; bankAmount: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: axisColor }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${v}`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [formatTaka(Number(value)), name === "cashAmount" ? "Cash" : "Bank"]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend
          formatter={(value) => (value === "cashAmount" ? "Cash" : "Bank")}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        <Bar dataKey="cashAmount" stackId="sales" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="bankAmount" stackId="sales" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyComparisonChart({ data }: { data: { month: string; totalSales: number; totalExpense: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={tickStyle} axisLine={{ stroke: axisColor }} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [formatTaka(Number(value)), name === "totalSales" ? "Sales" : "Expenses"]}
        />
        <Legend
          formatter={(value) => (value === "totalSales" ? "Sales" : "Expenses")}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        <Bar dataKey="totalSales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="totalExpense" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpenseBreakdownChart({ data }: { data: { accountName: string; amount: number }[] }) {
  const chartData = data.map((d) => ({ ...d, shortName: d.accountName.replace(/\s*\(.*\)/, "") }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 42)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="shortName" tick={tickStyle} axisLine={false} tickLine={false} width={150} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTaka(Number(value))} />
        <Bar dataKey="amount" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopItemsChart({ data }: { data: { name: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} width={110} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTaka(Number(value))} />
        <Bar dataKey="revenue" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashTrendLine({ data }: { data: { date: string; totalAmount: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: axisColor }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTaka(Number(value))} />
        <Line type="monotone" dataKey="totalAmount" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
