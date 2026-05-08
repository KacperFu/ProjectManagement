import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatHours } from "@/lib/utils";
import Link from "next/link";
import { Clock, FolderKanban, CheckCircle2, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [projectCount, taskStats, recentTimeEntries, urgentTasks] = await Promise.all([
    prisma.projectMember.count({ where: { userId } }),
    prisma.task.groupBy({
      by: ["status"],
      where: {
        project: { members: { some: { userId } } },
      },
      _count: true,
    }),
    prisma.timeEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      include: { task: { include: { project: true } } },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "DONE" },
        dueDate: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      },
      include: { project: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  const totalHoursThisWeek = await prisma.timeEntry.aggregate({
    _sum: { hours: true },
    where: {
      userId,
      date: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const doneTasks = taskStats.find((s) => s.status === "DONE")?._count ?? 0;
  const inProgressTasks = taskStats.find((s) => s.status === "IN_PROGRESS")?._count ?? 0;
  const todoTasks = taskStats.find((s) => s.status === "TODO")?._count ?? 0;
  const weekHours = totalHoursThisWeek._sum.hours ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {session!.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FolderKanban className="w-5 h-5 text-indigo-600" />}
          bg="bg-indigo-50"
          label="Projects"
          value={projectCount}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-emerald-600" />}
          bg="bg-emerald-50"
          label="Hours this week"
          value={formatHours(weekHours)}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="In progress"
          value={inProgressTasks + todoTasks}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-orange-600" />}
          bg="bg-orange-50"
          label="Done this sprint"
          value={doneTasks}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Time Entries</h2>
          {recentTimeEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No time logged yet</p>
          ) : (
            <div className="space-y-3">
              {recentTimeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.task.project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {entry.task.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.task.project.name} &middot;{" "}
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 shrink-0">
                    {formatHours(entry.hours)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/reports"
            className="block mt-4 text-xs text-indigo-600 font-medium hover:underline"
          >
            View all time entries →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Due Soon</h2>
          {urgentTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No urgent tasks</p>
          ) : (
            <div className="space-y-3">
              {urgentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.projectId}/tasks/${task.id}`}
                  className="flex items-center gap-3 group"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: task.project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 truncate transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-400">{task.project.name}</p>
                  </div>
                  {task.dueDate && (
                    <span className="text-xs text-red-500 shrink-0 font-medium">
                      {new Date(task.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/projects"
            className="block mt-4 text-xs text-indigo-600 font-medium hover:underline"
          >
            View all tasks →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
