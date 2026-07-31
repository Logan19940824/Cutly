"use server";

import argon2 from "argon2";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

function authError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function register(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) authError("/register", "请输入有效邮箱，密码至少 8 位");

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) authError("/register", "该邮箱已注册");

  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: parsed.data.email, passwordHash, emailVerifiedAt: new Date() },
    });
    await tx.creditAccount.create({ data: { userId: created.id, available: 3 } });
    await tx.creditLedger.create({
      data: {
        userId: created.id, type: "SIGNUP_GRANT", availableDelta: 3, heldDelta: 0,
        referenceType: "USER", referenceId: created.id, idempotencyKey: `signup:${created.id}`,
      },
    });
    return created;
  });
  await createSession(user.id);
  redirect("/app");
}

export async function login(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) authError("/login", "邮箱或密码错误");
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || user.status !== "ACTIVE" || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
    authError("/login", "邮箱或密码错误");
  }
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
