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
  const statusFilter = searchParams.get("status"); // optional: DONE | IN_PROGRESS | etc.

  const userProjects = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });
  const allowedProjectIds = userProjects.map((p) => p.projectId);

  // Resolve task IDs up-front so we avoid nested relation filters in where
  const taskIds = await prisma.task
    .findMany({
      where: {
        projectId:
          projectId && allowedProjectIds.includes(projectId)
            ? projectId
            : { in: allowedProjectIds },
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const where = {
    taskId: { in: taskIds },
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
          },
        }
      : {}),
  };

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          estimatedHours: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}
