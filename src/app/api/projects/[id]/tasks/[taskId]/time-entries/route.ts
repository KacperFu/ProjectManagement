import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  hours: z.number().min(0.1).max(24),
  date: z.string(),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId, taskId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { hours, date, description } = createSchema.parse(body);

  const entry = await prisma.timeEntry.create({
    data: {
      hours,
      date: new Date(date),
      description,
      taskId,
      userId: session.user.id,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(entry);
}
