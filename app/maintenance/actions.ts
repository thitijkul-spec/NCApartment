"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getDefaultBranch } from "../rooms/actions";

export async function createMaintenanceRequest(formData: FormData) {
  const branch = await getDefaultBranch();
  const roomId = Number(formData.get("roomId"));
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const priority = Number(formData.get("priority") || 3);
  if (!roomId || !description) return;

  await prisma.maintenanceRequest.create({
    data: {
      branchId: branch.id,
      roomId,
      description,
      category: category || null,
      priority,
      status: "new",
    },
  });

  revalidatePath("/maintenance");
}

export async function updateMaintenanceStatus(formData: FormData) {
  const id = Number(formData.get("requestId"));
  const status = String(formData.get("status") || "");
  const assignedTo = String(formData.get("assignedTo") || "").trim();
  const cost = formData.get("cost") ? Number(formData.get("cost")) : null;

  if (!id || !status) return;

  await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status,
      assignedTo: assignedTo || undefined,
      cost: cost ?? undefined,
      completedDate: status === "done" ? new Date() : undefined,
    },
  });

  if (status === "done" && cost) {
    const req = await prisma.maintenanceRequest.findUnique({ where: { id } });
    if (req) {
      await prisma.expense.create({
        data: {
          branchId: req.branchId,
          category: "ซ่อมบำรุง",
          description: `แจ้งซ่อม #${req.id} - ${req.description}`,
          amount: cost,
          expenseDate: new Date(),
        },
      });
    }
  }

  revalidatePath("/maintenance");
  revalidatePath("/expenses");
}
