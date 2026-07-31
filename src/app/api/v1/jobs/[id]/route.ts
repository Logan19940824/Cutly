import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const job = await db.imageJob.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, status: true, params: true, errorMessage: true, createdAt: true, finishedAt: true,
      outputs: { select: { asset: { select: { id: true, kind: true, mimeType: true, width: true, height: true, byteSize: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json({ job });
}
