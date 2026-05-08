"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, CheckSquare2, Plus, X } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_LABELS, formatHours } from "@/lib/utils";

interface ProjectMember {
  user: { id: string; name: string | null; email: string };
}

interface CalTask {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  project: { id: string; name: string; color: string };
  assignee: { id: string; name: string | null } | null;
}

interface CalTimeEntry {
  id: string;
  hours: number;
  date: string;
  description: string | null;
  task: {
    id: string;
    title: string;
    project: { id: string; name: string; color: string };
  };
}

interface Project {
  id: string;
  name: string;
  color: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [timeEntries, setTimeEntries] = useState<CalTimeEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [projects, setProjects] = useState<Project[]>([]);

  // new-task form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newStatus, setNewStatus] = useState("TODO");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newEstHours, setNewEstHours] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        if (data.length > 0) setNewProject(data[0].id);
      });
  }, []);

  // Reload members whenever the selected project changes
  useEffect(() => {
    if (!newProject) { setProjectMembers([]); return; }
    fetch(`/api/projects/${newProject}`)
      .then((r) => r.json())
      .then((p) => setProjectMembers(p.members ?? []));
  }, [newProject]);

  function loadCalendar() {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(({ tasks, timeEntries }) => {
        setTasks(tasks);
        setTimeEntries(timeEntries);
      });
  }

  useEffect(() => { loadCalendar(); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDay(null);
  }

  const tasksByDay = useMemo(() => {
    const map: Record<number, CalTask[]> = {};
    tasks.forEach((t) => {
      const d = new Date(t.dueDate).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(t);
    });
    return map;
  }, [tasks]);

  const entriesByDay = useMemo(() => {
    const map: Record<number, CalTimeEntry[]> = {};
    timeEntries.forEach((e) => {
      const d = new Date(e.date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [timeEntries]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const selectedTasks = selectedDay ? tasksByDay[selectedDay] ?? [] : [];
  const selectedEntries = selectedDay ? entriesByDay[selectedDay] ?? [] : [];
  const selectedHours = selectedEntries.reduce((s, e) => s + e.hours, 0);

  // Build ISO date string for the selected day
  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : "";

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject) return;
    setCreating(true);

    await fetch(`/api/projects/${newProject}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc || undefined,
        status: newStatus,
        priority: newPriority,
        dueDate: selectedDateStr,
        estimatedHours: newEstHours ? parseFloat(newEstHours) : null,
        assigneeId: newAssignee || null,
      }),
    });

    setNewTitle("");
    setNewDesc("");
    setNewStatus("TODO");
    setNewPriority("MEDIUM");
    setNewEstHours("");
    setNewAssignee("");
    setShowForm(false);
    setCreating(false);
    loadCalendar();
  }

  function openForm() {
    setShowForm(true);
    setNewTitle("");
    setNewDesc("");
    setNewStatus("TODO");
    setNewPriority("MEDIUM");
    setNewEstHours("");
    setNewAssignee("");
    if (projects.length > 0 && !newProject) setNewProject(projects[0].id);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 mt-1">Tasks due and time logged</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-36 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_NAMES.map((d) => (
                <div key={d} className="p-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} className="h-24 border-b border-r border-gray-50" />;
                const isToday =
                  day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                const isSelected = day === selectedDay;
                const dayTasks = tasksByDay[day] ?? [];
                const dayEntries = entriesByDay[day] ?? [];
                const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDay(day === selectedDay ? null : day);
                      setShowForm(false);
                    }}
                    className={`h-24 p-2 border-b border-r border-gray-50 text-left transition hover:bg-gray-50 ${
                      isSelected ? "bg-indigo-50 border-indigo-100" : ""
                    }`}
                  >
                    <span
                      className={`text-sm font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${
                        isToday
                          ? "bg-indigo-600 text-white"
                          : isSelected
                          ? "text-indigo-600"
                          : "text-gray-700"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className="w-full h-1.5 rounded-full"
                          style={{ backgroundColor: t.project.color }}
                          title={t.title}
                        />
                      ))}
                      {dayTasks.length > 2 && (
                        <p className="text-xs text-gray-400">+{dayTasks.length - 2}</p>
                      )}
                      {dayHours > 0 && (
                        <p className="text-xs text-indigo-500 font-medium">{formatHours(dayHours)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        <div className="space-y-3">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">
                  {MONTH_NAMES[month]} {selectedDay}
                </h2>
                <button
                  onClick={openForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> New task
                </button>
              </div>

              {/* Inline create form */}
              {showForm && (
                <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                      New task — due {MONTH_NAMES[month]} {selectedDay}
                    </p>
                    <button
                      onClick={() => setShowForm(false)}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={createTask} className="space-y-3">
                    {/* Title */}
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Task title"
                      required
                    />

                    {/* Description */}
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Description (optional)"
                      rows={2}
                    />

                    {/* Project */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Project</label>
                      <select
                        value={newProject}
                        onChange={(e) => { setNewProject(e.target.value); setNewAssignee(""); }}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        required
                      >
                        {projects.length === 0 && <option value="">No projects</option>}
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status + Priority */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          {Object.entries(STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Assignee + Est. hours */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Assignee</label>
                        <select
                          value={newAssignee}
                          onChange={(e) => setNewAssignee(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Unassigned</option>
                          {projectMembers.map(({ user }) => (
                            <option key={user.id} value={user.id}>
                              {user.name ?? user.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Est. hours</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={newEstHours}
                          onChange={(e) => setNewEstHours(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0.0"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creating || projects.length === 0}
                      className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {creating ? "Creating…" : "Create task"}
                    </button>
                    {projects.length === 0 && (
                      <p className="text-xs text-gray-400 text-center">
                        <Link href="/projects" className="text-indigo-600 hover:underline">Create a project</Link> first
                      </p>
                    )}
                  </form>
                </div>
              )}

              {selectedHours > 0 && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-700">
                      {formatHours(selectedHours)} logged
                    </span>
                  </div>
                </div>
              )}

              {selectedTasks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                    <CheckSquare2 className="w-3.5 h-3.5" /> Due tasks
                  </h3>
                  <div className="space-y-2">
                    {selectedTasks.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.project.id}/tasks/${t.id}`}
                        className="flex items-center gap-2 group"
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.project.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-gray-400">{t.project.name}</p>
                        </div>
                        <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntries.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Time entries
                  </h3>
                  <div className="space-y-2">
                    {selectedEntries.map((e) => (
                      <Link
                        key={e.id}
                        href={`/projects/${e.task.project.id}/tasks/${e.task.id}`}
                        className="flex items-center gap-2 group"
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.task.project.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition truncate">
                            {e.task.title}
                          </p>
                          {e.description && <p className="text-xs text-gray-400 truncate">{e.description}</p>}
                        </div>
                        <span className="ml-auto shrink-0 text-sm font-bold text-indigo-600">
                          {formatHours(e.hours)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!showForm && selectedTasks.length === 0 && selectedEntries.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-400 mb-3">Nothing on this day</p>
                  <button
                    onClick={openForm}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-medium hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add a task
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <p className="text-sm text-gray-400">Select a day to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
