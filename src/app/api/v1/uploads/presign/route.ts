import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { createUploadUrl } from "@/lib/oss";

const input = z.object({ fileName: z.string().min(1).max(200), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]), size: z.number().int().positive().max(10 * 1024 * 1024) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "仅支持 JPG、PNG、WebP、HEIC，最大 10MB" }, { status: 400 });
  const ext = parsed.data.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "img";
  const key = `temp/${user.id}/${randomUUID()}.${ext}`;
  try {
    const uploadUrl = await createUploadUrl(key, parsed.data.mimeType);
    return NextResponse.json({ key, uploadUrl, expiresIn: 300 });
  } catch (error) {
    if (error instanceof Error && error.message === "OSS_NOT_CONFIGURED") return NextResponse.json({ error: "OSS 尚未配置，请联系管理员" }, { status: 503 });
    throw error;
  }
}
