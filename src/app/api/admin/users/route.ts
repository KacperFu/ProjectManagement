import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      projectMembers: {
        include: {
          project: { select: { id: true, name: true, color: true } },
        },
      },
      assignedTasks: {
        where: { status: { not: "DONE" } },
        select: { id: true, estimatedHours: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const enriched = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    projects: u.projectMembers.map((pm) => ({
      ...pm.project,
      role: pm.role,
    })),
    openTasks: u.assignedTasks.length,
    estimatedHours: u.assignedTasks.reduce(
      (sum, t) => sum + (t.estimatedHours ?? 0),
      0
    ),
  }));

  return NextResponse.json(enriched);
}
