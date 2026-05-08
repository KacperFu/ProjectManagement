"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Clock, Plus, Trash2, CheckCircle2, Circle,
  User, Calendar, Flag, Tag, Edit3, Check, X
} from "lucide-react";
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, formatHours, formatDate,
} from "@/lib/utils";
import { LogTimeModal } from "@/components/log-time-modal";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface TimeEntry {
  id: string;
  hours: number;
  date: string;
  description: string | null;
  user: { id: string; name: string | null };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  assignee: { id: string; name: string | null; email: string } | null;
  creator: { id: string; name: string | null };
  labels: { label: { id: string; name: string; color: string } }[];
  subtasks: Subtask[];
  timeEntries: TimeEntry[];
  project: {
    id: string;
    name: string;
    color: string;
    members: { role: string; user: { id: string; name: string | null; email: string } }[];
    labels: { id: string; name: string; color: string }[];
  };
}

export default function TaskDetailPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [newDesc, setNewDesc] = useState("");

  const loadTask = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/tasks/${taskId}`);
    const data = await res.json();
    setTask(data);
  }, [id, taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  async function updateTask(data: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setTask(updated);
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    await fetch(`/api/projects/${id}/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSubtask }),
    });
    setNewSubtask("");
    setAddingSubtask(false);
    loadTask();
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    await fetch(`/api/projects/${id}/tasks/${taskId}/subtasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtaskId, completed }),
    });
    loadTask();
  }

  async function deleteSubtask(subtaskId: string) {
    await fetch(`/api/projects/${id}/tasks/${taskId}/subtasks?subtaskId=${subtaskId}`, {
      method: "DELETE",
    });
    loadTask();
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalLogged = task.timeEntries.reduce((s, e) => s + e.hours, 0);
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/projects" className="hover:text-gray-600 transition">Projects</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/projects/${id}`} className="hover:text-gray-600 transition">
          {task.project.name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium line-clamp-1">{task.title}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            {editingTitle ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex-1 text-xl font-bold border-b-2 border-indigo-500 focus:outline-none pb-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { updateTask({ title: newTitle }); setEditingTitle(false); }
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
                <button onClick={() => { updateTask({ title: newTitle }); setEditingTitle(false); }}>
                  <Check className="w-5 h-5 text-green-500" />
                </button>
                <button onClick={() => setEditingTitle(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 group">
                <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
                <button
                  onClick={() => { setNewTitle(task.title); setEditingTitle(true); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition shrink-0"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              {task.labels.map(({ label }) => (
                <span
                  key={label.id}
                  className="px-2 py-1 rounded-md text-xs font-medium"
                  style={{ backgroundColor: label.color + "20", color: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Description</h3>
                {!editingDesc && (
                  <button
                    onClick={() => { setNewDesc(task.description ?? ""); setEditingDesc(true); }}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={4}
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { updateTask({ description: newDesc }); setEditingDesc(false); }}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDesc(false)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {task.description || <span className="text-gray-400 italic">No description</span>}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                Subtasks
                {task.subtasks.length > 0 && (
                  <span className="text-xs text-gray-400 font-normal">
                    {completedSubtasks}/{task.subtasks.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setAddingSubtask(true)}
                className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {task.subtasks.length > 0 && (
              <div className="mb-3">
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${task.subtasks.length ? (completedSubtasks / task.subtasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-3 group">
                  <button onClick={() => toggleSubtask(subtask.id, !subtask.completed)}>
                    {subtask.completed ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-green-500" size={18} />
                    ) : (
                      <Circle className="w-4.5 h-4.5 text-gray-300 hover:text-gray-400" size={18} />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${subtask.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(subtask.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {addingSubtask && (
              <form onSubmit={addSubtask} className="flex gap-2 mt-3">
                <input
                  autoFocus
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Subtask title"
                />
                <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
                  Add
                </button>
                <button type="button" onClick={() => setAddingSubtask(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Time Logged
                <span className="text-xs text-gray-400 font-normal">
                  {formatHours(totalLogged)} total
                  {task.estimatedHours && ` / ${formatHours(task.estimatedHours)} est.`}
                </span>
              </h3>
              <button
                onClick={() => setShowLogTime(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Log time
              </button>
            </div>

            {task.estimatedHours && (
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all ${totalLogged > task.estimatedHours ? "bg-red-400" : "bg-indigo-500"}`}
                  style={{ width: `${Math.min((totalLogged / task.estimatedHours) * 100, 100)}%` }}
                />
              </div>
            )}

            {task.timeEntries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No time logged yet</p>
            ) : (
              <div className="space-y-2">
                {task.timeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {entry.user.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{entry.user.name}</p>
                      {entry.description && (
                        <p className="text-xs text-gray-400 truncate">{entry.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-indigo-600">{formatHours(entry.hours)}</p>
                      <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm">Details</h3>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Flag className="w-3.5 h-3.5" /> Status
              </label>
              <select
                value={task.status}
                onChange={(e) => updateTask({ status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Flag className="w-3.5 h-3.5" /> Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => updateTask({ priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <User className="w-3.5 h-3.5" /> Assignee
              </label>
              <select
                value={task.assignee?.id ?? ""}
                onChange={(e) => updateTask({ assigneeId: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Unassigned</option>
                {task.project.members.map(({ user }) => (
                  <option key={user.id} value={user.id}>{user.name ?? user.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Calendar className="w-3.5 h-3.5" /> Due date
              </label>
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) => updateTask({ dueDate: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Clock className="w-3.5 h-3.5" /> Estimated hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={task.estimatedHours ?? ""}
                onChange={(e) => updateTask({ estimatedHours: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Tag className="w-3.5 h-3.5" /> Labels
              </label>
              <div className="flex flex-wrap gap-1.5">
                {task.project.labels.map((label) => {
                  const active = task.labels.some((l) => l.label.id === label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => {
                        const newIds = active
                          ? task.labels.filter((l) => l.label.id !== label.id).map((l) => l.label.id)
                          : [...task.labels.map((l) => l.label.id), label.id];
                        updateTask({ labelIds: newIds });
                      }}
                      className="px-2 py-1 rounded-md text-xs font-medium transition-opacity"
                      style={{
                        backgroundColor: label.color + "20",
                        color: label.color,
                        opacity: active ? 1 : 0.4,
                        outline: active ? `1.5px solid ${label.color}` : "none",
                      }}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-3">Time Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Logged</span>
                <span className="font-semibold text-indigo-600">{formatHours(totalLogged)}</span>
              </div>
              {task.estimatedHours && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estimated</span>
                    <span className="font-medium text-gray-700">{formatHours(task.estimatedHours)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining</span>
                    <span className={`font-medium ${totalLogged > task.estimatedHours ? "text-red-500" : "text-green-600"}`}>
                      {formatHours(Math.max(0, task.estimatedHours - totalLogged))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showLogTime && (
        <LogTimeModal
          projectId={id}
          taskId={taskId}
          onClose={() => setShowLogTime(false)}
          onLogged={loadTask}
        />
      )}
    </div>
  );
}
