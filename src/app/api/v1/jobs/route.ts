import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const jobs = await db.imageJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, status: true, params: true, errorMessage: true, createdAt: true, finishedAt: true,
      outputs: { select: { asset: { select: { id: true, kind: true, mimeType: true, width: true, height: true, byteSize: true } } } },
    },
  });
  return NextResponse.json({ jobs });
}
