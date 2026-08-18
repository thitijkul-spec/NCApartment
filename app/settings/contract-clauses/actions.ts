"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addClause(formData: FormData) {
  const { building } = await requireAccess("setting");

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title || !body) return { error: "กรอกหัวข้อและเนื้อหาภาษาไทยอย่างน้อย" };

  const maxOrder = await prisma.contractClauseTemplate.aggregate({
    where: { buildingId: building.id },
    _max: { order: true },
  });

  await prisma.contractClauseTemplate.create({
    data: {
      buildingId: building.id,
      order: (maxOrder._max.order ?? 0) + 1,
      title,
      titleEn: String(formData.get("titleEn") || "").trim() || null,
      body,
      bodyEn: String(formData.get("bodyEn") || "").trim() || null,
      isDefaultIncluded: formData.get("isDefaultIncluded") === "on",
    },
  });

  revalidatePath("/settings/contract-clauses");
}

export async function updateClause(formData: FormData) {
  const { building } = await requireAccess("setting");
  const id = Number(formData.get("id"));
  if (!id) return;
  const existing = await prisma.contractClauseTemplate.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบข้อสัญญา" };

  await prisma.contractClauseTemplate.update({
    where: { id },
    data: {
      title: String(formData.get("title") || "").trim(),
      titleEn: String(formData.get("titleEn") || "").trim() || null,
      body: String(formData.get("body") || "").trim(),
      bodyEn: String(formData.get("bodyEn") || "").trim() || null,
      isDefaultIncluded: formData.get("isDefaultIncluded") === "on",
    },
  });

  revalidatePath("/settings/contract-clauses");
}

export async function deleteClause(formData: FormData) {
  const { building } = await requireAccess("setting");
  const id = Number(formData.get("id"));
  if (!id) return;
  const existing = await prisma.contractClauseTemplate.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบข้อสัญญา" };
  await prisma.contractClauseTemplate.delete({ where: { id } });
  revalidatePath("/settings/contract-clauses");
}

export async function moveClause(formData: FormData) {
  const { building } = await requireAccess("setting");
  const id = Number(formData.get("id"));
  const direction = String(formData.get("direction"));
  if (!id) return;

  const clauses = await prisma.contractClauseTemplate.findMany({
    where: { buildingId: building.id },
    orderBy: { order: "asc" },
  });
  const index = clauses.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= clauses.length) return;

  await prisma.$transaction([
    prisma.contractClauseTemplate.update({
      where: { id: clauses[index].id },
      data: { order: clauses[swapWith].order },
    }),
    prisma.contractClauseTemplate.update({
      where: { id: clauses[swapWith].id },
      data: { order: clauses[index].order },
    }),
  ]);

  revalidatePath("/settings/contract-clauses");
}
