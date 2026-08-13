"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getDefaultBranch } from "../rooms/actions";

export async function createExpense(formData: FormData) {
  const branch = await getDefaultBranch();
  const category = String(formData.get("category") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const expenseDate = new Date(String(formData.get("expenseDate")));

  if (!category || !amount || !expenseDate.getTime()) return;

  await prisma.expense.create({
    data: {
      branchId: branch.id,
      category,
      description: description || null,
      amount,
      expenseDate,
    },
  });

  revalidatePath("/expenses");
}
