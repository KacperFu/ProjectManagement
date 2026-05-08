"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Download, Clock, FolderKanban, CheckCircle2,
  Circle, ArrowUpCircle, AlertCircle, ListTodo,
} from "lucide-react";
import { formatHours, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";

interface TimeEntryRaw {
  id: string;
  hours: number;
  date: string;
  description: string | null;
  user: { id: string; name: string | null; email: string };
  task: {
    id: string;
    title: string;
    status: string;
    estimatedHours: number | null;
    project: { id: string; name: string; color: string };
  };
}

interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  estimatedHours: number | null;
  loggedHours: number;
  timeEntryCount: number;
  subtaskCount: number;
  project: { id: string; name: string; color: string };
  assignee: { id: string; name: string | null; email: string } | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

const CHART_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6",
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  TODO:        <Circle className="w-3.5 h-3.5 text-slate-400" />,
  IN_PROGRESS: <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500" />,
  IN_REVIEW:   <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />,
  DONE:        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
};

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().split("T")[0],
    end: sun.toISOString().split("T")[0],
  };
}

export default function ReportsPage() {
  const [entries, setEntries] = useState<TimeEntryRaw[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ready, setReady] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");

  useEffect(() => {
    const bounds = getWeekBounds();
    setFrom(bounds.start);
    setTo(bounds.end);
    setWeekStart(bounds.start);
    setWeekEnd(bounds.end);
    setReady(true);
  }, []);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams({ from, to });
    if (projectFilter) params.set("projectId", projectFilter);
    if (statusFilter) params.set("status", statusFilter);

    Promise.all([
      fetch(`/api/reports?${params}`).then((r) => r.json()),
      fetch(`/api/reports/tasks?${params}`).then((r) => r.json()),
    ]).then(([entriesData, tasksData]) => {
      setEntries(Array.isArray(entriesData) ? entriesData : []);
      setTasks(tasksData.tasks ?? []);
      setByStatus(tasksData.byStatus ?? {});
    });
  }, [ready, from, to, projectFilter, statusFilter]);

  const totalHours = useMemo(() => entries.reduce((s, e) => s + e.hours, 0), [entries]);
  const totalTasks = Object.values(byStatus).reduce((s, v) => s + v, 0);
  const doneTasks = byStatus["DONE"] ?? 0;

  const byPerson = useMemo(() => {
    const map: Record<string, { name: string; hours: number }> = {};
    entries.forEach((e) => {
      const k = e.user.id;
      if (!map[k]) map[k] = { name: e.user.name ?? e.user.email, hours: 0 };
      map[k].hours += e.hours;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const byProject = useMemo(() => {
    const map: Record<string, { name: string; hours: number; color: string }> = {};
    entries.forEach((e) => {
      const k = e.task.project.id;
      if (!map[k]) map[k] = { name: e.task.project.name, hours: 0, color: e.task.project.color };
      map[k].hours += e.hours;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const d = new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      map[d] = (map[d] ?? 0) + e.hours;
    });
    return Object.entries(map)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(2)) }));
  }, [entries]);

  const statusChartData = useMemo(() =>
    Object.entries(byStatus).map(([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      count,
      status,
    })), [byStatus]);

  const completedWithHours = useMemo(
    () => tasks.filter((t) => t.status === "DONE" && t.loggedHours > 0),
    [tasks]
  );

  function exportCSV() {
    const rows = [
      ["Date", "User", "Project", "Task", "Status", "Hours", "Description"],
      ...entries.map((e) => [
        new Date(e.date).toLocaleDateString(),
        e.user.name ?? e.user.email,
        e.task.project.name,
        e.task.title,
        STATUS_LABELS[e.task.status] ?? e.task.status,
        e.hours.toString(),
        e.description ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskflow-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Activity overview for your projects</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={entries.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button
            onClick={() => { setFrom(weekStart); setTo(weekEnd); }}
            className="self-end px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            This week
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Project</label>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Task status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<ListTodo className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-50"
          label="Tasks created" value={totalTasks} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} bg="bg-green-50"
          label="Tasks done" value={doneTasks} />
        <StatCard icon={<Clock className="w-5 h-5 text-violet-600" />} bg="bg-violet-50"
          label="Hours logged" value={formatHours(totalHours)} />
        <StatCard icon={<FolderKanban className="w-5 h-5 text-pink-600" />} bg="bg-pink-50"
          label="Projects" value={byProject.length || projects.length} />
      </div>

      {/* Task status breakdown */}
      {totalTasks > 0 && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Tasks by status</h2>
            <div className="space-y-3">
              {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const count = byStatus[status] ?? 0;
                const pct = totalTasks ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 text-gray-700">
                        {STATUS_ICONS[status]}
                        {label}
                      </span>
                      <span className="text-gray-500 font-medium">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            status === "DONE" ? "#22c55e"
                            : status === "IN_PROGRESS" ? "#3b82f6"
                            : status === "IN_REVIEW" ? "#eab308"
                            : "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {statusChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Status distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" outerRadius={65}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={11}>
                    {statusChartData.map((entry, idx) => (
                      <Cell key={idx} fill={
                        entry.status === "DONE" ? "#22c55e"
                        : entry.status === "IN_PROGRESS" ? "#3b82f6"
                        : entry.status === "IN_REVIEW" ? "#eab308"
                        : "#94a3b8"
                      } />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* All tasks table */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All tasks</h2>
            <span className="text-xs text-gray-400">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                <th className="px-6 py-3 text-left">Task</th>
                <th className="px-6 py-3 text-left">Project</th>
                <th className="px-6 py-3 text-left">Assignee</th>
                <th className="px-6 py-3 text-left">Priority</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Hours logged</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      {STATUS_ICONS[t.status]}
                      <span className="text-sm text-gray-800">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.project.color }} />
                      {t.project.name}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-500">
                    {t.assignee ? (t.assignee.name ?? t.assignee.email) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${PRIORITY_COLORS[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      t.status === "DONE" ? "bg-green-100 text-green-700"
                      : t.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700"
                      : t.status === "IN_REVIEW" ? "bg-yellow-100 text-yellow-700"
                      : "bg-slate-100 text-slate-600"
                    }`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {t.loggedHours > 0 ? (
                      <span className="text-sm font-semibold text-indigo-600">{formatHours(t.loggedHours)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">no time logged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Completed tasks with hours */}
      {completedWithHours.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-green-800">
              Completed &amp; tracked — {formatHours(completedWithHours.reduce((s, t) => s + t.loggedHours, 0))} total
            </h2>
            <span className="ml-auto text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">
              {completedWithHours.length} task{completedWithHours.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {completedWithHours.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-green-100">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{t.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.project.color }} />
                  {t.project.name}
                </span>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-green-700">{formatHours(t.loggedHours)}</span>
                  {t.estimatedHours && (
                    <span className="text-xs text-gray-400 ml-1.5">/ {formatHours(t.estimatedHours)} est.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hours over time */}
      {byDay.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Hours logged over time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDay} barSize={20}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v) => [formatHours(Number(v)), "Hours"]} />
              <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hours by person */}
      {byPerson.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Hours by person</h2>
          <div className="space-y-3">
            {byPerson.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{p.name}</span>
                  <span className="text-gray-500">{formatHours(p.hours)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${(p.hours / (byPerson[0]?.hours || 1)) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalTasks === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <ListTodo className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tasks found in this period</p>
          <p className="text-gray-400 text-sm mt-1">Try widening the date range or changing filters</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, bg, label, value }: {
  icon: React.ReactNode; bg: string; label: string; value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
