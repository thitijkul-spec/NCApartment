"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!name || !phone) return;

  const idCardNo = String(formData.get("idCardNo") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const emergencyContactName = String(formData.get("emergencyContactName") || "").trim();
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") || "").trim();

  await prisma.customer.create({
    data: {
      name,
      phone,
      idCardNo: idCardNo || null,
      address: address || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/bookings");
}

export async function addCustomerNote(formData: FormData) {
  const customerId = Number(formData.get("customerId"));
  const note = String(formData.get("note") || "").trim();
  if (!customerId || !note) return;

  await prisma.customerNote.create({ data: { customerId, note } });

  revalidatePath(`/customers/${customerId}`);
}
