"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Shield, Users, FolderKanban, ListTodo, Clock,
  Plus, CheckCircle2, X,
} from "lucide-react";
import { formatHours, formatDate } from "@/lib/utils";

interface UserProject {
  id: string;
  name: string;
  color: string;
  role: string;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  projects: UserProject[];
  openTasks: number;
  estimatedHours: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignModal, setAssignModal] = useState<AdminUser | null>(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedRole, setSelectedRole] = useState("MEMBER");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "ADMIN") {
      redirect("/dashboard");
      return;
    }
    loadData();
  }, [session, status]);

  function loadData() {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([usersData, projectsData]) => {
      setUsers(Array.isArray(usersData) ? usersData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    });
  }

  function openAssignModal(user: AdminUser) {
    setAssignModal(user);
    setSelectedProject("");
    setSelectedRole("MEMBER");
    setError("");
    setSuccess("");
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignModal || !selectedProject) return;
    setAssigning(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/admin/users/${assignModal.id}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProject, role: selectedRole }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to assign");
      setAssigning(false);
      return;
    }

    setSuccess("User assigned to project");
    setAssigning(false);
    loadData();
    setTimeout(() => setAssignModal(null), 800);
  }

  if (status === "loading") {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
            <p className="text-gray-500 mt-0.5">Manage users, assign projects, and view workloads</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
          label="Total users"
          value={users.length}
        />
        <SummaryCard
          icon={<FolderKanban className="w-5 h-5 text-pink-600" />}
          bg="bg-pink-50"
          label="Total projects"
          value={projects.length}
        />
        <SummaryCard
          icon={<ListTodo className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-50"
          label="Open tasks"
          value={users.reduce((s, u) => s + u.openTasks, 0)}
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
          label="Est. hours"
          value={formatHours(users.reduce((s, u) => s + u.estimatedHours, 0))}
        />
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">All Users</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Projects</th>
              <th className="px-6 py-3 text-right">Open tasks</th>
              <th className="px-6 py-3 text-right">Est. hours</th>
              <th className="px-6 py-3 text-left">Joined</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    u.role === "ADMIN"
                      ? "bg-indigo-100 text-indigo-700"
                      : u.role === "VIEWER"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  {u.projects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.projects.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: p.color + "18", color: p.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">No projects</span>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className={`text-sm font-semibold ${u.openTasks > 0 ? "text-orange-500" : "text-gray-300"}`}>
                    {u.openTasks}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className={`text-sm font-semibold ${u.estimatedHours > 0 ? "text-indigo-600" : "text-gray-300"}`}>
                    {u.estimatedHours > 0 ? formatHours(u.estimatedHours) : "0h"}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-sm text-gray-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button
                    onClick={() => openAssignModal(u)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign project
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400">No users found</div>
        )}
      </div>

      {/* Assign project modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Assign project</h2>
                  <p className="text-sm text-gray-400">{assignModal.name ?? assignModal.email}</p>
                </div>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-1 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </div>
            )}

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select a project...</option>
                  {projects
                    .filter((p) => !assignModal.projects.some((up) => up.id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedProject}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {assigning ? "Assigning..." : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, bg, label, value }: {
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
