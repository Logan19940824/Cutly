"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const grantInput = z.object({
  userId: z.string().uuid(),
  planCode: z.enum(["PRO_MONTHLY", "PRO_YEARLY"]),
  reason: z.string().trim().min(2).max(200),
});
const revokeInput = z.object({ membershipId: z.string().uuid(), reason: z.string().trim().min(2).max(200) });

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/app");
  return user;
}

export async function grantMembership(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = grantInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin?view=users&error=请选择套餐并填写操作原因");
  const plan = await db.plan.findFirst({ where: { code: parsed.data.planCode, active: true } });
  if (!plan) redirect("/admin?view=users&error=套餐不存在或已停用");

  const now = new Date();
  const orderNo = `ADMIN-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await db.$transaction(async (tx) => {
    await tx.membership.updateMany({ where: { userId: parsed.data.userId, status: "ACTIVE" }, data: { status: "REVOKED" } });
    const order = await tx.order.create({
      data: {
        orderNo, userId: parsed.data.userId, planId: plan.id, amount: 0, currency: plan.currency,
        planSnapshot: { code: plan.code, name: plan.name, listedPrice: plan.priceAmount, source: "ADMIN_GRANT" },
        status: "PAID", paidAt: now,
      },
    });
    const membership = await tx.membership.create({
      data: {
        userId: parsed.data.userId, planCode: plan.code, startsAt: now,
        endsAt: new Date(now.getTime() + plan.durationDays * 86_400_000), status: "ACTIVE", sourceOrderId: order.id,
        entitlementSnapshot: plan.entitlements as Prisma.InputJsonValue,
      },
    });
    await tx.creditAccount.upsert({
      where: { userId: parsed.data.userId },
      create: { userId: parsed.data.userId, available: plan.credits },
      update: { available: { increment: plan.credits }, version: { increment: 1 } },
    });
    await tx.creditLedger.create({
      data: {
        userId: parsed.data.userId, type: "PLAN_GRANT", availableDelta: plan.credits, heldDelta: 0,
        referenceType: "MEMBERSHIP", referenceId: membership.id, idempotencyKey: `admin-plan-grant:${membership.id}`,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: admin.id, action: "MEMBERSHIP_GRANTED", targetType: "USER", targetId: parsed.data.userId,
        reason: parsed.data.reason, metadata: { membershipId: membership.id, planCode: plan.code, credits: plan.credits, orderNo },
      },
    });
  });
  revalidatePath("/admin");
  redirect("/admin?view=users&notice=会员已开通，套餐额度已发放");
}

export async function revokeMembership(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = revokeInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin?view=users&error=请填写撤销原因");
  const membership = await db.membership.findUnique({ where: { id: parsed.data.membershipId } });
  if (!membership) redirect("/admin?view=users&error=会员记录不存在");

  await db.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: membership.id }, data: { status: "REVOKED" } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: admin.id, action: "MEMBERSHIP_REVOKED", targetType: "USER", targetId: membership.userId,
        reason: parsed.data.reason, metadata: { membershipId: membership.id, planCode: membership.planCode },
      },
    });
  });
  revalidatePath("/admin");
  redirect("/admin?view=users&notice=会员已撤销，剩余额度未扣回");
}
