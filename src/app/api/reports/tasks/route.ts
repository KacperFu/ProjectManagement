import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const statusFilter = searchParams.get("status");

  const userProjects = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });
  const allowedProjectIds = userProjects.map((p) => p.projectId);

  const resolvedProjectIds =
    projectId && allowedProjectIds.includes(projectId)
      ? [projectId]
      : allowedProjectIds;

  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: resolvedProjectIds },
      ...(statusFilter ? { status: statusFilter as never } : {}),
      // Only apply date filter when explicitly provided
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, email: true } },
      _count: { select: { timeEntries: true, subtasks: true } },
      timeEntries: { select: { hours: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    loggedHours: t.timeEntries.reduce((s, e) => s + e.hours, 0),
    project: t.project,
    assignee: t.assignee,
    timeEntryCount: t._count.timeEntries,
    subtaskCount: t._count.subtasks,
  }));

  const byStatus = enriched.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ tasks: enriched, byStatus });
}
