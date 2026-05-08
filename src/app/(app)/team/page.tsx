import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Clock, CheckSquare2, FolderKanban, AlertCircle } from "lucide-react";
import { formatHours } from "@/lib/utils";

export default async function TeamPage() {
  const session = await auth();
  const userId = session!.user.id;

  const myProjects = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = myProjects.map((p) => p.projectId);

  if (projectIds.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        </div>
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No projects yet</p>
          <p className="text-gray-400 text-sm mt-1">Create a project and add teammates to see the team view</p>
        </div>
      </div>
    );
  }

  // All members across shared projects
  const memberships = await prisma.projectMember.findMany({
    where: { projectId: { in: projectIds } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  // Deduplicate: one entry per user, collect all projects
  const userMap: Record<string, {
    user: (typeof memberships)[0]["user"];
    projects: { id: string; name: string; color: string }[];
    role: string;
  }> = {};

  memberships.forEach((m) => {
    if (!userMap[m.userId]) {
      userMap[m.userId] = { user: m.user, projects: [], role: m.role };
    }
    userMap[m.userId].projects.push(m.project);
  });

  const uniqueMembers = Object.values(userMap);
  const memberIds = uniqueMembers.map((m) => m.user.id);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Resolve task IDs first so groupBy can filter on taskId directly
  // (Prisma groupBy silently ignores nested relation filters)
  const projectTaskIds = await prisma.task
    .findMany({ where: { projectId: { in: projectIds } }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  const [hoursThisMonth, hoursAllTime, assignedTasks, openTasks, estimatedByUser] =
    await Promise.all([
      prisma.timeEntry.groupBy({
        by: ["userId"],
        where: {
          userId: { in: memberIds },
          taskId: { in: projectTaskIds },
          date: { gte: startOfMonth },
        },
        _sum: { hours: true },
      }),
      prisma.timeEntry.groupBy({
        by: ["userId"],
        where: {
          userId: { in: memberIds },
          taskId: { in: projectTaskIds },
        },
        _sum: { hours: true },
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          id: { in: projectTaskIds },
          assigneeId: { in: memberIds },
        },
        _count: true,
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          id: { in: projectTaskIds },
          assigneeId: { in: memberIds },
          status: { not: "DONE" },
        },
        _count: true,
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          id: { in: projectTaskIds },
          assigneeId: { in: memberIds },
          estimatedHours: { not: null },
        },
        _sum: { estimatedHours: true },
      }),
    ]);

  // Total tasks in the projects (for context)
  const totalTaskCount = await prisma.task.count({
    where: { projectId: { in: projectIds } },
  });

  const monthHoursMap: Record<string, number> = {};
  hoursThisMonth.forEach((h) => { monthHoursMap[h.userId] = h._sum.hours ?? 0; });

  const allTimeHoursMap: Record<string, number> = {};
  hoursAllTime.forEach((h) => { allTimeHoursMap[h.userId] = h._sum.hours ?? 0; });

  const assignedMap: Record<string, number> = {};
  assignedTasks.forEach((t) => { if (t.assigneeId) assignedMap[t.assigneeId] = t._count; });

  const openMap: Record<string, number> = {};
  openTasks.forEach((t) => { if (t.assigneeId) openMap[t.assigneeId] = t._count; });

  const estimatedMap: Record<string, number> = {};
  estimatedByUser.forEach((t) => { if (t.assigneeId) estimatedMap[t.assigneeId] = t._sum.estimatedHours ?? 0; });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-gray-500 mt-1">
          {uniqueMembers.length} member{uniqueMembers.length !== 1 ? "s" : ""} &middot; {totalTaskCount} task{totalTaskCount !== 1 ? "s" : ""} across {projectIds.length} project{projectIds.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniqueMembers.map(({ user, projects, role }) => {
          const monthHours = monthHoursMap[user.id] ?? 0;
          const allHours = allTimeHoursMap[user.id] ?? 0;
          const estimated = estimatedMap[user.id] ?? 0;
          const assigned = assignedMap[user.id] ?? 0;
          const open = openMap[user.id] ?? 0;

          return (
            <div key={user.id} className="bg-white rounded-xl border border-gray-100 p-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-base font-bold shrink-0">
                  {user.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{user.name ?? "Unknown"}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 capitalize">
                  {role.toLowerCase()}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-indigo-600">
                    {formatHours(monthHours)}
                    {monthHours > 0 && estimated > 0 && (
                      <span className="text-xs text-gray-400 font-normal"> / {formatHours(estimated)}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> logged this month
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-violet-600">{formatHours(estimated)}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> estimated total
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-gray-700">{assigned}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <CheckSquare2 className="w-3 h-3" /> assigned
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className={`text-lg font-bold ${open > 0 ? "text-orange-500" : "text-gray-400"}`}>{open}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> open
                  </p>
                </div>
              </div>

              {/* Projects */}
              <div>
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                  <FolderKanban className="w-3 h-3" /> Projects
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {projects.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ backgroundColor: p.color + "18", color: p.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                  ))}
                  {projects.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
                      +{projects.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
