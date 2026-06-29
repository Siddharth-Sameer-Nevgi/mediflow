"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Activity,
  Loader2,
} from "lucide-react";

interface AnalyticsData {
  totalPatientsToday: number;
  completedToday: number;
  noShowsToday: number;
  avgWaitMins: number;
  noShowRate: number;
  departmentStats: { department: string; count: number }[];
  weeklyTrend: { date: string; count: number }[];
}

const CHART_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const statCards = [
    {
      label: "Patients Today",
      value: data?.totalPatientsToday ?? 0,
      icon: Users,
      color: "sky",
      sub: `${data?.completedToday ?? 0} completed`,
    },
    {
      label: "Avg Wait Time",
      value: `${data?.avgWaitMins ?? 0} min`,
      icon: Clock,
      color: "emerald",
      sub: "Across all queues",
    },
    {
      label: "No-Show Rate",
      value: `${data?.noShowRate ?? 0}%`,
      icon: AlertTriangle,
      color: data?.noShowRate && data.noShowRate > 20 ? "red" : "amber",
      sub: `${data?.noShowsToday ?? 0} no-shows today`,
    },
    {
      label: "Queue Utilization",
      value: `${Math.round(((data?.completedToday ?? 0) / Math.max(data?.totalPatientsToday ?? 1, 1)) * 100)}%`,
      icon: Activity,
      color: "violet",
      sub: "Completion rate",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Real-time hospital operations overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-${card.color}-500/20 flex items-center justify-center mb-3`}
            >
              <card.icon className={`w-5 h-5 text-${card.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-slate-400 text-xs font-medium mt-0.5">
              {card.label}
            </div>
            <div className="text-slate-600 text-xs mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            Patient Volume (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.weeklyTrend ?? []}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "12px",
                  color: "#f1f5f9",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="count"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                name="Patients"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Utilization */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            Department Distribution
          </h3>
          {data?.departmentStats.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No data for today yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data?.departmentStats ?? []}
                  dataKey="count"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={3}
                >
                  {(data?.departmentStats ?? []).map((_, index) => (
                    <Cell
                      key={index}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Department Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
        <h3 className="text-white font-semibold text-sm mb-4">
          Department Breakdown — Today
        </h3>
        {data?.departmentStats.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">
            No appointments yet today
          </p>
        ) : (
          <div className="space-y-3">
            {data?.departmentStats
              .sort((a, b) => b.count - a.count)
              .map((dept, i) => {
                const max = Math.max(
                  ...(data?.departmentStats.map((d) => d.count) ?? [1])
                );
                const pct = Math.round((dept.count / max) * 100);
                return (
                  <div key={dept.department} className="flex items-center gap-4">
                    <div className="w-32 shrink-0">
                      <p className="text-slate-300 text-sm font-medium truncate">
                        {dept.department}
                      </p>
                    </div>
                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="w-12 text-right text-slate-400 text-sm font-medium shrink-0">
                      {dept.count}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
