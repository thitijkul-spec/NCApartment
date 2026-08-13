"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, destroySession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ALL_MODULES = ["A", "B", "C", "D", "F", "G", "H", "M", "L"];

export async function createStaffUser(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !username || password.length < 4) return;

  const canManageUsers = formData.get("canManageUsers") === "on";
  const permissions = ALL_MODULES.filter((m) => formData.get(`perm_${m}`) === "on").join(",");

  await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: hashPassword(password),
      role: "staff",
      canManageUsers,
      permissions,
    },
  });

  revalidatePath("/users");
}

export async function updateUser(formData: FormData) {
  const id = Number(formData.get("userId"));
  if (!id) return;

  const active = formData.get("active") === "on";
  const canManageUsers = formData.get("canManageUsers") === "on";
  const permissions = ALL_MODULES.filter((m) => formData.get(`perm_${m}`) === "on").join(",");

  await prisma.user.update({
    where: { id },
    data: { active, canManageUsers, permissions },
  });

  revalidatePath("/users");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
