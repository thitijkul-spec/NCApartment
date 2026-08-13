"use server";

import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function bootstrapOwner(formData: FormData) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) return;

  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !username || password.length < 4) return;

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: hashPassword(password),
      role: "owner",
      canManageUsers: true,
      permissions: "A,B,C,D,F,G,H,M,L",
    },
  });

  await createSession(user.id);
  redirect("/");
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  redirect("/");
}
