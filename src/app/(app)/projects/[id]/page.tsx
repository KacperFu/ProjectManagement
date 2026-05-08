"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Plus, Search, Filter, ChevronRight, Clock, CheckSquare2,
  Circle, ArrowUpCircle, AlertCircle, Tag, Trash2, Users
} from "lucide-react";
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS,
  formatHours, formatDate,
} from "@/lib/utils";
import { AddMemberModal } from "@/components/add-member-modal";
import { CreateLabelModal } from "@/components/create-label-modal";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  assignee: { id: string; name: string | null; email: string } | null;
  labels: { label: { id: string; name: string; color: string } }[];
  _count: { subtasks: number; timeEntries: number };
}

interface Project {
  id: string;
  name: string;
  color: string;
  description: string | null;
  members: { role: string; user: { id: string; name: string | null; email: string } }[];
  labels: { id: string; name: string; color: string }[];
  _count: { tasks: number };
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  TODO: <Circle className="w-4 h-4 text-slate-400" />,
  IN_PROGRESS: <ArrowUpCircle className="w-4 h-4 text-blue-500" />,
  IN_REVIEW: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  DONE: <CheckSquare2 className="w-4 h-4 text-green-500" />,
};

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("TODO");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDue, setNewDue] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setProject(data);
  }, [id]);

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/projects/${id}/tasks?${params}`);
    const data = await res.json();
    setTasks(data);
  }, [id, search, statusFilter]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        status: newStatus,
        priority: newPriority,
        dueDate: newDue || null,
        assigneeId: newAssignee || null,
      }),
    });
    const task = await res.json();
    setTasks([task, ...tasks]);
    setShowCreate(false);
    setNewTitle("");
    setNewStatus("TODO");
    setNewPriority("MEDIUM");
    setNewDue("");
    setNewAssignee("");
    setCreating(false);
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/projects/${id}/tasks/${taskId}`, { method: "DELETE" });
    setTasks(tasks.filter((t) => t.id !== taskId));
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/projects" className="hover:text-gray-600 transition">Projects</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{project.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: project.color }} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-500 text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateLabel(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <Tag className="w-4 h-4" /> Labels
          </button>
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <Users className="w-4 h-4" /> Members
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> New task
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <CheckSquare2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tasks yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first task to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-12 text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3 border-b border-gray-100">
            <div className="col-span-5">Task</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Priority</div>
            <div className="col-span-2">Due / Est.</div>
            <div className="col-span-1"></div>
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="grid grid-cols-12 items-center px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 group transition"
            >
              <div className="col-span-5 flex items-center gap-3 min-w-0">
                {STATUS_ICONS[task.status]}
                <div className="min-w-0">
                  <Link
                    href={`/projects/${id}/tasks/${task.id}`}
                    className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition truncate block"
                  >
                    {task.title}
                  </Link>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {task.labels.map(({ label }) => (
                      <span
                        key={label.id}
                        className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: label.color + "20", color: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
              <div className="col-span-2">
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              </div>
              <div className="col-span-2 text-xs text-gray-500 space-y-0.5">
                {task.dueDate && <p>{formatDate(task.dueDate)}</p>}
                {task.estimatedHours && (
                  <p className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3 h-3" /> {formatHours(task.estimatedHours)}
                  </p>
                )}
                {task._count.timeEntries > 0 && (
                  <p className="text-indigo-500">{task._count.timeEntries} entries</p>
                )}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-5">Create task</h2>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Task title"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
                  <input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assignee</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {project.members.map(({ user }) => (
                      <option key={user.id} value={user.id}>{user.name ?? user.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddMember && (
        <AddMemberModal
          projectId={id}
          onClose={() => setShowAddMember(false)}
          onAdded={loadProject}
        />
      )}
      {showCreateLabel && (
        <CreateLabelModal
          projectId={id}
          onClose={() => setShowCreateLabel(false)}
          onCreated={loadProject}
        />
      )}
    </div>
  );
}
