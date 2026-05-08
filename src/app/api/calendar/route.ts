import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const to = searchParams.get("to") ?? new Date(Date.now() + 60 * 86400000).toISOString();

  const [tasks, timeEntries] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { members: { some: { userId: session.user.id } } },
        dueDate: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        task: {
          include: { project: { select: { id: true, name: true, color: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({ tasks, timeEntries });
}
