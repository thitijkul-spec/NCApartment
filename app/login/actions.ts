"use server";

import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, setCurrentBuildingId, verifyPassword } from "@/lib/auth";
import { seedNewBuildingDefaults } from "@/lib/building-seed";
import { redirect } from "next/navigation";

export async function bootstrapOwner(formData: FormData) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) return;

  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const buildingName = String(formData.get("buildingName") || "").trim();
  if (!name || !username || password.length < 4 || !buildingName) return;

  const { user, building } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        username,
        passwordHash: hashPassword(password),
        role: "owner",
        permissions: "",
      },
    });
    const building = await tx.building.create({
      data: {
        name: buildingName,
        settings: { create: {} },
      },
    });
    return { user, building };
  });

  await seedNewBuildingDefaults(building.id);
  await createSession(user.id);
  await setCurrentBuildingId(building.id);
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
