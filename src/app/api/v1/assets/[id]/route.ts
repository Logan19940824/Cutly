import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createReadUrl } from "@/lib/oss";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  const asset = await db.imageAsset.findFirst({
    where: { id, deletedAt: null, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const extension = asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType.split("/")[1] || "png";
  const url = await createReadUrl(asset.storageKey, download ? `cutly-${id.slice(0, 8)}.${extension}` : undefined);
  return NextResponse.redirect(url);
}
