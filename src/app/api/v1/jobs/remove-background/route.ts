import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { inspectObject } from "@/lib/oss";
import { getCurrentUser } from "@/lib/session";
import { enqueueImageJob } from "@/lib/queue";

const input = z.object({ storageKey: z.string().min(1), idempotencyKey: z.string().uuid(), width: z.number().int().min(64).max(6000), height: z.number().int().min(64).max(6000), fit: z.enum(["contain", "cover"]), format: z.enum(["png", "webp", "jpeg"]), background: z.string().regex(/^(transparent|#[0-9a-fA-F]{6})$/), cropToSubject: z.boolean().optional().default(true) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success || !parsed.data.storageKey.startsWith(`temp/${user.id}/`)) return NextResponse.json({ error: "任务参数无效" }, { status: 400 });

  const existing = await db.imageJob.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: parsed.data.idempotencyKey } } });
  if (existing) return NextResponse.json({ job: existing });

  let object;
  try { object = await inspectObject(parsed.data.storageKey); } catch { return NextResponse.json({ error: "未找到上传图片" }, { status: 400 }); }
  if (object.size <= 0 || object.size > 10 * 1024 * 1024 || !object.type.startsWith("image/")) return NextResponse.json({ error: "图片文件无效" }, { status: 400 });

  try {
    const job = await db.$transaction(async (tx) => {
      const changed = await tx.creditAccount.updateMany({ where: { userId: user.id, available: { gte: 1 } }, data: { available: { decrement: 1 }, held: { increment: 1 }, version: { increment: 1 } } });
      if (!changed.count) throw new Error("NO_CREDITS");
      const asset = await tx.imageAsset.create({ data: { userId: user.id, kind: "ORIGINAL", storageKey: parsed.data.storageKey, mimeType: object.type, byteSize: object.size } });
      const created = await tx.imageJob.create({ data: { userId: user.id, type: "REMOVE_BACKGROUND", sourceAssetId: asset.id, status: "QUEUED", params: parsed.data, provider: "aliyun-imageseg", idempotencyKey: parsed.data.idempotencyKey } });
      await tx.creditLedger.create({ data: { userId: user.id, type: "JOB_HOLD", availableDelta: -1, heldDelta: 1, referenceType: "IMAGE_JOB", referenceId: created.id, idempotencyKey: `job-hold:${created.id}` } });
      return created;
    });
    try { await enqueueImageJob(job.id); } catch {
      await db.$transaction(async (tx) => {
        await tx.imageJob.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "QUEUE_UNAVAILABLE", errorMessage: "任务队列暂不可用" } });
        await tx.creditAccount.update({ where: { userId: user.id }, data: { available: { increment: 1 }, held: { decrement: 1 }, version: { increment: 1 } } });
        await tx.creditLedger.create({ data: { userId: user.id, type: "JOB_RELEASE", availableDelta: 1, heldDelta: -1, referenceType: "IMAGE_JOB", referenceId: job.id, idempotencyKey: `job-release:${job.id}` } });
      });
      return NextResponse.json({ error: "任务队列暂不可用，额度已退回" }, { status: 503 });
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CREDITS") return NextResponse.json({ error: "抠图额度不足，请升级会员" }, { status: 402 });
    throw error;
  }
}
